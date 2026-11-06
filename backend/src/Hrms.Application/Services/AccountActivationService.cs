using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.Common.Tenancy;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

/// <summary>Validates and consumes company admin activation invitations.</summary>
public sealed class AccountActivationService : IAccountActivationService
{
    private readonly IMasterUnitOfWork _master;
    private readonly ITenantDatabaseService _tenantDb;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _tokenService;

    public AccountActivationService(
        IMasterUnitOfWork master,
        ITenantDatabaseService tenantDb,
        IPasswordHasher passwordHasher,
        IJwtTokenService tokenService)
    {
        _master = master;
        _tenantDb = tenantDb;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<ActivationInfoResponse> ValidateAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return new ActivationInfoResponse(false, null, null, null, "This activation link is not valid.");
        }

        var invitation = await _master.Invitations.GetByTokenHashAsync(TenantNaming.HashToken(token), ct);
        if (invitation is null)
        {
            return new ActivationInfoResponse(false, null, null, null, "This activation link is not valid.");
        }

        var company = await _master.Companies.GetByIdAsync(invitation.CompanyId, ct);
        return Describe(invitation, company);
    }

    public async Task<LoginResponse> ActivateAsync(ActivateAccountRequest request, CancellationToken ct = default)
    {
        var invitation = await _master.Invitations.GetByTokenHashAsync(TenantNaming.HashToken(request.Token), ct)
                         ?? throw new ValidationException("This activation link is not valid.");

        if (invitation.Status == InvitationStatus.Accepted)
        {
            throw new ValidationException("This account has already been activated.");
        }

        if (invitation.ExpiresAtUtc < DateTime.UtcNow)
        {
            invitation.Status = InvitationStatus.Expired;
            _master.Invitations.Update(invitation);
            await _master.SaveChangesAsync(ct);
            throw new ValidationException("This activation link has expired. Ask your administrator to resend it.");
        }

        var company = await _master.Companies.GetByIdAsync(invitation.CompanyId, ct)
                      ?? throw new NotFoundException("The company for this invitation no longer exists.");

        if (string.IsNullOrWhiteSpace(company.DatabaseName))
        {
            throw new ValidationException("The company database is not ready yet.");
        }

        if (company.Status == CompanyStatus.Suspended)
        {
            throw new ForbiddenException("This company has been suspended.");
        }

        var email = invitation.Email.Trim().ToLowerInvariant();
        await _tenantDb.SetUserPasswordAsync(company.DatabaseName, email, _passwordHasher.Hash(request.NewPassword), ct);

        var user = await _tenantDb.FindUserByEmailAsync(company.DatabaseName, email, ct)
                   ?? throw new NotFoundException("The company administrator account was not found.");

        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAtUtc = DateTime.UtcNow;
        invitation.LastError = null;
        _master.Invitations.Update(invitation);

        if (company.Status != CompanyStatus.Active)
        {
            company.Status = CompanyStatus.Active;
            company.ProvisionedAtUtc ??= DateTime.UtcNow;
            _master.Companies.Update(company);
        }

        await _master.SaveChangesAsync(ct);
        await _tenantDb.RecordLoginAsync(company.DatabaseName, user.Id, ct);

        var token = _tokenService.CreateToken(new TokenSubject(
            user.Id,
            user.FullName,
            user.Initials,
            user.Email,
            user.RoleName,
            user.EmployeeId,
            company.Id,
            company.Code));

        var dto = new UserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Initials,
            user.RoleName,
            user.RoleCode,
            user.EmployeeId,
            company.Id,
            company.Name,
            company.Code);

        return new LoginResponse(token.AccessToken, token.ExpiresAtUtc, dto);
    }

    private static ActivationInfoResponse Describe(CompanyInvitation invitation, Company? company)
    {
        var name = company?.Name;
        var code = company?.Code;

        if (invitation.Status == InvitationStatus.Accepted)
        {
            return new ActivationInfoResponse(false, name, code, invitation.Email, "This account has already been activated.");
        }

        if (invitation.ExpiresAtUtc < DateTime.UtcNow)
        {
            return new ActivationInfoResponse(false, name, code, invitation.Email, "This activation link has expired. Ask your administrator to resend it.");
        }

        return new ActivationInfoResponse(true, name, code, invitation.Email, null);
    }
}
