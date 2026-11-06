using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

public class Employee : BaseEntity
{
    /// <summary>Human readable code shown in the UI, e.g. EMP-1001.</summary>
    public string EmployeeCode { get; set; } = string.Empty;

    public string FirstName { get; set; } = string.Empty;

    public string? MiddleName { get; set; }

    public string LastName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public Gender Gender { get; set; } = Gender.Female;

    public MaritalStatus MaritalStatus { get; set; } = MaritalStatus.Single;

    public string? BloodGroup { get; set; }

    public string? Nationality { get; set; }

    public string? Address { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }

    public string? Country { get; set; }

    // ── Job information ──
    public Guid DepartmentId { get; set; }

    public Department? Department { get; set; }

    public Guid? DesignationId { get; set; }

    public Designation? Designation { get; set; }

    public Guid? BranchId { get; set; }

    public Branch? Branch { get; set; }

    public Guid? ShiftId { get; set; }

    public Shift? Shift { get; set; }

    public Guid? ReportingManagerId { get; set; }

    public Employee? ReportingManager { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public string Grade { get; set; } = "L3";

    public EmploymentType EmploymentType { get; set; } = EmploymentType.FullTime;

    public EmploymentStatus Status { get; set; } = EmploymentStatus.Active;

    public DateOnly JoinDate { get; set; }

    public int NoticePeriodDays { get; set; } = 30;

    // ── Compensation ──
    public decimal BasicSalary { get; set; }

    public decimal HousingAllowance { get; set; }

    public decimal TransportAllowance { get; set; }

    public decimal MobileAllowance { get; set; }

    public decimal OtherAllowances { get; set; }

    public string Currency { get; set; } = "USD";

    // ── Bank ──
    public string? BankName { get; set; }

    public string? AccountName { get; set; }

    public string? AccountNumber { get; set; }

    public string? Iban { get; set; }

    public string? IfscCode { get; set; }

    public string? SwiftCode { get; set; }

    public PaymentMode PaymentMode { get; set; } = PaymentMode.BankTransfer;

    public string? WpsId { get; set; }

    // ── Identity documents ──
    public string? PassportNumber { get; set; }

    public DateOnly? PassportExpiry { get; set; }

    public string? VisaNumber { get; set; }

    public DateOnly? VisaExpiry { get; set; }

    public string? EmiratesId { get; set; }

    // ── Biometric & Face Recognition ──
    public string? FaceDescriptor { get; set; }

    public string? FacePhotoUrl { get; set; }

    public DateTime? FaceEnrolledAtUtc { get; set; }

    public bool IsFaceEnrolled => !string.IsNullOrWhiteSpace(FaceDescriptor);

    // ── Collections ──
    public ICollection<EmployeeDocument> Documents { get; set; } = new List<EmployeeDocument>();

    public ICollection<EmployeeEducation> Educations { get; set; } = new List<EmployeeEducation>();

    public ICollection<EmployeeBank> Banks { get; set; } = new List<EmployeeBank>();

    public ICollection<EmployeeAddress> Addresses { get; set; } = new List<EmployeeAddress>();

    public ICollection<EmployeePunch> Punches { get; set; } = new List<EmployeePunch>();

    public ICollection<ShiftAssignment> ShiftAssignments { get; set; } = new List<ShiftAssignment>();

    public ICollection<AssetAssignment> AssetAssignments { get; set; } = new List<AssetAssignment>();

    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();

    public ICollection<Payslip> Payslips { get; set; } = new List<Payslip>();

    public ICollection<Loan> Loans { get; set; } = new List<Loan>();

    public ICollection<ApprovalRequest> ApprovalRequests { get; set; } = new List<ApprovalRequest>();

    public string FullName => string.Join(' ', new[] { FirstName, LastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
}

public class EmployeeEducation : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string Degree { get; set; } = string.Empty;

    public string Institution { get; set; } = string.Empty;

    public int PassingYear { get; set; }

    public string? PercentageOrCgpa { get; set; }

    public string? Specialization { get; set; }
}

public class EmployeeBank : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string BankName { get; set; } = string.Empty;

    public string AccountHolderName { get; set; } = string.Empty;

    public string AccountNumber { get; set; } = string.Empty;

    public string? IfscOrSwiftCode { get; set; }

    public string? BranchName { get; set; }

    public bool IsPrimary { get; set; } = true;
}

public class EmployeeAddress : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string AddressType { get; set; } = "Permanent";

    public string AddressLine1 { get; set; } = string.Empty;

    public string? AddressLine2 { get; set; }

    public string City { get; set; } = string.Empty;

    public string State { get; set; } = string.Empty;

    public string? PostalCode { get; set; }

    public string Country { get; set; } = string.Empty;
}

public class EmployeeDocument : BaseEntity
{
    public Guid? EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string Name { get; set; } = string.Empty;

    public DocumentType Type { get; set; } = DocumentType.Identity;

    public string? DocumentNumber { get; set; }

    public string? IssuedBy { get; set; }

    public DateOnly? IssueDate { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public DocumentStatus Status { get; set; } = DocumentStatus.Valid;

    public string? Notes { get; set; }

    public string? FileSize { get; set; }

    public string? FileUrl { get; set; }

    /// <summary>Company-wide handbook / policy documents appear for every employee.</summary>
    public bool IsCompanyDocument { get; set; }
}
