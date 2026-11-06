using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

public class Loan : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public LoanType LoanType { get; set; } = LoanType.PersonalLoan;

    public decimal Amount { get; set; }

    public decimal Emi { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal Balance { get; set; }

    public int TenureMonths { get; set; }

    public LoanStatus Status { get; set; } = LoanStatus.Pending;

    public string? Reason { get; set; }

    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ApprovedAtUtc { get; set; }

    public Guid? ApprovedByUserId { get; set; }

    public User? ApprovedByUser { get; set; }
}
