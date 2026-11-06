using Hrms.Application.Abstractions.Persistence;
using Hrms.Domain.Entities;
using Hrms.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence;

/// <summary>Owns the repositories for one request and the single save point.</summary>
public sealed class UnitOfWork : IUnitOfWork
{
    private readonly HrmsDbContext _db;

    private IUserRepository? _users;
    private IEmployeeRepository? _employees;
    private IRepository<Role>? _roles;
    private IRepository<Department>? _departments;
    private IRepository<Designation>? _designations;
    private IRepository<Branch>? _branches;
    private IRepository<Shift>? _shifts;
    private IRepository<Holiday>? _holidays;
    private ILeaveTypeRepository? _leaveTypes;
    private ILeaveRequestRepository? _leaveRequests;
    private IAttendanceRepository? _attendance;
    private IRegularizationRepository? _regularizations;
    private IPayrollRunRepository? _payrollRuns;
    private IPayslipRepository? _payslips;
    private ILoanRepository? _loans;
    private IEmployeeDocumentRepository? _documents;
    private IApprovalRepository? _approvals;
    private IRepository<Announcement>? _announcements;
    private IRepository<Notification>? _notifications;
    private IRepository<CompanySettings>? _companySettings;
    private IRepository<TaskItem>? _tasks;
    private IPerformanceReviewRepository? _performanceReviews;
    private IRepository<ErpIntegration>? _erpIntegrations;
    private IRepository<ErpSyncLog>? _erpSyncLogs;
    private IRepository<NotificationPreference>? _notificationPreferences;
    private IRepository<EmployeePunch>? _punches;
    private IRepository<ShiftTemplate>? _shiftTemplates;
    private IRepository<Shiftday>? _shiftdays;
    private IRepository<ShiftAssignment>? _shiftAssignments;
    private IRepository<HolidayTemplate>? _holidayTemplates;
    private IRepository<HolidayTemplateAssignment>? _holidayTemplateAssignments;
    private IRepository<EmployeeEducation>? _employeeEducations;
    private IRepository<EmployeeBank>? _employeeBanks;
    private IRepository<EmployeeAddress>? _employeeAddresses;
    private IRepository<NavigationItem>? _navigationItems;
    private IRepository<RoleNavigation>? _roleNavigations;
    private IRepository<EmployeeNavigation>? _employeeNavigations;
    private IRepository<KeyGroup>? _keyGroups;
    private IRepository<KeyStore>? _keyStores;
    private IRepository<AssetType>? _assetTypes;
    private IRepository<Asset>? _assets;
    private IRepository<AssetAssignment>? _assetAssignments;
    private IRepository<SupportType>? _supportTypes;
    private IRepository<SupportRequest>? _supportRequests;

    public UnitOfWork(HrmsDbContext db)
    {
        _db = db;
    }

    public IUserRepository Users => _users ??= new UserRepository(_db);

    public IEmployeeRepository Employees => _employees ??= new EmployeeRepository(_db);

    public IRepository<Role> Roles => _roles ??= new Repository<Role>(_db);

    public IRepository<Department> Departments => _departments ??= new Repository<Department>(_db);

    public IRepository<Designation> Designations => _designations ??= new Repository<Designation>(_db);

    public IRepository<Branch> Branches => _branches ??= new Repository<Branch>(_db);

    public IRepository<Shift> Shifts => _shifts ??= new Repository<Shift>(_db);

    public IRepository<Holiday> Holidays => _holidays ??= new Repository<Holiday>(_db);

    public ILeaveTypeRepository LeaveTypes => _leaveTypes ??= new LeaveTypeRepository(_db);

    public ILeaveRequestRepository LeaveRequests => _leaveRequests ??= new LeaveRequestRepository(_db);

    public IAttendanceRepository Attendance => _attendance ??= new AttendanceRepository(_db);

    public IRegularizationRepository Regularizations => _regularizations ??= new RegularizationRepository(_db);

    public IPayrollRunRepository PayrollRuns => _payrollRuns ??= new PayrollRunRepository(_db);

    public IPayslipRepository Payslips => _payslips ??= new PayslipRepository(_db);

    public ILoanRepository Loans => _loans ??= new LoanRepository(_db);

    public IEmployeeDocumentRepository Documents => _documents ??= new EmployeeDocumentRepository(_db);

    public IApprovalRepository Approvals => _approvals ??= new ApprovalRepository(_db);

    public IRepository<Announcement> Announcements => _announcements ??= new Repository<Announcement>(_db);

    public IRepository<Notification> Notifications => _notifications ??= new Repository<Notification>(_db);

    public IRepository<CompanySettings> CompanySettings => _companySettings ??= new Repository<CompanySettings>(_db);

    public IRepository<TaskItem> Tasks => _tasks ??= new Repository<TaskItem>(_db);

    public IPerformanceReviewRepository PerformanceReviews =>
        _performanceReviews ??= new PerformanceReviewRepository(_db);

    public IRepository<ErpIntegration> ErpIntegrations =>
        _erpIntegrations ??= new Repository<ErpIntegration>(_db);

    public IRepository<ErpSyncLog> ErpSyncLogs => _erpSyncLogs ??= new Repository<ErpSyncLog>(_db);

    public IRepository<NotificationPreference> NotificationPreferences =>
        _notificationPreferences ??= new Repository<NotificationPreference>(_db);

    public IRepository<EmployeePunch> Punches => _punches ??= new Repository<EmployeePunch>(_db);

    public IRepository<ShiftTemplate> ShiftTemplates => _shiftTemplates ??= new Repository<ShiftTemplate>(_db);

    public IRepository<Shiftday> Shiftdays => _shiftdays ??= new Repository<Shiftday>(_db);

    public IRepository<ShiftAssignment> ShiftAssignments => _shiftAssignments ??= new Repository<ShiftAssignment>(_db);

    public IRepository<HolidayTemplate> HolidayTemplates => _holidayTemplates ??= new Repository<HolidayTemplate>(_db);

    public IRepository<HolidayTemplateAssignment> HolidayTemplateAssignments =>
        _holidayTemplateAssignments ??= new Repository<HolidayTemplateAssignment>(_db);

    public IRepository<EmployeeEducation> EmployeeEducations =>
        _employeeEducations ??= new Repository<EmployeeEducation>(_db);

    public IRepository<EmployeeBank> EmployeeBanks => _employeeBanks ??= new Repository<EmployeeBank>(_db);

    public IRepository<EmployeeAddress> EmployeeAddresses => _employeeAddresses ??= new Repository<EmployeeAddress>(_db);

    public IRepository<NavigationItem> NavigationItems => _navigationItems ??= new Repository<NavigationItem>(_db);

    public IRepository<RoleNavigation> RoleNavigations => _roleNavigations ??= new Repository<RoleNavigation>(_db);

    public IRepository<EmployeeNavigation> EmployeeNavigations =>
        _employeeNavigations ??= new Repository<EmployeeNavigation>(_db);

    public IRepository<KeyGroup> KeyGroups => _keyGroups ??= new Repository<KeyGroup>(_db);

    public IRepository<KeyStore> KeyStores => _keyStores ??= new Repository<KeyStore>(_db);

    public IRepository<AssetType> AssetTypes => _assetTypes ??= new Repository<AssetType>(_db);

    public IRepository<Asset> Assets => _assets ??= new Repository<Asset>(_db);

    public IRepository<AssetAssignment> AssetAssignments => _assetAssignments ??= new Repository<AssetAssignment>(_db);

    public IRepository<SupportType> SupportTypes => _supportTypes ??= new Repository<SupportType>(_db);

    public IRepository<SupportRequest> SupportRequests => _supportRequests ??= new Repository<SupportRequest>(_db);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> _memoryLocks = new();

    public async Task<IAsyncDisposable?> TryAcquireAppLockAsync(string lockKey, TimeSpan timeout, CancellationToken ct = default)
    {
        if (_db.Database.IsSqlServer())
        {
            var conn = _db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
            {
                await conn.OpenAsync(ct);
            }

            var timeoutMs = (int)timeout.TotalMilliseconds;
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DECLARE @res INT; EXEC @res = sp_getapplock @Resource = @lockKey, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = @timeoutMs; SELECT @res;";

            var pKey = cmd.CreateParameter();
            pKey.ParameterName = "@lockKey";
            pKey.Value = lockKey;
            cmd.Parameters.Add(pKey);

            var pTimeout = cmd.CreateParameter();
            pTimeout.ParameterName = "@timeoutMs";
            pTimeout.Value = timeoutMs;
            cmd.Parameters.Add(pTimeout);

            var result = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
            if (result < 0)
            {
                return null;
            }

            return new SqlAppLockHandle(conn, lockKey);
        }
        else
        {
            var sem = _memoryLocks.GetOrAdd(lockKey, _ => new SemaphoreSlim(1, 1));
            var acquired = await sem.WaitAsync(timeout, ct);
            if (!acquired) return null;
            return new MemoryLockHandle(sem);
        }
    }

    private sealed class SqlAppLockHandle : IAsyncDisposable
    {
        private readonly System.Data.Common.DbConnection _conn;
        private readonly string _lockKey;
        private bool _disposed;

        public SqlAppLockHandle(System.Data.Common.DbConnection conn, string lockKey)
        {
            _conn = conn;
            _lockKey = lockKey;
        }

        public async ValueTask DisposeAsync()
        {
            if (_disposed) return;
            _disposed = true;
            try
            {
                if (_conn.State == System.Data.ConnectionState.Open)
                {
                    using var cmd = _conn.CreateCommand();
                    cmd.CommandText = "EXEC sp_releaseapplock @Resource = @lockKey, @LockOwner = 'Session';";
                    var pKey = cmd.CreateParameter();
                    pKey.ParameterName = "@lockKey";
                    pKey.Value = _lockKey;
                    cmd.Parameters.Add(pKey);
                    await cmd.ExecuteNonQueryAsync();
                }
            }
            catch
            {
                // Suppress on dispose
            }
        }
    }

    private sealed class MemoryLockHandle : IAsyncDisposable
    {
        private readonly SemaphoreSlim _semaphore;
        private bool _disposed;

        public MemoryLockHandle(SemaphoreSlim semaphore)
        {
            _semaphore = semaphore;
        }

        public ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                _disposed = true;
                _semaphore.Release();
            }
            return ValueTask.CompletedTask;
        }
    }
}
