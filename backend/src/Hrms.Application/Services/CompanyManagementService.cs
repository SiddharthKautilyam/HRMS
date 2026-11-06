using System.Net;
using Hrms.Application.Abstractions.Notifications;
using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.Common.Tenancy;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hrms.Application.Services;

/// <summary>
/// Super Admin company management. Owns the idempotent provisioning workflow: create the
/// company record, provision a dedicated database, bootstrap the schema, create the admin
/// login and send the activation invitation.
/// </summary>
public sealed class CompanyManagementService : ICompanyManagementService
{
    private const string StepName = "database-name";
    private const string StepCreate = "create-database";
    private const string StepBootstrap = "bootstrap";
    private const string StepInvitation = "invitation";
    private const string StepEmail = "email";
    private const string StepActivate = "activate";

    private readonly IMasterUnitOfWork _master;
    private readonly ITenantDatabaseService _tenantDb;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailSender _emailSender;
    private readonly AppOptions _app;
    private readonly ILogger<CompanyManagementService> _logger;

    public CompanyManagementService(
        IMasterUnitOfWork master,
        ITenantDatabaseService tenantDb,
        IPasswordHasher passwordHasher,
        IEmailSender emailSender,
        IOptions<AppOptions> app,
        ILogger<CompanyManagementService> logger)
    {
        _master = master;
        _tenantDb = tenantDb;
        _passwordHasher = passwordHasher;
        _emailSender = emailSender;
        _app = app.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<CompanyListItemDto>> ListAsync(string? search, CancellationToken ct = default)
    {
        var companies = await _master.Companies.ListAsync(search, ct);
        var invitations = await _master.Invitations.ToListAsync(_master.Invitations.Query(), ct);
        var latestByCompany = invitations
            .GroupBy(i => i.CompanyId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.CreatedAtUtc).First());

        return companies
            .Select(c =>
            {
                latestByCompany.TryGetValue(c.Id, out var invitation);
                return ToListItem(c, invitation);
            })
            .ToList();
    }

    public async Task<CompanyDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        var invitation = await _master.Invitations.GetLatestForCompanyAsync(id, ct);
        var logs = await _master.ProvisioningLogs.ToListAsync(
            _master.ProvisioningLogs.Query().Where(l => l.CompanyId == id).OrderBy(l => l.OccurredAtUtc),
            ct);

        return ToDetail(company, invitation, logs);
    }

    public async Task<CompanyProvisioningResultDto> CreateAsync(CreateCompanyRequest request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (name.Length == 0)
        {
            throw new ValidationException("Company name is required.");
        }

        var existing = await _master.Companies.ListAsync(null, ct);
        var codes = new HashSet<string>(existing.Select(c => c.Code), StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(request.Code))
        {
            var requested = TenantNaming.SlugifyCode(request.Code);
            if (codes.Contains(requested))
            {
                throw new ConflictException($"Company code '{requested}' is already in use.");
            }
        }

        var code = TenantNaming.GenerateCode(request.Code, name, codes.Contains);

        var company = new Company
        {
            Name = name,
            Code = code,
            AdminFullName = request.AdminFullName.Trim(),
            AdminEmail = request.AdminEmail.Trim().ToLowerInvariant(),
            ContactName = request.ContactName?.Trim(),
            ContactEmail = request.ContactEmail?.Trim(),
            TimeZone = request.TimeZone?.Trim(),
            Status = CompanyStatus.Provisioning,
        };

        await _master.Companies.AddAsync(company, ct);
        await _master.SaveChangesAsync(ct);

        return await ProvisionAsync(company, ct);
    }

    public async Task<CompanyDetailDto> UpdateAsync(Guid id, UpdateCompanyRequest request, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        if (!string.IsNullOrWhiteSpace(request.Name)) company.Name = request.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.AdminFullName)) company.AdminFullName = request.AdminFullName.Trim();
        if (request.ContactName is not null) company.ContactName = request.ContactName.Trim();
        if (request.ContactEmail is not null) company.ContactEmail = request.ContactEmail.Trim();
        if (request.TimeZone is not null) company.TimeZone = request.TimeZone.Trim();

        _master.Companies.Update(company);
        await _master.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task<CompanyDetailDto> ActivateAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        if (string.IsNullOrWhiteSpace(company.DatabaseName))
        {
            throw new ValidationException("The company database has not been provisioned yet. Run the provisioning workflow first.");
        }

        company.Status = CompanyStatus.Active;
        company.SuspendedAtUtc = null;
        company.LastProvisioningError = null;
        _master.Companies.Update(company);
        await _master.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task<CompanyDetailDto> SuspendAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        if (company.IsDefault)
        {
            throw new ValidationException("The default company cannot be suspended.");
        }

        company.Status = CompanyStatus.Suspended;
        company.SuspendedAtUtc = DateTime.UtcNow;
        _master.Companies.Update(company);
        await _master.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task<CompanyProvisioningResultDto> RetryProvisioningAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        return await ProvisionAsync(company, ct);
    }

    public async Task<ResendInvitationResponse> ResendInvitationAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        if (string.IsNullOrWhiteSpace(company.DatabaseName))
        {
            throw new ValidationException("The company database has not been provisioned yet.");
        }

        await ExpirePendingInvitationsAsync(company.Id, ct);

        var (invitation, token) = await CreateInvitationAsync(company, isResend: true, ct);
        var activationUrl = BuildActivationUrl(token, company.Code);
        await DeliverInvitationAsync(company, invitation, activationUrl, ct);

        return new ResendInvitationResponse(
            invitation.Status.ToString(),
            invitation.Status == InvitationStatus.Failed ? null : activationUrl,
            invitation.LastError);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _master.Companies.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Company", id);

        if (company.IsDefault)
        {
            throw new ValidationException("The default company cannot be deleted.");
        }

        if (!string.IsNullOrWhiteSpace(company.DatabaseName))
        {
            try
            {
                await _tenantDb.DropDatabaseAsync(company.DatabaseName, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to drop tenant database {DbName} while deleting company {CompanyId}.", company.DatabaseName, id);
            }
        }

        var invitations = await _master.Invitations.ToListAsync(
            _master.Invitations.Query().Where(i => i.CompanyId == id), ct);
        foreach (var inv in invitations)
        {
            _master.Invitations.Remove(inv);
        }

        var logs = await _master.ProvisioningLogs.ToListAsync(
            _master.ProvisioningLogs.Query().Where(l => l.CompanyId == id), ct);
        foreach (var log in logs)
        {
            _master.ProvisioningLogs.Remove(log);
        }

        _master.Companies.Remove(company);
        await _master.SaveChangesAsync(ct);
    }

    // ── Provisioning workflow ──

    private async Task<CompanyProvisioningResultDto> ProvisionAsync(Company company, CancellationToken ct)
    {
        var dbReady = false;
        var adminCreated = false;
        string? activationUrl = null;
        CompanyInvitation? invitation = null;

        try
        {
            company.Status = CompanyStatus.Provisioning;
            _master.Companies.Update(company);
            await _master.SaveChangesAsync(ct);

            // 1. Database name — generated once, never regenerated on retry.
            if (string.IsNullOrWhiteSpace(company.DatabaseName))
            {
                var others = await _master.Companies.ListAsync(null, ct);
                var taken = new HashSet<string>(
                    others.Where(c => c.Id != company.Id && c.DatabaseName is not null).Select(c => c.DatabaseName!),
                    StringComparer.OrdinalIgnoreCase);

                company.DatabaseName = TenantNaming.GenerateDatabaseName(company.Name, company.Id, taken.Contains);
                _master.Companies.Update(company);
                await _master.SaveChangesAsync(ct);
            }

            await LogAsync(company.Id, StepName, true, company.DatabaseName, ct);

            // 2. Create the database and apply the schema migrations only (idempotent).
            await _tenantDb.ProvisionSchemaAsync(company.DatabaseName!, ct);
            dbReady = await _tenantDb.DatabaseExistsAsync(company.DatabaseName!, ct);
            await LogAsync(company.Id, StepCreate, dbReady, dbReady ? "Schema applied." : "Database not reachable.", ct);

            if (!dbReady)
            {
                throw new InvalidOperationException("The tenant database could not be created.");
            }

            // 3. Bootstrap schema defaults + the initial admin login.
            var bootstrap = new TenantBootstrap(
                company.Name,
                company.AdminEmail,
                company.AdminFullName,
                // Unusable random password — the account only becomes usable after activation.
                _passwordHasher.Hash($"invite:{Guid.NewGuid():N}:{Guid.NewGuid():N}"));

            await _tenantDb.BootstrapAsync(company.DatabaseName!, bootstrap, ct);
            adminCreated = await _tenantDb.FindUserByEmailAsync(company.DatabaseName!, company.AdminEmail, ct) is not null;
            await LogAsync(company.Id, StepBootstrap, adminCreated, adminCreated ? "Admin login created." : "Admin login missing.", ct);

            if (!adminCreated)
            {
                throw new InvalidOperationException("The company administrator login could not be created.");
            }

            // 4. Invitation (reuses any pending one so retries are safe).
            var created = await CreateInvitationAsync(company, isResend: false, ct);
            invitation = created.Invitation;
            activationUrl = BuildActivationUrl(created.Token, company.Code);
            await LogAsync(company.Id, StepInvitation, true, invitation.Status.ToString(), ct);

            // 5. Email (best-effort: never blocks the company becoming active).
            await DeliverInvitationAsync(company, invitation, activationUrl, ct);

            // 6. Mark active only once the database + admin + invitation exist.
            company.Status = CompanyStatus.Active;
            company.ProvisionedAtUtc = DateTime.UtcNow;
            company.LastProvisioningError = null;
            _master.Companies.Update(company);
            await _master.SaveChangesAsync(ct);
            await LogAsync(company.Id, StepActivate, true, "Company activated.", ct);

            return new CompanyProvisioningResultDto(
                company.Id,
                company.Status.ToString(),
                company.DatabaseName,
                dbReady,
                adminCreated,
                invitation.Status.ToString(),
                activationUrl,
                null);
        }
        catch (Exception ex)
        {
            var message = Sensitive.Redact(ex.Message);
            _logger.LogError(ex, "Provisioning failed for company {CompanyId}", company.Id);

            company.Status = CompanyStatus.Failed;
            company.LastProvisioningError = message;
            _master.Companies.Update(company);
            await _master.SaveChangesAsync(ct);
            await LogAsync(company.Id, "provisioning", false, message, ct);

            return new CompanyProvisioningResultDto(
                company.Id,
                company.Status.ToString(),
                company.DatabaseName,
                dbReady,
                adminCreated,
                invitation?.Status.ToString() ?? InvitationStatus.Pending.ToString(),
                null,
                message);
        }
    }

    private async Task<(CompanyInvitation Invitation, string Token)> CreateInvitationAsync(
        Company company,
        bool isResend,
        CancellationToken ct)
    {
        var token = TenantNaming.CreateToken();

        var invitation = isResend ? null : await _master.Invitations.GetOpenForCompanyAsync(company.Id, ct);
        if (invitation is null)
        {
            invitation = new CompanyInvitation { CompanyId = company.Id, ResentCount = isResend ? 1 : 0 };
            await _master.Invitations.AddAsync(invitation, ct);
        }
        else if (isResend)
        {
            invitation.ResentCount++;
        }

        invitation.Email = company.AdminEmail;
        invitation.TokenHash = TenantNaming.HashToken(token);
        invitation.ExpiresAtUtc = DateTime.UtcNow.AddHours(_app.InvitationExpiryHours);
        invitation.Status = InvitationStatus.Pending;
        invitation.SentAtUtc = null;
        invitation.AcceptedAtUtc = null;
        invitation.LastError = null;
        await _master.SaveChangesAsync(ct);

        return (invitation, token);
    }

    private async Task ExpirePendingInvitationsAsync(Guid companyId, CancellationToken ct)
    {
        var pending = await _master.Invitations.ToListAsync(
            _master.Invitations.Query().Where(i => i.CompanyId == companyId && i.Status != InvitationStatus.Accepted),
            ct);

        foreach (var invitation in pending)
        {
            invitation.Status = InvitationStatus.Expired;
            _master.Invitations.Update(invitation);
        }

        if (pending.Count > 0)
        {
            await _master.SaveChangesAsync(ct);
        }
    }

    private async Task DeliverInvitationAsync(Company company, CompanyInvitation invitation, string activationUrl, CancellationToken ct)
    {
        var result = await SendInvitationEmailAsync(company, activationUrl, ct);

        invitation.SentAtUtc = DateTime.UtcNow;
        if (result.Delivered || result.Simulated)
        {
            invitation.Status = InvitationStatus.Sent;
            invitation.LastError = null;
        }
        else
        {
            invitation.Status = InvitationStatus.Failed;
            invitation.LastError = Sensitive.Redact(result.Error);
        }

        _master.Invitations.Update(invitation);
        await _master.SaveChangesAsync(ct);
        await LogAsync(company.Id, StepEmail, result.Delivered || result.Simulated, invitation.Status.ToString(), ct);
    }

    private async Task<EmailResult> SendInvitationEmailAsync(Company company, string activationUrl, CancellationToken ct)
    {
        var body = $"""
            <p>Hello {WebUtility.HtmlEncode(company.AdminFullName)},</p>
            <p>The HR portal for <strong>{WebUtility.HtmlEncode(company.Name)}</strong> is ready.</p>
            <p>Company code: <strong>{WebUtility.HtmlEncode(company.Code)}</strong></p>
            <p>Set your password to activate your account:</p>
            <p><a href="{activationUrl}">Activate your account</a></p>
            <p>This link expires in {_app.InvitationExpiryHours} hours.</p>
            """;

        try
        {
            return await _emailSender.SendAsync(
                new EmailMessage(company.AdminEmail, $"Your {company.Name} HR portal account", body),
                ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invitation email failed for company {CompanyId}", company.Id);
            return EmailResult.Failed(ex.Message);
        }
    }

    private string BuildActivationUrl(string token, string code) =>
        $"{_app.FrontendBaseUrl.TrimEnd('/')}/activate?token={Uri.EscapeDataString(token)}&code={Uri.EscapeDataString(code)}";

    private async Task LogAsync(Guid companyId, string step, bool succeeded, string? message, CancellationToken ct)
    {
        await _master.ProvisioningLogs.AddAsync(new ProvisioningLog
        {
            CompanyId = companyId,
            Step = step,
            Succeeded = succeeded,
            Message = Sensitive.Redact(message),
            OccurredAtUtc = DateTime.UtcNow,
        }, ct);

        await _master.SaveChangesAsync(ct);
    }

    private static CompanyListItemDto ToListItem(Company c, CompanyInvitation? invitation) => new(
        c.Id,
        c.Name,
        c.Code,
        c.DatabaseName,
        c.Status.ToString(),
        c.IsDefault,
        c.AdminFullName,
        c.AdminEmail,
        c.ContactName,
        c.ContactEmail,
        c.TimeZone,
        c.CreatedAtUtc,
        c.ProvisionedAtUtc,
        c.LastProvisioningError,
        invitation?.Status.ToString() ?? InvitationStatus.Pending.ToString(),
        invitation?.SentAtUtc,
        invitation?.LastError);

    private static CompanyDetailDto ToDetail(Company c, CompanyInvitation? invitation, IReadOnlyList<ProvisioningLog> logs) => new(
        c.Id,
        c.Name,
        c.Code,
        c.DatabaseName,
        c.Status.ToString(),
        c.IsDefault,
        c.AdminFullName,
        c.AdminEmail,
        c.ContactName,
        c.ContactEmail,
        c.TimeZone,
        c.CreatedAtUtc,
        c.ProvisionedAtUtc,
        c.SuspendedAtUtc,
        c.LastProvisioningError,
        invitation?.Status.ToString() ?? InvitationStatus.Pending.ToString(),
        invitation?.Email,
        invitation?.SentAtUtc,
        invitation?.AcceptedAtUtc,
        invitation?.LastError,
        logs.Select(l => new ProvisioningLogDto(l.Step, l.Succeeded, l.Message, l.OccurredAtUtc)).ToList());
}
