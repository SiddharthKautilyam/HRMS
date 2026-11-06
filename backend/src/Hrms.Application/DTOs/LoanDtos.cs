using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record LoanDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string LoanType,
    decimal Amount,
    decimal Emi,
    decimal PaidAmount,
    decimal Balance,
    int TenureMonths,
    string Status,
    string? Reason,
    DateTime RequestedAtUtc);

public sealed record CreateLoanRequest(
    Guid? EmployeeId,
    LoanType LoanType,
    [Range(1, 1_000_000)] decimal Amount,
    [Range(1, 120)] int TenureMonths,
    string? Reason);

public sealed record LoanSummaryDto(
    decimal TotalDisbursed,
    decimal Outstanding,
    int ActiveLoans,
    int PendingApproval);
