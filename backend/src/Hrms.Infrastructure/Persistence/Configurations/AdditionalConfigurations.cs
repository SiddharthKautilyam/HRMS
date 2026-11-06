using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Configurations;

public sealed class EmployeePunchConfiguration : IEntityTypeConfiguration<EmployeePunch>
{
    public void Configure(EntityTypeBuilder<EmployeePunch> builder)
    {
        builder.ToTable("EmployeePunches");
        builder.Property(p => p.PunchType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(p => p.Note).HasMaxLength(250);
        builder.Property(p => p.Device).HasMaxLength(80);

        builder.HasOne(p => p.Employee)
            .WithMany(e => e.Punches)
            .HasForeignKey(p => p.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.EmployeeId, p.PunchTime });

        builder.Property(p => p.IsOpen).HasDefaultValue(false);
        builder.HasIndex(p => p.EmployeeId)
            .HasDatabaseName("IX_EmployeePunches_EmployeeId_IsOpen")
            .IsUnique()
            .HasFilter("[IsOpen] = 1");
    }
}

public sealed class ShiftTemplateConfiguration : IEntityTypeConfiguration<ShiftTemplate>
{
    public void Configure(EntityTypeBuilder<ShiftTemplate> builder)
    {
        builder.ToTable("ShiftTemplates");
        builder.Property(s => s.Name).HasMaxLength(80).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(250);

        builder.HasOne(s => s.Department)
            .WithMany()
            .HasForeignKey(s => s.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class ShiftdayConfiguration : IEntityTypeConfiguration<Shiftday>
{
    public void Configure(EntityTypeBuilder<Shiftday> builder)
    {
        builder.ToTable("Shiftdays");
        builder.Property(s => s.DayOfWeek).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(s => s.ShiftTemplate)
            .WithMany(t => t.Shiftdays)
            .HasForeignKey(s => s.ShiftTemplateId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ShiftAssignmentConfiguration : IEntityTypeConfiguration<ShiftAssignment>
{
    public void Configure(EntityTypeBuilder<ShiftAssignment> builder)
    {
        builder.ToTable("ShiftAssignments");

        builder.HasOne(s => s.ShiftTemplate)
            .WithMany(t => t.ShiftAssignments)
            .HasForeignKey(s => s.ShiftTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Employee)
            .WithMany(e => e.ShiftAssignments)
            .HasForeignKey(s => s.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.EmployeeId, s.StartDate });
    }
}

public sealed class HolidayTemplateConfiguration : IEntityTypeConfiguration<HolidayTemplate>
{
    public void Configure(EntityTypeBuilder<HolidayTemplate> builder)
    {
        builder.ToTable("HolidayTemplates");
        builder.Property(h => h.Name).HasMaxLength(80).IsRequired();
        builder.Property(h => h.Description).HasMaxLength(250);
    }
}

public sealed class HolidayTemplateAssignmentConfiguration : IEntityTypeConfiguration<HolidayTemplateAssignment>
{
    public void Configure(EntityTypeBuilder<HolidayTemplateAssignment> builder)
    {
        builder.ToTable("HolidayTemplateAssignments");

        builder.HasOne(a => a.HolidayTemplate)
            .WithMany(t => t.Assignments)
            .HasForeignKey(a => a.HolidayTemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Department)
            .WithMany()
            .HasForeignKey(a => a.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.Branch)
            .WithMany()
            .HasForeignKey(a => a.BranchId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.Employee)
            .WithMany()
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class EmployeeEducationConfiguration : IEntityTypeConfiguration<EmployeeEducation>
{
    public void Configure(EntityTypeBuilder<EmployeeEducation> builder)
    {
        builder.ToTable("EmployeeEducations");
        builder.Property(e => e.Degree).HasMaxLength(120).IsRequired();
        builder.Property(e => e.Institution).HasMaxLength(160).IsRequired();
        builder.Property(e => e.PercentageOrCgpa).HasMaxLength(20);
        builder.Property(e => e.Specialization).HasMaxLength(120);

        builder.HasOne(e => e.Employee)
            .WithMany(emp => emp.Educations)
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class EmployeeBankConfiguration : IEntityTypeConfiguration<EmployeeBank>
{
    public void Configure(EntityTypeBuilder<EmployeeBank> builder)
    {
        builder.ToTable("EmployeeBanks");
        builder.Property(b => b.BankName).HasMaxLength(120).IsRequired();
        builder.Property(b => b.AccountHolderName).HasMaxLength(120).IsRequired();
        builder.Property(b => b.AccountNumber).HasMaxLength(60).IsRequired();
        builder.Property(b => b.IfscOrSwiftCode).HasMaxLength(40);
        builder.Property(b => b.BranchName).HasMaxLength(120);

        builder.HasOne(b => b.Employee)
            .WithMany(emp => emp.Banks)
            .HasForeignKey(b => b.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class EmployeeAddressConfiguration : IEntityTypeConfiguration<EmployeeAddress>
{
    public void Configure(EntityTypeBuilder<EmployeeAddress> builder)
    {
        builder.ToTable("EmployeeAddresses");
        builder.Property(a => a.AddressType).HasMaxLength(40).IsRequired();
        builder.Property(a => a.AddressLine1).HasMaxLength(250).IsRequired();
        builder.Property(a => a.AddressLine2).HasMaxLength(250);
        builder.Property(a => a.City).HasMaxLength(80).IsRequired();
        builder.Property(a => a.State).HasMaxLength(80).IsRequired();
        builder.Property(a => a.PostalCode).HasMaxLength(20);
        builder.Property(a => a.Country).HasMaxLength(80).IsRequired();

        builder.HasOne(a => a.Employee)
            .WithMany(emp => emp.Addresses)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class NavigationItemConfiguration : IEntityTypeConfiguration<NavigationItem>
{
    public void Configure(EntityTypeBuilder<NavigationItem> builder)
    {
        builder.ToTable("NavigationItems");
        builder.Property(n => n.Code).HasMaxLength(50);
        builder.Property(n => n.Title).HasMaxLength(80).IsRequired();
        builder.Property(n => n.Route).HasMaxLength(160).IsRequired();
        builder.Property(n => n.Icon).HasMaxLength(60);
        builder.Property(n => n.Badge).HasMaxLength(40);
        builder.Property(n => n.IsActive).HasDefaultValue(true);

        builder.HasOne(n => n.Parent)
            .WithMany(p => p.Children)
            .HasForeignKey(n => n.ParentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class RoleNavigationConfiguration : IEntityTypeConfiguration<RoleNavigation>
{
    public void Configure(EntityTypeBuilder<RoleNavigation> builder)
    {
        builder.ToTable("RoleNavigations");

        builder.HasOne(r => r.Role)
            .WithMany(role => role.RoleNavigations)
            .HasForeignKey(r => r.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.NavigationItem)
            .WithMany(n => n.RoleNavigations)
            .HasForeignKey(r => r.NavigationItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.RoleId, r.NavigationItemId }).IsUnique();
    }
}

public sealed class EmployeeNavigationConfiguration : IEntityTypeConfiguration<EmployeeNavigation>
{
    public void Configure(EntityTypeBuilder<EmployeeNavigation> builder)
    {
        builder.ToTable("EmployeeNavigations");

        builder.HasOne(e => e.Employee)
            .WithMany()
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.NavigationItem)
            .WithMany(n => n.EmployeeNavigations)
            .HasForeignKey(e => e.NavigationItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.EmployeeId, e.NavigationItemId }).IsUnique();
    }
}

public sealed class KeyGroupConfiguration : IEntityTypeConfiguration<KeyGroup>
{
    public void Configure(EntityTypeBuilder<KeyGroup> builder)
    {
        builder.ToTable("KeyGroups");
        builder.Property(k => k.Code).HasMaxLength(60).IsRequired();
        builder.Property(k => k.Name).HasMaxLength(120).IsRequired();
        builder.Property(k => k.Description).HasMaxLength(250);
        builder.Property(k => k.IsGeneric).HasDefaultValue(false);
        builder.HasIndex(k => k.Code).IsUnique();
    }
}

public sealed class KeyStoreConfiguration : IEntityTypeConfiguration<KeyStore>
{
    public void Configure(EntityTypeBuilder<KeyStore> builder)
    {
        builder.ToTable("KeyStores");
        builder.Property(k => k.Key).HasMaxLength(120).IsRequired();
        builder.Property(k => k.Value).HasMaxLength(250).IsRequired();
        builder.Property(k => k.SubValue).HasMaxLength(250);

        builder.HasOne(k => k.KeyGroup)
            .WithMany(g => g.KeyStores)
            .HasForeignKey(k => k.KeyGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(k => new { k.KeyGroupId, k.Key }).IsUnique();
    }
}

public sealed class AssetTypeConfiguration : IEntityTypeConfiguration<AssetType>
{
    public void Configure(EntityTypeBuilder<AssetType> builder)
    {
        builder.ToTable("AssetTypes");
        builder.Property(a => a.Name).HasMaxLength(80).IsRequired();
        builder.Property(a => a.Description).HasMaxLength(250);
    }
}

public sealed class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> builder)
    {
        builder.ToTable("Assets");
        builder.Property(a => a.AssetCode).HasMaxLength(40).IsRequired();
        builder.Property(a => a.Name).HasMaxLength(120).IsRequired();
        builder.Property(a => a.SerialNumber).HasMaxLength(80);
        builder.Property(a => a.Status).HasMaxLength(30).IsRequired();

        builder.HasOne(a => a.AssetType)
            .WithMany(t => t.Assets)
            .HasForeignKey(a => a.AssetTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.AssetCode).IsUnique();
    }
}

public sealed class AssetAssignmentConfiguration : IEntityTypeConfiguration<AssetAssignment>
{
    public void Configure(EntityTypeBuilder<AssetAssignment> builder)
    {
        builder.ToTable("AssetAssignments");
        builder.Property(a => a.ConditionOnAssign).HasMaxLength(250);
        builder.Property(a => a.ConditionOnReturn).HasMaxLength(250);
        builder.Property(a => a.Status).HasMaxLength(30).IsRequired();

        builder.HasOne(a => a.Asset)
            .WithMany(ass => ass.Assignments)
            .HasForeignKey(a => a.AssetId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.Employee)
            .WithMany(e => e.AssetAssignments)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SupportTypeConfiguration : IEntityTypeConfiguration<SupportType>
{
    public void Configure(EntityTypeBuilder<SupportType> builder)
    {
        builder.ToTable("SupportTypes");
        builder.Property(s => s.Name).HasMaxLength(80).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(250);
    }
}

public sealed class SupportRequestConfiguration : IEntityTypeConfiguration<SupportRequest>
{
    public void Configure(EntityTypeBuilder<SupportRequest> builder)
    {
        builder.ToTable("SupportRequests");
        builder.Property(s => s.Subject).HasMaxLength(160).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(2000).IsRequired();
        builder.Property(s => s.Priority).HasMaxLength(30).IsRequired();
        builder.Property(s => s.Status).HasMaxLength(30).IsRequired();
        builder.Property(s => s.ResolutionNotes).HasMaxLength(1000);

        builder.HasOne(s => s.SupportType)
            .WithMany(t => t.SupportRequests)
            .HasForeignKey(s => s.SupportTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Employee)
            .WithMany()
            .HasForeignKey(s => s.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
