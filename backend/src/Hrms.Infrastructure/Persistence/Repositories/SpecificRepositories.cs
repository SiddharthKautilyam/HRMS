using Hrms.Application.Abstractions.Persistence;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Persistence.Repositories;

public sealed class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(HrmsDbContext db) : base(db) { }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToUpperInvariant();
        return await Set.Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
    }

    public async Task<User?> GetWithRoleAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<bool> EmailExistsAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToUpperInvariant();
        return await Set.AnyAsync(u => u.NormalizedEmail == normalized, ct);
    }
}

public sealed class EmployeeRepository : Repository<Employee>, IEmployeeRepository
{
    public EmployeeRepository(HrmsDbContext db) : base(db) { }

    public async Task<Employee?> GetWithDetailsAsync(Guid id, CancellationToken ct = default) =>
        await Set
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .Include(e => e.Branch)
            .Include(e => e.Shift)
            .Include(e => e.ReportingManager)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<Employee?> GetWithDepartmentAsync(Guid id, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<Employee?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        await Set.Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Email == email, ct);

    public async Task<(IReadOnlyList<Employee> Items, int Total)> SearchAsync(
        string? search,
        Guid? departmentId,
        EmploymentStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = Set.AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Designation)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e =>
                EF.Functions.Like(e.FirstName, $"%{term}%") ||
                EF.Functions.Like(e.LastName, $"%{term}%") ||
                EF.Functions.Like(e.Email, $"%{term}%") ||
                EF.Functions.Like(e.EmployeeCode, $"%{term}%"));
        }

        if (departmentId is { } deptId)
        {
            query = query.Where(e => e.DepartmentId == deptId);
        }

        if (status is { } employmentStatus)
        {
            query = query.Where(e => e.Status == employmentStatus);
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(e => e.EmployeeCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<Employee>> ListWithDepartmentAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(e => e.Department)
            .OrderBy(e => e.EmployeeCode)
            .ToListAsync(ct);
}

public sealed class LeaveTypeRepository : Repository<LeaveType>, ILeaveTypeRepository
{
    public LeaveTypeRepository(HrmsDbContext db) : base(db) { }

    public async Task<LeaveType?> GetByNameAsync(string name, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(t => t.Name == name, ct);
}

public sealed class LeaveRequestRepository : Repository<LeaveRequest>, ILeaveRequestRepository
{
    public LeaveRequestRepository(HrmsDbContext db) : base(db) { }

    public async Task<(IReadOnlyList<LeaveRequest> Items, int Total)> SearchAsync(
        string? search,
        LeaveStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = Set.AsNoTracking()
            .Include(l => l.Employee)
            .Include(l => l.LeaveType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(l =>
                EF.Functions.Like(l.Employee!.FirstName, $"%{term}%") ||
                EF.Functions.Like(l.Employee!.LastName, $"%{term}%"));
        }

        if (status is { } leaveStatus)
        {
            query = query.Where(l => l.Status == leaveStatus);
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.SubmittedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<IReadOnlyList<LeaveRequest>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(l => l.Employee)
            .Include(l => l.LeaveType)
            .Where(l => l.EmployeeId == employeeId)
            .OrderByDescending(l => l.FromDate)
            .ToListAsync(ct);

    public async Task<LeaveRequest?> GetWithDetailsAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(l => l.Employee)
            .Include(l => l.LeaveType)
            .FirstOrDefaultAsync(l => l.Id == id, ct);
}

public sealed class AttendanceRepository : Repository<AttendanceRecord>, IAttendanceRepository
{
    public AttendanceRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<AttendanceRecord>> ListForEmployeeMonthAsync(
        Guid employeeId,
        int year,
        int month,
        CancellationToken ct = default)
    {
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1);

        return await Set.AsNoTracking()
            .Include(a => a.Employee)
            .Where(a => a.EmployeeId == employeeId && a.Date >= from && a.Date < to)
            .OrderBy(a => a.Date)
            .ToListAsync(ct);
    }

    public async Task<AttendanceRecord?> GetForEmployeeDateAsync(Guid employeeId, DateOnly date, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.Date == date, ct);

    public async Task<IReadOnlyList<AttendanceRecord>> ListByDateAsync(DateOnly date, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(a => a.Employee)
            .Where(a => a.Date == date)
            .OrderBy(a => a.Employee!.EmployeeCode)
            .ToListAsync(ct);
}

public sealed class RegularizationRepository : Repository<RegularizationRequest>, IRegularizationRepository
{
    public RegularizationRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<RegularizationRequest>> ListWithEmployeeAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(r => r.Employee)
            .OrderByDescending(r => r.SubmittedAtUtc)
            .ToListAsync(ct);

    public async Task<RegularizationRequest?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(r => r.Employee).FirstOrDefaultAsync(r => r.Id == id, ct);
}

public sealed class PayrollRunRepository : Repository<PayrollRun>, IPayrollRunRepository
{
    public PayrollRunRepository(HrmsDbContext db) : base(db) { }

    public async Task<PayrollRun?> GetByPeriodAsync(int year, int month, CancellationToken ct = default) =>
        await Set.FirstOrDefaultAsync(r => r.Year == year && r.Month == month, ct);
}

public sealed class PayslipRepository : Repository<Payslip>, IPayslipRepository
{
    public PayslipRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<Payslip>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(p => p.Employee)!.ThenInclude(e => e!.Department)
            .Where(p => p.EmployeeId == employeeId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Payslip>> ListForRunAsync(Guid runId, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(p => p.Employee)!.ThenInclude(e => e!.Department)
            .Where(p => p.PayrollRunId == runId)
            .OrderBy(p => p.Employee!.EmployeeCode)
            .ToListAsync(ct);
}

public sealed class LoanRepository : Repository<Loan>, ILoanRepository
{
    public LoanRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<Loan>> ListWithEmployeeAsync(LoanStatus? status, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking().Include(l => l.Employee).AsQueryable();
        if (status is { } loanStatus)
        {
            query = query.Where(l => l.Status == loanStatus);
        }

        return await query.OrderByDescending(l => l.RequestedAtUtc).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Loan>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(l => l.Employee)
            .Where(l => l.EmployeeId == employeeId)
            .OrderByDescending(l => l.RequestedAtUtc)
            .ToListAsync(ct);

    public async Task<Loan?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(l => l.Employee).FirstOrDefaultAsync(l => l.Id == id, ct);
}

public sealed class EmployeeDocumentRepository : Repository<EmployeeDocument>, IEmployeeDocumentRepository
{
    public EmployeeDocumentRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<EmployeeDocument>> SearchAsync(
        Guid? employeeId,
        string? search,
        DocumentType? type,
        DocumentStatus? status,
        CancellationToken ct = default)
    {
        var query = Set.AsNoTracking()
            .Include(d => d.Employee)!.ThenInclude(e => e!.Department)
            .AsQueryable();

        if (employeeId is { } id)
        {
            query = query.Where(d => d.EmployeeId == id);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(d =>
                EF.Functions.Like(d.Name, $"%{term}%") ||
                EF.Functions.Like(d.Employee!.FirstName, $"%{term}%") ||
                EF.Functions.Like(d.Employee!.LastName, $"%{term}%"));
        }

        if (type is { } documentType)
        {
            query = query.Where(d => d.Type == documentType);
        }

        if (status is { } documentStatus)
        {
            query = query.Where(d => d.Status == documentStatus);
        }

        return await query.OrderBy(d => d.ExpiryDate).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<EmployeeDocument>> ListCompanyDocumentsAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Where(d => d.IsCompanyDocument)
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

    public async Task<EmployeeDocument?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(d => d.Employee).FirstOrDefaultAsync(d => d.Id == id, ct);
}

public sealed class ApprovalRepository : Repository<ApprovalRequest>, IApprovalRepository
{
    public ApprovalRepository(HrmsDbContext db) : base(db) { }

    public async Task<IReadOnlyList<ApprovalRequest>> ListPendingAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(a => a.Employee)
            .Where(a => a.Status == ApprovalStatus.Pending)
            .OrderByDescending(a => a.SubmittedAtUtc)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ApprovalRequest>> ListWithEmployeeAsync(
        ApprovalStatus? status,
        ApprovalType? type,
        CancellationToken ct = default)
    {
        var query = Set.AsNoTracking().Include(a => a.Employee).AsQueryable();

        if (status is { } approvalStatus)
        {
            query = query.Where(a => a.Status == approvalStatus);
        }

        if (type is { } approvalType)
        {
            query = query.Where(a => a.Type == approvalType);
        }

        return await query.OrderByDescending(a => a.SubmittedAtUtc).ToListAsync(ct);
    }

    public async Task<ApprovalRequest?> GetWithEmployeeAsync(Guid id, CancellationToken ct = default) =>
        await Set.Include(a => a.Employee).FirstOrDefaultAsync(a => a.Id == id, ct);
}

public sealed class PerformanceReviewRepository : Repository<PerformanceReview>, IPerformanceReviewRepository
{
    public PerformanceReviewRepository(HrmsDbContext db) : base(db) { }

    public async Task<PerformanceReview?> GetLatestForEmployeeAsync(Guid employeeId, CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(p => p.Employee)
            .Include(p => p.Metrics)
            .Include(p => p.Feedbacks)
            .Where(p => p.EmployeeId == employeeId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<PerformanceReview>> ListWithDetailsAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking()
            .Include(p => p.Employee)
            .Include(p => p.Metrics)
            .Include(p => p.Feedbacks)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(ct);
}
