using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class PayrollService : IPayrollService
{
    private const decimal FixedDeductions = 250m;

    private readonly IUnitOfWork _uow;

    public PayrollService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<PayrollSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        // Aggregate in SQL — previously this loaded every payslip (with employee and
        // department) just to sum five numbers.
        var payslips = _uow.Payslips.Query();

        var totals = await _uow.Payslips.FirstOrDefaultAsync(
            payslips.GroupBy(_ => 1).Select(g => new
            {
                Gross = g.Sum(p => p.BasicSalary),
                Allowances = g.Sum(p => p.Allowances),
                Deductions = g.Sum(p => p.Deductions),
                Net = g.Sum(p => p.NetPay),
            }),
            ct);

        var employees = await _uow.Payslips.CountQueryAsync(payslips.Select(p => p.EmployeeId).Distinct(), ct);

        return new PayrollSummaryDto(
            totals?.Gross ?? 0m,
            totals?.Allowances ?? 0m,
            totals?.Deductions ?? 0m,
            totals?.Net ?? 0m,
            employees);
    }

    public async Task<IReadOnlyList<PayrollRunDto>> GetRunsAsync(CancellationToken ct = default)
    {
        // No payslip Include: the run summary comes from the stored totals, so eager-loading
        // every payslip of every run is wasted work.
        var runs = await _uow.PayrollRuns.ToListAsync(
            _uow.PayrollRuns.Query()
                .OrderByDescending(r => r.Year)
                .ThenByDescending(r => r.Month),
            ct);

        return runs.Select(ToRunDto).ToList();
    }

    public async Task<IReadOnlyList<PayslipDto>> GetPayslipsForRunAsync(Guid runId, CancellationToken ct = default)
    {
        var payslips = await _uow.Payslips.ListForRunAsync(runId, ct);
        return payslips.Select(ToPayslipDto).ToList();
    }

    public async Task<IReadOnlyList<PayslipDto>> GetPayslipsForEmployeeAsync(Guid employeeId, CancellationToken ct = default)
    {
        var payslips = await _uow.Payslips.ListForEmployeeAsync(employeeId, ct);
        return payslips
            .OrderByDescending(p => p.Year)
            .ThenByDescending(p => p.Month)
            .Select(ToPayslipDto)
            .ToList();
    }

    public async Task<PayrollRunDto> RunPayrollAsync(RunPayrollRequest request, CancellationToken ct = default)
    {
        if (await _uow.PayrollRuns.GetByPeriodAsync(request.Year, request.Month, ct) is { } existing)
        {
            throw new ConflictException(
                $"Payroll for {Formatting.MonthYear(request.Month, request.Year)} has already been processed (status: {existing.Status}).");
        }

        var employees = await _uow.Employees.ListWithDepartmentAsync(ct);
        var active = employees.Where(e => e.Status != EmploymentStatus.Terminated).ToList();

        if (active.Count == 0)
        {
            throw new ValidationException("There are no employees to run payroll for.");
        }

        var run = new PayrollRun
        {
            Month = request.Month,
            Year = request.Year,
            PayDate = request.PayDate,
            PaymentMethod = request.PaymentMethod,
            Status = PayrollStatus.Processed,
            EmployeeCount = active.Count,
            ProcessedAtUtc = DateTime.UtcNow,
        };

        var payslips = new List<Payslip>();

        foreach (var employee in active)
        {
            var basic = employee.BasicSalary;
            var allowances = employee.HousingAllowance + employee.TransportAllowance + employee.MobileAllowance + employee.OtherAllowances;
            var deductions = FixedDeductions;
            var net = basic + allowances - deductions;

            payslips.Add(new Payslip
            {
                PayrollRunId = run.Id,
                EmployeeId = employee.Id,
                Month = request.Month,
                Year = request.Year,
                BasicSalary = basic,
                Allowances = allowances,
                Deductions = deductions,
                NetPay = net,
                WorkingDays = DateTime.DaysInMonth(request.Year, request.Month),
                Status = PayrollStatus.Processed,
                PayDate = request.PayDate,
            });
        }

        run.TotalGross = payslips.Sum(p => p.BasicSalary);
        run.TotalAllowances = payslips.Sum(p => p.Allowances);
        run.TotalDeductions = payslips.Sum(p => p.Deductions);
        run.TotalNet = payslips.Sum(p => p.NetPay);

        await _uow.PayrollRuns.AddAsync(run, ct);
        await _uow.Payslips.AddRangeAsync(payslips, ct);
        await _uow.SaveChangesAsync(ct);

        return ToRunDto(run);
    }

    private static PayrollRunDto ToRunDto(PayrollRun run) => new(
        run.Id,
        run.Month,
        run.Year,
        run.PayDate,
        run.Status.ToString(),
        run.EmployeeCount,
        run.TotalGross,
        run.TotalAllowances,
        run.TotalDeductions,
        run.TotalNet);

    private static PayslipDto ToPayslipDto(Payslip p)
    {
        var name = p.Employee is null ? "—" : $"{p.Employee.FirstName} {p.Employee.LastName}".Trim();
        return new PayslipDto(
            p.Id,
            p.EmployeeId,
            name,
            p.Employee?.Department?.Name ?? "—",
            p.Month,
            p.Year,
            p.BasicSalary,
            p.Allowances,
            p.Deductions,
            p.NetPay,
            p.WorkingDays,
            p.Status.ToString(),
            p.PayDate);
    }
}
