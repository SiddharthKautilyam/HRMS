using Hrms.Domain.Enums;

namespace Hrms.Application.Abstractions.Tenancy;

/// <summary>A company resolved to its tenant database, used to route a request.</summary>
public sealed record ResolvedTenant(
    Guid CompanyId,
    string Code,
    string Name,
    string? DatabaseName,
    CompanyStatus Status,
    bool IsDefault,
    string? LogoUrl = null);

/// <summary>Holds the tenant resolved for the current request.</summary>
public interface ITenantContext
{
    ResolvedTenant? Tenant { get; }

    Guid? CompanyId { get; }

    void Set(ResolvedTenant? tenant);
}

/// <summary>Builds tenant connection strings safely from a sanitized database name.</summary>
public interface ITenantConnectionFactory
{
    /// <summary>Runtime (least-privilege) connection for a tenant database.</summary>
    string BuildTenant(string databaseName);

    /// <summary>Elevated connection used to create a tenant database during provisioning.</summary>
    string BuildProvisioning(string databaseName);

    /// <summary>Connection string used when no tenant has been resolved (the default tenant).</summary>
    string BuildDefault();
}

/// <summary>Supplies the connection string for the tenant resolved for the current request.</summary>
public interface ITenantConnectionResolver
{
    string GetConnectionString();
}

/// <summary>Looks up companies in the master registry (server-side, trusted).</summary>
public interface ITenantResolutionService
{
    Task<ResolvedTenant?> ResolveByCodeAsync(string code, CancellationToken ct = default);

    Task<ResolvedTenant?> ResolveByIdAsync(Guid companyId, CancellationToken ct = default);

    Task<ResolvedTenant?> ResolveDefaultAsync(CancellationToken ct = default);

    Task<ResolvedTenant?> ResolveByEmailAsync(string email, CancellationToken ct = default);

    void InvalidateCache(Guid companyId, string code);
}

/// <summary>A tenant user projection needed to authenticate without loading the whole graph.</summary>
public sealed record TenantUserRecord(
    Guid Id,
    string Email,
    string FullName,
    string Initials,
    string PasswordHash,
    bool IsActive,
    Guid? EmployeeId,
    string RoleName,
    string RoleCode);

/// <summary>The minimal defaults written into a freshly provisioned tenant database.</summary>
public sealed record TenantBootstrap(
    string CompanyName,
    string AdminEmail,
    string AdminFullName,
    string AdminPasswordHash,
    string Currency = "USD");

/// <summary>Performs the EF Core work required to create and initialize a tenant database.</summary>
public interface ITenantDatabaseService
{
    Task<bool> DatabaseExistsAsync(string databaseName, CancellationToken ct = default);

    /// <summary>Creates the database (if missing) and applies the tenant migrations only.</summary>
    Task ProvisionSchemaAsync(string databaseName, CancellationToken ct = default);

    /// <summary>Writes the roles, initial admin login and default settings (idempotent).</summary>
    Task BootstrapAsync(string databaseName, TenantBootstrap bootstrap, CancellationToken ct = default);

    Task<TenantUserRecord?> FindUserByEmailAsync(string databaseName, string email, CancellationToken ct = default);

    Task RecordLoginAsync(string databaseName, Guid userId, CancellationToken ct = default);

    Task SetUserPasswordAsync(string databaseName, string email, string passwordHash, CancellationToken ct = default);

    Task<int> CountUsersAsync(string databaseName, CancellationToken ct = default);

    /// <summary>Safely drops a tenant database.</summary>
    Task DropDatabaseAsync(string databaseName, CancellationToken ct = default);
}
