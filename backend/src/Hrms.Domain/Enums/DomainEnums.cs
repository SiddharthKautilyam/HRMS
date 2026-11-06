namespace Hrms.Domain.Enums;

/// <summary>The application roles: SuperAdmin (platform), CompanyAdmin (tenant), HrManager and Employee.</summary>
public enum RoleCode
{
    SuperAdmin = 1,
    HrManager = 2,
    Employee = 3,
    CompanyAdmin = 4,
}

/// <summary>Lifecycle of a tenant company in the master registry.</summary>
public enum CompanyStatus
{
    Provisioning = 1,
    Active = 2,
    Suspended = 3,
    Failed = 4,
}

/// <summary>Delivery/activation state of a company admin invitation.</summary>
public enum InvitationStatus
{
    Pending = 1,
    Sent = 2,
    Failed = 3,
    Accepted = 4,
    Expired = 5,
}

public enum EmploymentType
{
    FullTime = 1,
    PartTime = 2,
    Contract = 3,
    Intern = 4,
}

public enum EmploymentStatus
{
    Active = 1,
    OnLeave = 2,
    Offboarding = 3,
    Resigned = 4,
    Terminated = 5,
}

public enum Gender
{
    Male = 1,
    Female = 2,
    Other = 3,
    PreferNotToSay = 4,
}

public enum MaritalStatus
{
    Single = 1,
    Married = 2,
    Divorced = 3,
    Widowed = 4,
}

public enum LeaveStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4,
}

public enum AttendanceStatus
{
    Present = 1,
    Absent = 2,
    Late = 3,
    OnLeave = 4,
    Weekend = 5,
    Holiday = 6,
    LeftEarly = 7,
    Remote = 8,
    HalfDay = 9,
}

public enum PayrollStatus
{
    Draft = 1,
    Processing = 2,
    Processed = 3,
    OnHold = 4,
    Failed = 5,
}

public enum LoanType
{
    PersonalLoan = 1,
    SalaryAdvance = 2,
    EmergencyAdvance = 3,
}

public enum LoanStatus
{
    Pending = 1,
    Active = 2,
    Closed = 3,
    Rejected = 4,
}

public enum ApprovalType
{
    Leave = 1,
    Overtime = 2,
    WorkFromHome = 3,
    Regularization = 4,
    Loan = 5,
    Document = 6,
}

public enum ApprovalStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
}

public enum ApprovalPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
}

public enum DocumentType
{
    Identity = 1,
    Legal = 2,
    Benefits = 3,
    Employment = 4,
    Other = 5,
}

public enum DocumentStatus
{
    Valid = 1,
    Warning = 2,
    Critical = 3,
    Expired = 4,
}

public enum AnnouncementSeverity
{
    Info = 1,
    Success = 2,
    Warning = 3,
    Danger = 4,
}

public enum PaymentMode
{
    BankTransfer = 1,
    Wps = 2,
    Cheque = 3,
    Cash = 4,
}

public enum HolidayType
{
    National = 1,
    Religious = 2,
    Optional = 3,
}

public enum TaskItemStatus
{
    Pending = 1,
    InProgress = 2,
    Completed = 3,
}

public enum TaskItemPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
}

public enum ErpStatus
{
    Connected = 1,
    Error = 2,
    Pending = 3,
}
