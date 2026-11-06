using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

public class LeaveRequest : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public Guid LeaveTypeId { get; set; }

    public LeaveType? LeaveType { get; set; }

    public DateOnly FromDate { get; set; }

    public DateOnly ToDate { get; set; }

    public int Days { get; set; }
    public bool IsHalfDay { get; set; }
    public string Reason { get; set; } = string.Empty;

    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;

    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? DecidedAtUtc { get; set; }

    public Guid? DecidedByUserId { get; set; }

    public User? DecidedByUser { get; set; }

    public string? DecisionNote { get; set; }
}
