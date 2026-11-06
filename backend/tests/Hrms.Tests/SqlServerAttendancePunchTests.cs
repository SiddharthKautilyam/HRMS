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

public sealed class SqlServerAttendancePunchTests
{
    private sealed class FakeCurrentUser : ICurrentUser
    {
        public bool IsAuthenticated => UserId.HasValue;
        public Guid? UserId { get; set; }
        public string? Email { get; set; } = "sqltest@example.com";
        public string? Role { get; set; } = "Employee";
        public Guid? EmployeeId { get; set; }
        public Guid? CompanyId { get; set; }
        public bool IsInRole(string role) => string.Equals(Role, role, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RealSqlServer_ParallelCheckIn_EnforcesFilteredUniqueIndex_Returns409Conflict()
    {
        // Connect to real LocalDB instance
        var dbName = $"Hrms_PunchTest_{Guid.NewGuid():N}";
        var connectionString = $@"Server=(localdb)\MSSQLLocalDB;Database={dbName};Integrated Security=True;TrustServerCertificate=True;";

        var options = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using var db = new HrmsDbContext(options);

        try
        {
            // Create real database and schema
            await db.Database.EnsureCreatedAsync();

            // Explicitly ensure the filtered unique index exists on the real SQL Server engine
            const string createIndexSql = @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeePunches_EmployeeId_IsOpen' AND object_id = OBJECT_ID('EmployeePunches'))
BEGIN
    CREATE UNIQUE INDEX IX_EmployeePunches_EmployeeId_IsOpen ON EmployeePunches (EmployeeId) WHERE [IsOpen] = 1;
END";
            await db.Database.ExecuteSqlRawAsync(createIndexSql);

            // Seed shift, employee, user, and settings
            var shift = new Shift
            {
                Name = "Engineering Shift",
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(18, 0),
                DailyHours = 9,
                LateGraceMinutes = 15
            };
            db.Shifts.Add(shift);

            var role = new Role { Code = "Employee", Name = "Employee", IsSystem = true };
            db.Roles.Add(role);

            var dept = new Department { Code = "ENG", Name = "Engineering" };
            db.Departments.Add(dept);

            var empId = Guid.NewGuid();
            var emp = new Employee
            {
                Id = empId,
                FirstName = "David",
                LastName = "Miller",
                EmployeeCode = "EMP-9099",
                Email = "david@example.com",
                Status = EmploymentStatus.Active,
                ShiftId = shift.Id,
                DepartmentId = dept.Id,
                JobTitle = "Staff Engineer",
                Currency = "USD"
            };
            db.Employees.Add(emp);

            var user = new User
            {
                Id = Guid.NewGuid(),
                EmployeeId = empId,
                Email = "david@example.com",
                FullName = "David Miller",
                RoleId = role.Id
            };
            db.Users.Add(user);

            db.CompanySettings.Add(new CompanySettings
            {
                CompanyName = "SQL Test Corp",
                TimeZone = "UTC"
            });

            await db.SaveChangesAsync();

            var uow = new UnitOfWork(db);
            var currentUser = new FakeCurrentUser { UserId = user.Id, EmployeeId = empId };
            var service = new AttendanceService(uow, currentUser);

            // 1. First check-in succeeds and saves IsOpen = 1 to real SQL Server
            var punch1 = await service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "First punch", "Web"));
            Assert.Equal("ClockIn", punch1.PunchType);

            // Verify IsOpen = 1 in SQL Server
            var openPunches = await db.EmployeePunches.Where(p => p.EmployeeId == empId && p.IsOpen).ToListAsync();
            Assert.Single(openPunches);

            // 2. Direct parallel collision test at SQL Server engine level:
            // Attempting to insert a second open punch with IsOpen = 1 for the same employee
            // must be rejected by the filtered unique index IX_EmployeePunches_EmployeeId_IsOpen
            var conflictingPunch = new EmployeePunch
            {
                EmployeeId = empId,
                PunchTime = DateTime.UtcNow.AddMinutes(1),
                PunchType = PunchType.ClockIn,
                IsOpen = true,
                Device = "Kiosk"
            };
            db.EmployeePunches.Add(conflictingPunch);

            // Verify that calling SaveChanges throws DbUpdateException wrapping SQL Server error 2601 / 2627
            var dbEx = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.Contains("IX_EmployeePunches_EmployeeId_IsOpen", dbEx.InnerException?.Message ?? dbEx.Message);

            // Detach conflicting entity so context remains clean
            db.Entry(conflictingPunch).State = EntityState.Detached;

            // 3. Verify that through the AttendanceService API, attempting another check-in returns a 409 Conflict (not a 500)
            var conflictEx = await Assert.ThrowsAsync<ConflictException>(() =>
                service.RecordPunchAsync(new CreatePunchRequest(empId, "ClockIn", "Second punch attempt", "Web")));

            Assert.Contains("already checked in", conflictEx.Message, StringComparison.OrdinalIgnoreCase);

            // 4. Verify SQL Server database still has exactly 1 open punch
            var finalOpenCount = await db.EmployeePunches.CountAsync(p => p.EmployeeId == empId && p.IsOpen);
            Assert.Equal(1, finalOpenCount);
        }
        finally
        {
            // Clean up test database from LocalDB instance
            await db.Database.EnsureDeletedAsync();
        }
    }

    [Fact]
    public async Task RealSqlServer_ParallelCloseout_RunsWithSingleRunLock_PreventsDuplicateRunsAndEnforcesUniqueIndex()
    {
        var dbName = $"Hrms_CloseoutLockTest_{Guid.NewGuid():N}";
        var connectionString = $@"Server=(localdb)\MSSQLLocalDB;Database={dbName};Integrated Security=True;TrustServerCertificate=True;";

        var options = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using var initDb = new HrmsDbContext(options);

        try
        {
            await initDb.Database.EnsureCreatedAsync();

            // Ensure unique index IX_AttendanceRecords_EmployeeId_Date exists on SQL Server
            const string createAttIndexSql = @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AttendanceRecords_EmployeeId_Date' AND object_id = OBJECT_ID('AttendanceRecords') AND is_unique = 1)
BEGIN
    CREATE UNIQUE INDEX IX_AttendanceRecords_EmployeeId_Date ON AttendanceRecords (EmployeeId, [Date]);
END";
            await initDb.Database.ExecuteSqlRawAsync(createAttIndexSql);

            var shift = new Shift
            {
                Name = "General Shift",
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(18, 0),
                DailyHours = 9,
                WorkingDays = "Mon - Fri"
            };
            initDb.Shifts.Add(shift);

            var dept = new Department { Code = "OPS", Name = "Operations" };
            initDb.Departments.Add(dept);

            var empId = Guid.NewGuid();
            var emp = new Employee
            {
                Id = empId,
                FirstName = "Lock",
                LastName = "Tester",
                EmployeeCode = "EMP-LOCK-1",
                Email = "lock@example.com",
                Status = EmploymentStatus.Active,
                ShiftId = shift.Id,
                DepartmentId = dept.Id,
                JoinDate = new DateOnly(2026, 1, 1),
                Currency = "USD"
            };
            initDb.Employees.Add(emp);

            initDb.CompanySettings.Add(new CompanySettings
            {
                CompanyName = "Parallel Lock Test Corp",
                TimeZone = "UTC"
            });

            await initDb.SaveChangesAsync();

            var targetDate = new DateOnly(2026, 10, 20); // Tuesday (working day)

            // Spin up two separate DbContext and UnitOfWork instances representing two distinct server nodes
            await using var db1 = new HrmsDbContext(options);
            await using var db2 = new HrmsDbContext(options);

            var uow1 = new UnitOfWork(db1);
            var uow2 = new UnitOfWork(db2);

            var service1 = new AttendanceService(uow1, new FakeCurrentUser { EmployeeId = empId });
            var service2 = new AttendanceService(uow2, new FakeCurrentUser { EmployeeId = empId });

            // Launch both closeouts concurrently against real SQL Server
            var task1 = service1.CloseoutDailyAttendanceAsync(targetDate);
            var task2 = service2.CloseoutDailyAttendanceAsync(targetDate);

            var results = await Task.WhenAll(task1, task2);

            // Exactly one closeout executed the records; the other was locked out via sp_getapplock
            var totalFinalizedOrAbsent = results.Sum(r => r.FinalizedAttendanceCount + r.MarkedAbsentCount);
            Assert.Equal(1, totalFinalizedOrAbsent);

            // Verify in SQL Server that exactly 1 attendance record exists
            await using var verifyDb = new HrmsDbContext(options);
            var recordsInDb = await verifyDb.AttendanceRecords
                .Where(a => a.EmployeeId == empId && a.Date == targetDate)
                .ToListAsync();

            Assert.Single(recordsInDb);
            Assert.Equal(AttendanceStatus.Absent, recordsInDb[0].Status);
        }
        finally
        {
            await initDb.Database.EnsureDeletedAsync();
        }
    }
}
