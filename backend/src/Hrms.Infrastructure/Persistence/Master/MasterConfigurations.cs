using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Master;

public sealed class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.ToTable("Companies");
        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Code).HasMaxLength(24).IsRequired();
        builder.Property(c => c.DatabaseName).HasMaxLength(64);
        builder.Property(c => c.ContactName).HasMaxLength(160);
        builder.Property(c => c.ContactEmail).HasMaxLength(160);
        builder.Property(c => c.AdminFullName).HasMaxLength(160).IsRequired();
        builder.Property(c => c.AdminEmail).HasMaxLength(160).IsRequired();
        builder.Property(c => c.TimeZone).HasMaxLength(64);
        builder.Property(c => c.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.LastProvisioningError).HasMaxLength(1000);

        builder.HasIndex(c => c.Code).IsUnique();
        builder.HasIndex(c => c.DatabaseName).IsUnique().HasFilter("[DatabaseName] IS NOT NULL");
    }
}

public sealed class CompanyInvitationConfiguration : IEntityTypeConfiguration<CompanyInvitation>
{
    public void Configure(EntityTypeBuilder<CompanyInvitation> builder)
    {
        builder.ToTable("CompanyInvitations");
        builder.Property(i => i.Email).HasMaxLength(160).IsRequired();
        builder.Property(i => i.TokenHash).HasMaxLength(128).IsRequired();
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(i => i.LastError).HasMaxLength(1000);

        builder.HasIndex(i => i.TokenHash).IsUnique();

        builder.HasOne(i => i.Company)
            .WithMany(c => c.Invitations)
            .HasForeignKey(i => i.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProvisioningLogConfiguration : IEntityTypeConfiguration<ProvisioningLog>
{
    public void Configure(EntityTypeBuilder<ProvisioningLog> builder)
    {
        builder.ToTable("ProvisioningLogs");
        builder.Property(l => l.Step).HasMaxLength(80).IsRequired();
        builder.Property(l => l.Message).HasMaxLength(1000);

        builder.HasOne(l => l.Company)
            .WithMany(c => c.ProvisioningLogs)
            .HasForeignKey(l => l.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
