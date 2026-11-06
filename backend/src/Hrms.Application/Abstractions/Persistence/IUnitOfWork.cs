using Hrms.Domain.Entities;

namespace Hrms.Application.Abstractions.Persistence;

/// <summary>
/// Unit of work exposing the named repositories used by the application services
/// and a single save point per request.
/// </summary>
public interface IUnitOfWork
{
    IUserRepository Users { get; }

    IEmployeeRepository Employees { get; }

    IRepository<Role> Roles { get; }

    IRepository<Department> Departments { get; }

    IRepository<Designation> Designations { get; }

    IRepository<Branch> Branches { get; }

    IRepository<Shift> Shifts { get; }

    IRepository<Holiday> Holidays { get; }

    ILeaveTypeRepository LeaveTypes { get; }

    ILeaveRequestRepository LeaveRequests { get; }

    IAttendanceRepository Attendance { get; }

    IRegularizationRepository Regularizations { get; }

    IPayrollRunRepository PayrollRuns { get; }

    IPayslipRepository Payslips { get; }

    ILoanRepository Loans { get; }

    IEmployeeDocumentRepository Documents { get; }

    IApprovalRepository Approvals { get; }

    IRepository<Announcement> Announcements { get; }

    IRepository<Notification> Notifications { get; }

    IRepository<CompanySettings> CompanySettings { get; }

    IRepository<TaskItem> Tasks { get; }

    IPerformanceReviewRepository PerformanceReviews { get; }

    IRepository<ErpIntegration> ErpIntegrations { get; }

    IRepository<ErpSyncLog> ErpSyncLogs { get; }

    IRepository<NotificationPreference> NotificationPreferences { get; }

    IRepository<EmployeePunch> Punches { get; }

    IRepository<ShiftTemplate> ShiftTemplates { get; }

    IRepository<Shiftday> Shiftdays { get; }

    IRepository<ShiftAssignment> ShiftAssignments { get; }

    IRepository<HolidayTemplate> HolidayTemplates { get; }

    IRepository<HolidayTemplateAssignment> HolidayTemplateAssignments { get; }

    IRepository<EmployeeEducation> EmployeeEducations { get; }

    IRepository<EmployeeBank> EmployeeBanks { get; }

    IRepository<EmployeeAddress> EmployeeAddresses { get; }

    IRepository<NavigationItem> NavigationItems { get; }

    IRepository<RoleNavigation> RoleNavigations { get; }

    IRepository<EmployeeNavigation> EmployeeNavigations { get; }

    IRepository<KeyGroup> KeyGroups { get; }

    IRepository<KeyStore> KeyStores { get; }

    IRepository<AssetType> AssetTypes { get; }

    IRepository<Asset> Assets { get; }

    IRepository<AssetAssignment> AssetAssignments { get; }

    IRepository<SupportType> SupportTypes { get; }

    IRepository<SupportRequest> SupportRequests { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);

    Task<IAsyncDisposable?> TryAcquireAppLockAsync(string lockKey, TimeSpan timeout, CancellationToken ct = default);
}
