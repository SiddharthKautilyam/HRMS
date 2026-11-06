using Hrms.Domain.Common;
using Hrms.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence;

/// <summary>
/// EF Core code-first context. Entities are configured through
/// <c>IEntityTypeConfiguration</c> classes in this assembly; audit timestamps are
/// maintained on save.
/// </summary>
public class HrmsDbContext : DbContext
{
    public HrmsDbContext(DbContextOptions<HrmsDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<Department> Departments => Set<Department>();

    public DbSet<Designation> Designations => Set<Designation>();

    public DbSet<Branch> Branches => Set<Branch>();

    public DbSet<Shift> Shifts => Set<Shift>();

    public DbSet<Holiday> Holidays => Set<Holiday>();

    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();

    public DbSet<Employee> Employees => Set<Employee>();

    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();

    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();

    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();

    public DbSet<RegularizationRequest> RegularizationRequests => Set<RegularizationRequest>();

    public DbSet<PayrollRun> PayrollRuns => Set<PayrollRun>();

    public DbSet<Payslip> Payslips => Set<Payslip>();

    public DbSet<Loan> Loans => Set<Loan>();

    public DbSet<ApprovalRequest> ApprovalRequests => Set<ApprovalRequest>();

    public DbSet<Announcement> Announcements => Set<Announcement>();

    public DbSet<CompanySettings> CompanySettings => Set<CompanySettings>();

    public DbSet<TaskItem> TaskItems => Set<TaskItem>();

    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();

    public DbSet<PerformanceMetric> PerformanceMetrics => Set<PerformanceMetric>();

    public DbSet<PerformanceFeedback> PerformanceFeedbacks => Set<PerformanceFeedback>();

    public DbSet<ErpIntegration> ErpIntegrations => Set<ErpIntegration>();

    public DbSet<ErpSyncLog> ErpSyncLogs => Set<ErpSyncLog>();

    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();

    public DbSet<EmployeePunch> EmployeePunches => Set<EmployeePunch>();

    public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();

    public DbSet<Shiftday> Shiftdays => Set<Shiftday>();

    public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();

    public DbSet<HolidayTemplate> HolidayTemplates => Set<HolidayTemplate>();

    public DbSet<HolidayTemplateAssignment> HolidayTemplateAssignments => Set<HolidayTemplateAssignment>();

    public DbSet<EmployeeEducation> EmployeeEducations => Set<EmployeeEducation>();

    public DbSet<EmployeeBank> EmployeeBanks => Set<EmployeeBank>();

    public DbSet<EmployeeAddress> EmployeeAddresses => Set<EmployeeAddress>();

    public DbSet<NavigationItem> NavigationItems => Set<NavigationItem>();

    public DbSet<RoleNavigation> RoleNavigations => Set<RoleNavigation>();

    public DbSet<EmployeeNavigation> EmployeeNavigations => Set<EmployeeNavigation>();

    public DbSet<KeyGroup> KeyGroups => Set<KeyGroup>();

    public DbSet<KeyStore> KeyStores => Set<KeyStore>();

    public DbSet<AssetType> AssetTypes => Set<AssetType>();

    public DbSet<Asset> Assets => Set<Asset>();

    public DbSet<AssetAssignment> AssetAssignments => Set<AssetAssignment>();

    public DbSet<SupportType> SupportTypes => Set<SupportType>();

    public DbSet<SupportRequest> SupportRequests => Set<SupportRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Master-registry configurations (Companies, invitations, provisioning logs) live in
        // the Persistence.Master namespace and belong to the master context only.
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(HrmsDbContext).Assembly,
            type => type.Namespace is null || !type.Namespace.Contains(".Master", StringComparison.Ordinal));

        // Consistent money precision for every decimal column.
        foreach (var property in modelBuilder.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetPrecision(18);
            property.SetScale(2);
        }

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
