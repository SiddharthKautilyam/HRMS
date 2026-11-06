using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record ApprovalDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeInitials,
    string Type,
    string Title,
    string Details,
    DateTime SubmittedAtUtc,
    string SubmittedLabel,
    string Priority,
    string Status);

public sealed record CreateApprovalRequest(
    Guid? EmployeeId,
    ApprovalType Type,
    [Required, MaxLength(120)] string Title,
    [Required, MaxLength(500)] string Details,
    ApprovalPriority Priority);

public sealed record ApprovalDecisionRequest(string? Note);

public sealed record ApprovalSummaryDto(int TotalPending, int LeaveRequests, int Overtime, int Regularization);
