using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

public class AttendanceRecord : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }

    public TimeOnly? CheckIn { get; set; }

    public TimeOnly? CheckOut { get; set; }

    public int BreakMinutes { get; set; }

    public decimal WorkHours { get; set; }

    public AttendanceStatus Status { get; set; } = AttendanceStatus.Present;

    public string? Notes { get; set; }
}

/// <summary>Employee request to correct a missed/incorrect punch.</summary>
public class RegularizationRequest : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }

    public TimeOnly InTime { get; set; }

    public TimeOnly OutTime { get; set; }

    public string Reason { get; set; } = string.Empty;

    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? DecidedAtUtc { get; set; }

    public Guid? DecidedByUserId { get; set; }

    public User? DecidedByUser { get; set; }
}

public enum PunchType
{
    ClockIn = 1,
    ClockOut = 2,
    BreakIn = 3,
    BreakOut = 4
}

/// <summary>Raw punch clock event recorded from a face terminal or web punch.</summary>
public class EmployeePunch : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateTime PunchTime { get; set; } = DateTime.UtcNow;

    public PunchType PunchType { get; set; } = PunchType.ClockIn;

    public string? Note { get; set; }

    public string? Device { get; set; }

    public bool IsOpen { get; set; }
}
