using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/leave")]
[Authorize]
[Tags("Leave")]
public sealed class LeaveController : ControllerBase
{
    private readonly ILeaveService _leave;

    public LeaveController(ILeaveService leave)
    {
        _leave = leave;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(LeaveSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LeaveSummaryDto>> GetSummary(CancellationToken ct) =>
        Ok(await _leave.GetSummaryAsync(ct));

    // ── Leave types ──
    [HttpGet("types")]
    [ProducesResponseType(typeof(IReadOnlyList<LeaveTypeDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LeaveTypeDto>>> GetTypes(CancellationToken ct) =>
        Ok(await _leave.GetLeaveTypesAsync(ct));

    [HttpPost("types")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(LeaveTypeDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<LeaveTypeDto>> CreateType(
        [FromBody] SaveLeaveTypeRequest request,
        CancellationToken ct)
    {
        var created = await _leave.CreateLeaveTypeAsync(request, ct);
        return CreatedAtAction(nameof(GetTypes), created);
    }

    [HttpPut("types/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(LeaveTypeDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LeaveTypeDto>> UpdateType(
        Guid id,
        [FromBody] SaveLeaveTypeRequest request,
        CancellationToken ct) =>
        Ok(await _leave.UpdateLeaveTypeAsync(id, request, ct));

    [HttpDelete("types/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteType(Guid id, CancellationToken ct)
    {
        await _leave.DeleteLeaveTypeAsync(id, ct);
        return NoContent();
    }

    // ── Requests ──
    [HttpGet("requests")]
    [ProducesResponseType(typeof(PagedResult<LeaveRequestDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<LeaveRequestDto>>> Search(
        [FromQuery] string? search,
        [FromQuery] LeaveStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default) =>
        Ok(await _leave.SearchAsync(search, status, page, pageSize, ct));

    [HttpGet("requests/employee/{employeeId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<LeaveRequestDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LeaveRequestDto>>> ForEmployee(Guid employeeId, CancellationToken ct) =>
        Ok(await _leave.ListForEmployeeAsync(employeeId, ct));

    [HttpPost("requests")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<LeaveRequestDto>> Create(
        [FromBody] CreateLeaveRequest request,
        CancellationToken ct)
    {
        var created = await _leave.CreateAsync(request, ct);
        return CreatedAtAction(nameof(ForEmployee), new { employeeId = created.EmployeeId }, created);
    }

    [HttpPost("requests/{id:guid}/approve")]
    [Authorize(Policy = "ManagerOrAbove")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LeaveRequestDto>> Approve(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LeaveDecisionRequest? request,
        CancellationToken ct) =>
        Ok(await _leave.DecideAsync(id, true, request, ct));

    [HttpPost("requests/{id:guid}/reject")]
    [Authorize(Policy = "ManagerOrAbove")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LeaveRequestDto>> Reject(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] LeaveDecisionRequest? request,
        CancellationToken ct) =>
        Ok(await _leave.DecideAsync(id, false, request, ct));

    [HttpGet("balances/{employeeId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<LeaveBalanceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LeaveBalanceDto>>> Balances(Guid employeeId, CancellationToken ct) =>
        Ok(await _leave.GetBalancesAsync(employeeId, ct));
}
