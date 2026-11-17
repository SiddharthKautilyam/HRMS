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

    public async Task<(byte[] Content, string FileName)> DownloadPayslipPdfAsync(
        Guid? payslipId = null,
        Guid? employeeId = null,
        string? employeeCode = null,
        int? month = null,
        int? year = null,
        CancellationToken ct = default)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var targetMonth = month ?? DateTime.UtcNow.Month;

        var comp = await _uow.CompanySettings.FirstOrDefaultAsync(_uow.CompanySettings.Query(), ct);
        var compName = string.IsNullOrWhiteSpace(comp?.CompanyName) ? "HRNexus Corp" : comp.CompanyName;
        var compAddr = string.IsNullOrWhiteSpace(comp?.Address) ? "Dubai Internet City, Dubai, UAE" : $"{comp.Address}, {comp.City}, {comp.Country}";
        var compTrn = string.IsNullOrWhiteSpace(comp?.Trn) ? "100-2495-9201" : comp.Trn;

        Payslip? payslip = null;

        if (payslipId.HasValue && payslipId.Value != Guid.Empty)
        {
            payslip = await _uow.Payslips.FirstOrDefaultAsync(
                _uow.Payslips.Query().Where(p => p.Id == payslipId.Value),
                ct);
        }

        if (payslip is null && (employeeId.HasValue || !string.IsNullOrWhiteSpace(employeeCode)))
        {
            var query = _uow.Payslips.Query();
            if (employeeId.HasValue && employeeId.Value != Guid.Empty)
            {
                query = query.Where(p => p.EmployeeId == employeeId.Value);
            }
            if (!string.IsNullOrWhiteSpace(employeeCode))
            {
                query = query.Where(p => p.Employee != null && p.Employee.EmployeeCode == employeeCode);
            }
            if (month.HasValue && year.HasValue)
            {
                query = query.Where(p => p.Month == month.Value && p.Year == year.Value);
            }

            payslip = await _uow.Payslips.FirstOrDefaultAsync(query, ct);
        }

        PayslipPdfData pdfData;

        if (payslip != null)
        {
            var emp = await _uow.Employees.FirstOrDefaultAsync(
                _uow.Employees.Query().Where(e => e.Id == payslip.EmployeeId),
                ct);

            var dept = emp?.DepartmentId != null
                ? await _uow.Departments.FirstOrDefaultAsync(_uow.Departments.Query().Where(d => d.Id == emp.DepartmentId), ct)
                : null;

            var empName = emp != null ? $"{emp.FirstName} {emp.LastName}".Trim() : (payslip.Employee != null ? $"{payslip.Employee.FirstName} {payslip.Employee.LastName}".Trim() : "Employee");
            var code = emp?.EmployeeCode ?? employeeCode ?? "EMP-001";
            var deptName = dept?.Name ?? emp?.Department?.Name ?? "Operations";
            var jobTitle = !string.IsNullOrWhiteSpace(emp?.JobTitle) ? emp.JobTitle : "Staff Member";

            pdfData = new PayslipPdfData(
                CompanyName: compName,
                CompanyAddress: compAddr,
                Trn: compTrn,
                EmployeeName: empName,
                EmployeeCode: code,
                Department: deptName,
                Designation: jobTitle,
                BankName: emp?.BankName ?? "Direct Deposit (WPS)",
                AccountNumber: emp?.AccountNumber ?? "—",
                Month: payslip.Month,
                Year: payslip.Year,
                PayDate: payslip.PayDate,
                WorkingDays: payslip.WorkingDays > 0 ? payslip.WorkingDays : DateTime.DaysInMonth(payslip.Year, payslip.Month),
                BasicSalary: payslip.BasicSalary,
                Allowances: payslip.Allowances,
                Deductions: payslip.Deductions,
                NetPay: payslip.NetPay,
                Status: payslip.Status.ToString(),
                LoanAdvance: 0m,
                OvertimePay: 0m
            );
        }
        else
        {
            Employee? emp = null;
            if (employeeId.HasValue && employeeId.Value != Guid.Empty)
            {
                emp = await _uow.Employees.FirstOrDefaultAsync(_uow.Employees.Query().Where(e => e.Id == employeeId.Value), ct);
            }
            if (emp is null && !string.IsNullOrWhiteSpace(employeeCode))
            {
                emp = await _uow.Employees.FirstOrDefaultAsync(_uow.Employees.Query().Where(e => e.EmployeeCode == employeeCode), ct);
            }

            var dept = emp?.DepartmentId != null
                ? await _uow.Departments.FirstOrDefaultAsync(_uow.Departments.Query().Where(d => d.Id == emp.DepartmentId), ct)
                : null;

            var code = emp?.EmployeeCode ?? employeeCode ?? "EMP-001";
            var empName = emp != null ? $"{emp.FirstName} {emp.LastName}".Trim() : GetDemoEmployeeName(code);
            var deptName = dept?.Name ?? (emp != null ? "Operations" : GetDemoDepartment(code));
            var jobTitle = !string.IsNullOrWhiteSpace(emp?.JobTitle) ? emp.JobTitle : GetDemoDesignation(code);

            var basic = emp?.BasicSalary > 0 ? emp.BasicSalary : GetDemoSalary(code);
            var allowances = emp != null
                ? (emp.HousingAllowance + emp.TransportAllowance + emp.MobileAllowance + emp.OtherAllowances)
                : Math.Round(basic * 0.25m, 2);
            var deductions = FixedDeductions;
            var net = basic + allowances - deductions;
            var daysInMonth = DateTime.DaysInMonth(targetYear, targetMonth);
            var payDate = new DateOnly(targetYear, targetMonth, daysInMonth);

            pdfData = new PayslipPdfData(
                CompanyName: compName,
                CompanyAddress: compAddr,
                Trn: compTrn,
                EmployeeName: empName,
                EmployeeCode: code,
                Department: deptName,
                Designation: jobTitle,
                BankName: emp?.BankName ?? "Direct Deposit (WPS)",
                AccountNumber: emp?.AccountNumber ?? "—",
                Month: targetMonth,
                Year: targetYear,
                PayDate: payDate,
                WorkingDays: 22,
                BasicSalary: basic,
                Allowances: allowances,
                Deductions: deductions,
                NetPay: net,
                Status: "Processed",
                LoanAdvance: code == "EMP-003" ? 200m : 0m,
                OvertimePay: code == "EMP-001" ? 150m : code == "EMP-002" ? 220m : 0m
            );
        }

        var pdfBytes = PayslipPdfBuilder.Build(pdfData);
        var fileName = $"Payslip_{pdfData.EmployeeCode}_{Formatting.MonthYear(pdfData.Month, pdfData.Year).Replace(' ', '_')}.pdf";
        return (pdfBytes, fileName);
    }

    private static string GetDemoEmployeeName(string code) => code switch
    {
        "EMP-001" => "Sarah Jenkins",
        "EMP-002" => "Alex Rivera",
        "EMP-003" => "James Wilson",
        "EMP-004" => "Elena Rostova",
        "EMP-005" => "David Chen",
        "EMP-006" => "Priya Patel",
        _ => "Employee " + code,
    };

    private static string GetDemoDepartment(string code) => code switch
    {
        "EMP-001" or "EMP-002" => "Engineering",
        "EMP-003" => "Marketing",
        "EMP-004" => "Design",
        "EMP-005" => "Finance",
        "EMP-006" => "HR",
        _ => "Operations",
    };

    private static string GetDemoDesignation(string code) => code switch
    {
        "EMP-001" => "Senior Fullstack Engineer",
        "EMP-002" => "DevOps Lead",
        "EMP-003" => "Growth Director",
        "EMP-004" => "Product Designer",
        "EMP-005" => "Senior Financial Analyst",
        "EMP-006" => "People Operations Manager",
        _ => "Staff Member",
    };

    private static decimal GetDemoSalary(string code) => code switch
    {
        "EMP-001" => 8500m,
        "EMP-002" => 7800m,
        "EMP-003" => 7200m,
        "EMP-004" => 6900m,
        "EMP-005" => 7400m,
        "EMP-006" => 6500m,
        _ => 6000m,
    };

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
            p.PayDate,
            p.Employee?.EmployeeCode);
    }
}
