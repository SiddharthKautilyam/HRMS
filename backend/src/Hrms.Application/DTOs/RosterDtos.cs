using System.ComponentModel.DataAnnotations;

namespace Hrms.Application.DTOs;

public sealed record ShiftTemplateDto(
    Guid Id,
    string Name,
    string? Description,
    Guid? DepartmentId,
    string? DepartmentName,
    int GracePeriodMinutes,
    decimal HalfDayHours,
    decimal FullDayHours,
    bool IsDefault,
    bool IsNightShift,
    IReadOnlyList<ShiftdayDto> Shiftdays);

public sealed record ShiftdayDto(
    Guid Id,
    Guid ShiftTemplateId,
    string DayOfWeek,
    string StartTime,
    string EndTime,
    bool IsWeekOff,
    int BreakMinutes);

public sealed record SaveShiftdayRequest(
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool IsWeekOff,
    int BreakMinutes);

public sealed record SaveShiftTemplateRequest(
    [Required, MaxLength(80)] string Name,
    string? Description,
    Guid? DepartmentId,
    int GracePeriodMinutes,
    decimal HalfDayHours,
    decimal FullDayHours,
    bool IsDefault,
    bool IsNightShift,
    List<SaveShiftdayRequest>? Shiftdays);

public sealed record ShiftAssignmentDto(
    Guid Id,
    Guid ShiftTemplateId,
    string ShiftName,
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    DateOnly StartDate,
    DateOnly? EndDate,
    bool IsActive);

public sealed record AssignShiftRequest(
    Guid ShiftTemplateId,
    Guid EmployeeId,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record RosterQueryRequest(
    DateOnly StartDate,
    DateOnly EndDate,
    Guid? DepartmentId);

public sealed record RosterCellDto(
    DateOnly Date,
    string Status,
    string? ShiftName,
    string? StartTime,
    string? EndTime,
    bool IsWeekOff,
    bool IsHoliday);

public sealed record RosterRowDto(
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    IReadOnlyList<RosterCellDto> Days);

public sealed record RosterMatrixDto(
    DateOnly StartDate,
    DateOnly EndDate,
    IReadOnlyList<DateOnly> Dates,
    IReadOnlyList<RosterRowDto> Rows);
