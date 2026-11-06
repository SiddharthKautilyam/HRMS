using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Configurations;

public sealed class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("Departments");
        builder.Property(d => d.Name).HasMaxLength(80).IsRequired();
        builder.Property(d => d.Code).HasMaxLength(20).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(250);
        builder.HasIndex(d => d.Name).IsUnique();
        builder.HasIndex(d => d.Code).IsUnique();
    }
}

public sealed class DesignationConfiguration : IEntityTypeConfiguration<Designation>
{
    public void Configure(EntityTypeBuilder<Designation> builder)
    {
        builder.ToTable("Designations");
        builder.Property(d => d.Name).HasMaxLength(80).IsRequired();
        builder.Property(d => d.Grade).HasMaxLength(10).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(250);

        builder.HasOne(d => d.Department)
            .WithMany(dep => dep.Designations)
            .HasForeignKey(d => d.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("Branches");
        builder.Property(b => b.Name).HasMaxLength(80).IsRequired();
        builder.Property(b => b.Location).HasMaxLength(120).IsRequired();
        builder.Property(b => b.ManagerName).HasMaxLength(120).IsRequired();
    }
}

public sealed class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> builder)
    {
        builder.ToTable("Shifts");
        builder.Property(s => s.Name).HasMaxLength(80).IsRequired();
        builder.Property(s => s.WorkingDays).HasMaxLength(60).IsRequired();
    }
}

public sealed class HolidayConfiguration : IEntityTypeConfiguration<Holiday>
{
    public void Configure(EntityTypeBuilder<Holiday> builder)
    {
        builder.ToTable("Holidays");
        builder.Property(h => h.Name).HasMaxLength(120).IsRequired();
        builder.Property(h => h.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(h => h.Date);
    }
}

public sealed class LeaveTypeConfiguration : IEntityTypeConfiguration<LeaveType>
{
    public void Configure(EntityTypeBuilder<LeaveType> builder)
    {
        builder.ToTable("LeaveTypes");
        builder.Property(t => t.Name).HasMaxLength(80).IsRequired();
        builder.Property(t => t.Color).HasMaxLength(20).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(250);
        builder.HasIndex(t => t.Name).IsUnique();
    }
}
