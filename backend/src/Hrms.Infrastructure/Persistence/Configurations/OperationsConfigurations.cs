using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Hrms.Infrastructure.Persistence.Configurations;

public sealed class CompanySettingsConfiguration : IEntityTypeConfiguration<CompanySettings>
{
    public void Configure(EntityTypeBuilder<CompanySettings> builder)
    {
        builder.ToTable("CompanySettings");
        builder.Property(c => c.CompanyName).HasMaxLength(160).IsRequired();
        builder.Property(c => c.TradeLicense).HasMaxLength(60);
        builder.Property(c => c.Trn).HasMaxLength(60);
        builder.Property(c => c.Industry).HasMaxLength(80);
        builder.Property(c => c.Website).HasMaxLength(200);
        builder.Property(c => c.Address).HasMaxLength(250);
        builder.Property(c => c.City).HasMaxLength(80);
        builder.Property(c => c.Country).HasMaxLength(80);
        builder.Property(c => c.Phone).HasMaxLength(40);
        builder.Property(c => c.HrEmail).HasMaxLength(160);
        builder.Property(c => c.PayrollCurrency).HasMaxLength(3);
    }
}

public sealed class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("TaskItems");
        builder.Property(t => t.Title).HasMaxLength(160).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(500);
        builder.Property(t => t.AssignedBy).HasMaxLength(120);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(t => t.Priority).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(t => t.Employee)
            .WithMany()
            .HasForeignKey(t => t.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => new { t.EmployeeId, t.Status });
    }
}

public sealed class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> builder)
    {
        builder.ToTable("PerformanceReviews");
        builder.Property(p => p.Period).HasMaxLength(30).IsRequired();
        builder.Property(p => p.Rank).HasMaxLength(20);

        builder.HasOne(p => p.Employee)
            .WithMany()
            .HasForeignKey(p => p.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Metrics)
            .WithOne(m => m.PerformanceReview)
            .HasForeignKey(m => m.PerformanceReviewId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Feedbacks)
            .WithOne(f => f.PerformanceReview)
            .HasForeignKey(f => f.PerformanceReviewId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.EmployeeId, p.Period }).IsUnique();
    }
}

public sealed class PerformanceMetricConfiguration : IEntityTypeConfiguration<PerformanceMetric>
{
    public void Configure(EntityTypeBuilder<PerformanceMetric> builder)
    {
        builder.ToTable("PerformanceMetrics");
        builder.Property(m => m.Name).HasMaxLength(80).IsRequired();
    }
}

public sealed class PerformanceFeedbackConfiguration : IEntityTypeConfiguration<PerformanceFeedback>
{
    public void Configure(EntityTypeBuilder<PerformanceFeedback> builder)
    {
        builder.ToTable("PerformanceFeedbacks");
        builder.Property(f => f.FromName).HasMaxLength(120).IsRequired();
        builder.Property(f => f.FromRole).HasMaxLength(120);
        builder.Property(f => f.Message).HasMaxLength(1000).IsRequired();
    }
}

public sealed class ErpIntegrationConfiguration : IEntityTypeConfiguration<ErpIntegration>
{
    public void Configure(EntityTypeBuilder<ErpIntegration> builder)
    {
        builder.ToTable("ErpIntegrations");
        builder.Property(e => e.Name).HasMaxLength(120).IsRequired();
        builder.Property(e => e.Description).HasMaxLength(250);
        builder.Property(e => e.LastSyncLabel).HasMaxLength(60);
        builder.Property(e => e.IconKey).HasMaxLength(40);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(e => e.Name).IsUnique();
    }
}

public sealed class ErpSyncLogConfiguration : IEntityTypeConfiguration<ErpSyncLog>
{
    public void Configure(EntityTypeBuilder<ErpSyncLog> builder)
    {
        builder.ToTable("ErpSyncLogs");
        builder.Property(l => l.Message).HasMaxLength(300).IsRequired();
        builder.HasIndex(l => l.SyncedAtUtc);
    }
}

public sealed class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> builder)
    {
        builder.ToTable("NotificationPreferences");
        builder.Property(p => p.Key).HasMaxLength(60).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(120).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(250);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.UserId, p.Key }).IsUnique();
    }
}
