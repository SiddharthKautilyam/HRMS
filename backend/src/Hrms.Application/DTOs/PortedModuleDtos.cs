using System.ComponentModel.DataAnnotations;

namespace Hrms.Application.DTOs;

// ── Dynamic RBAC & Navigation ──
public sealed record RoleDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    int UserCount);

public sealed record CreateRoleRequest(
    [Required, MaxLength(50)] string Code,
    [Required, MaxLength(60)] string Name,
    string? Description);

public sealed record UpdateRoleRequest(
    [Required, MaxLength(50)] string Code,
    [Required, MaxLength(60)] string Name,
    string? Description);

public sealed record NavigationItemDto(
    Guid Id,
    string Title,
    string Route,
    string Icon,
    Guid? ParentId,
    int OrderIndex,
    string? Badge,
    IReadOnlyList<NavigationItemDto> Children,
    string Code = "",
    bool IsActive = true);

public sealed record SaveNavigationItemRequest(
    Guid? Id,
    [Required, MaxLength(50)] string Code,
    [Required, MaxLength(80)] string Title,
    [Required, MaxLength(160)] string Route,
    string? Icon,
    Guid? ParentId,
    int OrderIndex,
    string? Badge,
    bool IsActive = true);

public sealed record ReorderNavigationItemRequest(
    Guid Id,
    int OrderIndex,
    Guid? ParentId);

public sealed record ReorderNavigationBatchRequest(
    List<ReorderNavigationItemRequest> Items);

public sealed record RoleNavigationDto(
    Guid Id,
    Guid RoleId,
    string RoleName,
    Guid NavigationItemId,
    string NavigationTitle,
    string NavigationRoute,
    bool IsFull,
    bool IsView,
    bool IsCreate,
    bool IsEdit,
    bool IsDelete);

public sealed record SaveRolePermissionItem(
    Guid NavigationItemId,
    bool IsFull,
    bool IsView,
    bool IsCreate,
    bool IsEdit,
    bool IsDelete);

public sealed record SaveRolePermissionsRequest(
    Guid RoleId,
    List<SaveRolePermissionItem> Permissions);

// ── KeyStore & Options ──
public sealed record KeyGroupDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsGeneric,
    IReadOnlyList<KeyStoreDto> Items,
    bool IsEnumLocked = false);

public sealed record KeyStoreDto(
    Guid Id,
    Guid KeyGroupId,
    string Key,
    string Value,
    string? SubValue,
    int DisplayOrder,
    bool IsActive);

public sealed record SaveKeyStoreRequest(
    Guid? Id,
    Guid KeyGroupId,
    [Required, MaxLength(120)] string Key,
    [Required, MaxLength(250)] string Value,
    [MaxLength(250)] string? SubValue,
    int DisplayOrder,
    bool IsActive);

public sealed record SaveKeyGroupRequest(
    Guid? Id,
    [Required, MaxLength(60)] string Code,
    [Required, MaxLength(120)] string Name,
    [MaxLength(250)] string? Description,
    bool IsGeneric,
    IReadOnlyList<SaveKeyStoreRequest>? Items);

public sealed record ReorderKeyStoresRequest(
    Guid KeyGroupId,
    IReadOnlyList<Guid> StoreIds);

// ── Hardware & Assets ──
public sealed record AssetDto(
    Guid Id,
    Guid AssetTypeId,
    string AssetTypeName,
    string AssetCode,
    string Name,
    string? SerialNumber,
    DateOnly? PurchaseDate,
    DateOnly? WarrantyExpiryDate,
    string Status,
    decimal? Cost,
    string? AssignedToEmployeeName,
    Guid? AssignedToEmployeeId);

public sealed record AssetAssignmentDto(
    Guid Id,
    Guid AssetId,
    string AssetName,
    string AssetCode,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly AssignedDate,
    DateOnly? ReturnedDate,
    string? ConditionOnAssign,
    string? ConditionOnReturn,
    string Status);

public sealed record SaveAssetRequest(
    Guid? Id,
    Guid AssetTypeId,
    [Required, MaxLength(40)] string AssetCode,
    [Required, MaxLength(120)] string Name,
    string? SerialNumber,
    DateOnly? PurchaseDate,
    DateOnly? WarrantyExpiryDate,
    string Status,
    decimal? Cost);

public sealed record AssignAssetRequest(
    Guid AssetId,
    Guid EmployeeId,
    string? ConditionOnAssign);

public sealed record ReturnAssetRequest(
    string? ConditionOnReturn);

// ── Support / Helpdesk ──
public sealed record SupportRequestDto(
    Guid Id,
    Guid SupportTypeId,
    string SupportTypeName,
    Guid EmployeeId,
    string EmployeeName,
    string Subject,
    string Description,
    string Priority,
    string Status,
    DateTime SubmittedAtUtc,
    DateTime? ResolvedAtUtc,
    string? ResolutionNotes);

public sealed record CreateSupportRequest(
    Guid SupportTypeId,
    Guid? EmployeeId,
    [Required, MaxLength(160)] string Subject,
    [Required, MaxLength(2000)] string Description,
    string Priority);

public sealed record UpdateSupportRequest(
    string Status,
    string? ResolutionNotes);

// ── Dashboard Template Multi-Widgets ──
public sealed record NoticeBoardDto(
    Guid Id,
    string Title,
    string Message,
    string Tag,
    string Severity,
    string? ImageUrl,
    string? LinkUrl,
    DateTime PublishedAtUtc);

public sealed record CelebrationDto(
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string Type, // "Birthday" | "WorkAnniversary" | "NewJoinee"
    string DateLabel,
    string? AvatarUrl);

public sealed record DashboardTemplateDataDto(
    TodayAttendanceOverviewDto TodayAttendance,
    IReadOnlyList<NoticeBoardDto> Notices,
    IReadOnlyList<CelebrationDto> Celebrations,
    IReadOnlyList<HolidayDto> UpcomingHolidays,
    IReadOnlyList<TaskDto> MyTasks,
    IReadOnlyList<PendingApprovalDto> PendingApprovals,
    IReadOnlyList<AttendanceTrendPointDto> AttendanceGraph,
    IReadOnlyList<EmployeePunchDto> TodayPunches,
    IReadOnlyList<LeaveBalanceDto> LeaveBalances);
