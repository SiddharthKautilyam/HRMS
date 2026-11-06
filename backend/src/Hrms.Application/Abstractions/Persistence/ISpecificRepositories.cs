using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Abstractions.Persistence;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);

    Task<User?> GetWithRoleAsync(Guid id, CancellationToken ct = default);

    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
}

public interface IEmployeeRepository : IRepository<Employee>
{
    Task<Employee?> GetWithDetailsAsync(Guid id, CancellationToken ct = default);

    /// <summary>Lightweight lookup including only the department (for dashboard-style reads).</summary>
    Task<Employee?> GetWithDepartmentAsync(Guid id, CancellationToken ct = default);

    Task<Employee?> GetByEmailAsync(string email, CancellationToken ct = default);

    Task<(IReadOnlyList<Employee> Items, int Total)> SearchAsync(
        string? search,
        Guid? departmentId,
        EmploymentStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<IReadOnlyList<Employee>> ListWithDepartmentAsync(CancellationToken ct = default);
}

public interface ILeaveTypeRepository : IRepository<LeaveType>
{
    Task<LeaveType?> GetByNameAsync(string name, CancellationToken ct = default);
}

public interface ILeaveRequestRepository : IRepository<LeaveRequest>
{
    Task<(IReadOnlyList<LeaveRequest> Items, int Total)> SearchAsync(
        string? search,
        LeaveStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<IReadOnlyList<LeaveRequest>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<LeaveRequest?> GetWithDetailsAsync(Guid id, CancellationToken ct = default);
}

public interface IAttendanceRepository : IRepository<AttendanceRecord>
{
    Task<IReadOnlyList<AttendanceRecord>> ListForEmployeeMonthAsync(
        Guid employeeId,
        int year,
        int month,
        CancellationToken ct = default);

    Task<AttendanceRecord?> GetForEmployeeDateAsync(Guid employeeId, DateOnly date, CancellationToken ct = default);

    Task<IReadOnlyList<AttendanceRecord>> ListByDateAsync(DateOnly date, CancellationToken ct = default);
}

public interface IRegularizationRepository : IRepository<RegularizationRequest>
{
    Task<IReadOnlyList<RegularizationRequest>> ListWithEmployeeAsync(CancellationToken ct = default);

    Task<RegularizationRequest?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default);
}

public interface IPayrollRunRepository : IRepository<PayrollRun>
{
    Task<PayrollRun?> GetByPeriodAsync(int year, int month, CancellationToken ct = default);
}

public interface IPayslipRepository : IRepository<Payslip>
{
    Task<IReadOnlyList<Payslip>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<IReadOnlyList<Payslip>> ListForRunAsync(Guid runId, CancellationToken ct = default);
}

public interface ILoanRepository : IRepository<Loan>
{
    Task<IReadOnlyList<Loan>> ListWithEmployeeAsync(LoanStatus? status, CancellationToken ct = default);

    Task<IReadOnlyList<Loan>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<Loan?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default);
}

public interface IEmployeeDocumentRepository : IRepository<EmployeeDocument>
{
    Task<IReadOnlyList<EmployeeDocument>> SearchAsync(
        Guid? employeeId,
        string? search,
        DocumentType? type,
        DocumentStatus? status,
        CancellationToken ct = default);

    Task<IReadOnlyList<EmployeeDocument>> ListCompanyDocumentsAsync(CancellationToken ct = default);

    Task<EmployeeDocument?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default);
}

public interface IApprovalRepository : IRepository<ApprovalRequest>
{
    Task<IReadOnlyList<ApprovalRequest>> ListPendingAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ApprovalRequest>> ListWithEmployeeAsync(
        ApprovalStatus? status,
        ApprovalType? type,
        CancellationToken ct = default);

    Task<ApprovalRequest?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default);
}

public interface IPerformanceReviewRepository : IRepository<PerformanceReview>
{
    Task<PerformanceReview?> GetLatestForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<IReadOnlyList<PerformanceReview>> ListWithDetailsAsync(CancellationToken ct = default);
}
