using System.ComponentModel.DataAnnotations;
using Hrms.Domain.Enums;

namespace Hrms.Application.DTOs;

public sealed record DepartmentDto(Guid Id, string Name, string Code, string? Description, bool IsActive, int EmployeeCount);

public sealed record SaveDepartmentRequest(
    [Required, MaxLength(80)] string Name,
    [Required, MaxLength(20)] string Code,
    string? Description,
    bool IsActive = true);

public sealed record DesignationDto(Guid Id, string Name, string Grade, Guid? DepartmentId, string? Department, string? Description);

public sealed record SaveDesignationRequest(
    [Required, MaxLength(80)] string Name,
    [Required, MaxLength(10)] string Grade,
    Guid? DepartmentId,
    string? Description);

public sealed record BranchDto(Guid Id, string Name, string Location, string ManagerName, int EmployeeCount, bool IsActive);

public sealed record SaveBranchRequest(
    [Required, MaxLength(80)] string Name,
    [Required, MaxLength(120)] string Location,
    [Required, MaxLength(120)] string ManagerName,
    int EmployeeCount);

public sealed record HolidayDto(Guid Id, string Name, DateOnly Date, string DayLabel, string Type);

public sealed record SaveHolidayRequest(
    [Required, MaxLength(120)] string Name,
    DateOnly Date,
    HolidayType Type);

public sealed record ShiftDto(Guid Id, string Name, string StartTime, string EndTime, int DailyHours, string WorkingDays);

public sealed record SaveShiftRequest(
    [Required, MaxLength(80)] string Name,
    TimeOnly StartTime,
    TimeOnly EndTime,
    [Range(1, 24)] int DailyHours,
    [Required, MaxLength(60)] string WorkingDays);
