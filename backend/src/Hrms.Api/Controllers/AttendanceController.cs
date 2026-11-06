using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
[Tags("Attendance")]
public sealed class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendance;

    public AttendanceController(IAttendanceService attendance)
    {
        _attendance = attendance;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(AttendanceSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AttendanceSummaryDto>> Summary(CancellationToken ct) =>
        Ok(await _attendance.GetSummaryAsync(ct));

    [HttpGet("today")]
    [ProducesResponseType(typeof(IReadOnlyList<AttendanceRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecordDto>>> Today(CancellationToken ct) =>
        Ok(await _attendance.GetTodayAsync(ct));

    [HttpGet("employee/{employeeId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<AttendanceRecordDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AttendanceRecordDto>>> ForEmployee(
        Guid employeeId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return Ok(await _attendance.GetForEmployeeMonthAsync(employeeId, year ?? now.Year, month ?? now.Month, ct));
    }

    [HttpGet("muster/{employeeId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<MonthlyMusterDayDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MonthlyMusterDayDto>>> Muster(
        Guid employeeId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return Ok(await _attendance.GetMusterAsync(employeeId, year ?? now.Year, month ?? now.Month, ct));
    }

    [HttpGet("regularizations")]
    [ProducesResponseType(typeof(IReadOnlyList<RegularizationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RegularizationDto>>> Regularizations(CancellationToken ct) =>
        Ok(await _attendance.GetRegularizationsAsync(ct));

    [HttpPost("regularizations")]
    [ProducesResponseType(typeof(RegularizationDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<RegularizationDto>> CreateRegularization(
        [FromBody] CreateRegularizationRequest request,
        CancellationToken ct)
    {
        var created = await _attendance.CreateRegularizationAsync(request, ct);
        return CreatedAtAction(nameof(Regularizations), created);
    }

    [HttpPost("regularizations/{id:guid}/approve")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(RegularizationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RegularizationDto>> ApproveRegularization(Guid id, CancellationToken ct) =>
        Ok(await _attendance.DecideRegularizationAsync(id, true, ct));

    [HttpPost("regularizations/{id:guid}/reject")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(RegularizationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RegularizationDto>> RejectRegularization(Guid id, CancellationToken ct) =>
        Ok(await _attendance.DecideRegularizationAsync(id, false, ct));

    [HttpPost("punch")]
    [ProducesResponseType(typeof(EmployeePunchDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmployeePunchDto>> Punch(
        [FromBody] CreatePunchRequest request,
        CancellationToken ct) =>
        Ok(await _attendance.RecordPunchAsync(request, ct));

    [HttpGet("punch/status")]
    [ProducesResponseType(typeof(EmployeePunchStatusDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmployeePunchStatusDto>> PunchStatus(
        [FromQuery] Guid? employeeId,
        CancellationToken ct) =>
        Ok(await _attendance.GetPunchStatusAsync(employeeId, ct));

    [HttpGet("punches/today")]
    [ProducesResponseType(typeof(IReadOnlyList<EmployeePunchDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EmployeePunchDto>>> TodayPunches(
        [FromQuery] Guid? employeeId,
        CancellationToken ct) =>
        Ok(await _attendance.GetTodayPunchesAsync(employeeId, ct));

    [HttpGet("overview/today")]
    [ProducesResponseType(typeof(TodayAttendanceOverviewDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<TodayAttendanceOverviewDto>> TodayOverview(CancellationToken ct) =>
        Ok(await _attendance.GetTodayOverviewAsync(ct));

    /// <summary>Lists enrolled employee face descriptors for real-time Kiosk matching.</summary>
    [HttpGet("enrolled-faces")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<EnrolledFaceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EnrolledFaceDto>>> GetEnrolledFaces(CancellationToken ct) =>
        Ok(await _attendance.GetEnrolledFacesAsync(ct));

    /// <summary>Submits a face recognition punch from Kiosk or Self-Service camera.</summary>
    [HttpPost("face-punch")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(FacePunchResultDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<FacePunchResultDto>> FacePunch(
        [FromBody] FacePunchRequest request,
        CancellationToken ct) =>
        Ok(await _attendance.ProcessFacePunchAsync(request, ct));

    /// <summary>Enrolls face biometric descriptor for an employee.</summary>
    [HttpPost("employees/{id:guid}/enroll-face")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> EnrollFace(
        Guid id,
        [FromBody] EnrollFaceRequest request,
        CancellationToken ct)
    {
        await _attendance.EnrollFaceAsync(id, request, ct);
        return Ok(new { message = "Face enrolled successfully." });
    }

    /// <summary>Removes enrolled face biometric descriptor for an employee.</summary>
    [HttpDelete("employees/{id:guid}/enroll-face")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveFace(
        Guid id,
        CancellationToken ct)
    {
        await _attendance.RemoveFaceAsync(id, ct);
        return Ok(new { message = "Face biometric removed successfully." });
    }
}
