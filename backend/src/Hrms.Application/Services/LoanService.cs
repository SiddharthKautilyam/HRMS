using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class LoanService : ILoanService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public LoanService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<LoanSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        // Aggregate in SQL instead of loading every loan row.
        var totals = await _uow.Loans.FirstOrDefaultAsync(
            _uow.Loans.Query().GroupBy(_ => 1).Select(g => new
            {
                Disbursed = g.Sum(l => l.Amount),
                ActiveBalance = g.Sum(l => l.Status == LoanStatus.Active ? l.Balance : 0m),
                ActiveLoans = g.Sum(l => l.Status == LoanStatus.Active ? 1 : 0),
                PendingApproval = g.Sum(l => l.Status == LoanStatus.Pending ? 1 : 0),
            }),
            ct);

        return new LoanSummaryDto(
            totals?.Disbursed ?? 0m,
            totals?.ActiveBalance ?? 0m,
            totals?.ActiveLoans ?? 0,
            totals?.PendingApproval ?? 0);
    }

    public async Task<IReadOnlyList<LoanDto>> ListAsync(LoanStatus? status, CancellationToken ct = default)
    {
        var loans = await _uow.Loans.ListWithEmployeeAsync(status, ct);
        return loans.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<LoanDto>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default)
    {
        var loans = await _uow.Loans.ListForEmployeeAsync(employeeId, ct);
        return loans.Select(ToDto).ToList();
    }

    public async Task<LoanDto> CreateAsync(CreateLoanRequest request, CancellationToken ct = default)
    {
        var employeeId = await ResolveEmployeeIdAsync(request.EmployeeId, ct);
        _ = await _uow.Employees.GetByIdAsync(employeeId, ct)
            ?? throw NotFoundException.For("Employee", employeeId);

        if (request.TenureMonths <= 0)
        {
            throw new ValidationException("The repayment tenure must be at least one month.");
        }

        var loan = new Loan
        {
            EmployeeId = employeeId,
            LoanType = request.LoanType,
            Amount = request.Amount,
            TenureMonths = request.TenureMonths,
            Balance = request.Amount,
            Emi = Math.Round(request.Amount / request.TenureMonths, 2),
            Status = LoanStatus.Pending,
            Reason = request.Reason,
            RequestedAtUtc = DateTime.UtcNow,
        };

        await _uow.Loans.AddAsync(loan, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await _uow.Loans.GetWithEmployeeAsync(loan.Id, ct)
                     ?? throw NotFoundException.For("Loan", loan.Id);
        return ToDto(loaded);
    }

    public async Task<LoanDto> DecideAsync(Guid id, bool approved, CancellationToken ct = default)
    {
        var loan = await _uow.Loans.GetWithEmployeeAsync(id, ct)
                   ?? throw NotFoundException.For("Loan", id);

        if (loan.Status != LoanStatus.Pending)
        {
            throw new ConflictException("This loan request has already been decided.");
        }

        if (approved)
        {
            loan.Status = LoanStatus.Active;
            loan.ApprovedAtUtc = DateTime.UtcNow;
            loan.ApprovedByUserId = _currentUser.UserId;
        }
        else
        {
            loan.Status = LoanStatus.Rejected;
        }

        _uow.Loans.Update(loan);
        await _uow.SaveChangesAsync(ct);
        return ToDto(loan);
    }

    private async Task<Guid> ResolveEmployeeIdAsync(Guid? explicitId, CancellationToken ct)
    {
        if (explicitId is { } id && id != Guid.Empty) return id;
        if (_currentUser.EmployeeId is { } own) return own;

        var first = await _uow.Employees.FirstOrDefaultAsync(
            _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id),
            ct);

        return first ?? throw new NotFoundException("No employees exist yet.");
    }

    private static LoanDto ToDto(Loan l)
    {
        var name = l.Employee is null ? "—" : $"{l.Employee.FirstName} {l.Employee.LastName}".Trim();
        return new LoanDto(
            l.Id,
            l.EmployeeId,
            name,
            l.LoanType.ToString(),
            l.Amount,
            l.Emi,
            l.PaidAmount,
            l.Balance,
            l.TenureMonths,
            l.Status.ToString(),
            l.Reason,
            l.RequestedAtUtc);
    }
}
