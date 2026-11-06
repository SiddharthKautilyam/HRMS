using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class CompanyService : ICompanyService
{
    private readonly IUnitOfWork _uow;
    private readonly IMasterUnitOfWork _masterUow;
    private readonly ITenantContext _tenantContext;
    private readonly ITenantResolutionService _tenantResolver;

    public CompanyService(
        IUnitOfWork uow,
        IMasterUnitOfWork masterUow,
        ITenantContext tenantContext,
        ITenantResolutionService tenantResolver)
    {
        _uow = uow;
        _masterUow = masterUow;
        _tenantContext = tenantContext;
        _tenantResolver = tenantResolver;
    }

    public async Task<CompanySettingsDto> GetAsync(CancellationToken ct = default)
    {
        var settings = await _uow.CompanySettings.FirstOrDefaultAsync(
            _uow.CompanySettings.Query().OrderBy(c => c.CreatedAtUtc), ct);

        if (settings is null)
        {
            var companyId = _tenantContext.CompanyId;
            var masterComp = companyId.HasValue
                ? await _masterUow.Companies.GetByIdAsync(companyId.Value, ct)
                : await _masterUow.Companies.GetDefaultAsync(ct);

            settings = new CompanySettings
            {
                CompanyName = masterComp?.Name ?? "HR Nexus",
                HrEmail = masterComp?.ContactEmail ?? masterComp?.AdminEmail ?? "admin@hrnexus.com",
                TimeZone = masterComp?.TimeZone ?? string.Empty,
                LogoUrl = masterComp?.LogoUrl
            };
            await _uow.CompanySettings.AddAsync(settings, ct);
            await _uow.SaveChangesAsync(ct);
        }

        return ToDto(settings);
    }

    public async Task<CompanySettingsDto> UpdateAsync(SaveCompanySettingsRequest request, CancellationToken ct = default)
    {
        var settings = await _uow.CompanySettings.FirstOrDefaultAsync(
            _uow.CompanySettings.Query().OrderBy(c => c.CreatedAtUtc), ct);

        if (settings is null)
        {
            settings = new CompanySettings();
            Apply(settings, request);
            await _uow.CompanySettings.AddAsync(settings, ct);
        }
        else
        {
            Apply(settings, request);
            _uow.CompanySettings.Update(settings);
        }

        await _uow.SaveChangesAsync(ct);

        // Single write path: Synchronize Master DB Company entity and invalidate cache
        var companyId = _tenantContext.CompanyId;
        var masterComp = companyId.HasValue
            ? await _masterUow.Companies.GetByIdAsync(companyId.Value, ct)
            : await _masterUow.Companies.GetDefaultAsync(ct);

        if (masterComp != null)
        {
            masterComp.Name = settings.CompanyName;
            masterComp.ContactEmail = settings.HrEmail;
            masterComp.TimeZone = settings.TimeZone;
            if (!string.IsNullOrWhiteSpace(settings.LogoUrl))
            {
                masterComp.LogoUrl = settings.LogoUrl;
            }
            _masterUow.Companies.Update(masterComp);
            await _masterUow.SaveChangesAsync(ct);

            _tenantResolver.InvalidateCache(masterComp.Id, masterComp.Code);
        }

        return ToDto(settings);
    }

    public async Task<string> UploadLogoAsync(Stream stream, string fileName, string contentType, long length, CancellationToken ct = default)
    {
        if (length > 2 * 1024 * 1024)
        {
            throw new ValidationException("File size exceeds the 2MB limit.");
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext is not (".png" or ".jpg" or ".jpeg" or ".webp" or ".svg"))
        {
            throw new ValidationException("Invalid file type. Allowed formats are PNG, JPEG, SVG, and WebP.");
        }

        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        // Validate magic numbers / signatures
        if (ext == ".png")
        {
            if (bytes.Length < 8 || bytes[0] != 0x89 || bytes[1] != 0x50 || bytes[2] != 0x4E || bytes[3] != 0x47)
            {
                throw new ValidationException("The uploaded file is not a valid PNG image.");
            }
        }
        else if (ext is ".jpg" or ".jpeg")
        {
            if (bytes.Length < 3 || bytes[0] != 0xFF || bytes[1] != 0xD8 || bytes[2] != 0xFF)
            {
                throw new ValidationException("The uploaded file is not a valid JPEG image.");
            }
        }
        else if (ext == ".webp")
        {
            if (bytes.Length < 12 || bytes[0] != 0x52 || bytes[1] != 0x49 || bytes[2] != 0x46 || bytes[3] != 0x46 ||
                bytes[8] != 0x57 || bytes[9] != 0x45 || bytes[10] != 0x42 || bytes[11] != 0x50)
            {
                throw new ValidationException("The uploaded file is not a valid WebP image.");
            }
        }
        else if (ext == ".svg")
        {
            if (!Hrms.Application.Common.SvgSanitizer.TrySanitize(bytes, out var sanitized))
            {
                throw new ValidationException("The uploaded SVG is malformed or contains unsupported script elements.");
            }
            bytes = sanitized;
        }

        var tenantCode = _tenantContext.Tenant?.Code ?? "default";
        var slug = Hrms.Application.Common.Tenancy.TenantNaming.SlugifyCode(tenantCode);

        var webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var targetFolder = Path.Combine(webRoot, "uploads", "tenants", slug);
        Directory.CreateDirectory(targetFolder);

        var savedFileName = $"logo_{DateTime.UtcNow:yyyyMMddHHmmssfff}{ext}";
        var targetPath = Path.Combine(targetFolder, savedFileName);
        await File.WriteAllBytesAsync(targetPath, bytes, ct);

        var publicUrl = $"/uploads/tenants/{slug}/{savedFileName}";

        // Single write path: Update CompanySettings in tenant DB
        var settings = await _uow.CompanySettings.FirstOrDefaultAsync(
            _uow.CompanySettings.Query().OrderBy(c => c.CreatedAtUtc), ct);

        // Delete previous logo file if exists
        var previousLogo = settings?.LogoUrl;
        if (!string.IsNullOrWhiteSpace(previousLogo) && previousLogo.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var relPath = previousLogo.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                var oldFilePath = Path.Combine(webRoot, relPath);
                if (File.Exists(oldFilePath) && !string.Equals(oldFilePath, targetPath, StringComparison.OrdinalIgnoreCase))
                {
                    File.Delete(oldFilePath);
                }
            }
            catch
            {
                // Best effort cleanup
            }
        }

        if (settings is null)
        {
            settings = new CompanySettings();
            await _uow.CompanySettings.AddAsync(settings, ct);
        }
        settings.LogoUrl = publicUrl;
        _uow.CompanySettings.Update(settings);
        await _uow.SaveChangesAsync(ct);

        // Single write path: Update Master DB Company entity & invalidate cache
        var companyId = _tenantContext.CompanyId;
        var masterComp = companyId.HasValue
            ? await _masterUow.Companies.GetByIdAsync(companyId.Value, ct)
            : await _masterUow.Companies.GetDefaultAsync(ct);

        if (masterComp != null)
        {
            masterComp.LogoUrl = publicUrl;
            _masterUow.Companies.Update(masterComp);
            await _masterUow.SaveChangesAsync(ct);

            _tenantResolver.InvalidateCache(masterComp.Id, masterComp.Code);
        }

        return publicUrl;
    }

    private static void Apply(CompanySettings settings, SaveCompanySettingsRequest request)
    {
        settings.CompanyName = request.CompanyName.Trim();
        settings.HrEmail = request.HrEmail.Trim();
        settings.TimeZone = string.IsNullOrWhiteSpace(request.TimeZone) ? string.Empty : request.TimeZone.Trim();
        settings.TradeLicense = request.TradeLicense?.Trim() ?? string.Empty;
        settings.Trn = request.Trn?.Trim() ?? string.Empty;
        settings.Industry = string.IsNullOrWhiteSpace(request.Industry) ? "Technology" : request.Industry.Trim();
        settings.FoundedYear = request.FoundedYear ?? 2018;
        settings.Website = request.Website?.Trim() ?? string.Empty;
        settings.Address = request.Address?.Trim() ?? string.Empty;
        settings.City = request.City?.Trim() ?? string.Empty;
        settings.Country = string.IsNullOrWhiteSpace(request.Country) ? "UAE" : request.Country.Trim();
        settings.Phone = request.Phone?.Trim() ?? string.Empty;
        settings.PayrollCurrency = string.IsNullOrWhiteSpace(request.PayrollCurrency) ? "USD" : request.PayrollCurrency.Trim();
        settings.TaxNumberLabel = string.IsNullOrWhiteSpace(request.TaxNumberLabel) ? "TRN / Tax Number" : request.TaxNumberLabel.Trim();
        settings.RegistrationNumberLabel = string.IsNullOrWhiteSpace(request.RegistrationNumberLabel) ? "Trade License / Reg No" : request.RegistrationNumberLabel.Trim();

        if (!string.IsNullOrWhiteSpace(request.LogoUrl))
        {
            settings.LogoUrl = request.LogoUrl.Trim();
        }
    }

    private static CompanySettingsDto ToDto(CompanySettings s) => new(
        s.CompanyName,
        s.TradeLicense,
        s.Trn,
        s.Industry,
        s.FoundedYear,
        s.Website,
        s.Address,
        s.City,
        s.Country,
        s.Phone,
        s.HrEmail,
        s.PayrollCurrency,
        s.LogoUrl,
        s.TimeZone,
        s.TaxNumberLabel,
        s.RegistrationNumberLabel);
}

public sealed class TaskService : ITaskService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public TaskService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<TaskDto>> ListAsync(Guid? employeeId, CancellationToken ct = default)
    {
        var query = _uow.Tasks.Query();

        if (employeeId is { } id && id != Guid.Empty)
        {
            query = query.Where(t => t.EmployeeId == id);
        }

        var items = await _uow.Tasks.ToListAsync(
            query.OrderBy(t => t.DueDate).Select(t => new
            {
                t.Id,
                t.EmployeeId,
                EmployeeName = t.Employee!.FirstName + " " + t.Employee.LastName,
                t.Title,
                t.Description,
                t.DueDate,
                t.Status,
                t.Priority,
                t.AssignedBy,
            }),
            ct);

        return items.Select(t => new TaskDto(
            t.Id,
            t.EmployeeId,
            t.EmployeeName,
            t.Title,
            t.Description,
            t.DueDate,
            Formatting.ShortDate(t.DueDate),
            t.Status.ToString(),
            t.Priority.ToString(),
            t.AssignedBy)).ToList();
    }

    public async Task<TaskDto> CreateAsync(CreateTaskRequest request, CancellationToken ct = default)
    {
        var employeeId = await ResolveEmployeeIdAsync(request.EmployeeId, ct);

        var task = new TaskItem
        {
            EmployeeId = employeeId,
            Title = request.Title.Trim(),
            Description = request.Description,
            DueDate = request.DueDate,
            Status = TaskItemStatus.Pending,
            Priority = request.Priority,
            AssignedBy = string.IsNullOrWhiteSpace(request.AssignedBy) ? "Self" : request.AssignedBy.Trim(),
        };

        await _uow.Tasks.AddAsync(task, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await ListAsync(employeeId, ct);
        return loaded.First(t => t.Id == task.Id);
    }

    public async Task<TaskDto> UpdateStatusAsync(Guid id, TaskItemStatus status, CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Task", id);

        task.Status = status;
        _uow.Tasks.Update(task);
        await _uow.SaveChangesAsync(ct);

        var loaded = await ListAsync(task.EmployeeId, ct);
        return loaded.First(t => t.Id == task.Id);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Task", id);

        _uow.Tasks.Remove(task);
        await _uow.SaveChangesAsync(ct);
    }

    private async Task<Guid> ResolveEmployeeIdAsync(Guid? explicitId, CancellationToken ct)
    {
        if (explicitId is { } id && id != Guid.Empty) return id;
        if (_currentUser.EmployeeId is { } own) return own;

        var first = await _uow.Employees.FirstOrDefaultAsync(
            _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id),
            ct);

        return first ?? throw new NotFoundException("No employees exist yet.");
    }
}

public sealed class PerformanceService : IPerformanceService
{
    private readonly IUnitOfWork _uow;

    public PerformanceService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<PerformanceReviewDto> GetForEmployeeAsync(Guid employeeId, CancellationToken ct = default)
    {
        var review = await _uow.PerformanceReviews.GetLatestForEmployeeAsync(employeeId, ct)
                     ?? throw new NotFoundException("No performance review has been recorded for this employee yet.");

        return ToDto(review);
    }

    public async Task<IReadOnlyList<PerformanceReviewDto>> ListAsync(CancellationToken ct = default)
    {
        var reviews = await _uow.PerformanceReviews.ListWithDetailsAsync(ct);
        return reviews.Select(ToDto).ToList();
    }

    private static PerformanceReviewDto ToDto(PerformanceReview review)
    {
        var name = review.Employee is null
            ? "—"
            : $"{review.Employee.FirstName} {review.Employee.LastName}".Trim();

        return new PerformanceReviewDto(
            review.Id,
            review.EmployeeId,
            name,
            review.Period,
            review.OverallRating,
            review.GoalsAchieved,
            review.GoalsTotal,
            review.FeedbackScore,
            review.Rank,
            review.Metrics.OrderBy(m => m.Name).Select(m => new PerformanceMetricDto(m.Name, m.Score)).ToList(),
            review.Feedbacks
                .OrderByDescending(f => f.Date)
                .Select(f => new PerformanceFeedbackDto(
                    f.FromName,
                    f.FromRole,
                    f.Message,
                    Formatting.FullDate(f.Date),
                    f.Rating))
                .ToList());
    }
}
