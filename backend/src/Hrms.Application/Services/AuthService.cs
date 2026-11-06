using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class AuthService : IAuthService
{
    private readonly IUnitOfWork _uow;
    private readonly ITenantDatabaseService _tenantDb;
    private readonly ITenantResolutionService _tenants;
    private readonly ITenantContext _tenantContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _tokenService;

    public AuthService(
        IUnitOfWork uow,
        ITenantDatabaseService tenantDb,
        ITenantResolutionService tenants,
        ITenantContext tenantContext,
        IPasswordHasher passwordHasher,
        IJwtTokenService tokenService)
    {
        _uow = uow;
        _tenantDb = tenantDb;
        _tenants = tenants;
        _tenantContext = tenantContext;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Resolve the tenant from the (optional) company code, or by admin/contact email if omitted.
        // A blank code falls back to the default company if no company matches the email.
        ResolvedTenant? tenant = null;
        if (!string.IsNullOrWhiteSpace(request.CompanyCode))
        {
            tenant = await _tenants.ResolveByCodeAsync(request.CompanyCode.Trim(), ct);
        }
        else
        {
            tenant = await _tenants.ResolveByEmailAsync(email, ct)
                     ?? await _tenants.ResolveDefaultAsync(ct);
        }

        if (tenant is null)
        {
            throw new UnauthorizedException("Unknown company code.");
        }

        if (!tenant.IsDefault && tenant.Status != CompanyStatus.Active)
        {
            throw tenant.Status == CompanyStatus.Suspended
                ? new ForbiddenException("This company has been suspended. Contact your administrator.")
                : new ForbiddenException("This company is not active yet.");
        }

        if (string.IsNullOrWhiteSpace(tenant.DatabaseName))
        {
            throw new InvalidOperationException("The company database has not been provisioned.");
        }

        var user = await _tenantDb.FindUserByEmailAsync(tenant.DatabaseName, email, ct);

        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedException();
        }

        if (!user.IsActive)
        {
            throw new ForbiddenException("This account has been deactivated. Contact your administrator.");
        }

        await _tenantDb.RecordLoginAsync(tenant.DatabaseName, user.Id, ct);

        var token = _tokenService.CreateToken(new TokenSubject(
            user.Id,
            user.FullName,
            user.Initials,
            user.Email,
            user.RoleName,
            user.EmployeeId,
            tenant.CompanyId,
            tenant.Code));

        return new LoginResponse(token.AccessToken, token.ExpiresAtUtc, ToDto(user, tenant));
    }

    public async Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _uow.Users.GetWithRoleAsync(userId, ct)
                   ?? throw NotFoundException.For("User", userId);

        var tenant = _tenantContext.Tenant;

        return new UserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Initials,
            user.Role?.Name ?? "Employee",
            user.Role?.Code ?? "Employee",
            user.EmployeeId,
            tenant?.CompanyId,
            tenant?.Name,
            tenant?.Code,
            tenant?.LogoUrl);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await _uow.Users.GetByIdAsync(userId, ct)
                   ?? throw NotFoundException.For("User", userId);

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new ValidationException("Current password is incorrect.");
        }

        if (request.CurrentPassword == request.NewPassword)
        {
            throw new ValidationException("The new password must be different from the current password.");
        }

        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        _uow.Users.Update(user);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await _uow.Users.GetWithRoleAsync(userId, ct)
                   ?? throw NotFoundException.For("User", userId);

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName.Trim();
            user.Initials = Formatting.Initials(user.FullName);
            _uow.Users.Update(user);
            await _uow.SaveChangesAsync(ct);
        }

        var tenant = _tenantContext.Tenant;
        return new UserDto(
            user.Id,
            user.FullName,
            user.Email,
            user.Initials,
            user.Role?.Name ?? "Employee",
            user.Role?.Code ?? "Employee",
            user.EmployeeId,
            tenant?.CompanyId,
            tenant?.Name,
            tenant?.Code,
            tenant?.LogoUrl);
    }

    private static UserDto ToDto(TenantUserRecord user, ResolvedTenant tenant) => new(
        user.Id,
        user.FullName,
        user.Email,
        user.Initials,
        user.RoleName,
        user.RoleCode,
        user.EmployeeId,
        tenant.CompanyId,
        tenant.Name,
        tenant.Code,
        tenant.LogoUrl);
}
