using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Configurations;

public sealed class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> builder)
    {
        builder.ToTable("LeaveRequests");
        builder.Property(l => l.Reason).HasMaxLength(500).IsRequired();
        builder.Property(l => l.DecisionNote).HasMaxLength(500);
        builder.Property(l => l.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(l => l.Employee)
            .WithMany(e => e.LeaveRequests)
            .HasForeignKey(l => l.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.LeaveType)
            .WithMany(t => t.LeaveRequests)
            .HasForeignKey(l => l.LeaveTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(l => l.DecidedByUser)
            .WithMany()
            .HasForeignKey(l => l.DecidedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(l => new { l.EmployeeId, l.FromDate });
    }
}

public sealed class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
{
    public void Configure(EntityTypeBuilder<AttendanceRecord> builder)
    {
        builder.ToTable("AttendanceRecords");
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.Notes).HasMaxLength(250);

        builder.HasOne(a => a.Employee)
            .WithMany(e => e.AttendanceRecords)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.EmployeeId, a.Date }).IsUnique();
        builder.HasIndex(a => a.Date);
    }
}

public sealed class RegularizationRequestConfiguration : IEntityTypeConfiguration<RegularizationRequest>
{
    public void Configure(EntityTypeBuilder<RegularizationRequest> builder)
    {
        builder.ToTable("RegularizationRequests");
        builder.Property(r => r.Reason).HasMaxLength(500).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(r => r.Employee)
            .WithMany()
            .HasForeignKey(r => r.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.DecidedByUser)
            .WithMany()
            .HasForeignKey(r => r.DecidedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PayrollRunConfiguration : IEntityTypeConfiguration<PayrollRun>
{
    public void Configure(EntityTypeBuilder<PayrollRun> builder)
    {
        builder.ToTable("PayrollRuns");
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(p => p.PaymentMethod).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(p => new { p.Year, p.Month }).IsUnique();
    }
}

public sealed class PayslipConfiguration : IEntityTypeConfiguration<Payslip>
{
    public void Configure(EntityTypeBuilder<Payslip> builder)
    {
        builder.ToTable("Payslips");
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(p => p.PayrollRun)
            .WithMany(r => r.Payslips)
            .HasForeignKey(p => p.PayrollRunId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict on employee to avoid multiple cascade paths into Payslips.
        builder.HasOne(p => p.Employee)
            .WithMany(e => e.Payslips)
            .HasForeignKey(p => p.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.EmployeeId, p.Year, p.Month });
    }
}

public sealed class LoanConfiguration : IEntityTypeConfiguration<Loan>
{
    public void Configure(EntityTypeBuilder<Loan> builder)
    {
        builder.ToTable("Loans");
        builder.Property(l => l.Reason).HasMaxLength(500);
        builder.Property(l => l.LoanType).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(l => l.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(l => l.Employee)
            .WithMany(e => e.Loans)
            .HasForeignKey(l => l.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.ApprovedByUser)
            .WithMany()
            .HasForeignKey(l => l.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ApprovalRequestConfiguration : IEntityTypeConfiguration<ApprovalRequest>
{
    public void Configure(EntityTypeBuilder<ApprovalRequest> builder)
    {
        builder.ToTable("ApprovalRequests");
        builder.Property(a => a.Title).HasMaxLength(120).IsRequired();
        builder.Property(a => a.Details).HasMaxLength(500).IsRequired();
        builder.Property(a => a.DecisionNote).HasMaxLength(500);
        builder.Property(a => a.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.Priority).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(a => a.Employee)
            .WithMany(e => e.ApprovalRequests)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.DecidedByUser)
            .WithMany()
            .HasForeignKey(a => a.DecidedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.Status);
    }
}

public sealed class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
{
    public void Configure(EntityTypeBuilder<Announcement> builder)
    {
        builder.ToTable("Announcements");
        builder.Property(a => a.Title).HasMaxLength(160).IsRequired();
        builder.Property(a => a.Message).HasMaxLength(2000).IsRequired();
        builder.Property(a => a.Tag).HasMaxLength(40).IsRequired();
        builder.Property(a => a.Severity).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(a => a.PublishedAtUtc);
    }
}
