using System.Text.RegularExpressions;
using Hrms.Application.Abstractions.Security;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Hrms.Infrastructure.Seed;

/// <summary>
/// Idempotent demo seeder. Creates the four role logins, organisation master data
/// and enough HR records to exercise every screen.
/// </summary>
public static class DbSeeder
{
    // ── Seeded login credentials (documented in README) ──
    public const string SuperAdminEmail = "admin@hrnexus.com";
    public const string SuperAdminPassword = "Admin@123";
    public const string CompanyAdminEmail = "companyadmin@hrnexus.com";
    public const string CompanyAdminPassword = "Admin@123";
    public const string HrManagerEmail = "hr@hrnexus.com";
    public const string HrManagerPassword = "Hr@12345";
    public const string EmployeeEmail = "sarah@hrnexus.com";
    public const string EmployeePassword = "Employee@123";

    public static async Task SeedAsync(HrmsDbContext db, IPasswordHasher hasher, bool isProduction = false, CancellationToken ct = default)
    {
        if (!await db.Roles.AnyAsync(ct))
        {
            await SeedBaseAsync(db, hasher, isProduction, ct);
        }

        if (!isProduction)
        {
            await SeedOperationsAsync(db, ct);
        }
    }

    private static async Task SeedBaseAsync(HrmsDbContext db, IPasswordHasher hasher, bool isProduction, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;

        // ── Roles (System Seeded) ──
        var superAdminRole = new Role { Code = "SuperAdmin", Name = "Super Admin", Description = "Platform administrator with full system access", IsSystem = true };
        var companyAdminRole = new Role { Code = "CompanyAdmin", Name = "Company Admin", Description = "Manages company organization and HR operations", IsSystem = true };
        var hrManagerRole = new Role { Code = "HrManager", Name = "HR Manager", Description = "HR operations, payroll and approvals", IsSystem = true };
        var managerRole = new Role { Code = "Manager", Name = "Manager", Description = "Team management, reviews and shift approvals", IsSystem = true };
        var employeeRole = new Role { Code = "Employee", Name = "Employee", Description = "Self-service portal access", IsSystem = true };
        db.Roles.AddRange(superAdminRole, companyAdminRole, hrManagerRole, managerRole, employeeRole);

        // ── Departments ──
        var engineering = new Department { Name = "Engineering", Code = "ENG", Description = "Product engineering" };
        var finance = new Department { Name = "Finance", Code = "FIN", Description = "Finance and accounting" };
        var hr = new Department { Name = "HR", Code = "HR", Description = "People operations" };
        var sales = new Department { Name = "Sales", Code = "SAL", Description = "Revenue team" };
        var marketing = new Department { Name = "Marketing", Code = "MKT", Description = "Brand and growth" };
        var design = new Department { Name = "Design", Code = "DSN", Description = "Product design" };
        db.Departments.AddRange(engineering, finance, hr, sales, marketing, design);

        // ── Designations ──
        var seniorEngineer = new Designation { Name = "Senior Engineer", Grade = "L5", DepartmentId = engineering.Id };
        var engineer = new Designation { Name = "Engineer", Grade = "L4", DepartmentId = engineering.Id };
        var financeAnalyst = new Designation { Name = "Finance Analyst", Grade = "L4", DepartmentId = finance.Id };
        var hrExecutive = new Designation { Name = "HR Executive", Grade = "L3", DepartmentId = hr.Id };
        var salesExecutive = new Designation { Name = "Sales Executive", Grade = "L4", DepartmentId = sales.Id };
        var marketingSpecialist = new Designation { Name = "Marketing Specialist", Grade = "L3", DepartmentId = marketing.Id };
        var designer = new Designation { Name = "Designer", Grade = "L3", DepartmentId = design.Id };
        db.Designations.AddRange(seniorEngineer, engineer, financeAnalyst, hrExecutive, salesExecutive, marketingSpecialist, designer);

        // ── Branches ──
        var dubai = new Branch { Name = "Dubai HQ", Location = "Dubai, UAE", ManagerName = "Alex Johnson", EmployeeCount = 850 };
        var abuDhabi = new Branch { Name = "Abu Dhabi", Location = "Abu Dhabi, UAE", ManagerName = "Maria Chen", EmployeeCount = 220 };
        var riyadh = new Branch { Name = "Riyadh", Location = "Riyadh, KSA", ManagerName = "Omar Hassan", EmployeeCount = 145 };
        var london = new Branch { Name = "London", Location = "London, UK", ManagerName = "James Smith", EmployeeCount = 69 };
        db.Branches.AddRange(dubai, abuDhabi, riyadh, london);

        // ── Shifts ──
        var morning = new Shift { Name = "Morning Shift", StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(18, 0), DailyHours = 9, WorkingDays = "Mon - Fri" };
        var evening = new Shift { Name = "Evening Shift", StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(23, 0), DailyHours = 9, WorkingDays = "Mon - Fri" };
        var night = new Shift { Name = "Night Shift", StartTime = new TimeOnly(22, 0), EndTime = new TimeOnly(7, 0), DailyHours = 9, WorkingDays = "Mon - Fri" };
        db.Shifts.AddRange(morning, evening, night);

        // ── Holidays ──
        db.Holidays.AddRange(
            new Holiday { Name = "New Year's Day", Date = new DateOnly(today.Year, 1, 1), Type = HolidayType.National },
            new Holiday { Name = "Eid Al Fitr", Date = new DateOnly(today.Year, 3, 30), Type = HolidayType.Religious },
            new Holiday { Name = "Eid Al Adha", Date = new DateOnly(today.Year, 6, 6), Type = HolidayType.Religious },
            new Holiday { Name = "UAE National Day", Date = new DateOnly(today.Year, 12, 2), Type = HolidayType.National });

        // ── Leave types ──
        var annual = new LeaveType { Name = "Annual Leave", MaxDaysPerYear = 21, IsPaid = true, Color = "#2563eb", Description = "Yearly paid vacation leave" };
        var sick = new LeaveType { Name = "Sick Leave", MaxDaysPerYear = 10, IsPaid = true, Color = "#16a34a", Description = "Medical or illness related leave" };
        var emergency = new LeaveType { Name = "Emergency Leave", MaxDaysPerYear = 3, IsPaid = true, Color = "#dc2626", Description = "Urgent personal emergency" };
        var unpaid = new LeaveType { Name = "Unpaid Leave", MaxDaysPerYear = 30, IsPaid = false, Color = "#9333ea", Description = "Leave without pay" };
        var maternity = new LeaveType { Name = "Maternity Leave", MaxDaysPerYear = 90, IsPaid = true, Color = "#ec4899", Description = "Maternity benefit leave" };
        var paternity = new LeaveType { Name = "Paternity Leave", MaxDaysPerYear = 5, IsPaid = true, Color = "#0891b2", Description = "Paternity benefit leave" };
        db.LeaveTypes.AddRange(annual, sick, emergency, unpaid, maternity, paternity);

        if (!isProduction)
        {
            // ── Demo Employees (Development only) ──
            var sarah = NewEmployee("EMP-1001", "Sarah", "Mitchell", engineering, seniorEngineer, "L5", EmploymentStatus.Active, new DateOnly(2022, 3, 15), 3200, 800, 400, 150, 650, "sarah@co.com", dubai, morning);
        sarah.MiddleName = "Anne";
        sarah.Phone = "+971 50 123 4567";
        sarah.DateOfBirth = new DateOnly(1990, 6, 15);
        sarah.Gender = Gender.Female;
        sarah.MaritalStatus = MaritalStatus.Married;
        sarah.BloodGroup = "O+";
        sarah.Nationality = "British";
        sarah.Address = "Apt 4B, Marina Tower";
        sarah.City = "Dubai";
        sarah.State = "Dubai";
        sarah.Country = "UAE";
        sarah.BankName = "Emirates NBD";
        sarah.AccountName = "Sarah Mitchell";
        sarah.AccountNumber = "1234567890";
        sarah.Iban = "AE070331234567890123456";
        sarah.SwiftCode = "EBILAEAD";
        sarah.PaymentMode = PaymentMode.BankTransfer;
        sarah.WpsId = "WPS-2024-001";
        sarah.PassportNumber = "GB1234567";
        sarah.PassportExpiry = today.AddDays(410);
        sarah.VisaNumber = "UAE-2024-98765";
        sarah.VisaExpiry = today.AddDays(820);
        sarah.EmiratesId = "784-1992-1234567-1";

        var james = NewEmployee("EMP-1002", "James", "Okafor", finance, financeAnalyst, "L4", EmploymentStatus.Active, new DateOnly(2021, 6, 1), 2800, 800, 400, 150, 650, "james@co.com", dubai, morning);
        var priya = NewEmployee("EMP-1003", "Priya", "Sharma", hr, hrExecutive, "L3", EmploymentStatus.Active, new DateOnly(2023, 1, 10), 2200, 700, 400, 150, 450, "priya@co.com", abuDhabi, morning);
        var carlos = NewEmployee("EMP-1004", "Carlos", "Rivera", sales, salesExecutive, "L4", EmploymentStatus.Offboarding, new DateOnly(2020, 8, 20), 2600, 800, 400, 150, 550, "carlos@co.com", riyadh, morning);
        var emma = NewEmployee("EMP-1005", "Emma", "Wilson", marketing, marketingSpecialist, "L3", EmploymentStatus.Active, new DateOnly(2022, 11, 5), 2400, 700, 400, 150, 450, "emma@co.com", london, morning);
        var tom = NewEmployee("EMP-1006", "Tom", "Bradley", engineering, engineer, "L4", EmploymentStatus.Active, new DateOnly(2021, 2, 14), 3000, 800, 400, 150, 650, "tom@co.com", dubai, evening);
        var aisha = NewEmployee("EMP-1007", "Aisha", "Malik", design, designer, "L3", EmploymentStatus.OnLeave, new DateOnly(2023, 4, 3), 2200, 700, 400, 150, 350, "aisha@co.com", dubai, morning);
        var ravi = NewEmployee("EMP-1008", "Ravi", "Kumar", engineering, seniorEngineer, "L5", EmploymentStatus.Active, new DateOnly(2019, 9, 12), 3300, 900, 450, 150, 700, "ravi@co.com", dubai, night);

        sarah.ReportingManagerId = ravi.Id;
        james.ReportingManagerId = sarah.Id;
        priya.ReportingManagerId = sarah.Id;
        carlos.ReportingManagerId = sarah.Id;
        emma.ReportingManagerId = sarah.Id;
        tom.ReportingManagerId = ravi.Id;
        aisha.ReportingManagerId = sarah.Id;

        var employees = new[] { sarah, james, priya, carlos, emma, tom, aisha, ravi };
        db.Employees.AddRange(employees);

        // ── Users (one login per role) ──
        var adminUser = NewUser(SuperAdminEmail, "Alex Johnson", "SA", superAdminRole, hasher, SuperAdminPassword);
        var companyAdminUser = NewUser(CompanyAdminEmail, "David Vance", "CA", companyAdminRole, hasher, CompanyAdminPassword);
        var hrUser = NewUser(HrManagerEmail, "HR Manager", "HR", hrManagerRole, hasher, HrManagerPassword);
        var employeeUser = NewUser(EmployeeEmail, "Sarah Mitchell", "SM", employeeRole, hasher, EmployeePassword);
        employeeUser.EmployeeId = sarah.Id;
        db.Users.AddRange(adminUser, companyAdminUser, hrUser, employeeUser);

        // ── Leave requests ──
        db.LeaveRequests.AddRange(
            NewLeave(sarah, annual, today.AddDays(10), today.AddDays(14), "Family vacation", LeaveStatus.Pending, adminUser.Id),
            NewLeave(priya, sick, today.AddDays(-30), today.AddDays(-29), "Medical", LeaveStatus.Approved, adminUser.Id),
            NewLeave(tom, emergency, today.AddDays(-60), today.AddDays(-60), "Family emergency", LeaveStatus.Approved, hrUser.Id),
            NewLeave(carlos, annual, today.AddDays(-90), today.AddDays(-86), "Christmas break", LeaveStatus.Approved, hrUser.Id),
            NewLeave(emma, sick, today.AddDays(-120), today.AddDays(-119), "Flu", LeaveStatus.Rejected, hrUser.Id));

        // ── Attendance for the last 7 days ──
        for (var offset = 6; offset >= 0; offset--)
        {
            var date = today.AddDays(-offset);
            var weekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

            for (var index = 0; index < employees.Length; index++)
            {
                var employee = employees[index];
                AttendanceStatus status;
                TimeOnly? checkIn = null;
                TimeOnly? checkOut = null;
                var workHours = 0m;

                if (weekend)
                {
                    status = AttendanceStatus.Weekend;
                }
                else if (employee.Status == EmploymentStatus.OnLeave)
                {
                    status = AttendanceStatus.OnLeave;
                }
                else if ((index + offset) % 13 == 0)
                {
                    status = AttendanceStatus.Absent;
                }
                else if ((index + offset) % 7 == 0)
                {
                    status = AttendanceStatus.Late;
                    checkIn = new TimeOnly(9, 32);
                    checkOut = new TimeOnly(18, 5);
                    workHours = 8.0m;
                }
                else
                {
                    status = AttendanceStatus.Present;
                    checkIn = new TimeOnly(9, 0);
                    checkOut = new TimeOnly(18, 0);
                    workHours = 8.5m;
                }

                db.AttendanceRecords.Add(new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    Date = date,
                    CheckIn = checkIn,
                    CheckOut = checkOut,
                    BreakMinutes = status is AttendanceStatus.Present or AttendanceStatus.Late ? 60 : 0,
                    WorkHours = workHours,
                    Status = status,
                });
            }
        }

        // ── Regularization requests ──
        db.RegularizationRequests.AddRange(
            new RegularizationRequest
            {
                EmployeeId = sarah.Id,
                Date = today.AddDays(-8),
                InTime = new TimeOnly(9, 45),
                OutTime = new TimeOnly(18, 30),
                Reason = "Biometric not working",
                Status = ApprovalStatus.Pending,
                SubmittedAtUtc = now.AddDays(-7),
            },
            new RegularizationRequest
            {
                EmployeeId = tom.Id,
                Date = today.AddDays(-6),
                InTime = new TimeOnly(10, 0),
                OutTime = new TimeOnly(19, 0),
                Reason = "Forgot to punch in",
                Status = ApprovalStatus.Approved,
                SubmittedAtUtc = now.AddDays(-5),
                DecidedByUserId = hrUser.Id,
                DecidedAtUtc = now.AddDays(-4),
            },
            new RegularizationRequest
            {
                EmployeeId = priya.Id,
                Date = today.AddDays(-4),
                InTime = new TimeOnly(9, 15),
                OutTime = new TimeOnly(18, 0),
                Reason = "System error",
                Status = ApprovalStatus.Pending,
                SubmittedAtUtc = now.AddDays(-3),
            });

        // ── Payroll run + payslips (previous month) ──
        var period = today.AddMonths(-1);
        var run = new PayrollRun
        {
            Month = period.Month,
            Year = period.Year,
            PayDate = new DateOnly(period.Year, period.Month, DateTime.DaysInMonth(period.Year, period.Month)),
            PaymentMethod = PaymentMode.BankTransfer,
            Status = PayrollStatus.Processed,
            EmployeeCount = employees.Length,
            ProcessedAtUtc = now.AddDays(-20),
        };

        foreach (var employee in employees)
        {
            var allowances = employee.HousingAllowance + employee.TransportAllowance + employee.MobileAllowance + employee.OtherAllowances;
            const decimal deductions = 250m;

            run.Payslips.Add(new Payslip
            {
                PayrollRunId = run.Id,
                EmployeeId = employee.Id,
                Month = period.Month,
                Year = period.Year,
                BasicSalary = employee.BasicSalary,
                Allowances = allowances,
                Deductions = deductions,
                NetPay = employee.BasicSalary + allowances - deductions,
                WorkingDays = DateTime.DaysInMonth(period.Year, period.Month),
                Status = PayrollStatus.Processed,
                PayDate = run.PayDate,
            });
        }

        run.TotalGross = run.Payslips.Sum(p => p.BasicSalary);
        run.TotalAllowances = run.Payslips.Sum(p => p.Allowances);
        run.TotalDeductions = run.Payslips.Sum(p => p.Deductions);
        run.TotalNet = run.Payslips.Sum(p => p.NetPay);
        db.PayrollRuns.Add(run);

        // ── Loans ──
        db.Loans.AddRange(
            NewLoan(sarah, LoanType.PersonalLoan, 5000, 500, 2000, 3000, 10, LoanStatus.Active, adminUser.Id),
            NewLoan(james, LoanType.EmergencyAdvance, 3000, 0, 3000, 0, 1, LoanStatus.Closed, adminUser.Id),
            NewLoan(priya, LoanType.PersonalLoan, 2000, 250, 500, 1500, 8, LoanStatus.Active, hrUser.Id),
            NewLoan(carlos, LoanType.SalaryAdvance, 1500, 750, 750, 750, 2, LoanStatus.Active, hrUser.Id),
            NewLoan(aisha, LoanType.PersonalLoan, 4000, 400, 0, 4000, 10, LoanStatus.Pending, null),
            NewLoan(ravi, LoanType.EmergencyAdvance, 2000, 0, 0, 2000, 3, LoanStatus.Pending, null));

        // ── Employee documents ──
        db.EmployeeDocuments.AddRange(
            NewDocument(carlos, "Passport", DocumentType.Identity, "A1234567", "Government of India", today.AddDays(-1500), today.AddDays(5), "Valid for international travel"),
            NewDocument(emma, "Work Permit", DocumentType.Legal, "WP-98765", "Ministry of Labour", today.AddDays(-700), today.AddDays(13), "Renewal required"),
            NewDocument(james, "Medical Insurance", DocumentType.Benefits, "INS-2025-001", "Daman Insurance", today.AddDays(-300), today.AddDays(21), "Covers employee and dependents"),
            NewDocument(sarah, "Visa", DocumentType.Legal, "V-456123", "UAE Embassy", today.AddDays(-900), today.AddDays(410), "Employment visa"),
            NewDocument(priya, "Emirates ID", DocumentType.Identity, "784-1234-5678901-2", "ICA UAE", today.AddDays(-800), today.AddDays(820), "National identity card"),
            NewDocument(tom, "Passport", DocumentType.Identity, "GB7654321", "UK Passport Office", today.AddDays(-2000), today.AddDays(1600), "Valid for travel"),
            NewDocument(sarah, "Offer Letter", DocumentType.Employment, "OL-2022-042", "HR Department", today.AddDays(-1400), null, "Original offer of employment"),
            NewDocument(sarah, "Contract", DocumentType.Employment, "CT-2022-042", "HR Department", today.AddDays(-1400), null, "Employment contract signed"));

        db.EmployeeDocuments.AddRange(
            NewCompanyDocument("Employee Handbook 2025", "2.4 MB"),
            NewCompanyDocument("Leave Policy", "0.8 MB"),
            NewCompanyDocument("Code of Conduct", "1.2 MB"),
            NewCompanyDocument("IT Security Policy", "0.6 MB"),
            NewCompanyDocument("Health & Safety Guidelines", "1.8 MB"));

        // ── Approvals ──
        db.ApprovalRequests.AddRange(
            NewApproval(priya, ApprovalType.Leave, "Annual Leave", "5 days · next week", ApprovalPriority.High, now.AddDays(-1)),
            NewApproval(tom, ApprovalType.Leave, "Sick Leave", "2 days · this week", ApprovalPriority.Medium, now.AddDays(-2)),
            NewApproval(ravi, ApprovalType.Overtime, "Overtime", "12 hrs · last week", ApprovalPriority.Low, now.AddDays(-1)),
            NewApproval(emma, ApprovalType.WorkFromHome, "Work From Home", "3 days · next week", ApprovalPriority.Low, now.AddDays(-3)),
            NewApproval(sarah, ApprovalType.Leave, "Annual Leave", "5 days · next month", ApprovalPriority.Medium, now.AddDays(-4)),
            NewApproval(james, ApprovalType.Overtime, "Overtime", "8 hrs · last week", ApprovalPriority.Low, now.AddDays(-5)),
            NewApproval(aisha, ApprovalType.Leave, "Sick Leave", "2 days · this week", ApprovalPriority.High, now.AddDays(-6)),
            NewApproval(carlos, ApprovalType.Overtime, "Overtime", "10 hrs · this week", ApprovalPriority.Medium, now.AddDays(-7)));

        // ── Announcements ──
        db.Announcements.AddRange(
            NewAnnouncement("Q1 Performance Reviews Starting", "Performance review cycle starts on the 1st. Please complete your self-assessment form before the deadline.", "HR Update", AnnouncementSeverity.Info, now.AddHours(-2)),
            NewAnnouncement("Office Closure", "The office will be closed for scheduled maintenance. All employees are requested to work from home.", "Notice", AnnouncementSeverity.Warning, now.AddDays(-1)),
            NewAnnouncement("New Leave Policy Effective Next Month", "Updated leave policy takes effect next month. Key changes include additional annual leave days and revised sick leave rules.", "Policy", AnnouncementSeverity.Info, now.AddDays(-2)),
            NewAnnouncement("Health Insurance Renewal", "Please submit your health insurance renewal documents to HR before the deadline. Failure to submit may result in a coverage lapse.", "Urgent", AnnouncementSeverity.Danger, now.AddDays(-3)),
            NewAnnouncement("Team Building Event", "Join us for a team building event at Dubai Marina. Registration is mandatory. Please confirm your attendance.", "Event", AnnouncementSeverity.Info, now.AddDays(-4)),
            NewAnnouncement("Salary Revision Effective Next Quarter", "Annual salary revision will be effective next quarter. Performance-based increments will be communicated by your manager.", "HR Update", AnnouncementSeverity.Info, now.AddDays(-7)));

        // ── Notifications ──
        db.Notifications.AddRange(
            NewNotification("check", "Leave Approved", "Your annual leave request has been approved.", "2 min ago", false),
            NewNotification("alert", "Attendance Alert", "Tom Bradley marked absent today.", "15 min ago", false),
            NewNotification("documents", "New Approval Request", "Ravi Kumar submitted an overtime request.", "1 hr ago", false),
            NewNotification("party", "Birthday Today", "Emma Wilson celebrates her birthday today!", "2 hr ago", false),
            NewNotification("documents", "Document Expiry", "Carlos Rivera's passport expires in 5 days.", "3 hr ago", false),
            NewNotification("check", "Payroll Processed", "Last month's payroll has been processed.", "1 day ago", true),
            NewNotification("bell", "Policy Update", "New leave policy is effective next month.", "2 days ago", true));
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedOperationsAsync(HrmsDbContext db, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;

        var sarah = await db.Employees.FirstOrDefaultAsync(e => e.Email == "sarah@co.com", ct);
        if (sarah is null)
        {
            return;
        }

        // Backfill overtime hours for approvals created before the field existed.
        var overtime = await db.ApprovalRequests
            .Where(a => a.Type == ApprovalType.Overtime && a.OvertimeHours == null)
            .ToListAsync(ct);

        foreach (var approval in overtime)
        {
            var match = Regex.Match(approval.Details, @"\d+(\.\d+)?");
            approval.OvertimeHours = match.Success && decimal.TryParse(match.Value, out var hours) ? hours : 0;
        }

        if (!await db.CompanySettings.AnyAsync(ct))
        {
            db.CompanySettings.Add(new CompanySettings
            {
                CompanyName = "HRNexus Corp",
                TradeLicense = "TL-2024-123456",
                Trn = "100234567890003",
                Industry = "Technology",
                FoundedYear = 2018,
                Website = "https://hrnexus.com",
                Address = "Dubai Internet City, Building 3",
                City = "Dubai",
                Country = "UAE",
                Phone = "+971 4 123 4567",
                HrEmail = "hr@hrnexus.com",
                PayrollCurrency = "USD",
            });
        }

        if (!await db.TaskItems.AnyAsync(ct))
        {
            db.TaskItems.AddRange(
                NewTask(sarah.Id, "Complete Q4 Report", today.AddDays(14), TaskItemStatus.InProgress, TaskItemPriority.High, "Self", "Quarterly business review"),
                NewTask(sarah.Id, "AWS Certification Study", today.AddDays(30), TaskItemStatus.Pending, TaskItemPriority.Medium, "Self", "Solutions Architect exam"),
                NewTask(sarah.Id, "Code Review · PR #142", today.AddDays(4), TaskItemStatus.Completed, TaskItemPriority.High, "Alex Johnson", "Payments module"),
                NewTask(sarah.Id, "Team Meeting Prep", today.AddDays(5), TaskItemStatus.Completed, TaskItemPriority.Low, "Self", "Weekly standup deck"),
                NewTask(sarah.Id, "Update API Documentation", today.AddDays(20), TaskItemStatus.InProgress, TaskItemPriority.Medium, "Alex Johnson", "OpenAPI annotations"),
                NewTask(sarah.Id, "Fix Login Bug #89", today.AddDays(6), TaskItemStatus.Completed, TaskItemPriority.High, "Alex Johnson", "Session timeout issue"),
                NewTask(sarah.Id, "Deploy v2.1 to Staging", today.AddDays(8), TaskItemStatus.Completed, TaskItemPriority.High, "Alex Johnson", "Release candidate"),
                NewTask(sarah.Id, "Write Unit Tests", today.AddDays(25), TaskItemStatus.Completed, TaskItemPriority.Medium, "Self", "Attendance service coverage"),
                NewTask(sarah.Id, "Database Optimization", today.AddDays(40), TaskItemStatus.Completed, TaskItemPriority.Low, "Alex Johnson", "Index review"),
                NewTask(sarah.Id, "Security Audit Review", today.AddDays(60), TaskItemStatus.Completed, TaskItemPriority.High, "Alex Johnson", "OWASP checklist"));
        }

        if (!await db.PerformanceReviews.AnyAsync(ct))
        {
            var review = new PerformanceReview
            {
                EmployeeId = sarah.Id,
                Period = "Q4 2024",
                OverallRating = 4.5m,
                GoalsAchieved = 18,
                GoalsTotal = 20,
                FeedbackScore = 92,
                Rank = "#3/24",
            };

            review.Metrics.Add(new PerformanceMetric { Name = "Technical Skills", Score = 90 });
            review.Metrics.Add(new PerformanceMetric { Name = "Communication", Score = 85 });
            review.Metrics.Add(new PerformanceMetric { Name = "Teamwork", Score = 92 });
            review.Metrics.Add(new PerformanceMetric { Name = "Punctuality", Score = 88 });
            review.Metrics.Add(new PerformanceMetric { Name = "Problem Solving", Score = 87 });
            review.Metrics.Add(new PerformanceMetric { Name = "Leadership", Score = 78 });

            review.Feedbacks.Add(new PerformanceFeedback
            {
                FromName = "Alex Johnson",
                FromRole = "Engineering Manager",
                Message = "Sarah has consistently delivered high-quality work this quarter. Her technical skills are exceptional and she has been a great team player.",
                Date = today.AddDays(-20),
                Rating = 5,
            });

            review.Feedbacks.Add(new PerformanceFeedback
            {
                FromName = "HR Department",
                FromRole = "HR Manager",
                Message = "Excellent attendance record and professional conduct. Recommended for senior role consideration.",
                Date = today.AddDays(-22),
                Rating = 4,
            });

            db.PerformanceReviews.Add(review);
        }

        if (!await db.ErpIntegrations.AnyAsync(ct))
        {
            db.ErpIntegrations.AddRange(
                NewIntegration("SAP ERP", "Finance & Accounting sync", ErpStatus.Connected, "2h ago", "building"),
                NewIntegration("Oracle HCM", "HR data synchronization", ErpStatus.Connected, "2h ago", "erp"),
                NewIntegration("Face Recognition System", "Attendance & access control", ErpStatus.Error, "Failed", "user"),
                NewIntegration("Email Server", "SMTP notifications", ErpStatus.Connected, "Active", "mail"),
                NewIntegration("Active Directory", "User authentication", ErpStatus.Connected, "Active", "lock"),
                NewIntegration("Payroll Bank API", "WPS payment gateway", ErpStatus.Pending, "Not configured", "money"));
        }

        if (!await db.ErpSyncLogs.AnyAsync(ct))
        {
            db.ErpSyncLogs.AddRange(
                NewLog("Payroll data synced to SAP", now.AddHours(-2), true, 1284),
                NewLog("Employee records updated · 284 records", now.AddHours(-2), true, 284),
                NewLog("Face terminal sync failed · Connection timeout", now.AddHours(-3), false, 0),
                NewLog("Leave balances synced to Oracle HCM", now.AddHours(-5), true, 1284),
                NewLog("WPS payment file generated", now.AddDays(-1), true, 1284),
                NewLog("Active Directory sync failed · Auth error", now.AddDays(-1), false, 0));
        }

        if (!await db.NotificationPreferences.AnyAsync(ct))
        {
            var users = await db.Users.ToListAsync(ct);
            foreach (var user in users)
            {
                db.NotificationPreferences.AddRange(
                    NewPreference(user.Id, "leave", "Leave Approval Updates", "Get notified when your leave is approved or rejected", true),
                    NewPreference(user.Id, "payroll", "Payroll Notifications", "Notify when salary is credited", true),
                    NewPreference(user.Id, "attendance", "Attendance Reminders", "Daily check-in/out reminders", false),
                    NewPreference(user.Id, "announcements", "Announcements", "Company news and HR updates", true),
                    NewPreference(user.Id, "tasks", "Task Assignments", "When new tasks are assigned to you", true),
                    NewPreference(user.Id, "performance", "Performance Reviews", "Review cycle reminders", false));
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static TaskItem NewTask(
        Guid employeeId,
        string title,
        DateOnly dueDate,
        TaskItemStatus status,
        TaskItemPriority priority,
        string assignedBy,
        string description) => new()
    {
        EmployeeId = employeeId,
        Title = title,
        Description = description,
        DueDate = dueDate,
        Status = status,
        Priority = priority,
        AssignedBy = assignedBy,
    };

    private static ErpIntegration NewIntegration(
        string name,
        string description,
        ErpStatus status,
        string lastSync,
        string iconKey) => new()
    {
        Name = name,
        Description = description,
        Status = status,
        LastSyncLabel = lastSync,
        IconKey = iconKey,
    };

    private static ErpSyncLog NewLog(string message, DateTime syncedAt, bool success, int records) => new()
    {
        Message = message,
        SyncedAtUtc = syncedAt,
        Success = success,
        RecordsSynced = records,
    };

    private static NotificationPreference NewPreference(
        Guid userId,
        string key,
        string name,
        string description,
        bool enabled) => new()
    {
        UserId = userId,
        Key = key,
        Name = name,
        Description = description,
        Enabled = enabled,
    };

    private static Employee NewEmployee(
        string code,
        string firstName,
        string lastName,
        Department department,
        Designation designation,
        string grade,
        EmploymentStatus status,
        DateOnly joinDate,
        decimal basic,
        decimal housing,
        decimal transport,
        decimal mobile,
        decimal other,
        string email,
        Branch branch,
        Shift shift) => new()
    {
        EmployeeCode = code,
        FirstName = firstName,
        LastName = lastName,
        Email = email,
        DepartmentId = department.Id,
        DesignationId = designation.Id,
        BranchId = branch.Id,
        ShiftId = shift.Id,
        JobTitle = designation.Name,
        Grade = grade,
        EmploymentType = EmploymentType.FullTime,
        Status = status,
        JoinDate = joinDate,
        BasicSalary = basic,
        HousingAllowance = housing,
        TransportAllowance = transport,
        MobileAllowance = mobile,
        OtherAllowances = other,
        Currency = "USD",
        Country = "UAE",
        City = "Dubai",
    };

    private static User NewUser(string email, string fullName, string initials, Role role, IPasswordHasher hasher, string password) => new()
    {
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        PasswordHash = hasher.Hash(password),
        FullName = fullName,
        Initials = initials,
        RoleId = role.Id,
        IsActive = true,
    };

    private static LeaveRequest NewLeave(
        Employee employee,
        LeaveType type,
        DateOnly from,
        DateOnly to,
        string reason,
        LeaveStatus status,
        Guid? decidedBy) => new()
    {
        EmployeeId = employee.Id,
        LeaveTypeId = type.Id,
        FromDate = from,
        ToDate = to,
        Days = to.DayNumber - from.DayNumber + 1,
        Reason = reason,
        Status = status,
        SubmittedAtUtc = DateTime.UtcNow.AddDays(-10),
        DecidedAtUtc = status == LeaveStatus.Pending ? null : DateTime.UtcNow.AddDays(-9),
        DecidedByUserId = status == LeaveStatus.Pending ? null : decidedBy,
    };

    private static Loan NewLoan(
        Employee employee,
        LoanType type,
        decimal amount,
        decimal emi,
        decimal paid,
        decimal balance,
        int tenure,
        LoanStatus status,
        Guid? approvedBy) => new()
    {
        EmployeeId = employee.Id,
        LoanType = type,
        Amount = amount,
        Emi = emi,
        PaidAmount = paid,
        Balance = balance,
        TenureMonths = tenure,
        Status = status,
        RequestedAtUtc = DateTime.UtcNow.AddDays(-30),
        ApprovedAtUtc = status == LoanStatus.Pending ? null : DateTime.UtcNow.AddDays(-25),
        ApprovedByUserId = status == LoanStatus.Pending ? null : approvedBy,
    };

    private static EmployeeDocument NewDocument(
        Employee employee,
        string name,
        DocumentType type,
        string number,
        string issuedBy,
        DateOnly issueDate,
        DateOnly? expiry,
        string notes) => new()
    {
        EmployeeId = employee.Id,
        Name = name,
        Type = type,
        DocumentNumber = number,
        IssuedBy = issuedBy,
        IssueDate = issueDate,
        ExpiryDate = expiry,
        Notes = notes,
        Status = DocumentStatus.Valid,
    };

    private static EmployeeDocument NewCompanyDocument(string name, string size) => new()
    {
        Name = name,
        Type = DocumentType.Other,
        FileSize = size,
        IsCompanyDocument = true,
        IssueDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-30),
    };

    private static ApprovalRequest NewApproval(
        Employee employee,
        ApprovalType type,
        string title,
        string details,
        ApprovalPriority priority,
        DateTime submitted) => new()
    {
        EmployeeId = employee.Id,
        Type = type,
        Title = title,
        Details = details,
        Priority = priority,
        Status = ApprovalStatus.Pending,
        SubmittedAtUtc = submitted,
    };

    private static Announcement NewAnnouncement(
        string title,
        string message,
        string tag,
        AnnouncementSeverity severity,
        DateTime published) => new()
    {
        Title = title,
        Message = message,
        Tag = tag,
        Severity = severity,
        PublishedAtUtc = published,
    };

    private static Notification NewNotification(string iconKey, string title, string message, string timeLabel, bool read) => new()
    {
        IconKey = iconKey,
        Title = title,
        Message = message,
        TimeLabel = timeLabel,
        IsRead = read,
    };
}
