using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.Common.Tenancy;
using Hrms.Domain.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace Hrms.Infrastructure.Persistence.Tenancy;

/// <summary>Holds the tenant resolved for the current request (scoped).</summary>
public sealed class TenantContext : ITenantContext
{
    public ResolvedTenant? Tenant { get; private set; }

    public Guid? CompanyId => Tenant?.CompanyId;

    public void Set(ResolvedTenant? tenant) => Tenant = tenant;
}

/// <summary>
/// Builds tenant connection strings from a sanitized database name using
/// <see cref="SqlConnectionStringBuilder"/> — no string concatenation and never a
/// database name supplied by a client.
/// </summary>
public sealed class TenantConnectionFactory : ITenantConnectionFactory
{
    private readonly string _tenantBase;
    private readonly string _provisioningBase;
    private readonly string _defaultCatalog;

    public TenantConnectionFactory(IConfiguration configuration)
    {
        var fallback = configuration.GetConnectionString("DefaultConnection")
                       ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

        _defaultCatalog = new SqlConnectionStringBuilder(fallback).InitialCatalog;
        if (string.IsNullOrWhiteSpace(_defaultCatalog))
        {
            _defaultCatalog = "HRMS";
        }

        var options = configuration.GetSection(TenancyOptions.SectionName).Get<TenancyOptions>() ?? new TenancyOptions();

        _tenantBase = string.IsNullOrWhiteSpace(options.TenantConnectionBase) ? fallback : options.TenantConnectionBase!;
        _provisioningBase = string.IsNullOrWhiteSpace(options.ProvisioningConnectionBase) ? _tenantBase : options.ProvisioningConnectionBase!;
    }

    public string BuildTenant(string databaseName) => WithCatalog(_tenantBase, databaseName);

    public string BuildProvisioning(string databaseName) => WithCatalog(_provisioningBase, databaseName);

    public string BuildDefault() => WithCatalog(_tenantBase, _defaultCatalog);

    private static string WithCatalog(string baseConnection, string databaseName)
    {
        if (!TenantNaming.IsValidDatabaseName(databaseName))
        {
            throw new InvalidOperationException($"'{databaseName}' is not a valid tenant database name.");
        }

        return new SqlConnectionStringBuilder(baseConnection) { InitialCatalog = databaseName }.ConnectionString;
    }
}

/// <summary>Supplies the connection string for the tenant resolved for the current request.</summary>
public sealed class TenantConnectionResolver : ITenantConnectionResolver
{
    private readonly ITenantContext _context;
    private readonly ITenantConnectionFactory _factory;

    public TenantConnectionResolver(ITenantContext context, ITenantConnectionFactory factory)
    {
        _context = context;
        _factory = factory;
    }

    public string GetConnectionString()
    {
        var databaseName = _context.Tenant?.DatabaseName;
        return string.IsNullOrWhiteSpace(databaseName)
            ? _factory.BuildDefault()
            : _factory.BuildTenant(databaseName);
    }
}

/// <summary>Resolves companies from the master registry (server-side, trusted) with in-memory caching.</summary>
public sealed class TenantResolutionService : ITenantResolutionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private readonly IMasterUnitOfWork _master;
    private readonly ITenantDatabaseService? _tenantDb;
    private readonly IMemoryCache? _cache;

    public TenantResolutionService(IMasterUnitOfWork master, ITenantDatabaseService? tenantDb = null, IMemoryCache? cache = null)
    {
        _master = master;
        _tenantDb = tenantDb;
        _cache = cache;
    }

    public async Task<ResolvedTenant?> ResolveByCodeAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var slug = TenantNaming.SlugifyCode(code);
        var cacheKey = $"tenant:code:{slug}";
        if (_cache is not null && _cache.TryGetValue(cacheKey, out ResolvedTenant? cached))
        {
            return cached;
        }

        var company = await _master.Companies.GetByCodeAsync(slug, ct);
        var resolved = company is null ? null : Map(company);
        if (resolved is not null && _cache is not null)
        {
            _cache.Set(cacheKey, resolved, CacheTtl);
            _cache.Set($"tenant:id:{resolved.CompanyId}", resolved, CacheTtl);
        }

        return resolved;
    }

    public async Task<ResolvedTenant?> ResolveByIdAsync(Guid companyId, CancellationToken ct = default)
    {
        var cacheKey = $"tenant:id:{companyId}";
        if (_cache is not null && _cache.TryGetValue(cacheKey, out ResolvedTenant? cached))
        {
            return cached;
        }

        var company = await _master.Companies.GetByIdAsync(companyId, ct);
        var resolved = company is null ? null : Map(company);
        if (resolved is not null && _cache is not null)
        {
            _cache.Set(cacheKey, resolved, CacheTtl);
            if (!string.IsNullOrWhiteSpace(resolved.Code))
            {
                _cache.Set($"tenant:code:{TenantNaming.SlugifyCode(resolved.Code)}", resolved, CacheTtl);
            }
        }

        return resolved;
    }

    public async Task<ResolvedTenant?> ResolveDefaultAsync(CancellationToken ct = default)
    {
        const string cacheKey = "tenant:default";
        if (_cache is not null && _cache.TryGetValue(cacheKey, out ResolvedTenant? cached))
        {
            return cached;
        }

        var company = await _master.Companies.GetDefaultAsync(ct);
        var resolved = company is null ? null : Map(company);
        if (resolved is not null && _cache is not null)
        {
            _cache.Set(cacheKey, resolved, CacheTtl);
            _cache.Set($"tenant:id:{resolved.CompanyId}", resolved, CacheTtl);
        }

        return resolved;
    }

    public async Task<ResolvedTenant?> ResolveByEmailAsync(string email, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalized = email.Trim().ToLowerInvariant();
        var company = await _master.Companies.FirstOrDefaultAsync(
            _master.Companies.Query().Where(c => c.AdminEmail == normalized || c.ContactEmail == normalized),
            ct);

        if (company is not null)
        {
            return Map(company);
        }

        if (_tenantDb is not null)
        {
            var activeCompanies = await _master.Companies.ToListAsync(
                _master.Companies.Query().Where(c => c.Status == Domain.Enums.CompanyStatus.Active),
                ct);

            foreach (var comp in activeCompanies)
            {
                if (string.IsNullOrWhiteSpace(comp.DatabaseName)) continue;
                try
                {
                    var user = await _tenantDb.FindUserByEmailAsync(comp.DatabaseName, normalized, ct);
                    if (user is not null)
                    {
                        return Map(comp);
                    }
                }
                catch
                {
                    // Ignore DB connection errors for an individual tenant during search
                }
            }
        }

        return null;
    }

    public void InvalidateCache(Guid companyId, string code)
    {
        if (_cache is null) return;
        _cache.Remove($"tenant:id:{companyId}");
        if (!string.IsNullOrWhiteSpace(code))
        {
            _cache.Remove($"tenant:code:{TenantNaming.SlugifyCode(code)}");
            _cache.Remove($"tenant:branding:{TenantNaming.SlugifyCode(code)}");
        }
        _cache.Remove("tenant:default");
    }

    private static ResolvedTenant Map(Company company) => new(
        company.Id,
        company.Code,
        company.Name,
        company.DatabaseName,
        company.Status,
        company.IsDefault,
        company.LogoUrl);
}

