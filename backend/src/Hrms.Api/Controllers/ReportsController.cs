using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
[Tags("Reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly IReportService _reports;

    public ReportsController(IReportService reports)
    {
        _reports = reports;
    }

    [HttpGet("payroll")]
    [ProducesResponseType(typeof(IReadOnlyList<PayrollReportRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PayrollReportRowDto>>> Payroll(CancellationToken ct) =>
        Ok(await _reports.PayrollAsync(ct));

    [HttpGet("attendance")]
    [ProducesResponseType(typeof(IReadOnlyList<AttendanceReportRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AttendanceReportRowDto>>> Attendance(
        [FromQuery] int? year,
        [FromQuery] int? month,
        CancellationToken ct) =>
        Ok(await _reports.AttendanceAsync(year, month, ct));

    [HttpGet("leave")]
    [ProducesResponseType(typeof(IReadOnlyList<LeaveReportRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LeaveReportRowDto>>> Leave(CancellationToken ct) =>
        Ok(await _reports.LeaveAsync(ct));

    [HttpGet("overtime")]
    [ProducesResponseType(typeof(IReadOnlyList<OvertimeReportRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<OvertimeReportRowDto>>> Overtime(CancellationToken ct) =>
        Ok(await _reports.OvertimeAsync(ct));
}
