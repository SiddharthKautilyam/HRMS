using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record DocumentDto(
    Guid Id,
    Guid? EmployeeId,
    string? EmployeeName,
    string Name,
    string Type,
    string? DocumentNumber,
    string? IssuedBy,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate,
    int? DaysLeft,
    string Status,
    string? Notes,
    string? FileSize,
    string? FileUrl,
    bool IsCompanyDocument);

public sealed record CreateDocumentRequest(
    Guid? EmployeeId,
    [Required, MaxLength(120)] string Name,
    DocumentType Type,
    string? DocumentNumber,
    string? IssuedBy,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate,
    string? Notes,
    string? FileUrl,
    string? FileSize,
    bool IsCompanyDocument);

public sealed record DocumentSummaryDto(int Total, int ExpiringSoon, int Expired, int Valid);
