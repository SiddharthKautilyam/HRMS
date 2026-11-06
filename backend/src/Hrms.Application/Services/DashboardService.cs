using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class DashboardService : IDashboardService
{
    private readonly IUnitOfWork _uow;

    public DashboardService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<DashboardStatsDto> GetStatsAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var totalEmployees = await _uow.Employees.CountAsync(ct);
        var departments = await _uow.Departments.CountAsync(ct);

        var attendance = await LoadDayStatusesAsync(today, ct);

        // On weekends (or before any punches) fall back to the most recent working
        // day that actually has attendance so the KPI is meaningful.
        if (!attendance.Any(status => status != AttendanceStatus.Weekend))
        {
            var latestWorkingDay = await _uow.Attendance.FirstOrDefaultAsync(
                _uow.Attendance.Query()
                    .Where(r => r.Status != AttendanceStatus.Weekend)
                    .OrderByDescending(r => r.Date)
                    .Select(r => (DateOnly?)r.Date),
                ct);

            if (latestWorkingDay is { } date)
            {
                attendance = await LoadDayStatusesAsync(date, ct);
            }
        }

        var present = attendance.Count(status => status is AttendanceStatus.Present or AttendanceStatus.Late
            or AttendanceStatus.Remote or AttendanceStatus.LeftEarly);
        var attendanceRate = attendance.Count == 0
            ? 0m
            : Math.Round((decimal)present / attendance.Count * 100, 1);

        var pendingApprovals =
            await _uow.Approvals.CountQueryAsync(_uow.Approvals.Query().Where(a => a.Status == ApprovalStatus.Pending), ct) +
            await _uow.Regularizations.CountQueryAsync(_uow.Regularizations.Query().Where(r => r.Status == ApprovalStatus.Pending), ct);

        var monthlyPayroll = await _uow.PayrollRuns.FirstOrDefaultAsync(
            _uow.PayrollRuns.Query()
                .OrderByDescending(r => r.Year)
                .ThenByDescending(r => r.Month)
                .Select(r => (decimal?)r.TotalNet),
            ct) ?? 0m;

        var onLeaveToday = await _uow.LeaveRequests.CountQueryAsync(
            _uow.LeaveRequests.Query().Where(l => l.Status == LeaveStatus.Approved && l.FromDate <= today && l.ToDate >= today),
            ct);

        var newJoiners = await _uow.Employees.CountQueryAsync(
            _uow.Employees.Query().Where(e => e.JoinDate.Year == today.Year && e.JoinDate.Month == today.Month),
            ct);

        var resignations = await _uow.Employees.CountQueryAsync(
            _uow.Employees.Query().Where(e => e.Status == EmploymentStatus.Offboarding),
            ct);

        return new DashboardStatsDto(
            totalEmployees,
            attendanceRate,
            pendingApprovals,
            monthlyPayroll,
            departments,
            newJoiners,
            onLeaveToday,
            resignations);
    }

    public async Task<EmployeeDashboardDto> GetMyDashboardAsync(Guid employeeId, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetWithDepartmentAsync(employeeId, ct)
                       ?? throw NotFoundException.For("Employee", employeeId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Only the columns this screen needs — the previous call eager-loaded six
        // navigation properties (one query each with split queries) and joined the
        // employee onto every attendance row.
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd = monthStart.AddMonths(1);
        var monthRecords = await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query()
                .Where(r => r.EmployeeId == employeeId && r.Date >= monthStart && r.Date < monthEnd)
                .Select(r => new { r.Date, r.CheckIn, r.WorkHours, r.Status }),
            ct);

        var summary = new AttendanceSummaryDto(
            monthRecords.Count(r => r.Status is AttendanceStatus.Present or AttendanceStatus.Late
                or AttendanceStatus.Remote or AttendanceStatus.LeftEarly),
            monthRecords.Count(r => r.Status == AttendanceStatus.Absent),
            monthRecords.Count(r => r.Status == AttendanceStatus.Late),
            monthRecords.Count(r => r.Status == AttendanceStatus.OnLeave));

        var todayRecord = monthRecords.FirstOrDefault(r => r.Date == today);
        var checkInLabel = todayRecord?.CheckIn is { } checkIn
            ? checkIn.ToString("hh:mm tt")
            : "Not checked in";

        var weekStart = today.AddDays(-6);
        var weekRecords = monthRecords.Where(r => r.Date >= weekStart).ToList();
        var workingHours = weekRecords.Sum(r => r.WorkHours);

        var trend = new List<AttendanceTrendPointDto>();
        for (var i = 6; i >= 0; i--)
        {
            var date = today.AddDays(-i);
            var record = monthRecords.FirstOrDefault(r => r.Date == date);
            trend.Add(new AttendanceTrendPointDto(
                date.DayOfWeek.ToString()[..3],
                record is { Status: AttendanceStatus.Present or AttendanceStatus.Remote or AttendanceStatus.Late or AttendanceStatus.LeftEarly } ? 1 : 0,
                record is { Status: AttendanceStatus.Absent } ? 1 : 0,
                record is { Status: AttendanceStatus.Late } ? 1 : 0));
        }

        // Leave balances
        var types = await _uow.LeaveTypes.ToListAsync(
            _uow.LeaveTypes.Query().Where(t => t.IsActive).OrderBy(t => t.Name), ct);
        var ownLeaves = await _uow.LeaveRequests.ListForEmployeeAsync(employeeId, ct);

        var balances = types.Select(type =>
        {
            var used = ownLeaves
                .Where(l => l.LeaveTypeId == type.Id && l.Status == LeaveStatus.Approved && l.FromDate.Year == today.Year)
                .Sum(l => l.Days);

            return new LeaveBalanceDto(type.Name, Math.Max(0, type.MaxDaysPerYear - used), type.MaxDaysPerYear, used, type.Color);
        }).ToList();

        var recentLeaves = ownLeaves.Take(5).Select(l => new RecentLeaveDto(
            l.Id,
            $"{employee.FirstName} {employee.LastName}".Trim(),
            l.LeaveType?.Name ?? "—",
            $"{Formatting.ShortDate(l.FromDate)} - {Formatting.ShortDate(l.ToDate)}",
            l.Status.ToString())).ToList();

        var announcements = await _uow.Announcements.ToListAsync(
            _uow.Announcements.Query().Where(a => a.IsActive).OrderByDescending(a => a.PublishedAtUtc).Take(5), ct);

        var holidays = await _uow.Holidays.ToListAsync(
            _uow.Holidays.Query().Where(h => h.Date >= today).OrderBy(h => h.Date).Take(5), ct);

        var activity = new List<ActivityDto>();

        if (todayRecord?.CheckIn is { } checkInTime)
        {
            activity.Add(new ActivityDto(
                employee.Id,
                $"{employee.FirstName} {employee.LastName}".Trim(),
                employee.EmployeeCode,
                employee.Department?.Name ?? "—",
                "Checked in",
                $"{checkInTime:hh:mm tt} · Today",
                todayRecord.Status.ToString()));
        }

        activity.AddRange(recentLeaves.Select(l => new ActivityDto(
            employee.Id,
            $"{employee.FirstName} {employee.LastName}".Trim(),
            employee.EmployeeCode,
            employee.Department?.Name ?? "—",
            $"{l.LeaveType} leave · {l.DateLabel}",
            "Recent",
            l.Status)));

        return new EmployeeDashboardDto(
            employee.Id,
            $"{employee.FirstName} {employee.LastName}".Trim(),
            Formatting.Initials($"{employee.FirstName} {employee.LastName}"),
            employee.JobTitle,
            employee.Department?.Name ?? "—",
            todayRecord?.Status.ToString() ?? employee.Status.ToString(),
            today.ToString("dddd, MMMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture),
            checkInLabel,
            summary,
            balances,
            recentLeaves,
            announcements.Select(a => new AnnouncementDto(
                a.Id, a.Title, a.Message, a.Tag, a.Severity.ToString(),
                a.PublishedAtUtc, Formatting.Relative(a.PublishedAtUtc), a.IsActive)).ToList(),
            holidays.Select(h => new HolidayDto(
                h.Id, h.Name, h.Date, h.Date.DayOfWeek.ToString(), h.Type.ToString())).ToList(),
            activity.Take(6).ToList(),
            trend,
            workingHours);
    }

    public async Task<IReadOnlyList<DepartmentHeadcountDto>> GetDepartmentHeadcountAsync(CancellationToken ct = default)
    {
        return await _uow.Departments.ToListAsync(
            _uow.Departments.Query()
                .OrderByDescending(d => d.Employees.Count)
                .Select(d => new DepartmentHeadcountDto(d.Name, d.Employees.Count)),
            ct);
    }

    public async Task<IReadOnlyList<AttendanceTrendPointDto>> GetAttendanceTrendAsync(CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var from = today.AddDays(-6);

        // Aggregate per day in SQL — previously every attendance row for the week was loaded.
        var daily = await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query()
                .Where(r => r.Date >= from && r.Date <= today)
                .GroupBy(r => r.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Present = g.Sum(r => r.Status == AttendanceStatus.Present || r.Status == AttendanceStatus.Remote
                        || r.Status == AttendanceStatus.Late ? 1 : 0),
                    Absent = g.Sum(r => r.Status == AttendanceStatus.Absent ? 1 : 0),
                    Late = g.Sum(r => r.Status == AttendanceStatus.Late ? 1 : 0),
                }),
            ct);

        var byDate = daily.ToDictionary(d => d.Date);
        var result = new List<AttendanceTrendPointDto>();

        for (var i = 6; i >= 0; i--)
        {
            var date = today.AddDays(-i);
            byDate.TryGetValue(date, out var day);
            result.Add(new AttendanceTrendPointDto(
                date.DayOfWeek.ToString()[..3],
                day?.Present ?? 0,
                day?.Absent ?? 0,
                day?.Late ?? 0));
        }

        return result;
    }

    /// <summary>Just the attendance statuses for a day — no employee join, no ordering.</summary>
    private async Task<IReadOnlyList<AttendanceStatus>> LoadDayStatusesAsync(DateOnly date, CancellationToken ct) =>
        await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query().Where(r => r.Date == date).Select(r => r.Status),
            ct);

    public async Task<IReadOnlyList<ActivityDto>> GetRecentActivityAsync(int take, CancellationToken ct = default)
    {
        var count = Math.Clamp(take, 1, 50);

        var leaveItems = await _uow.LeaveRequests.SearchAsync(null, null, 1, count, ct);
        var employeeItems = await _uow.Employees.SearchAsync(null, null, null, 1, count, ct);

        var fromLeaves = leaveItems.Items.Select(l => (
            When: l.SubmittedAtUtc,
            Dto: new ActivityDto(
                l.EmployeeId,
                l.Employee is null ? "—" : $"{l.Employee.FirstName} {l.Employee.LastName}".Trim(),
                l.Employee?.EmployeeCode ?? "—",
                l.Employee?.Department?.Name ?? "—",
                "Leave Applied",
                Formatting.ShortDate(l.SubmittedAtUtc),
                l.Status.ToString())));

        var fromEmployees = employeeItems.Items.Select(e => (
            When: e.CreatedAtUtc,
            Dto: new ActivityDto(
                e.Id,
                $"{e.FirstName} {e.LastName}".Trim(),
                e.EmployeeCode,
                e.Department?.Name ?? "—",
                "Joined",
                Formatting.ShortDate(e.JoinDate),
                e.Status.ToString())));

        return fromLeaves
            .Concat(fromEmployees)
            .OrderByDescending(x => x.When)
            .Take(count)
            .Select(x => x.Dto)
            .ToList();
    }

    public async Task<IReadOnlyList<ExpoAlertDto>> GetDocumentAlertsAsync(int take, CancellationToken ct = default)
    {
        var count = Math.Clamp(take, 1, 50);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff = today.AddDays(60);

        // Filter, sort and page in SQL — previously the whole documents table was loaded.
        var rows = await _uow.Documents.ToListAsync(
            _uow.Documents.Query()
                .Where(d => d.ExpiryDate != null && d.ExpiryDate <= cutoff)
                .OrderBy(d => d.ExpiryDate)
                .ThenBy(d => d.Id)
                .Take(count)
                .Select(d => new
                {
                    d.Name,
                    ExpiryDate = d.ExpiryDate!.Value,
                    EmployeeName = d.Employee != null ? d.Employee.FirstName + " " + d.Employee.LastName : null,
                }),
            ct);

        return rows.Select(d =>
        {
            var daysLeft = d.ExpiryDate.DayNumber - today.DayNumber;
            var status = daysLeft < 0 ? DocumentStatus.Expired
                : daysLeft <= 30 ? DocumentStatus.Critical
                : DocumentStatus.Warning;

            return new ExpoAlertDto(
                d.EmployeeName is null ? "—" : d.EmployeeName.Trim(),
                d.Name,
                Formatting.FullDate(d.ExpiryDate),
                daysLeft,
                status.ToString());
        }).ToList();
    }

    public async Task<IReadOnlyList<PendingApprovalDto>> GetPendingApprovalsAsync(int take, CancellationToken ct = default)
    {
        var count = Math.Clamp(take, 1, 50);

        // Filter and page in SQL instead of materialising every pending approval.
        var pending = await _uow.Approvals.ToListAsync(
            _uow.Approvals.Query()
                .Where(a => a.Status == ApprovalStatus.Pending)
                .OrderByDescending(a => a.SubmittedAtUtc)
                .Take(count)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Details,
                    a.Priority,
                    EmployeeName = a.Employee != null ? a.Employee.FirstName + " " + a.Employee.LastName : null,
                }),
            ct);

        return pending
            .Select(a => new PendingApprovalDto(
                a.Id,
                a.EmployeeName is null ? "—" : a.EmployeeName.Trim(),
                a.Title,
                a.Details,
                a.Priority.ToString()))
            .ToList();
    }

    public async Task<IReadOnlyList<RecentLeaveDto>> GetRecentLeavesAsync(int take, CancellationToken ct = default)
    {
        var count = Math.Clamp(take, 1, 50);
        var items = await _uow.LeaveRequests.SearchAsync(null, null, 1, count, ct);

        return items.Items.Select(l => new RecentLeaveDto(
            l.Id,
            l.Employee is null ? "—" : $"{l.Employee.FirstName} {l.Employee.LastName}".Trim(),
            l.LeaveType?.Name ?? "—",
            $"{Formatting.ShortDate(l.FromDate)} - {Formatting.ShortDate(l.ToDate)}",
            l.Status.ToString())).ToList();
    }

    public async Task<DashboardTemplateDataDto> GetTemplateDataAsync(Guid? employeeId, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Resolve target employee if provided, or pick first
        Guid targetEmpId;
        if (employeeId.HasValue && employeeId.Value != Guid.Empty)
        {
            targetEmpId = employeeId.Value;
        }
        else
        {
            var first = await _uow.Employees.FirstOrDefaultAsync(
                _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id), ct);
            targetEmpId = first ?? Guid.Empty;
        }

        // 1. Employees & Today Attendance
        var employees = await _uow.Employees.ListWithDepartmentAsync(ct);
        var todayRecords = await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query()
                .Where(a => a.Date == today)
                .Select(a => new { a.EmployeeId, a.CheckIn, a.Status }),
            ct);
        var recordByEmp = todayRecords.ToDictionary(r => r.EmployeeId);

        var todayLeaves = await _uow.LeaveRequests.ToListAsync(
            _uow.LeaveRequests.Query().Where(l => l.Status == LeaveStatus.Approved && l.FromDate <= today && l.ToDate >= today),
            ct);
        var leaveByEmp = todayLeaves.ToDictionary(l => l.EmployeeId);

        var presentList = new List<AttendancePersonDto>();
        var absentList = new List<AttendancePersonDto>();
        var onLeaveList = new List<AttendancePersonDto>();
        var lateList = new List<AttendancePersonDto>();

        foreach (var emp in employees.Where(e => e.Status == EmploymentStatus.Active))
        {
            var name = $"{emp.FirstName} {emp.LastName}".Trim();
            var dept = emp.Department?.Name ?? "General";
            var desig = emp.Designation?.Name ?? emp.JobTitle;

            if (leaveByEmp.TryGetValue(emp.Id, out var leave))
            {
                onLeaveList.Add(new AttendancePersonDto(emp.Id, name, emp.EmployeeCode, dept, desig, null, leave.Reason));
            }
            else if (recordByEmp.TryGetValue(emp.Id, out var rec) && rec.CheckIn is not null)
            {
                var person = new AttendancePersonDto(emp.Id, name, emp.EmployeeCode, dept, desig, rec.CheckIn.Value.ToString("hh:mm tt"), null);
                presentList.Add(person);
                if (rec.Status == AttendanceStatus.Late)
                {
                    lateList.Add(person);
                }
            }
            else
            {
                absentList.Add(new AttendancePersonDto(emp.Id, name, emp.EmployeeCode, dept, desig, null, null));
            }
        }

        var todayOverview = new TodayAttendanceOverviewDto(
            employees.Count,
            presentList.Count,
            absentList.Count,
            onLeaveList.Count,
            lateList.Count,
            presentList,
            absentList,
            onLeaveList,
            lateList);

        // 2. Notices
        var announcements = await _uow.Announcements.ToListAsync(
            _uow.Announcements.Query().Where(a => a.IsActive).OrderByDescending(a => a.PublishedAtUtc).Take(8), ct);
        var notices = announcements.Select(a => new NoticeBoardDto(
            a.Id, a.Title, a.Message, a.Tag, a.Severity.ToString(), a.ImageUrl, a.LinkUrl, a.PublishedAtUtc)).ToList();

        // 3. Celebrations (Birthdays, Anniversaries, New Joinees)
        var celebrations = new List<CelebrationDto>();
        foreach (var emp in employees.Where(e => e.Status == EmploymentStatus.Active))
        {
            var name = $"{emp.FirstName} {emp.LastName}".Trim();
            var dept = emp.Department?.Name ?? "General";

            if (emp.DateOfBirth is { } dob && dob.Month == today.Month)
            {
                celebrations.Add(new CelebrationDto(emp.Id, name, emp.EmployeeCode, dept, "Birthday", $"Birthday on {new DateTime(today.Year, dob.Month, dob.Day):MMM d}", null));
            }

            if (emp.JoinDate.Month == today.Month && emp.JoinDate.Year < today.Year)
            {
                var yrs = today.Year - emp.JoinDate.Year;
                celebrations.Add(new CelebrationDto(emp.Id, name, emp.EmployeeCode, dept, "WorkAnniversary", $"{yrs} Year{(yrs > 1 ? "s" : "")} on {new DateTime(today.Year, emp.JoinDate.Month, emp.JoinDate.Day):MMM d}", null));
            }

            if (emp.JoinDate >= today.AddDays(-30) && emp.JoinDate <= today)
            {
                celebrations.Add(new CelebrationDto(emp.Id, name, emp.EmployeeCode, dept, "NewJoinee", $"Joined {emp.JoinDate:MMM d, yyyy}", null));
            }
        }

        // 4. Upcoming Holidays
        var holidays = await _uow.Holidays.ToListAsync(
            _uow.Holidays.Query().Where(h => h.Date >= today).OrderBy(h => h.Date).Take(6), ct);
        var holidayDtos = holidays.Select(h => new HolidayDto(h.Id, h.Name, h.Date, h.Date.DayOfWeek.ToString(), h.Type.ToString())).ToList();

        // 5. Tasks
        var tasks = await _uow.Tasks.ToListAsync(
            _uow.Tasks.Query()
                .Where(t => targetEmpId == Guid.Empty || t.EmployeeId == targetEmpId)
                .OrderBy(t => t.DueDate)
                .Take(6), ct);
        var taskDtos = tasks.Select(t => new TaskDto(
            t.Id, t.EmployeeId, "You", t.Title, t.Description, t.DueDate, Formatting.ShortDate(t.DueDate), t.Status.ToString(), t.Priority.ToString(), t.AssignedBy)).ToList();

        // 6. Pending Approvals
        var pendingApprovals = await GetPendingApprovalsAsync(6, ct);

        // 7. Attendance Graph
        var attendanceGraph = await GetAttendanceTrendAsync(ct);

        // 8. Today's punches
        var startUtc = DateTime.UtcNow.Date;
        var endUtc = startUtc.AddDays(1);
        var todayPunches = await _uow.Punches.ToListAsync(
            _uow.Punches.Query()
                .Where(p => targetEmpId != Guid.Empty && p.EmployeeId == targetEmpId && p.PunchTime >= startUtc && p.PunchTime < endUtc)
                .OrderByDescending(p => p.PunchTime),
            ct);
        var punchDtos = todayPunches.Select(p => new EmployeePunchDto(
            p.Id, p.EmployeeId, "You", "", p.PunchTime, p.PunchType.ToString(), p.Note, p.Device)).ToList();

        // 9. Leave balances
        var leaveBalances = new List<LeaveBalanceDto>();
        if (targetEmpId != Guid.Empty)
        {
            var types = await _uow.LeaveTypes.ToListAsync(_uow.LeaveTypes.Query().Where(t => t.IsActive).OrderBy(t => t.Name), ct);
            var ownLeaves = await _uow.LeaveRequests.ListForEmployeeAsync(targetEmpId, ct);
            leaveBalances = types.Select(type =>
            {
                var used = ownLeaves.Where(l => l.LeaveTypeId == type.Id && l.Status == LeaveStatus.Approved && l.FromDate.Year == today.Year).Sum(l => l.Days);
                return new LeaveBalanceDto(type.Name, Math.Max(0, type.MaxDaysPerYear - used), type.MaxDaysPerYear, used, type.Color);
            }).ToList();
        }

        return new DashboardTemplateDataDto(
            todayOverview,
            notices,
            celebrations,
            holidayDtos,
            taskDtos,
            pendingApprovals,
            attendanceGraph,
            punchDtos,
            leaveBalances);
    }
}
