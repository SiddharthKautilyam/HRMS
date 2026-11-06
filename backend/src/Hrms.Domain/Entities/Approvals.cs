using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

/// <summary>Generic approval item (leave, overtime, WFH, regularization, loan, document).</summary>
public class ApprovalRequest : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public ApprovalType Type { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Details { get; set; } = string.Empty;

    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    public ApprovalPriority Priority { get; set; } = ApprovalPriority.Low;

    /// <summary>Hours requested when <see cref="Type"/> is overtime.</summary>
    public decimal? OvertimeHours { get; set; }

    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

    public DateTime? DecidedAtUtc { get; set; }

    public Guid? DecidedByUserId { get; set; }

    public User? DecidedByUser { get; set; }

    public string? DecisionNote { get; set; }
}

public class Announcement : BaseEntity
{
    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Tag { get; set; } = "HR Update";

    public AnnouncementSeverity Severity { get; set; } = AnnouncementSeverity.Info;

    public DateTime PublishedAtUtc { get; set; } = DateTime.UtcNow;

    public string? ImageUrl { get; set; }

    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string? LinkUrl { get; set; }

    public bool IsActive { get; set; } = true;
}
