using Hrms.Application.Abstractions.Notifications;
using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Infrastructure.Notifications;
using Hrms.Infrastructure.Persistence;
using Hrms.Infrastructure.Persistence.Master;
using Hrms.Infrastructure.Persistence.Tenancy;
using Hrms.Infrastructure.Security;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hrms.Infrastructure;

/// <summary>Registers EF Core, the repository/unit-of-work stack, tenancy and security services.</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

        // The master registry lives in its own database on the same server unless configured.
        var masterConnection = configuration.GetConnectionString("MasterConnection")
            ?? new SqlConnectionStringBuilder(connectionString) { InitialCatalog = "HRMS_Master" }.ConnectionString;

        services.AddDbContext<HrmsMasterDbContext>(options =>
        {
            options.UseSqlServer(masterConnection, sql =>
            {
                sql.EnableRetryOnFailure(3);
                sql.MigrationsAssembly(typeof(HrmsMasterDbContext).Assembly.FullName);
            });
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        // The tenant context is resolved per request from the validated identity + master mapping.
        services.AddDbContext<HrmsDbContext>((serviceProvider, options) =>
        {
            var tenantConnection = serviceProvider.GetRequiredService<ITenantConnectionResolver>().GetConnectionString();
            options.UseSqlServer(tenantConnection, sql =>
            {
                sql.EnableRetryOnFailure(3);
                sql.MigrationsAssembly(typeof(HrmsDbContext).Assembly.FullName);
                sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            });
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        services.AddMemoryCache();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<AppOptions>(configuration.GetSection(AppOptions.SectionName));
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));

        // Tenancy
        services.AddSingleton<ITenantConnectionFactory, TenantConnectionFactory>();
        services.AddScoped<ITenantContext, TenantContext>();
        services.AddScoped<ITenantConnectionResolver, TenantConnectionResolver>();
        services.AddScoped<ITenantResolutionService, TenantResolutionService>();
        services.AddScoped<ITenantDatabaseService, TenantDatabaseService>();
        services.AddScoped<IMasterUnitOfWork, MasterUnitOfWork>();

        // Notifications
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IPasswordHasher, IdentityPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();

        return services;
    }
}
