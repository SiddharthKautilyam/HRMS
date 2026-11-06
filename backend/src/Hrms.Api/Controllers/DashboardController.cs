using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
[Tags("Dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboard;
    private readonly IEmployeeService _employees;

    public DashboardController(IDashboardService dashboard, IEmployeeService employees)
    {
        _dashboard = dashboard;
        _employees = employees;
    }

    /// <summary>Self-service dashboard for the signed-in employee.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(EmployeeDashboardDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmployeeDashboardDto>> Me(
        [FromQuery] Guid? employeeId,
        CancellationToken ct)
    {
        var id = await _employees.ResolveEmployeeIdAsync(employeeId, ct);
        return Ok(await _dashboard.GetMyDashboardAsync(id, ct));
    }

    [HttpGet("stats")]
    [ProducesResponseType(typeof(DashboardStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardStatsDto>> Stats(CancellationToken ct) =>
        Ok(await _dashboard.GetStatsAsync(ct));

    [HttpGet("department-headcount")]
    [ProducesResponseType(typeof(IReadOnlyList<DepartmentHeadcountDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DepartmentHeadcountDto>>> DepartmentHeadcount(CancellationToken ct) =>
        Ok(await _dashboard.GetDepartmentHeadcountAsync(ct));

    [HttpGet("attendance-trend")]
    [ProducesResponseType(typeof(IReadOnlyList<AttendanceTrendPointDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AttendanceTrendPointDto>>> AttendanceTrend(CancellationToken ct) =>
        Ok(await _dashboard.GetAttendanceTrendAsync(ct));

    [HttpGet("activity")]
    [ProducesResponseType(typeof(IReadOnlyList<ActivityDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ActivityDto>>> Activity(
        [FromQuery] int take = 6,
        CancellationToken ct = default) =>
        Ok(await _dashboard.GetRecentActivityAsync(take, ct));

    [HttpGet("document-alerts")]
    [ProducesResponseType(typeof(IReadOnlyList<ExpoAlertDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ExpoAlertDto>>> DocumentAlerts(
        [FromQuery] int take = 5,
        CancellationToken ct = default) =>
        Ok(await _dashboard.GetDocumentAlertsAsync(take, ct));

    [HttpGet("pending-approvals")]
    [ProducesResponseType(typeof(IReadOnlyList<PendingApprovalDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PendingApprovalDto>>> PendingApprovals(
        [FromQuery] int take = 5,
        CancellationToken ct = default) =>
        Ok(await _dashboard.GetPendingApprovalsAsync(take, ct));

    [HttpGet("recent-leaves")]
    [ProducesResponseType(typeof(IReadOnlyList<RecentLeaveDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RecentLeaveDto>>> RecentLeaves(
        [FromQuery] int take = 5,
        CancellationToken ct = default) =>
        Ok(await _dashboard.GetRecentLeavesAsync(take, ct));

    /// <summary>Template multi-widget data matching the Old HRMS dashboard format.</summary>
    [HttpGet("template-data")]
    [ProducesResponseType(typeof(DashboardTemplateDataDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DashboardTemplateDataDto>> TemplateData(
        [FromQuery] Guid? employeeId,
        CancellationToken ct)
    {
        var id = await _employees.ResolveEmployeeIdAsync(employeeId, ct);
        return Ok(await _dashboard.GetTemplateDataAsync(id, ct));
    }
}
