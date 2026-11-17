using System.ComponentModel.DataAnnotations;

namespace Hrms.Application.DTOs;

public sealed record AttendanceRecordDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeInitials,
    DateOnly Date,
    string? CheckIn,
    string? CheckOut,
    int BreakMinutes,
    decimal WorkHours,
    string Status);

public sealed record RegularizationDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Reason,
    DateOnly Date,
    string InTime,
    string OutTime,
    string Status,
    string SubmittedLabel);

public sealed record CreateRegularizationRequest(
    Guid? EmployeeId,
    DateOnly Date,
    TimeOnly InTime,
    TimeOnly OutTime,
    [Required, MaxLength(500)] string Reason);

public sealed record AttendanceSummaryDto(int Present, int Absent, int Late, int OnLeave);

public sealed record MonthlyMusterDayDto(
    DateOnly Date,
    string DayLabel,
    string? CheckIn,
    string? CheckOut,
    decimal WorkHours,
    string Status);

public sealed record EmployeePunchDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    DateTime PunchTime,
    string PunchType,
    string? Note,
    string? Device);

public sealed record CreatePunchRequest(
    Guid? EmployeeId,
    string PunchType,
    string? Note,
    string? Device);

public sealed record DailyAttendanceCloseoutResult(
    DateOnly TargetDate,
    int ClosedIncompletePunches,
    int MarkedAbsentCount,
    int FinalizedAttendanceCount);


public sealed record EmployeePunchStatusDto(
    bool IsCheckedIn,
    DateTime? LastPunchTimeUtc,
    DateTime ServerTimeUtc,
    string CompanyTimeZone,
    string? FirstCheckInTime,
    decimal WorkedHoursToday,
    long WorkedSecondsToday,
    DateTime? CurrentCheckInTimeUtc,
    IReadOnlyList<EmployeePunchDto> TodayPunches,
    bool HasForgottenCheckOut,
    DateOnly? ForgottenCheckOutDate,
    string? RegularizationMessage);

public sealed record AttendancePersonDto(
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string? Designation,
    string? CheckInTime,
    string? LeaveReason,
    string? CheckOutTime = null,
    decimal WorkHours = 0,
    string? Status = null);

public sealed record TodayAttendanceOverviewDto(
    int TotalEmployees,
    int PresentCount,
    int AbsentCount,
    int OnLeaveCount,
    int LateCount,
    IReadOnlyList<AttendancePersonDto> Present,
    IReadOnlyList<AttendancePersonDto> Absent,
    IReadOnlyList<AttendancePersonDto> OnLeave,
    IReadOnlyList<AttendancePersonDto> Late);

/// <summary>One punch in a batch submitted by a capture source (e.g. the face terminal).</summary>
public sealed record PunchBatchItem(
    string EmployeeCode,
    DateTime PunchTime,
    string? PunchType,
    string? DeviceName,
    string? Note);

/// <summary>A batch of punches captured by a device/source and pushed to the API.</summary>
public sealed record PunchBatchRequest(
    string DeviceSerial,
    string? DeviceLocation,
    IReadOnlyList<PunchBatchItem> Punches);

public sealed record PunchBatchResult(
    bool Success,
    int TotalReceived,
    int ProcessedCount,
    int IgnoredDuplicates,
    IReadOnlyList<string> UnmatchedCodes,
    string Message);

public sealed record EnrolledFaceDto(
    Guid EmployeeId,
    string EmployeeCode,
    string FullName,
    string Department,
    string? AvatarUrl,
    string FaceDescriptor,
    DateTime? EnrolledAtUtc);

public sealed record EnrollFaceRequest(
    [Required] string FaceDescriptor,
    string? FacePhotoUrl);

public sealed record FacePunchRequest(
    string? EmployeeCode,
    Guid? EmployeeId,
    string? PunchType,
    double? Confidence,
    string? Device,
    string? SnapshotBase64);

public sealed record FacePunchResultDto(
    bool Success,
    Guid EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string PunchType,
    DateTime PunchTime,
    string Status,
    string Message);


