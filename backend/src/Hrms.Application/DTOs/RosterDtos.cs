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
