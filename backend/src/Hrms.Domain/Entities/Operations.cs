using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

/// <summary>Single-row organisation configuration (Settings → General).</summary>
public class CompanySettings : BaseEntity
{
    public string CompanyName { get; set; } = string.Empty;

    public string TradeLicense { get; set; } = string.Empty;

    public string Trn { get; set; } = string.Empty;

    public string Industry { get; set; } = "Technology";

    public int FoundedYear { get; set; } = 2018;

    public string Website { get; set; } = string.Empty;

    public string Address { get; set; } = string.Empty;

    public string City { get; set; } = string.Empty;

    public string Country { get; set; } = "UAE";

    public string Phone { get; set; } = string.Empty;

    public string HrEmail { get; set; } = string.Empty;
    public string PayrollCurrency { get; set; } = "USD";
    public string? LogoUrl { get; set; }
    public string? TimeZone { get; set; }
    public string TaxNumberLabel { get; set; } = "TRN / Tax Number";
    public string RegistrationNumberLabel { get; set; } = "Trade License / Reg No";
    public int MaxPunchDurationHours { get; set; } = 16;
}

/// <summary>A task assigned to an employee (My Tasks).</summary>
public class TaskItem : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateOnly DueDate { get; set; }

    public TaskItemStatus Status { get; set; } = TaskItemStatus.Pending;

    public TaskItemPriority Priority { get; set; } = TaskItemPriority.Medium;

    public string? AssignedBy { get; set; }
}

/// <summary>Quarterly performance review with metrics and manager feedback.</summary>
public class PerformanceReview : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string Period { get; set; } = string.Empty;

    public decimal OverallRating { get; set; }

    public int GoalsAchieved { get; set; }

    public int GoalsTotal { get; set; }

    public int FeedbackScore { get; set; }

    public string Rank { get; set; } = string.Empty;

    public ICollection<PerformanceMetric> Metrics { get; set; } = new List<PerformanceMetric>();

    public ICollection<PerformanceFeedback> Feedbacks { get; set; } = new List<PerformanceFeedback>();
}

public class PerformanceMetric : BaseEntity
{
    public Guid PerformanceReviewId { get; set; }

    public PerformanceReview? PerformanceReview { get; set; }

    public string Name { get; set; } = string.Empty;

    public int Score { get; set; }
}

public class PerformanceFeedback : BaseEntity
{
    public Guid PerformanceReviewId { get; set; }

    public PerformanceReview? PerformanceReview { get; set; }

    public string FromName { get; set; } = string.Empty;

    public string FromRole { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    public int Rating { get; set; }
}

/// <summary>External system connected to the HRMS (ERP Integration page).</summary>
public class ErpIntegration : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public ErpStatus Status { get; set; } = ErpStatus.Pending;

    public string LastSyncLabel { get; set; } = "Never";

    public string IconKey { get; set; } = "link";
}

/// <summary>One entry in the ERP synchronisation log.</summary>
public class ErpSyncLog : BaseEntity
{
    public string Message { get; set; } = string.Empty;

    public DateTime SyncedAtUtc { get; set; } = DateTime.UtcNow;

    public bool Success { get; set; } = true;

    public int RecordsSynced { get; set; }
}

/// <summary>Per-user notification preference toggles (Settings).</summary>
public class NotificationPreference : BaseEntity
{
    public Guid UserId { get; set; }

    public User? User { get; set; }

    public string Key { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;
}

public class KeyGroup : BaseEntity
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsGeneric { get; set; } = false;

    public ICollection<KeyStore> KeyStores { get; set; } = new List<KeyStore>();
}

public class KeyStore : BaseEntity
{
    public Guid KeyGroupId { get; set; }

    public KeyGroup? KeyGroup { get; set; }

    public string Key { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public string? SubValue { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

public class AssetType : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ICollection<Asset> Assets { get; set; } = new List<Asset>();
}

public class Asset : BaseEntity
{
    public Guid AssetTypeId { get; set; }

    public AssetType? AssetType { get; set; }

    public string AssetCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? SerialNumber { get; set; }

    public DateOnly? PurchaseDate { get; set; }

    public DateOnly? WarrantyExpiryDate { get; set; }

    public string Status { get; set; } = "Available";

    public decimal? Cost { get; set; }

    public ICollection<AssetAssignment> Assignments { get; set; } = new List<AssetAssignment>();
}

public class AssetAssignment : BaseEntity
{
    public Guid AssetId { get; set; }

    public Asset? Asset { get; set; }

    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateOnly AssignedDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);

    public DateOnly? ReturnedDate { get; set; }

    public string? ConditionOnAssign { get; set; }

    public string? ConditionOnReturn { get; set; }

    public string Status { get; set; } = "Active";
}

public class SupportType : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ICollection<SupportRequest> SupportRequests { get; set; } = new List<SupportRequest>();
}

public class SupportRequest : BaseEntity
{
    public Guid SupportTypeId { get; set; }

    public SupportType? SupportType { get; set; }

    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public string Subject { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Priority { get; set; } = "Medium";

    public string Status { get; set; } = "Open";

    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ResolvedAtUtc { get; set; }

    public string? ResolutionNotes { get; set; }
}
