using Hrms.Domain.Common;
using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence.Master;

/// <summary>
/// EF Core context for the central master (registry) database. Holds the company →
/// database mapping, provisioning state and account invitations.
/// </summary>
public class HrmsMasterDbContext : DbContext
{
    public HrmsMasterDbContext(DbContextOptions<HrmsMasterDbContext> options) : base(options)
    {
    }

    public DbSet<Company> Companies => Set<Company>();

    public DbSet<CompanyInvitation> CompanyInvitations => Set<CompanyInvitation>();

    public DbSet<ProvisioningLog> ProvisioningLogs => Set<ProvisioningLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(HrmsMasterDbContext).Assembly,
            type => type.Namespace?.Contains(".Master", StringComparison.Ordinal) == true);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAuditTimestamps();
        return base.SaveChanges();
    }

    private void ApplyAuditTimestamps()
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAtUtc = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAtUtc = now;
                    break;
            }
        }
    }
}
