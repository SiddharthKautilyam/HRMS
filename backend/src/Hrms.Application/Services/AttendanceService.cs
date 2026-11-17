using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class AttendanceService : IAttendanceService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;
    private readonly ITenantContext? _tenantContext;

    public AttendanceService(IUnitOfWork uow, ICurrentUser currentUser, ITenantContext? tenantContext = null)
    {
        _uow = uow;
        _currentUser = currentUser;
        _tenantContext = tenantContext;
    }

    public async Task<AttendanceSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var records = await LoadLatestDayAsync(ct);
        return new AttendanceSummaryDto(
            records.Count(r => r.Status == AttendanceStatus.Present),
            records.Count(r => r.Status == AttendanceStatus.Absent),
            records.Count(r => r.Status == AttendanceStatus.Late),
            records.Count(r => r.Status == AttendanceStatus.OnLeave));
    }

    public async Task<IReadOnlyList<AttendanceRecordDto>> GetForEmployeeMonthAsync(
        Guid employeeId,
        int year,
        int month,
        CancellationToken ct = default)
    {
        var records = await _uow.Attendance.ListForEmployeeMonthAsync(employeeId, year, month, ct);
        return records.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<AttendanceRecordDto>> GetTodayAsync(CancellationToken ct = default)
    {
        var records = await LoadLatestDayAsync(ct);
        return records.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<MonthlyMusterDayDto>> GetMusterAsync(
        Guid employeeId,
        int year,
        int month,
        CancellationToken ct = default)
    {
        var first = new DateOnly(year, month, 1);
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var lastDay = new DateOnly(year, month, daysInMonth);
        var records = await _uow.Attendance.ListForEmployeeMonthAsync(employeeId, year, month, ct);
        var byDate = records.ToDictionary(r => r.Date);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var leaves = await _uow.LeaveRequests.ToListAsync(
            _uow.LeaveRequests.Query().Where(l => l.EmployeeId == employeeId && l.Status == LeaveStatus.Approved && l.FromDate <= lastDay && l.ToDate >= first),
            ct);

        var result = new List<MonthlyMusterDayDto>();

        for (var day = 1; day <= daysInMonth; day++)
        {
            var date = first.AddDays(day - 1);
            var weekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

            if (byDate.TryGetValue(date, out var record))
            {
                result.Add(new MonthlyMusterDayDto(
                    date,
                    date.ToString("MMM d"),
                    record.CheckIn?.ToString("HH:mm"),
                    record.CheckOut?.ToString("HH:mm"),
                    record.WorkHours,
                    record.Status.ToString()));
            }
            else if (leaves.Any(l => l.FromDate <= date && l.ToDate >= date))
            {
                result.Add(new MonthlyMusterDayDto(
                    date,
                    date.ToString("MMM d"),
                    null,
                    null,
                    0,
                    AttendanceStatus.OnLeave.ToString()));
            }
            else if (weekend)
            {
                result.Add(new MonthlyMusterDayDto(
                    date,
                    date.ToString("MMM d"),
                    null,
                    null,
                    0,
                    AttendanceStatus.Weekend.ToString()));
            }
            else if (date > today)
            {
                result.Add(new MonthlyMusterDayDto(
                    date,
                    date.ToString("MMM d"),
                    null,
                    null,
                    0,
                    "Scheduled"));
            }
            else
            {
                result.Add(new MonthlyMusterDayDto(
                    date,
                    date.ToString("MMM d"),
                    null,
                    null,
                    0,
                    AttendanceStatus.Absent.ToString()));
            }
        }

        return result;
    }

    public async Task<IReadOnlyList<RegularizationDto>> GetRegularizationsAsync(CancellationToken ct = default)
    {
        var items = await _uow.Regularizations.ListWithEmployeeAsync(ct);
        return items.Select(ToRegularizationDto).ToList();
    }

    public async Task<RegularizationDto> CreateRegularizationAsync(
        CreateRegularizationRequest request,
        CancellationToken ct = default)
    {
        if (request.OutTime <= request.InTime)
        {
            throw new ValidationException("The out time must be after the in time.");
        }

        var employeeId = await ResolveEmployeeIdAsync(request.EmployeeId, ct);

        var entity = new RegularizationRequest
        {
            EmployeeId = employeeId,
            Date = request.Date,
            InTime = request.InTime,
            OutTime = request.OutTime,
            Reason = request.Reason.Trim(),
            Status = ApprovalStatus.Pending,
            SubmittedAtUtc = DateTime.UtcNow,
        };

        await _uow.Regularizations.AddAsync(entity, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await _uow.Regularizations.GetWithEmployeeAsync(entity.Id, ct)
                     ?? throw NotFoundException.For("Regularization request", entity.Id);

        return ToRegularizationDto(loaded);
    }

    public async Task<RegularizationDto> DecideRegularizationAsync(Guid id, bool approved, CancellationToken ct = default)
    {
        var entity = await _uow.Regularizations.GetWithEmployeeAsync(id, ct)
                     ?? throw NotFoundException.For("Regularization request", id);

        if (entity.Status != ApprovalStatus.Pending)
        {
            throw new ConflictException("This regularization request has already been decided.");
        }

        entity.Status = approved ? ApprovalStatus.Approved : ApprovalStatus.Rejected;
        entity.DecidedAtUtc = DateTime.UtcNow;
        entity.DecidedByUserId = _currentUser.UserId;

        _uow.Regularizations.Update(entity);

        if (approved)
        {
            var record = await _uow.Attendance.GetForEmployeeDateAsync(entity.EmployeeId, entity.Date, ct);
            var workHours = (decimal)Math.Max(0, Math.Round((entity.OutTime.ToTimeSpan() - entity.InTime.ToTimeSpan()).TotalHours, 2));
            if (record == null)
            {
                record = new AttendanceRecord
                {
                    EmployeeId = entity.EmployeeId,
                    Date = entity.Date,
                    CheckIn = entity.InTime,
                    CheckOut = entity.OutTime,
                    BreakMinutes = 0,
                    WorkHours = workHours,
                    Status = AttendanceStatus.Present,
                    Notes = $"Regularized: {entity.Reason}"
                };
                await _uow.Attendance.AddAsync(record, ct);
            }
            else
            {
                record.CheckIn = entity.InTime;
                record.CheckOut = entity.OutTime;
                record.WorkHours = workHours;
                record.Status = AttendanceStatus.Present;
                record.Notes = string.IsNullOrWhiteSpace(record.Notes)
                    ? $"Regularized: {entity.Reason}"
                    : $"{record.Notes} | Regularized: {entity.Reason}";
                _uow.Attendance.Update(record);
            }
        }

        await _uow.SaveChangesAsync(ct);
        return ToRegularizationDto(entity);
    }

    private async Task<(TimeZoneInfo TimeZone, string TimeZoneName, int MaxPunchDurationHours)> GetCompanyTimeZoneAsync(CancellationToken ct)
    {
        var settings = await _uow.CompanySettings.FirstOrDefaultAsync(
            _uow.CompanySettings.Query().OrderBy(c => c.CreatedAtUtc), ct);
        if (settings == null || string.IsNullOrWhiteSpace(settings.TimeZone))
        {
            throw new BadRequestException("The company's time zone is not configured. Please set a valid time zone in Company Profile settings before recording punches.");
        }
        var maxDuration = settings.MaxPunchDurationHours > 0 ? settings.MaxPunchDurationHours : 16;
        return (ResolveTimeZone(settings.TimeZone), settings.TimeZone, maxDuration);
    }

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var tz))
            {
                return tz;
            }
            throw new BadRequestException($"The company's configured time zone '{timeZoneId}' is invalid or not recognized by the server. Please update the time zone in Company Profile settings.");
        }
    }

    private static (double MaxAllowedHours, decimal TargetDailyHours, int LateGraceMinutes, TimeOnly ShiftStart, bool IsOvernight) GetShiftParameters(Shift? shift, int maxPunchDurationHours = 16)
    {
        var targetHours = shift?.DailyHours > 0 ? (decimal)shift.DailyHours : 8.0m;
        var lateGrace = shift?.LateGraceMinutes > 0 ? shift.LateGraceMinutes : 15;
        var shiftStart = shift?.StartTime ?? new TimeOnly(9, 0);

        if (shift == null)
        {
            return (Math.Max((double)maxPunchDurationHours, 16.0), targetHours, lateGrace, shiftStart, false);
        }

        bool isOvernight = shift.EndTime <= shift.StartTime;
        TimeSpan shiftDuration = isOvernight
            ? (shift.EndTime.ToTimeSpan() + TimeSpan.FromHours(24)) - shift.StartTime.ToTimeSpan()
            : shift.EndTime.ToTimeSpan() - shift.StartTime.ToTimeSpan();

        // One unified rule: Shift duration + 4 hours buffer, bounded by company-configured max punch duration (default 16 hours)
        double maxHours = Math.Max(shiftDuration.TotalHours + 4.0, (double)maxPunchDurationHours);
        return (maxHours, targetHours, lateGrace, shiftStart, isOvernight);
    }

    private async Task<Guid> ResolveSelfOrExplicitEmployeeIdAsync(Guid? explicitId, CancellationToken ct)
    {
        if (explicitId is { } id && id != Guid.Empty) return id;
        if (_currentUser.EmployeeId is { } own && own != Guid.Empty) return own;

        throw new ValidationException("User is not linked to an employee record.");
    }

    public async Task<EmployeePunchDto> RecordPunchAsync(CreatePunchRequest request, CancellationToken ct = default)
    {
        var employeeId = await ResolveSelfOrExplicitEmployeeIdAsync(request.EmployeeId, ct);
        var employee = await _uow.Employees.GetWithDetailsAsync(employeeId, ct)
                       ?? await _uow.Employees.GetByIdAsync(employeeId, ct)
                       ?? throw NotFoundException.For("Employee", employeeId);

        if (!Enum.TryParse<PunchType>(request.PunchType, true, out var punchType))
        {
            punchType = PunchType.ClockIn;
        }

        var (tz, tzName, maxPunchDurationHours) = await GetCompanyTimeZoneAsync(ct);
        var nowUtc = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
        var localToday = DateOnly.FromDateTime(localNow);

        var (maxAllowedHours, targetDailyHours, lateGraceMinutes, shiftStart, isOvernight) = GetShiftParameters(employee.Shift, maxPunchDurationHours);

        // Fetch any currently open punches for this employee
        var existingOpenPunches = await _uow.Punches.ToListAsync(
            _uow.Punches.Query().Where(p => p.EmployeeId == employeeId && p.IsOpen),
            ct);

        EmployeePunch? activeOpenPunch = null;

        if (punchType == PunchType.ClockIn)
        {
            // If there are existing open punches, verify whether any is still within the active shift
            foreach (var open in existingOpenPunches)
            {
                var duration = nowUtc - open.PunchTime;
                if (duration.TotalHours <= maxAllowedHours)
                {
                    // Active shift still ongoing!
                    throw new ConflictException("You are already checked in. Please check out before checking in again.");
                }

                // Older open punch past shift end + grace period: close it as incomplete in this same transaction
                open.IsOpen = false;
                open.Note = string.IsNullOrWhiteSpace(open.Note)
                    ? "Incomplete shift - missing check-out (auto-closed)"
                    : $"{open.Note} | Incomplete shift (auto-closed)";
                _uow.Punches.Update(open);

                var priorDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(open.PunchTime, tz));
                var priorRecord = await _uow.Attendance.GetForEmployeeDateAsync(employeeId, priorDate, ct);
                if (priorRecord != null && (priorRecord.Notes == null || !priorRecord.Notes.Contains("needs regularization")))
                {
                    priorRecord.Notes = string.IsNullOrWhiteSpace(priorRecord.Notes)
                        ? "Incomplete punch - missing check-out (needs regularization)"
                        : $"{priorRecord.Notes} | Incomplete punch (needs regularization)";
                    _uow.Attendance.Update(priorRecord);
                }
            }
        }
        else if (punchType == PunchType.ClockOut)
        {
            // Must have an active open punch
            activeOpenPunch = existingOpenPunches.OrderByDescending(p => p.PunchTime).FirstOrDefault();
            if (activeOpenPunch == null)
            {
                throw new ConflictException("Cannot check out without an active check-in.");
            }

            var duration = nowUtc - activeOpenPunch.PunchTime;
            if (duration.TotalHours > maxAllowedHours)
            {
                // Open punch has exceeded the shift window: close it as incomplete in this transaction
                activeOpenPunch.IsOpen = false;
                activeOpenPunch.Note = string.IsNullOrWhiteSpace(activeOpenPunch.Note)
                    ? "Incomplete shift - exceeded maximum shift duration (auto-closed)"
                    : $"{activeOpenPunch.Note} | Exceeded maximum shift duration (auto-closed)";
                _uow.Punches.Update(activeOpenPunch);

                foreach (var extra in existingOpenPunches.Where(p => p.Id != activeOpenPunch.Id))
                {
                    extra.IsOpen = false;
                    _uow.Punches.Update(extra);
                }

                var priorDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(activeOpenPunch.PunchTime, tz));
                var priorRecord = await _uow.Attendance.GetForEmployeeDateAsync(employeeId, priorDate, ct);
                if (priorRecord != null)
                {
                    priorRecord.Notes = string.IsNullOrWhiteSpace(priorRecord.Notes)
                        ? "Incomplete shift - missing check-out past shift limit (needs regularization)"
                        : $"{priorRecord.Notes} | Needs regularization";
                    _uow.Attendance.Update(priorRecord);
                }

                await _uow.SaveChangesAsync(ct);

                var priorLocalTime = TimeZoneInfo.ConvertTimeFromUtc(activeOpenPunch.PunchTime, tz);
                throw new ConflictException(
                    $"Your check-in from {priorLocalTime:MMM dd, yyyy hh:mm tt} exceeded the allowable shift limit ({maxAllowedHours:F0} hours) and has been closed as incomplete. Please submit an attendance regularization request.");
            }

            // Normal active check-out within shift window
            activeOpenPunch.IsOpen = false;
            _uow.Punches.Update(activeOpenPunch);

            // Close any other orphan open punches as well
            foreach (var extra in existingOpenPunches.Where(p => p.Id != activeOpenPunch.Id))
            {
                extra.IsOpen = false;
                _uow.Punches.Update(extra);
            }
        }

        var punch = new EmployeePunch
        {
            EmployeeId = employeeId,
            PunchTime = nowUtc,
            PunchType = punchType,
            Note = request.Note,
            Device = request.Device ?? "Web Browser",
            IsOpen = (punchType == PunchType.ClockIn)
        };

        await _uow.Punches.AddAsync(punch, ct);

        // Determine attendance record target date (for night shifts, date is based on check-in date)
        DateOnly attendanceDate;
        if (punchType == PunchType.ClockOut && activeOpenPunch != null)
        {
            var openLocal = TimeZoneInfo.ConvertTimeFromUtc(activeOpenPunch.PunchTime, tz);
            attendanceDate = DateOnly.FromDateTime(openLocal);
        }
        else
        {
            attendanceDate = localToday;
        }

        // Query all punches associated with this shift / date window
        var shiftDayStartUtc = TimeZoneInfo.ConvertTimeToUtc(attendanceDate.ToDateTime(TimeOnly.MinValue), tz);
        var shiftDayEndUtc = shiftDayStartUtc.AddHours(maxAllowedHours + 4);

        var shiftPunches = await _uow.Punches.ToListAsync(
            _uow.Punches.Query()
                .Where(p => p.EmployeeId == employeeId && p.PunchTime >= shiftDayStartUtc && p.PunchTime <= shiftDayEndUtc)
                .OrderBy(p => p.PunchTime),
            ct);

        var allPunches = shiftPunches.Concat(new[] { punch }).OrderBy(p => p.PunchTime).ToList();

        TimeOnly? firstCheckIn = null;
        TimeOnly? lastCheckOut = null;
        long totalClosedSeconds = 0;
        DateTime? activeIntervalOpen = null;

        foreach (var p in allPunches)
        {
            var pLocal = TimeZoneInfo.ConvertTimeFromUtc(p.PunchTime, tz);
            var pTimeOnly = TimeOnly.FromDateTime(pLocal);

            if (p.PunchType == PunchType.ClockIn)
            {
                firstCheckIn ??= pTimeOnly;
                activeIntervalOpen = p.PunchTime;
            }
            else if (p.PunchType == PunchType.ClockOut)
            {
                lastCheckOut = pTimeOnly;
                if (activeIntervalOpen.HasValue)
                {
                    var diff = p.PunchTime - activeIntervalOpen.Value;
                    if (diff.TotalSeconds > 0)
                    {
                        totalClosedSeconds += (long)diff.TotalSeconds;
                    }
                    activeIntervalOpen = null;
                }
            }
        }

        var workedHours = Math.Round((decimal)totalClosedSeconds / 3600m, 2);
        bool currentlyStillCheckedIn = (punchType == PunchType.ClockIn);

        var attendanceRecord = await _uow.Attendance.GetForEmployeeDateAsync(employeeId, attendanceDate, ct);
        if (attendanceRecord is null)
        {
            attendanceRecord = new AttendanceRecord
            {
                EmployeeId = employeeId,
                Date = attendanceDate,
                CheckIn = firstCheckIn,
                CheckOut = lastCheckOut,
                BreakMinutes = 0,
                WorkHours = workedHours,
                Status = AttendanceStatus.Present
            };

            if (firstCheckIn.HasValue && firstCheckIn.Value > shiftStart.AddMinutes(lateGraceMinutes))
            {
                attendanceRecord.Status = AttendanceStatus.Late;
            }

            await _uow.Attendance.AddAsync(attendanceRecord, ct);
        }
        else
        {
            attendanceRecord.CheckIn = firstCheckIn ?? attendanceRecord.CheckIn;
            if (lastCheckOut.HasValue)
            {
                attendanceRecord.CheckOut = lastCheckOut.Value;
            }
            attendanceRecord.WorkHours = workedHours;

            // Only finalize status to HalfDay or Absent if the employee is NOT currently checked in!
            if (currentlyStillCheckedIn)
            {
                // While still working, do not downgrade to HalfDay
                if (attendanceRecord.CheckIn.HasValue && attendanceRecord.CheckIn.Value > shiftStart.AddMinutes(lateGraceMinutes))
                {
                    attendanceRecord.Status = AttendanceStatus.Late;
                }
                else
                {
                    attendanceRecord.Status = AttendanceStatus.Present;
                }
            }
            else
            {
                // Finalize status after check out based on shift target hours
                if (attendanceRecord.WorkHours >= targetDailyHours * 0.9m || attendanceRecord.WorkHours >= 7.5m)
                {
                    if (attendanceRecord.CheckIn.HasValue && attendanceRecord.CheckIn.Value > shiftStart.AddMinutes(lateGraceMinutes))
                    {
                        attendanceRecord.Status = AttendanceStatus.Late;
                    }
                    else
                    {
                        attendanceRecord.Status = AttendanceStatus.Present;
                    }
                }
                else if (attendanceRecord.WorkHours >= targetDailyHours * 0.5m || attendanceRecord.WorkHours >= 4.0m)
                {
                    attendanceRecord.Status = AttendanceStatus.HalfDay;
                }
                else if (attendanceRecord.WorkHours > 0)
                {
                    attendanceRecord.Status = AttendanceStatus.HalfDay;
                }
            }

            _uow.Attendance.Update(attendanceRecord);
        }

        try
        {
            await _uow.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (ex.GetType().Name.Contains("DbUpdate") || ex.Message.Contains("IX_EmployeePunches_EmployeeId_IsOpen") || ex.InnerException?.Message.Contains("IX_EmployeePunches_EmployeeId_IsOpen") == true)
        {
            // Database-level filtered unique index (IX_EmployeePunches_EmployeeId_IsOpen) caught a concurrent check-in
            throw new ConflictException("You are already checked in. Please check out before checking in again.");
        }

        var name = $"{employee.FirstName} {employee.LastName}".Trim();
        return new EmployeePunchDto(
            punch.Id,
            employee.Id,
            name,
            employee.EmployeeCode,
            punch.PunchTime,
            punch.PunchType.ToString(),
            punch.Note,
            punch.Device);
    }

    public async Task<EmployeePunchStatusDto> GetPunchStatusAsync(Guid? employeeId, CancellationToken ct = default)
    {
        var targetEmpId = await ResolveSelfOrExplicitEmployeeIdAsync(employeeId, ct);
        var employee = await _uow.Employees.GetWithDetailsAsync(targetEmpId, ct)
                       ?? await _uow.Employees.GetByIdAsync(targetEmpId, ct);

        var (tz, tzName, maxPunchDurationHours) = await GetCompanyTimeZoneAsync(ct);
        var nowUtc = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
        var localToday = DateOnly.FromDateTime(localNow);

        var (maxAllowedHours, _, _, _, _) = GetShiftParameters(employee?.Shift, maxPunchDurationHours);

        // Fetch any open punches for this employee (pure read-only, NO SaveChanges!)
        var openPunch = await _uow.Punches.FirstOrDefaultAsync(
            _uow.Punches.Query()
                .Where(p => p.EmployeeId == targetEmpId && p.IsOpen)
                .OrderByDescending(p => p.PunchTime),
            ct);

        bool isCheckedIn = false;
        DateTime? currentOpenInUtc = null;
        bool hasForgottenCheckOut = false;
        DateOnly? forgottenCheckOutDate = null;
        string? regularizationMsg = null;

        if (openPunch != null)
        {
            var openDuration = nowUtc - openPunch.PunchTime;
            if (openDuration.TotalHours > maxAllowedHours)
            {
                // Shift expired past shift end + grace period (or max shift length)
                hasForgottenCheckOut = true;
                var priorLocal = TimeZoneInfo.ConvertTimeFromUtc(openPunch.PunchTime, tz);
                forgottenCheckOutDate = DateOnly.FromDateTime(priorLocal);
                regularizationMsg = $"You did not check out from your shift on {forgottenCheckOutDate:MMM dd, yyyy}. That punch is marked as Incomplete and requires regularization.";
                isCheckedIn = false;
            }
            else
            {
                // Shift is actively ongoing (including night shifts that crossed midnight)
                isCheckedIn = true;
                currentOpenInUtc = openPunch.PunchTime;
            }
        }

        // Determine today's local date boundaries for punches display
        var localStart = localToday.ToDateTime(TimeOnly.MinValue);
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        var localEnd = localToday.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(localEnd, tz);

        // If active open punch started prior to today (e.g. night shift), extend window to include it
        var displayStartUtc = (isCheckedIn && currentOpenInUtc.HasValue && currentOpenInUtc.Value < startUtc)
            ? currentOpenInUtc.Value.AddHours(-1)
            : startUtc;

        var punchesQuery = await _uow.Punches.ToListAsync(
            _uow.Punches.Query()
                .Where(p => p.EmployeeId == targetEmpId && p.PunchTime >= displayStartUtc && p.PunchTime < endUtc)
                .OrderBy(p => p.PunchTime),
            ct);

        long closedSeconds = 0;
        TimeOnly? firstCheckIn = null;
        DateTime? activeCalcOpen = null;

        foreach (var p in punchesQuery)
        {
            var pLocal = TimeZoneInfo.ConvertTimeFromUtc(p.PunchTime, tz);
            var pTimeOnly = TimeOnly.FromDateTime(pLocal);

            if (p.PunchType == PunchType.ClockIn)
            {
                firstCheckIn ??= pTimeOnly;
                activeCalcOpen = p.PunchTime;
            }
            else if (p.PunchType == PunchType.ClockOut)
            {
                if (activeCalcOpen.HasValue)
                {
                    var diff = p.PunchTime - activeCalcOpen.Value;
                    if (diff.TotalSeconds > 0)
                    {
                        closedSeconds += (long)diff.TotalSeconds;
                    }
                    activeCalcOpen = null;
                }
            }
        }

        var workedHours = Math.Round((decimal)closedSeconds / 3600m, 2);
        var empName = employee == null ? "—" : $"{employee.FirstName} {employee.LastName}".Trim();
        var empCode = employee?.EmployeeCode ?? "—";

        var punchDtos = punchesQuery
            .OrderByDescending(p => p.PunchTime)
            .Select(p => new EmployeePunchDto(
                p.Id,
                p.EmployeeId,
                empName,
                empCode,
                p.PunchTime,
                p.PunchType.ToString(),
                p.Note,
                p.Device))
            .ToList();

        return new EmployeePunchStatusDto(
            IsCheckedIn: isCheckedIn,
            LastPunchTimeUtc: punchesQuery.LastOrDefault()?.PunchTime ?? openPunch?.PunchTime,
            ServerTimeUtc: nowUtc,
            CompanyTimeZone: tzName,
            FirstCheckInTime: firstCheckIn?.ToString("hh:mm tt"),
            WorkedHoursToday: workedHours,
            WorkedSecondsToday: closedSeconds,
            CurrentCheckInTimeUtc: currentOpenInUtc,
            TodayPunches: punchDtos,
            HasForgottenCheckOut: hasForgottenCheckOut,
            ForgottenCheckOutDate: forgottenCheckOutDate,
            RegularizationMessage: regularizationMsg);
    }

    public async Task<IReadOnlyList<EmployeePunchDto>> GetTodayPunchesAsync(Guid? employeeId, CancellationToken ct = default)
    {
        var targetEmpId = await ResolveSelfOrExplicitEmployeeIdAsync(employeeId, ct);
        var (tz, _, _) = await GetCompanyTimeZoneAsync(ct);
        var nowUtc = DateTime.UtcNow;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
        var localToday = DateOnly.FromDateTime(localNow);

        var localStart = localToday.ToDateTime(TimeOnly.MinValue);
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(localStart, tz);
        var localEnd = localToday.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(localEnd, tz);

        var punches = await _uow.Punches.ToListAsync(
            _uow.Punches.Query()
                .Where(p => p.EmployeeId == targetEmpId && p.PunchTime >= startUtc && p.PunchTime < endUtc)
                .OrderByDescending(p => p.PunchTime),
            ct);

        var emp = await _uow.Employees.GetByIdAsync(targetEmpId, ct);
        var name = emp is null ? "—" : $"{emp.FirstName} {emp.LastName}".Trim();
        var code = emp?.EmployeeCode ?? "—";

        return punches.Select(p => new EmployeePunchDto(
            p.Id,
            p.EmployeeId,
            name,
            code,
            p.PunchTime,
            p.PunchType.ToString(),
            p.Note,
            p.Device)).ToList();
    }

    public async Task<TodayAttendanceOverviewDto> GetTodayOverviewAsync(DateOnly? targetDate = null, CancellationToken ct = default)
    {
        var target = targetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var employees = await _uow.Employees.ListWithDepartmentAsync(ct);
        var dateRecords = await _uow.Attendance.ToListAsync(
            _uow.Attendance.Query()
                .Where(a => a.Date == target)
                .Select(a => new { a.EmployeeId, a.CheckIn, a.CheckOut, a.WorkHours, a.Status, a.Notes }),
            ct);
        var recordByEmp = dateRecords.ToDictionary(r => r.EmployeeId);

        var dateLeaves = await _uow.LeaveRequests.ToListAsync(
            _uow.LeaveRequests.Query().Where(l => l.Status == LeaveStatus.Approved && l.FromDate <= target && l.ToDate >= target),
            ct);
        var leaveByEmp = dateLeaves.ToDictionary(l => l.EmployeeId);

        var presentList = new List<AttendancePersonDto>();
        var absentList = new List<AttendancePersonDto>();
        var onLeaveList = new List<AttendancePersonDto>();
        var lateList = new List<AttendancePersonDto>();

        foreach (var emp in employees.Where(e => e.Status == EmploymentStatus.Active || e.Status == EmploymentStatus.OnLeave))
        {
            var name = $"{emp.FirstName} {emp.LastName}".Trim();
            var dept = emp.Department?.Name ?? "General";
            var desig = emp.Designation?.Name ?? emp.JobTitle;

            if (recordByEmp.TryGetValue(emp.Id, out var rec) && (rec.CheckIn is not null || rec.Status == AttendanceStatus.Present || rec.Status == AttendanceStatus.Late || rec.Status == AttendanceStatus.HalfDay))
            {
                var person = new AttendancePersonDto(
                    emp.Id,
                    name,
                    emp.EmployeeCode,
                    dept,
                    desig,
                    rec.CheckIn?.ToString("hh:mm tt"),
                    null,
                    rec.CheckOut?.ToString("hh:mm tt"),
                    rec.WorkHours,
                    rec.Status.ToString());
                presentList.Add(person);
                if (rec.Status == AttendanceStatus.Late)
                {
                    lateList.Add(person);
                }
            }
            else if (leaveByEmp.TryGetValue(emp.Id, out var leave))
            {
                onLeaveList.Add(new AttendancePersonDto(
                    emp.Id,
                    name,
                    emp.EmployeeCode,
                    dept,
                    desig,
                    null,
                    leave.Reason,
                    null,
                    0,
                    "OnLeave"));
            }
            else if (emp.Status == EmploymentStatus.OnLeave)
            {
                onLeaveList.Add(new AttendancePersonDto(
                    emp.Id,
                    name,
                    emp.EmployeeCode,
                    dept,
                    desig,
                    null,
                    "Approved Leave",
                    null,
                    0,
                    "OnLeave"));
            }
            else
            {
                absentList.Add(new AttendancePersonDto(
                    emp.Id,
                    name,
                    emp.EmployeeCode,
                    dept,
                    desig,
                    null,
                    null,
                    null,
                    0,
                    "Absent"));
            }
        }

        var totalActiveTracked = presentList.Count + absentList.Count + onLeaveList.Count;
        return new TodayAttendanceOverviewDto(
            totalActiveTracked,
            presentList.Count,
            absentList.Count,
            onLeaveList.Count,
            lateList.Count,
            presentList,
            absentList,
            onLeaveList,
            lateList);
    }

    /// <summary>Today's records, or the most recent day that has any records.</summary>
    private async Task<IReadOnlyList<AttendanceRecord>> LoadLatestDayAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var records = await _uow.Attendance.ListByDateAsync(today, ct);
        if (records.Count > 0) return records;

        var latest = await _uow.Attendance.FirstOrDefaultAsync(
            _uow.Attendance.Query().OrderByDescending(r => r.Date).Select(r => (DateOnly?)r.Date),
            ct);

        return latest is { } date ? await _uow.Attendance.ListByDateAsync(date, ct) : Array.Empty<AttendanceRecord>();
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

    private static AttendanceRecordDto ToDto(AttendanceRecord r)
    {
        var name = r.Employee is null ? "—" : $"{r.Employee.FirstName} {r.Employee.LastName}".Trim();
        return new AttendanceRecordDto(
            r.Id,
            r.EmployeeId,
            name,
            Formatting.Initials(name),
            r.Date,
            r.CheckIn?.ToString("HH:mm"),
            r.CheckOut?.ToString("HH:mm"),
            r.BreakMinutes,
            r.WorkHours,
            r.Status.ToString());
    }

    /// <summary>Applies a batch of captured punches (dedupe + attendance sync). Used by the face terminal.</summary>
    private async Task<PunchBatchResult> ProcessPunchBatchAsync(PunchBatchRequest request, CancellationToken ct = default)
    {
        if (request.Punches == null || request.Punches.Count == 0)
        {
            return new PunchBatchResult(true, 0, 0, 0, Array.Empty<string>(), "No punches received in payload.");
        }

        var processedCount = 0;
        var ignoredDuplicates = 0;
        var unmatchedCodes = new List<string>();

        // Normalise the payload once so every lookup below is in-memory
        // (previously each punch issued 3-4 separate database queries).
        var items = request.Punches
            .Where(i => !string.IsNullOrWhiteSpace(i.EmployeeCode))
            .Select(i => new
            {
                Code = i.EmployeeCode.Trim(),
                Item = i,
                Utc = i.PunchTime.Kind == DateTimeKind.Utc ? i.PunchTime : i.PunchTime.ToUniversalTime(),
            })
            .ToList();

        if (items.Count == 0)
        {
            return new PunchBatchResult(
                true,
                request.Punches.Count,
                0,
                0,
                Array.Empty<string>(),
                $"Synced 0 punch(es) from {request.DeviceSerial}. 0 duplicate(s) ignored.");
        }

        var codes = items.Select(x => x.Code.ToUpperInvariant()).Distinct().ToList();

        // One query for every referenced employee.
        var employees = (await _uow.Employees.ToListAsync(
            _uow.Employees.Query().Where(e => codes.Contains(e.EmployeeCode.ToUpper())), ct)).ToList();

        var employeeByCode = employees
            .GroupBy(e => e.EmployeeCode.ToUpperInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var employeeIds = employees.Select(e => e.Id).Distinct().ToList();

        // One query for the punches needed by duplicate detection and same-day toggle parity.
        var windowFrom = items.Min(x => x.Utc).Date.AddMinutes(-2);
        var windowTo = items.Max(x => x.Utc).Date.AddDays(1).AddMinutes(2);

        var punchesByEmployee = (await _uow.Punches.ToListAsync(
                _uow.Punches.Query().Where(p => employeeIds.Contains(p.EmployeeId)
                    && p.PunchTime >= windowFrom && p.PunchTime <= windowTo),
                ct))
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // One query for the attendance records covering the affected employee/date pairs.
        var dates = items.Select(x => DateOnly.FromDateTime(x.Utc)).Distinct().ToList();

        var recordByKey = (await _uow.Attendance.ToListAsync(
                _uow.Attendance.Query().Where(a => employeeIds.Contains(a.EmployeeId) && dates.Contains(a.Date)),
                ct))
            .ToDictionary(a => (a.EmployeeId, a.Date));

        var acceptedTimes = new Dictionary<Guid, List<DateTime>>();
        var newlyAdded = new HashSet<(Guid EmployeeId, DateOnly Date)>();

        foreach (var entry in items)
        {
            if (!employeeByCode.TryGetValue(entry.Code.ToUpperInvariant(), out var employee))
            {
                if (!unmatchedCodes.Contains(entry.Code))
                {
                    unmatchedCodes.Add(entry.Code);
                }
                continue;
            }

            var itemUtc = entry.Utc;
            var windowStart = itemUtc.AddMinutes(-2);
            var windowEnd = itemUtc.AddMinutes(2);

            var knownPunches = punchesByEmployee.TryGetValue(employee.Id, out var known) ? known : new List<EmployeePunch>();
            var accepted = acceptedTimes.TryGetValue(employee.Id, out var times) ? times : new List<DateTime>();

            // Deduplicate against existing punches and against earlier items in this payload.
            var isDuplicate = knownPunches.Any(p => p.PunchTime >= windowStart && p.PunchTime <= windowEnd)
                || accepted.Any(t => t >= windowStart && t <= windowEnd);

            if (isDuplicate)
            {
                ignoredDuplicates++;
                continue;
            }

            accepted.Add(itemUtc);
            acceptedTimes[employee.Id] = accepted;

            // Determine punch type
            if (!Enum.TryParse<PunchType>(entry.Item.PunchType, true, out var punchType))
            {
                var startOfDay = itemUtc.Date;
                var endOfDay = startOfDay.AddDays(1);
                var todayCount = knownPunches.Count(p => p.PunchTime >= startOfDay && p.PunchTime < endOfDay);
                punchType = (todayCount % 2 == 0) ? PunchType.ClockIn : PunchType.ClockOut;
            }

            var deviceName = entry.Item.DeviceName ?? (!string.IsNullOrWhiteSpace(request.DeviceSerial) ? request.DeviceSerial : "Face Terminal");
            var punch = new EmployeePunch
            {
                EmployeeId = employee.Id,
                PunchTime = itemUtc,
                PunchType = punchType,
                Note = entry.Item.Note ?? $"Face scan ({request.DeviceSerial})",
                Device = deviceName
            };
            await _uow.Punches.AddAsync(punch, ct);

            // Synchronise with AttendanceRecord
            var dateOnly = DateOnly.FromDateTime(itemUtc);
            var timeOnly = TimeOnly.FromDateTime(itemUtc.ToLocalTime());
            var key = (employee.Id, dateOnly);

            if (!recordByKey.TryGetValue(key, out var todayRecord))
            {
                var shiftStart = employee.Shift?.StartTime ?? new TimeOnly(9, 0);
                var isLate = punchType == PunchType.ClockIn && timeOnly > shiftStart.AddMinutes(15);

                todayRecord = new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    Date = dateOnly,
                    CheckIn = punchType == PunchType.ClockIn ? timeOnly : null,
                    CheckOut = punchType == PunchType.ClockOut ? timeOnly : null,
                    BreakMinutes = 0,
                    WorkHours = 0,
                    Status = isLate ? AttendanceStatus.Late : AttendanceStatus.Present
                };
                await _uow.Attendance.AddAsync(todayRecord, ct);
                recordByKey[key] = todayRecord;
                newlyAdded.Add(key);
            }
            else
            {
                if (punchType == PunchType.ClockIn)
                {
                    if (todayRecord.CheckIn is null || timeOnly < todayRecord.CheckIn)
                    {
                        todayRecord.CheckIn = timeOnly;
                    }
                }
                else if (punchType == PunchType.ClockOut)
                {
                    if (todayRecord.CheckOut is null || timeOnly > todayRecord.CheckOut)
                    {
                        todayRecord.CheckOut = timeOnly;
                    }
                }

                if (todayRecord.CheckIn is { } inT && todayRecord.CheckOut is { } outT)
                {
                    var span = outT - inT;
                    var totalHours = (decimal)Math.Max(0, span.TotalHours) - (todayRecord.BreakMinutes / 60m);
                    todayRecord.WorkHours = Math.Round(Math.Max(0, totalHours), 2);
                    if (todayRecord.WorkHours >= 7.5m)
                    {
                        todayRecord.Status = AttendanceStatus.Present;
                    }
                    else if (todayRecord.WorkHours >= 4m)
                    {
                        todayRecord.Status = AttendanceStatus.HalfDay;
                    }
                }

                // Pre-loaded records are untracked; a record added in this same payload already is.
                if (!newlyAdded.Contains(key))
                {
                    _uow.Attendance.Update(todayRecord);
                }
            }

            processedCount++;
        }

        await _uow.SaveChangesAsync(ct);

        var msg = $"Synced {processedCount} punch(es) from {request.DeviceSerial}. {ignoredDuplicates} duplicate(s) ignored.";
        if (unmatchedCodes.Count > 0)
        {
            msg += $" Unmatched codes: {string.Join(", ", unmatchedCodes)}.";
        }

        return new PunchBatchResult(
            Success: true,
            TotalReceived: request.Punches.Count,
            ProcessedCount: processedCount,
            IgnoredDuplicates: ignoredDuplicates,
            UnmatchedCodes: unmatchedCodes,
            Message: msg
        );
    }

    public async Task<IReadOnlyList<EnrolledFaceDto>> GetEnrolledFacesAsync(CancellationToken ct = default)
    {
        var employees = await _uow.Employees.ToListAsync(
            _uow.Employees.Query().Where(e => !string.IsNullOrEmpty(e.FaceDescriptor)),
            ct);

        return employees.Select(e => new EnrolledFaceDto(
            EmployeeId: e.Id,
            EmployeeCode: e.EmployeeCode,
            FullName: e.FullName,
            Department: e.Department?.Name ?? e.JobTitle ?? "Staff",
            AvatarUrl: e.FacePhotoUrl,
            FaceDescriptor: e.FaceDescriptor!,
            EnrolledAtUtc: e.FaceEnrolledAtUtc
        )).ToList();
    }

    public async Task<bool> EnrollFaceAsync(Guid employeeId, EnrollFaceRequest request, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetByIdAsync(employeeId, ct)
            ?? throw NotFoundException.For("Employee", employeeId);

        employee.FaceDescriptor = request.FaceDescriptor;
        if (!string.IsNullOrWhiteSpace(request.FacePhotoUrl))
        {
            employee.FacePhotoUrl = request.FacePhotoUrl;
        }
        employee.FaceEnrolledAtUtc = DateTime.UtcNow;

        await _uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RemoveFaceAsync(Guid employeeId, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetByIdAsync(employeeId, ct)
            ?? throw NotFoundException.For("Employee", employeeId);

        employee.FaceDescriptor = null;
        employee.FaceEnrolledAtUtc = null;

        await _uow.SaveChangesAsync(ct);
        return true;
    }

    public async Task<FacePunchResultDto> ProcessFacePunchAsync(FacePunchRequest request, CancellationToken ct = default)
    {
        Employee? employee = null;
        if (request.EmployeeId.HasValue && request.EmployeeId.Value != Guid.Empty)
        {
            employee = await _uow.Employees.GetByIdAsync(request.EmployeeId.Value, ct);
        }
        else if (!string.IsNullOrWhiteSpace(request.EmployeeCode))
        {
            var code = request.EmployeeCode.Trim();
            employee = await _uow.Employees.FirstOrDefaultAsync(
                _uow.Employees.Query().Where(e => e.EmployeeCode.ToLower() == code.ToLower()), ct);
        }

        if (employee is null)
        {
            return new FacePunchResultDto(
                Success: false,
                EmployeeId: Guid.Empty,
                EmployeeCode: request.EmployeeCode ?? string.Empty,
                EmployeeName: "Unknown Employee",
                PunchType: request.PunchType ?? "ClockIn",
                PunchTime: DateTime.UtcNow,
                Status: "Unmatched",
                Message: "Face recognized but employee record not found in system."
            );
        }

        var confidencePct = request.Confidence.HasValue ? $"{(int)(request.Confidence.Value * 100)}%" : "verified";
        var deviceName = !string.IsNullOrWhiteSpace(request.Device) ? request.Device : "Face Attendance Kiosk";

        var syncRequest = new PunchBatchRequest(
            DeviceSerial: deviceName,
            DeviceLocation: "Office Face Terminal",
            Punches: new[]
            {
                new PunchBatchItem(
                    EmployeeCode: employee.EmployeeCode,
                    PunchTime: DateTime.UtcNow,
                    PunchType: request.PunchType,
                    DeviceName: deviceName,
                    Note: $"Face Recognition scan ({confidencePct} match)"
                )
            }
        );

        var syncResult = await ProcessPunchBatchAsync(syncRequest, ct);
        var todayRecord = await _uow.Attendance.GetForEmployeeDateAsync(employee.Id, DateOnly.FromDateTime(DateTime.UtcNow), ct);

        var msg = syncResult.ProcessedCount > 0
            ? $"Face verified! Welcome {employee.FullName}."
            : syncResult.IgnoredDuplicates > 0
                ? $"{employee.FullName} was already punched recently (duplicate cooldown)."
                : syncResult.Message;

        return new FacePunchResultDto(
            Success: syncResult.ProcessedCount > 0 || syncResult.IgnoredDuplicates > 0,
            EmployeeId: employee.Id,
            EmployeeCode: employee.EmployeeCode,
            EmployeeName: employee.FullName,
            PunchType: request.PunchType ?? (todayRecord?.CheckOut != null ? "ClockOut" : "ClockIn"),
            PunchTime: DateTime.UtcNow,
            Status: todayRecord?.Status.ToString() ?? "Present",
            Message: msg
        );
    }

    public async Task<DailyAttendanceCloseoutResult> CloseoutDailyAttendanceAsync(DateOnly? targetDate = null, CancellationToken ct = default)
    {
        var (tz, _, _) = await GetCompanyTimeZoneAsync(ct);
        var companyNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var effectiveTargetDate = targetDate ?? DateOnly.FromDateTime(companyNow.AddDays(-1));

        // Single-run distributed lock: prevent multiple servers from concurrently running closeout for the same company/date
        var lockKey = $"AttendanceCloseout_{_tenantContext?.CompanyId ?? Guid.Empty}_{effectiveTargetDate:yyyyMMdd}";
        await using var lockHandle = await _uow.TryAcquireAppLockAsync(lockKey, TimeSpan.Zero, ct);
        if (lockHandle == null)
        {
            // Another server instance or thread is already running closeout for this date - skip safely
            return new DailyAttendanceCloseoutResult(effectiveTargetDate, 0, 0, 0);
        }

        // 1. Resolve / auto-close lingering open punches from before the end of effectiveTargetDate
        var targetDateEndUtc = TimeZoneInfo.ConvertTimeToUtc(
            effectiveTargetDate.AddDays(1).ToDateTime(TimeOnly.MinValue), tz);

        var staleOpenPunches = await _uow.Punches.ToListAsync(
            _uow.Punches.Query().Where(p => p.IsOpen && p.PunchTime < targetDateEndUtc),
            ct);

        var closedPunchesCount = 0;
        foreach (var punch in staleOpenPunches)
        {
            punch.IsOpen = false;
            punch.Note = string.IsNullOrWhiteSpace(punch.Note)
                ? "[Auto-closed by EOD closeout: missing checkout]"
                : $"{punch.Note} | [Auto-closed by EOD closeout]";
            _uow.Punches.Update(punch);
            closedPunchesCount++;
        }

        // 2. Fetch all active employees and hydrate their Shift
        var activeEmployeesRaw = await _uow.Employees.ToListAsync(
            _uow.Employees.Query().Where(e => e.Status == EmploymentStatus.Active),
            ct);

        var allShifts = await _uow.Shifts.ToListAsync(_uow.Shifts.Query(), ct);
        var shiftsById = allShifts.ToDictionary(s => s.Id);

        var activeEmployees = activeEmployeesRaw
            .Where(e => e.JoinDate <= effectiveTargetDate && e.Status == EmploymentStatus.Active)
            .Select(e =>
            {
                if (e.Shift == null && e.ShiftId.HasValue && shiftsById.TryGetValue(e.ShiftId.Value, out var s))
                {
                    e.Shift = s;
                }
                return e;
            })
            .ToList();

        // 3. Pre-fetch approved leaves for effectiveTargetDate
        var approvedLeaves = await _uow.LeaveRequests.ToListAsync(
            _uow.LeaveRequests.Query().Where(l => l.Status == LeaveStatus.Approved && l.FromDate <= effectiveTargetDate && l.ToDate >= effectiveTargetDate),
            ct);
        var leavesByEmp = approvedLeaves.ToDictionary(l => l.EmployeeId);

        // 4. Pre-fetch holidays for effectiveTargetDate.
        // Optional holidays must NOT mark everyone as Holiday (only mandatory/national/religious holidays do).
        var holidays = await _uow.Holidays.ToListAsync(
            _uow.Holidays.Query().Where(h => h.Date == effectiveTargetDate),
            ct);
        var nonOptionalHolidays = holidays.Where(h => h.Type != HolidayType.Optional).ToList();
        var isMandatoryHoliday = nonOptionalHolidays.Count > 0;
        var holidayName = nonOptionalHolidays.FirstOrDefault()?.Name ?? "Public Holiday";

        // 5. Pre-fetch shiftdays for template-based weekly off determination
        var targetDayOfWeek = effectiveTargetDate.DayOfWeek;
        var relevantShiftdays = await _uow.Shiftdays.ToListAsync(
            _uow.Shiftdays.Query().Where(sd => sd.DayOfWeek == targetDayOfWeek),
            ct);
        var shiftdaysByTemplate = relevantShiftdays
            .GroupBy(sd => sd.ShiftTemplateId)
            .ToDictionary(g => g.Key, g => g.First());

        // 6. Fetch all existing attendance records for effectiveTargetDate (Idempotency guarantee)
        var existingAttendance = await _uow.Attendance.ListByDateAsync(effectiveTargetDate, ct);
        var attendanceByEmp = existingAttendance.ToDictionary(a => a.EmployeeId);

        var markedAbsentCount = 0;
        var finalizedCount = 0;

        foreach (var emp in activeEmployees)
        {
            var isWeekOff = IsEmployeeWeekOff(emp, effectiveTargetDate);

            if (attendanceByEmp.TryGetValue(emp.Id, out var record))
            {
                // Employee already has a punch/attendance record:
                // Never overwrite real punch hours. If employee has punches on a leave day, keep punch data and note the leave.
                if (leavesByEmp.TryGetValue(emp.Id, out var empLeave))
                {
                    var leaveNote = empLeave.IsHalfDay ? "[Approved Half-Day Leave]" : "[Approved Leave]";
                    if (string.IsNullOrWhiteSpace(record.Notes) || !record.Notes.Contains("Approved"))
                    {
                        record.Notes = string.IsNullOrWhiteSpace(record.Notes)
                            ? leaveNote
                            : $"{record.Notes} | {leaveNote}";
                    }
                }

                if (record.CheckIn.HasValue && !record.CheckOut.HasValue)
                {
                    record.Notes = string.IsNullOrWhiteSpace(record.Notes)
                        ? "[Incomplete attendance - missing checkout]"
                        : $"{record.Notes} | [Incomplete attendance - missing checkout]";
                    if (record.WorkHours == 0)
                    {
                        record.Status = AttendanceStatus.HalfDay;
                    }
                }
                _uow.Attendance.Update(record);
                finalizedCount++;
            }
            else
            {
                // No punch/record exists for this employee on effectiveTargetDate
                if (isMandatoryHoliday)
                {
                    // Mandatory Public Holiday: Never mark absent
                    var holidayRecord = new AttendanceRecord
                    {
                        EmployeeId = emp.Id,
                        Date = effectiveTargetDate,
                        CheckIn = null,
                        CheckOut = null,
                        BreakMinutes = 0,
                        WorkHours = 0,
                        Status = AttendanceStatus.Holiday,
                        Notes = $"[Public Holiday: {holidayName}]"
                    };
                    await _uow.Attendance.AddAsync(holidayRecord, ct);
                    finalizedCount++;
                }
                else if (leavesByEmp.TryGetValue(emp.Id, out var leave))
                {
                    // Approved Leave: Use shift's DailyHours/2 instead of fixed 4.5
                    var targetDailyHours = emp.Shift?.DailyHours > 0 ? (decimal)emp.Shift.DailyHours : 8.0m;
                    var leaveRecord = new AttendanceRecord
                    {
                        EmployeeId = emp.Id,
                        Date = effectiveTargetDate,
                        CheckIn = null,
                        CheckOut = null,
                        BreakMinutes = 0,
                        WorkHours = leave.IsHalfDay ? (targetDailyHours / 2m) : 0m,
                        Status = leave.IsHalfDay ? AttendanceStatus.HalfDay : AttendanceStatus.OnLeave,
                        Notes = leave.IsHalfDay ? "[Approved Half-Day Leave]" : "[Approved Leave]"
                    };
                    await _uow.Attendance.AddAsync(leaveRecord, ct);
                    finalizedCount++;
                }
                else if (isWeekOff)
                {
                    // Weekly Off / Roster Rest Day: Never mark absent
                    var weekendRecord = new AttendanceRecord
                    {
                        EmployeeId = emp.Id,
                        Date = effectiveTargetDate,
                        CheckIn = null,
                        CheckOut = null,
                        BreakMinutes = 0,
                        WorkHours = 0,
                        Status = AttendanceStatus.Weekend,
                        Notes = "[Scheduled Rest Day / Weekend]"
                    };
                    await _uow.Attendance.AddAsync(weekendRecord, ct);
                    finalizedCount++;
                }
                else
                {
                    // Scheduled workday with no punches, no leave, no holiday: Mark Absent
                    var absentRecord = new AttendanceRecord
                    {
                        EmployeeId = emp.Id,
                        Date = effectiveTargetDate,
                        CheckIn = null,
                        CheckOut = null,
                        BreakMinutes = 0,
                        WorkHours = 0,
                        Status = AttendanceStatus.Absent,
                        Notes = "[Marked Absent by EOD Closeout]"
                    };
                    await _uow.Attendance.AddAsync(absentRecord, ct);
                    markedAbsentCount++;
                }
            }
        }

        await _uow.SaveChangesAsync(ct);

        return new DailyAttendanceCloseoutResult(
            effectiveTargetDate,
            closedPunchesCount,
            markedAbsentCount,
            finalizedCount);
    }

    private static bool IsEmployeeWeekOff(Employee emp, DateOnly date)
    {
        // 1. Employee shift working days specification
        if (emp.Shift != null && !string.IsNullOrWhiteSpace(emp.Shift.WorkingDays))
        {
            var wd = emp.Shift.WorkingDays.Trim().ToLowerInvariant();
            if (wd.Contains("mon") && wd.Contains("sat"))
            {
                // Mon - Sat -> only Sunday is week off
                return date.DayOfWeek == DayOfWeek.Sunday;
            }
            if (wd.Contains("mon") && wd.Contains("fri"))
            {
                // Mon - Fri -> Saturday and Sunday are week off
                return date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            }
            if (wd.Contains("sun") && wd.Contains("thu"))
            {
                // Sun - Thu -> Friday and Saturday are week off
                return date.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday;
            }
        }

        // 2. Fallback default: Saturday and Sunday
        return date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
    }

    private static RegularizationDto ToRegularizationDto(RegularizationRequest r)
    {
        var name = r.Employee is null ? "—" : $"{r.Employee.FirstName} {r.Employee.LastName}".Trim();
        return new RegularizationDto(
            r.Id,
            r.EmployeeId,
            name,
            r.Reason,
            r.Date,
            r.InTime.ToString("HH:mm"),
            r.OutTime.ToString("HH:mm"),
            r.Status.ToString(),
            Formatting.Relative(r.SubmittedAtUtc));
    }
}
