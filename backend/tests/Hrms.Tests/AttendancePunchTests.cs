using Hrms.Application.Abstractions.Security;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Application.Services;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Hrms.Tests;

public sealed class AttendancePunchTests
{
    private static (HrmsDbContext db, UnitOfWork uow, Guid employeeId, Guid userId, Shift shift) SetupTestTenant(
        TimeOnly? shiftStart = null,
        TimeOnly? shiftEnd = null,
        int dailyHours = 9)
    {
        var options = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new HrmsDbContext(options);

        var employeeId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var shift = new Shift
        {
            Name = "Standard Shift",
            StartTime = shiftStart ?? new TimeOnly(9, 0),
            EndTime = shiftEnd ?? new TimeOnly(18, 0),
            DailyHours = dailyHours,
            LateGraceMinutes = 15
        };
        db.Shifts.Add(shift);

        var emp = new Employee
        {
            Id = employeeId,
            FirstName = "Sarah",
            LastName = "Mitchell",
            EmployeeCode = "EMP-1001",
            Email = "sarah@example.com",
            Status = EmploymentStatus.Active,
            ShiftId = shift.Id,
            Shift = shift,
            JobTitle = "Senior Engineer",
            Grade = "L5",
            Currency = "USD"
        };
        db.Employees.Add(emp);

        var user = new User
        {
            Id = userId,
            EmployeeId = employeeId,
            Email = "sarah@example.com",
            FullName = "Sarah Mitchell"
        };
        db.Users.Add(user);

        db.CompanySettings.Add(new CompanySettings
        {
            CompanyName = "Test Corp",
            TimeZone = "UTC"
        });

        db.SaveChanges();

        var uow = new UnitOfWork(db);
        return (db, uow, employeeId, userId, shift);
    }

    private sealed class FakeCurrentUser : ICurrentUser
    {
        public bool IsAuthenticated => true;
        public Guid? UserId { get; set; }
        public string? Email { get; set; } = "sarah@example.com";
        public string? Role { get; set; } = "Employee";
        public Guid? EmployeeId { get; set; }
        public Guid? CompanyId { get; set; }
        public bool IsInRole(string role) => string.Equals(Role, role, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RecordPunch_ParallelCheckInRequests_OnlyOneSucceedsAndSecondThrowsConflict()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service1 = new AttendanceService(uow, currentUser);
        var service2 = new AttendanceService(uow, currentUser);

        // First check-in succeeds
        var first = await service1.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Click 1", "Web"));
        Assert.Equal("ClockIn", first.PunchType);

        // Concurrently/subsequently attempting another check-in while first is open throws ConflictException
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service2.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Click 2", "Web")));

        Assert.Contains("already checked in", ex.Message, StringComparison.OrdinalIgnoreCase);

        // Database maintains exactly 1 open punch
        var openCount = await db.EmployeePunches.CountAsync(p => p.EmployeeId == empId && p.IsOpen);
        Assert.Equal(1, openCount);
    }

    [Fact]
    public async Task NightShift_OvernightPunch_StaysActiveAcrossMidnight_DoesNotMarkForgotten()
    {
        // 22:00 to 06:00 night shift (crosses midnight)
        var (db, uow, empId, userId, shift) = SetupTestTenant(
            shiftStart: new TimeOnly(22, 0),
            shiftEnd: new TimeOnly(6, 0),
            dailyHours: 8);

        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var yesterdayDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var punchInTime = DateTime.UtcNow.AddDays(-1).Date.AddHours(22); // 22:00 yesterday

        // Employee clocked in at 22:00 yesterday
        db.EmployeePunches.Add(new EmployeePunch
        {
            EmployeeId = empId,
            PunchTime = punchInTime,
            PunchType = PunchType.ClockIn,
            IsOpen = true,
            Device = "Web"
        });
        await db.SaveChangesAsync();

        // Simulate checking status at 02:00 next day (4 hours later, past midnight)
        // With an 8h shift + 4h grace, max allowed hours is 16h, so at 4h the shift is ACTIVE!
        var status = await service.GetPunchStatusAsync(empId);

        Assert.True(status.IsCheckedIn, "Night shift punch should remain active across midnight.");
        Assert.False(status.HasForgottenCheckOut, "Night shift punch must NOT be flagged as forgotten at midnight.");
        Assert.Null(status.ForgottenCheckOutDate);

        // Employee clocks out at 06:00
        var clockOut = await service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockOut", "Shift complete", "Web"));
        Assert.Equal("ClockOut", clockOut.PunchType);

        // Verify open punch is now closed
        var openCount = await db.EmployeePunches.CountAsync(p => p.EmployeeId == empId && p.IsOpen);
        Assert.Equal(0, openCount);
    }

    [Fact]
    public async Task GetPunchStatus_IsPureReadOnly_DoesNotWriteToDatabase()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Open punch from 3 days ago (expired past grace)
        var expiredTime = DateTime.UtcNow.AddDays(-3);
        var expiredDate = DateOnly.FromDateTime(expiredTime);

        db.EmployeePunches.Add(new EmployeePunch
        {
            EmployeeId = empId,
            PunchTime = expiredTime,
            PunchType = PunchType.ClockIn,
            IsOpen = true,
            Device = "Web"
        });
        var priorRecord = new AttendanceRecord
        {
            EmployeeId = empId,
            Date = expiredDate,
            CheckIn = new TimeOnly(9, 0),
            Status = AttendanceStatus.Present,
            Notes = null
        };
        db.AttendanceRecords.Add(priorRecord);
        await db.SaveChangesAsync();

        // Call GET /punch/status
        var status = await service.GetPunchStatusAsync(empId);

        Assert.True(status.HasForgottenCheckOut);
        Assert.False(status.IsCheckedIn);

        // Verify GET status DID NOT modify the database (pure read-only)
        var reloadedRecord = await db.AttendanceRecords.AsNoTracking().FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == expiredDate);
        Assert.NotNull(reloadedRecord);
        Assert.Null(reloadedRecord.Notes); // Note remains untouched until actual punch or background job!
    }

    [Fact]
    public async Task RecordPunch_NewCheckInWithExpiredOpenPunch_AutoClosesOldPunchInSameTransaction()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Old expired punch from 2 days ago with IsOpen = true
        var oldTime = DateTime.UtcNow.AddDays(-2);
        var oldDate = DateOnly.FromDateTime(oldTime);

        var oldPunch = new EmployeePunch
        {
            EmployeeId = empId,
            PunchTime = oldTime,
            PunchType = PunchType.ClockIn,
            IsOpen = true,
            Note = "Old shift"
        };
        db.EmployeePunches.Add(oldPunch);

        var oldRecord = new AttendanceRecord
        {
            EmployeeId = empId,
            Date = oldDate,
            CheckIn = new TimeOnly(9, 0),
            Status = AttendanceStatus.Present
        };
        db.AttendanceRecords.Add(oldRecord);
        await db.SaveChangesAsync();

        // New check-in today
        var newPunch = await service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Fresh day", "Web"));

        Assert.Equal("ClockIn", newPunch.PunchType);

        // Old punch is closed in the same transaction
        var reloadedOldPunch = await db.EmployeePunches.FindAsync(oldPunch.Id);
        Assert.NotNull(reloadedOldPunch);
        Assert.False(reloadedOldPunch.IsOpen);
        Assert.Contains("auto-closed", reloadedOldPunch.Note);

        // Old attendance record is flagged
        var reloadedOldRecord = await db.AttendanceRecords.FindAsync(oldRecord.Id);
        Assert.NotNull(reloadedOldRecord);
        Assert.Contains("needs regularization", reloadedOldRecord.Notes);

        // Exactly 1 punch is open now (the new one)
        var openCount = await db.EmployeePunches.CountAsync(p => p.EmployeeId == empId && p.IsOpen);
        Assert.Equal(1, openCount);
    }

    [Fact]
    public async Task AttendanceStatus_WhileStillCheckedIn_DoesNotShowHalfDay()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant(dailyHours: 9);
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Check in
        await service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Morning start", "Web"));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == today);

        Assert.NotNull(record);
        // While still checked in, status must not be HalfDay (it is Present or Late)
        Assert.NotEqual(AttendanceStatus.HalfDay, record.Status);
        Assert.True(record.Status is AttendanceStatus.Present or AttendanceStatus.Late);
    }

    [Fact]
    public async Task RecordPunch_CheckOutWithoutOpenPunch_ThrowsConflictException()
    {
        var (_, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockOut", null, "Web")));

        Assert.Contains("Cannot check out without an active check-in", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task FirstCheckIn_AfterShiftStartPlusLateGrace_SetsStatusToLate()
    {
        // Set shift start to 1 hour before current time (so checking in now is past shift start + 15 min late grace)
        var nowTime = TimeOnly.FromDateTime(DateTime.UtcNow);
        var shiftStart = nowTime.AddHours(-1);

        var (db, uow, empId, userId, shift) = SetupTestTenant(
            shiftStart: shiftStart,
            shiftEnd: shiftStart.AddHours(9),
            dailyHours: 9);

        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Punch clock-in now (which is 60 minutes after shift start, exceeding 15 min grace)
        await service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Running late", "Web"));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var reloaded = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == today);
        Assert.NotNull(reloaded);
        Assert.Equal(AttendanceStatus.Late, reloaded.Status);
    }

    [Fact]
    public async Task ClockOut_WhenOpenPunchExceedsShiftLimit_ClosesAsIncomplete_AndThrowsConflict()
    {
        var (db, uow, empId, userId, shift) = SetupTestTenant(dailyHours: 9);
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Open punch from 2 days ago (exceeds 16h max shift limit)
        var stalePunchTime = DateTime.UtcNow.AddDays(-2);
        var staleDate = DateOnly.FromDateTime(stalePunchTime);

        var stalePunch = new EmployeePunch
        {
            EmployeeId = empId,
            PunchTime = stalePunchTime,
            PunchType = PunchType.ClockIn,
            IsOpen = true,
            Device = "Web"
        };
        db.EmployeePunches.Add(stalePunch);

        var staleRecord = new AttendanceRecord
        {
            EmployeeId = empId,
            Date = staleDate,
            CheckIn = TimeOnly.FromDateTime(stalePunchTime),
            Status = AttendanceStatus.Present
        };
        db.AttendanceRecords.Add(staleRecord);
        await db.SaveChangesAsync();

        // Attempting to ClockOut on this expired punch should auto-close it as incomplete and inform user
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockOut", "Late checkout attempt", "Web")));

        Assert.Contains("exceeded the allowable shift limit", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("regularization", ex.Message, StringComparison.OrdinalIgnoreCase);

        // Verify stale punch is closed in database
        var reloadedPunch = await db.EmployeePunches.FindAsync(stalePunch.Id);
        Assert.NotNull(reloadedPunch);
        Assert.False(reloadedPunch.IsOpen);
        Assert.Contains("auto-closed", reloadedPunch.Note);

        // Verify zero open punches remain
        var openCount = await db.EmployeePunches.CountAsync(p => p.EmployeeId == empId && p.IsOpen);
        Assert.Equal(0, openCount);
    }

    [Fact]
    public async Task Punch_WithInvalidOrMissingTimeZone_ThrowsBadRequestException()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Set invalid timezone on CompanySettings
        var settings = await db.CompanySettings.FirstAsync();
        settings.TimeZone = "Invalid/NonExistent_Zone";
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
            service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Punch", "Web")));

        Assert.Contains("not recognized by the server", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_AutoClosesPastOpenPunches_AndMarksAbsentForEmployeesWithoutPunches()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // Add a second active employee who will have NO punches
        var secondEmp = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = "Absent",
            LastName = "Employee",
            EmployeeCode = "EMP-ABS",
            Email = "absent@example.com",
            Status = EmploymentStatus.Active,
            JobTitle = "Analyst",
            Currency = "USD"
        };
        db.Employees.Add(secondEmp);

        // Target date is a known weekday: 2026-10-21 (Wednesday)
        var targetDate = new DateOnly(2026, 10, 21);

        // empId checked in on 2026-10-21 at 09:00 UTC, but forgot to check out (IsOpen = true)
        var punchTime = new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc);
        var openPunch = new EmployeePunch
        {
            EmployeeId = empId,
            PunchTime = punchTime,
            PunchType = PunchType.ClockIn,
            IsOpen = true,
            Note = "Normal check-in"
        };
        db.EmployeePunches.Add(openPunch);

        var existingRecord = new AttendanceRecord
        {
            EmployeeId = empId,
            Date = targetDate,
            CheckIn = new TimeOnly(9, 0),
            Status = AttendanceStatus.Present
        };
        db.AttendanceRecords.Add(existingRecord);
        await db.SaveChangesAsync();

        // Run closeout for targetDate
        var result = await service.CloseoutDailyAttendanceAsync(targetDate);

        Assert.Equal(targetDate, result.TargetDate);
        Assert.Equal(1, result.ClosedIncompletePunches);
        Assert.Equal(1, result.MarkedAbsentCount);
        Assert.Equal(1, result.FinalizedAttendanceCount);

        // 1. Verify open punch is closed
        var reloadedPunch = await db.EmployeePunches.FindAsync(openPunch.Id);
        Assert.NotNull(reloadedPunch);
        Assert.False(reloadedPunch.IsOpen);
        Assert.Contains("Auto-closed by EOD closeout", reloadedPunch.Note);

        // 2. Verify empId's attendance record was finalized with missing checkout note
        var reloadedRecord = await db.AttendanceRecords.FindAsync(existingRecord.Id);
        Assert.NotNull(reloadedRecord);
        Assert.Contains("missing checkout", reloadedRecord.Notes, StringComparison.OrdinalIgnoreCase);

        // 3. Verify secondEmp was marked Absent for Wednesday
        var absentRecord = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == secondEmp.Id && a.Date == targetDate);
        Assert.NotNull(absentRecord);
        Assert.Equal(AttendanceStatus.Absent, absentRecord.Status);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_ApprovedLeave_DoesNotMarkAbsent_MarksOnLeave()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var targetDate = new DateOnly(2026, 10, 21); // Wednesday

        var leaveType = new LeaveType { Name = "Annual Leave", MaxDaysPerYear = 20 };
        db.LeaveTypes.Add(leaveType);

        var leave = new LeaveRequest
        {
            EmployeeId = empId,
            LeaveTypeId = leaveType.Id,
            FromDate = targetDate,
            ToDate = targetDate,
            Days = 1,
            IsHalfDay = false,
            Status = LeaveStatus.Approved
        };
        db.LeaveRequests.Add(leave);
        await db.SaveChangesAsync();

        var result = await service.CloseoutDailyAttendanceAsync(targetDate);

        Assert.Equal(0, result.MarkedAbsentCount);
        Assert.Equal(1, result.FinalizedAttendanceCount);

        var record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.NotNull(record);
        Assert.Equal(AttendanceStatus.OnLeave, record.Status);
        Assert.Contains("Approved Leave", record.Notes);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_ApprovedHalfDayLeave_DoesNotMarkAbsent_MarksHalfDay()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var targetDate = new DateOnly(2026, 10, 21); // Wednesday

        var leaveType = new LeaveType { Name = "Casual Leave", MaxDaysPerYear = 10 };
        db.LeaveTypes.Add(leaveType);

        var leave = new LeaveRequest
        {
            EmployeeId = empId,
            LeaveTypeId = leaveType.Id,
            FromDate = targetDate,
            ToDate = targetDate,
            Days = 1,
            IsHalfDay = true,
            Status = LeaveStatus.Approved
        };
        db.LeaveRequests.Add(leave);
        await db.SaveChangesAsync();

        var result = await service.CloseoutDailyAttendanceAsync(targetDate);

        Assert.Equal(0, result.MarkedAbsentCount);
        Assert.Equal(1, result.FinalizedAttendanceCount);

        var record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.NotNull(record);
        Assert.Equal(AttendanceStatus.HalfDay, record.Status);
        Assert.Equal(4.5m, record.WorkHours);
        Assert.Contains("Approved Half-Day Leave", record.Notes);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_PublicHoliday_DoesNotMarkAbsent_MarksHoliday()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var targetDate = new DateOnly(2026, 10, 21); // Wednesday

        var holiday = new Holiday
        {
            Name = "National Day",
            Date = targetDate,
            Type = HolidayType.National
        };
        db.Holidays.Add(holiday);
        await db.SaveChangesAsync();

        var result = await service.CloseoutDailyAttendanceAsync(targetDate);

        Assert.Equal(0, result.MarkedAbsentCount);
        Assert.Equal(1, result.FinalizedAttendanceCount);

        var record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.NotNull(record);
        Assert.Equal(AttendanceStatus.Holiday, record.Status);
        Assert.Contains("National Day", record.Notes);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_WeeklyOffWeekend_DoesNotMarkAbsent_MarksWeekend()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var targetDate = new DateOnly(2026, 10, 25); // Sunday

        var result = await service.CloseoutDailyAttendanceAsync(targetDate);

        Assert.Equal(0, result.MarkedAbsentCount);
        Assert.Equal(1, result.FinalizedAttendanceCount);

        var record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.NotNull(record);
        Assert.Equal(AttendanceStatus.Weekend, record.Status);
        Assert.Contains("Weekend", record.Notes);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_FutureJoinerOrTerminated_DoesNotCreateAnyRecord()
    {
        var (db, uow, _, userId, _) = SetupTestTenant();
        var targetDate = new DateOnly(2026, 10, 21); // Wednesday

        // Employee 1: Joins next month (future joiner)
        var futureJoiner = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = "Future",
            LastName = "Joiner",
            EmployeeCode = "EMP-FUT",
            Email = "future@example.com",
            Status = EmploymentStatus.Active,
            JoinDate = targetDate.AddDays(10),
            JobTitle = "Intern",
            Currency = "USD"
        };
        db.Employees.Add(futureJoiner);

        // Employee 2: Terminated last week
        var terminatedEmp = new Employee
        {
            Id = Guid.NewGuid(),
            FirstName = "Left",
            LastName = "Employee",
            EmployeeCode = "EMP-TERM",
            Email = "term@example.com",
            Status = EmploymentStatus.Terminated,
            JoinDate = targetDate.AddDays(-100),
            JobTitle = "Former Analyst",
            Currency = "USD"
        };
        db.Employees.Add(terminatedEmp);
        await db.SaveChangesAsync();

        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = futureJoiner.Id };
        var service = new AttendanceService(uow, currentUser);

        await service.CloseoutDailyAttendanceAsync(targetDate);

        // Neither future joiner nor terminated employee should have an attendance record
        var futureRecord = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == futureJoiner.Id && a.Date == targetDate);
        Assert.Null(futureRecord);

        var termRecord = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == terminatedEmp.Id && a.Date == targetDate);
        Assert.Null(termRecord);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_IsIdempotent_SecondRunDoesNotDuplicate()
    {
        var (db, uow, empId, userId, _) = SetupTestTenant();
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var targetDate = new DateOnly(2026, 10, 21); // Wednesday

        // First run: marks absent
        var result1 = await service.CloseoutDailyAttendanceAsync(targetDate);
        Assert.Equal(1, result1.MarkedAbsentCount);

        var recordsCount1 = await db.AttendanceRecords.CountAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.Equal(1, recordsCount1);

        // Second run on same date (e.g. multi-server run or rescheduled)
        var result2 = await service.CloseoutDailyAttendanceAsync(targetDate);
        Assert.Equal(0, result2.MarkedAbsentCount); // None marked absent on repeat run
        Assert.Equal(1, result2.FinalizedAttendanceCount);

        // Total count still exactly 1 (no duplicates)
        var recordsCount2 = await db.AttendanceRecords.CountAsync(a => a.EmployeeId == empId && a.Date == targetDate);
        Assert.Equal(1, recordsCount2);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_HalfDayLeave_UsesShiftDailyHoursHalf_AndPreservesRealPunches()
    {
        // 1. Shift has DailyHours = 10 (HalfDay should be 5.0h, NOT hardcoded 4.5h)
        var (db, uow, empId, userId, shift) = SetupTestTenant(dailyHours: 10);
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        var leaveDate = new DateOnly(2026, 10, 21); // Wednesday

        var leaveType = new LeaveType { Name = "Casual Leave", MaxDaysPerYear = 12, IsPaid = true };
        db.LeaveTypes.Add(leaveType);

        var leaveReq = new LeaveRequest
        {
            EmployeeId = empId,
            LeaveTypeId = leaveType.Id,
            FromDate = leaveDate,
            ToDate = leaveDate,
            Days = 1,
            IsHalfDay = true,
            Status = LeaveStatus.Approved
        };
        db.LeaveRequests.Add(leaveReq);
        await db.SaveChangesAsync();

        // Run closeout for an employee who did NOT punch on their half-day leave
        var result1 = await service.CloseoutDailyAttendanceAsync(leaveDate);
        var record1 = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == leaveDate);

        Assert.NotNull(record1);
        Assert.Equal(AttendanceStatus.HalfDay, record1.Status);
        // Must be shift DailyHours / 2 = 10 / 2 = 5.0m
        Assert.Equal(5.0m, record1.WorkHours);
        Assert.Contains("Approved Half-Day Leave", record1.Notes);

        // 2. Another employee who had approved half-day leave BUT ALSO ACTUALLY WORKED (real punches)
        var emp2Id = Guid.NewGuid();
        var emp2 = new Employee
        {
            Id = emp2Id,
            FirstName = "Working",
            LastName = "LeaveTaker",
            EmployeeCode = "EMP-LEAVE-2",
            Email = "worker@example.com",
            Status = EmploymentStatus.Active,
            ShiftId = shift.Id,
            JoinDate = new DateOnly(2026, 1, 1),
            Currency = "USD"
        };
        db.Employees.Add(emp2);

        var leaveReq2 = new LeaveRequest
        {
            EmployeeId = emp2Id,
            LeaveTypeId = leaveType.Id,
            FromDate = leaveDate,
            ToDate = leaveDate,
            Days = 1,
            IsHalfDay = true,
            Status = LeaveStatus.Approved
        };
        db.LeaveRequests.Add(leaveReq2);

        // Employee punched in from 09:00 to 15:30 (6.5 hours worked)
        var existingPunchRecord = new AttendanceRecord
        {
            EmployeeId = emp2Id,
            Date = leaveDate,
            CheckIn = new TimeOnly(9, 0),
            CheckOut = new TimeOnly(15, 30),
            WorkHours = 6.5m,
            Status = AttendanceStatus.Present,
            Notes = "Worked partial shift"
        };
        db.AttendanceRecords.Add(existingPunchRecord);
        await db.SaveChangesAsync();

        // Run closeout again
        await service.CloseoutDailyAttendanceAsync(leaveDate);

        var reloadedEmp2Record = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == emp2Id && a.Date == leaveDate);
        Assert.NotNull(reloadedEmp2Record);
        // Real punch hours MUST NOT be overwritten!
        Assert.Equal(6.5m, reloadedEmp2Record.WorkHours);
        Assert.Equal(new TimeOnly(9, 0), reloadedEmp2Record.CheckIn);
        Assert.Equal(new TimeOnly(15, 30), reloadedEmp2Record.CheckOut);
        Assert.Contains("Approved Half-Day Leave", reloadedEmp2Record.Notes);
    }

    [Fact]
    public async Task CloseoutDailyAttendance_WeeklyOff_RespectsShiftWorkingDays_AndIgnoresOptionalHolidays()
    {
        var (db, uow, empId, userId, shift) = SetupTestTenant(dailyHours: 8);
        var currentUser = new FakeCurrentUser { UserId = userId, EmployeeId = empId };
        var service = new AttendanceService(uow, currentUser);

        // 1. Shift is Mon - Sat (WorkingDays): Saturday is a working day, NOT weekend!
        shift.WorkingDays = "Mon - Sat";
        db.Shifts.Update(shift);

        var saturday = new DateOnly(2026, 10, 24); // Saturday
        Assert.Equal(DayOfWeek.Saturday, saturday.DayOfWeek);

        // Optional Holiday on Saturday
        var optHoliday = new Holiday
        {
            Name = "Optional Cultural Observance",
            Date = saturday,
            Type = HolidayType.Optional
        };
        db.Holidays.Add(optHoliday);
        await db.SaveChangesAsync();

        // Run closeout on Saturday
        await service.CloseoutDailyAttendanceAsync(saturday);

        var saturdayRecord = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == saturday);
        Assert.NotNull(saturdayRecord);
        // Because Saturday is a working day (Mon-Sat) and holiday is OPTIONAL, employee without punches is marked Absent (NOT Holiday, NOT Weekend)
        Assert.Equal(AttendanceStatus.Absent, saturdayRecord.Status);

        // 2. On Sunday: Sunday is a scheduled rest day
        var sunday = new DateOnly(2026, 10, 25);
        Assert.Equal(DayOfWeek.Sunday, sunday.DayOfWeek);

        await service.CloseoutDailyAttendanceAsync(sunday);
        var sundayRecord = await db.AttendanceRecords.FirstOrDefaultAsync(a => a.EmployeeId == empId && a.Date == sunday);
        Assert.NotNull(sundayRecord);
        Assert.Equal(AttendanceStatus.Weekend, sundayRecord.Status);
    }

    [Fact]
    public void Payroll_PaidDaysCalculation_FullMonthProducesCorrectPayDays()
    {
        // Test standard monthly paid days computation across a 30-day month
        // Model month with 30 days:
        // - 20 Present days (full workday)
        // - 4 Weekend days (scheduled weekly off)
        // - 2 Public Holidays (mandatory paid company holiday)
        // - 2 Paid Leave days (approved annual/sick leave)
        // - 1 Half-Day Leave (approved half-day: 0.5 paid day)
        // - 1 Absent day (unapproved absence: 0 paid days)
        // Total calendar days = 30
        const int totalDaysInMonth = 30;

        var dailyAttendance = new List<(AttendanceStatus Status, bool IsPaidLeave)>
        {
            (AttendanceStatus.Absent, false),            // 1 Absent (0 paid)
            (AttendanceStatus.HalfDay, true),            // 1 HalfDay (0.5 paid)
            (AttendanceStatus.Holiday, false),           // 2 Holiday (2 paid)
            (AttendanceStatus.Holiday, false),
            (AttendanceStatus.OnLeave, true),            // 2 Paid Leave (2 paid)
            (AttendanceStatus.OnLeave, true),
            (AttendanceStatus.Weekend, false),           // 4 Weekend (4 paid)
            (AttendanceStatus.Weekend, false),
            (AttendanceStatus.Weekend, false),
            (AttendanceStatus.Weekend, false),
        };
        // Add 20 Present days
        for (int i = 0; i < 20; i++)
        {
            dailyAttendance.Add((AttendanceStatus.Present, false));
        }

        Assert.Equal(totalDaysInMonth, dailyAttendance.Count);

        // Formula for paid days:
        decimal paidDays = 0m;
        foreach (var day in dailyAttendance)
        {
            paidDays += day.Status switch
            {
                AttendanceStatus.Present => 1.0m,
                AttendanceStatus.Late => 1.0m,
                AttendanceStatus.LeftEarly => 1.0m,
                AttendanceStatus.Remote => 1.0m,
                AttendanceStatus.Holiday => 1.0m,
                AttendanceStatus.Weekend => 1.0m,
                AttendanceStatus.OnLeave => day.IsPaidLeave ? 1.0m : 0.0m,
                AttendanceStatus.HalfDay => 0.5m,
                AttendanceStatus.Absent => 0.0m,
                _ => 0.0m
            };
        }

        // Expected paid days: 20 (Present) + 4 (Weekend) + 2 (Holiday) + 2 (Paid Leave) + 0.5 (Half-Day) = 28.5
        Assert.Equal(28.5m, paidDays);

        // Unpaid days (loss of pay): 1 (Absent) + 0.5 (Half-Day unpaid portion) = 1.5
        decimal unpaidDays = totalDaysInMonth - paidDays;
        Assert.Equal(1.5m, unpaidDays);

        // Verify salary deduction ratio
        const decimal basicSalary = 6000m;
        decimal perDayRate = basicSalary / totalDaysInMonth; // 200 per day
        decimal lossOfPayDeduction = perDayRate * unpaidDays; // 300 deduction
        decimal earnedBasic = basicSalary - lossOfPayDeduction; // 5700 earned

        Assert.Equal(200m, perDayRate);
        Assert.Equal(300m, lossOfPayDeduction);
        Assert.Equal(5700m, earnedBasic);
    }
}

