using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

// ── Company settings ──
public sealed record CompanySettingsDto(
    string CompanyName,
    string? TradeLicense,
    string? Trn,
    string? Industry,
    int? FoundedYear,
    string? Website,
    string? Address,
    string? City,
    string? Country,
    string? Phone,
    string HrEmail,
    string? PayrollCurrency,
    string? LogoUrl,
    string? TimeZone,
    string? TaxNumberLabel,
    string? RegistrationNumberLabel);

public sealed record SaveCompanySettingsRequest(
    [Required, MaxLength(160)] string CompanyName,
    [Required, EmailAddress] string HrEmail,
    [Required] string TimeZone,
    string? TradeLicense = null,
    string? Trn = null,
    string? Industry = null,
    int? FoundedYear = null,
    string? Website = null,
    string? Address = null,
    string? City = null,
    string? Country = null,
    string? Phone = null,
    string? PayrollCurrency = null,
    string? LogoUrl = null,
    string? TaxNumberLabel = null,
    string? RegistrationNumberLabel = null);

public sealed record CompanyLogoResponse(string LogoUrl);

// ── Tasks ──
public sealed record TaskDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Title,
    string? Description,
    DateOnly DueDate,
    string DueLabel,
    string Status,
    string Priority,
    string? AssignedBy);

public sealed record CreateTaskRequest(
    Guid? EmployeeId,
    [Required, MaxLength(160)] string Title,
    string? Description,
    DateOnly DueDate,
    TaskItemPriority Priority,
    string? AssignedBy);

public sealed record UpdateTaskStatusRequest(TaskItemStatus Status);

// ── Performance ──
public sealed record PerformanceMetricDto(string Name, int Score);

public sealed record PerformanceFeedbackDto(string FromName, string FromRole, string Message, string DateLabel, int Rating);

public sealed record PerformanceReviewDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Period,
    decimal OverallRating,
    int GoalsAchieved,
    int GoalsTotal,
    int FeedbackScore,
    string Rank,
    IReadOnlyList<PerformanceMetricDto> Metrics,
    IReadOnlyList<PerformanceFeedbackDto> Feedbacks);

// ── ERP ──
public sealed record ErpIntegrationDto(
    Guid Id,
    string Name,
    string Description,
    string Status,
    string LastSyncLabel,
    string IconKey);

public sealed record ErpSyncLogDto(Guid Id, string Message, string TimeLabel, bool Success);

public sealed record ErpOverviewDto(
    int ConnectedSystems,
    string LastSyncLabel,
    int SyncErrors,
    int RecordsSynced,
    IReadOnlyList<ErpIntegrationDto> Integrations,
    IReadOnlyList<ErpSyncLogDto> Logs);

// ── Notification preferences ──
public sealed record NotificationPreferenceDto(string Id, string Key, string Name, string Description, bool Enabled);

public sealed record UpdateNotificationPreferenceRequest(bool Enabled);

// ── Reports ──
public sealed record PayrollReportRowDto(
    string Month,
    int Employees,
    decimal Gross,
    decimal Allowances,
    decimal Deductions,
    decimal Net,
    string Status);

public sealed record AttendanceReportRowDto(
    string Employee,
    string Department,
    int Present,
    int Absent,
    int Late,
    decimal AverageHours,
    string Rating);

public sealed record LeaveReportRowDto(
    string Employee,
    int AnnualUsed,
    int SickUsed,
    int EmergencyUsed,
    int UnpaidUsed,
    int Balance);

public sealed record OvertimeReportRowDto(
    string Employee,
    decimal Hours,
    string Rate,
    decimal Amount,
    string Status);

// ── Employee self-service dashboard ──
public sealed record EmployeeDashboardDto(
    Guid EmployeeId,
    string FullName,
    string Initials,
    string JobTitle,
    string Department,
    string Status,
    string DateLabel,
    string CheckInLabel,
    AttendanceSummaryDto AttendanceSummary,
    IReadOnlyList<LeaveBalanceDto> LeaveBalances,
    IReadOnlyList<RecentLeaveDto> RecentLeaves,
    IReadOnlyList<AnnouncementDto> Announcements,
    IReadOnlyList<HolidayDto> UpcomingHolidays,
    IReadOnlyList<ActivityDto> Activity,
    IReadOnlyList<AttendanceTrendPointDto> AttendanceTrend,
    decimal WorkingHoursThisWeek);
