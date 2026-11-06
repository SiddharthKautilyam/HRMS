using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

/// <summary>Query parameters for the employees directory.</summary>
public sealed record EmployeeQuery(
    string? Search = null,
    Guid? DepartmentId = null,
    EmploymentStatus? Status = null,
    int Page = 1,
    int PageSize = 10);
