using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class ErpService : IErpService
{
    private readonly IUnitOfWork _uow;

    public ErpService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<ErpOverviewDto> GetOverviewAsync(CancellationToken ct = default)
    {
        var integrations = await _uow.ErpIntegrations.ToListAsync(
            _uow.ErpIntegrations.Query().OrderBy(i => i.Name), ct);

        var logs = await _uow.ErpSyncLogs.ToListAsync(
            _uow.ErpSyncLogs.Query().OrderByDescending(l => l.SyncedAtUtc).Take(10), ct);

        return Build(integrations, logs);
    }

    public async Task<ErpOverviewDto> SyncAsync(CancellationToken ct = default)
    {
        var integrations = await _uow.ErpIntegrations.ToListAsync(
            _uow.ErpIntegrations.Query().OrderBy(i => i.Name), ct);

        foreach (var integration in integrations)
        {
            integration.LastSyncLabel = "just now";
            if (integration.Status is ErpStatus.Connected or ErpStatus.Error)
            {
                integration.Status = ErpStatus.Connected;
            }

            _uow.ErpIntegrations.Update(integration);
        }

        var employeeCount = await _uow.Employees.CountAsync(ct);

        await _uow.ErpSyncLogs.AddAsync(new ErpSyncLog
        {
            Message = $"Manual sync completed · {employeeCount} employee records",
            SyncedAtUtc = DateTime.UtcNow,
            Success = true,
            RecordsSynced = employeeCount,
        }, ct);

        await _uow.SaveChangesAsync(ct);

        var logs = await _uow.ErpSyncLogs.ToListAsync(
            _uow.ErpSyncLogs.Query().OrderByDescending(l => l.SyncedAtUtc).Take(10), ct);

        return Build(integrations, logs);
    }

    private static ErpOverviewDto Build(
        IReadOnlyList<ErpIntegration> integrations,
        IReadOnlyList<ErpSyncLog> logs) =>
        new(
            integrations.Count(i => i.Status == ErpStatus.Connected),
            logs.Count == 0 ? "never" : Formatting.Relative(logs[0].SyncedAtUtc),
            logs.Count(l => !l.Success),
            logs.Sum(l => l.RecordsSynced),
            integrations.Select(i => new ErpIntegrationDto(
                i.Id, i.Name, i.Description, i.Status.ToString(), i.LastSyncLabel, i.IconKey)).ToList(),
            logs.Select(l => new ErpSyncLogDto(l.Id, l.Message, Formatting.Relative(l.SyncedAtUtc), l.Success)).ToList());
}

public sealed class ReportService : IReportService
{
    private readonly IUnitOfWork _uow;

    public ReportService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IReadOnlyList<PayrollReportRowDto>> PayrollAsync(CancellationToken ct = default)
    {
        // Project the payslip count as a correlated subquery instead of eager-loading
        // every payslip for every run.
        var rows = await _uow.PayrollRuns.ToListAsync(
            _uow.PayrollRuns.Query()
                .OrderByDescending(r => r.Year)
                .ThenByDescending(r => r.Month)
                .Select(r => new
                {
                    r.Month,
                    r.Year,
                    PayslipCount = r.Payslips.Count,
                    r.TotalGross,
                    r.TotalAllowances,
                    r.TotalDeductions,
                    r.TotalNet,
                    r.Status,
                }),
            ct);

        return rows.Select(r => new PayrollReportRowDto(
            $"{Formatting.MonthName(r.Month)} {r.Year}",
            r.PayslipCount,
            r.TotalGross,
            r.TotalAllowances,
            r.TotalDeductions,
            r.TotalNet,
            r.Status.ToString())).ToList();
    }

    public async Task<IReadOnlyList<AttendanceReportRowDto>> AttendanceAsync(
        int? year,
        int? month,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var targetYear = year ?? now.Year;
        var targetMonth = month ?? now.Month;
        var from = new DateOnly(targetYear, targetMonth, 1);
        var to = from.AddMonths(1);

        // One GROUP BY instead of loading every record and re-scanning per employee.
        var employees = await _uow.Employees.ListWithDepartmentAsync(ct);
        var stats = await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query()
                .Where(a => a.Date >= from && a.Date < to)
                .GroupBy(a => a.EmployeeId)
                .Select(g => new
                {
                    EmployeeId = g.Key,
                    Present = g.Sum(r => r.Status == AttendanceStatus.Present || r.Status == AttendanceStatus.Late
                        || r.Status == AttendanceStatus.Remote || r.Status == AttendanceStatus.LeftEarly ? 1 : 0),
                    Absent = g.Sum(r => r.Status == AttendanceStatus.Absent ? 1 : 0),
                    Late = g.Sum(r => r.Status == AttendanceStatus.Late ? 1 : 0),
                    TotalHours = g.Sum(r => r.WorkHours),
                    RecordCount = g.Count(),
                }),
            ct);

        var byEmployee = stats.ToDictionary(s => s.EmployeeId);

        return employees.Select(employee =>
        {
            byEmployee.TryGetValue(employee.Id, out var s);
            var present = s?.Present ?? 0;
            var absent = s?.Absent ?? 0;
            var late = s?.Late ?? 0;
            var averageHours = s is null || s.RecordCount == 0 ? 0m : Math.Round(s.TotalHours / s.RecordCount, 1);

            var counted = present + absent;
            var percentage = counted == 0 ? 0m : (decimal)present / counted * 100;
            var rating = percentage >= 95 ? "Excellent"
                : percentage >= 85 ? "Good"
                : percentage >= 75 ? "Average"
                : "Poor";

            return new AttendanceReportRowDto(
                $"{employee.FirstName} {employee.LastName}".Trim(),
                employee.Department?.Name ?? "—",
                present,
                absent,
                late,
                averageHours,
                rating);
        }).ToList();
    }

    public async Task<IReadOnlyList<LeaveReportRowDto>> LeaveAsync(CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        var from = new DateOnly(year, 1, 1);
        var to = new DateOnly(year + 1, 1, 1);

        var employees = await _uow.Employees.ListWithDepartmentAsync(ct);
        var types = await _uow.LeaveTypes.ToListAsync(_uow.LeaveTypes.Query(), ct);

        // Aggregate approved days per employee/type in SQL rather than loading every request.
        var usage = await _uow.LeaveRequests.ToListAsync(
            _uow.LeaveRequests.Query()
                .Where(l => l.Status == LeaveStatus.Approved && l.FromDate >= from && l.FromDate < to)
                .GroupBy(l => new { l.EmployeeId, l.LeaveTypeId })
                .Select(g => new { g.Key.EmployeeId, g.Key.LeaveTypeId, Days = g.Sum(x => x.Days) }),
            ct);

        var used = usage.ToDictionary(u => (u.EmployeeId, u.LeaveTypeId), u => u.Days);

        int Used(Guid employeeId, string typeName)
        {
            var type = types.FirstOrDefault(t => t.Name.Equals(typeName, StringComparison.OrdinalIgnoreCase));
            return type is null ? 0 : used.GetValueOrDefault((employeeId, type.Id));
        }

        var annual = types.FirstOrDefault(t => t.Name.Contains("Annual", StringComparison.OrdinalIgnoreCase));

        return employees.Select(employee =>
        {
            var annualUsed = Used(employee.Id, "Annual Leave");
            var balance = annual is null ? 0 : Math.Max(0, annual.MaxDaysPerYear - annualUsed);

            return new LeaveReportRowDto(
                $"{employee.FirstName} {employee.LastName}".Trim(),
                annualUsed,
                Used(employee.Id, "Sick Leave"),
                Used(employee.Id, "Emergency Leave"),
                Used(employee.Id, "Unpaid Leave"),
                balance);
        }).ToList();
    }

    public async Task<IReadOnlyList<OvertimeReportRowDto>> OvertimeAsync(CancellationToken ct = default)
    {
        var approvals = await _uow.Approvals.ListWithEmployeeAsync(null, ApprovalType.Overtime, ct);

        return approvals
            .Where(a => a.OvertimeHours is > 0)
            .Select(a =>
            {
                var hours = a.OvertimeHours ?? 0;
                return new OvertimeReportRowDto(
                    a.Employee is null ? "—" : $"{a.Employee.FirstName} {a.Employee.LastName}".Trim(),
                    hours,
                    "1.5x",
                    Math.Round(hours * 15m, 2),
                    a.Status.ToString());
            })
            .ToList();
    }
}
