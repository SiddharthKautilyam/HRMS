using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record LeaveTypeDto(
    Guid Id,
    string Name,
    int MaxDaysPerYear,
    bool IsPaid,
    string Color,
    string? Description);

public sealed record SaveLeaveTypeRequest(
    [Required, MaxLength(80)] string Name,
    [Range(1, 365)] int MaxDaysPerYear,
    bool IsPaid,
    string Color,
    string? Description);

public sealed record LeaveRequestDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeInitials,
    string LeaveType,
    DateOnly FromDate,
    DateOnly ToDate,
    int Days,
    string Reason,
    string Status,
    DateTime SubmittedAtUtc,
    string SubmittedLabel);

public sealed record CreateLeaveRequest(
    Guid? EmployeeId,
    [Required] Guid LeaveTypeId,
    DateOnly FromDate,
    DateOnly ToDate,
    [Required, MaxLength(500)] string Reason);

public sealed record LeaveDecisionRequest(string? Note);

public sealed record LeaveBalanceDto(string Type, int Balance, int Total, int Used, string Color);

public sealed record LeaveSummaryDto(
    int TotalRequests,
    int PendingRequests,
    int ApprovedRequests,
    int RejectedRequests,
    int OnLeaveToday);
