using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize]
[Tags("Approvals")]
public sealed class ApprovalsController : ControllerBase
{
    private readonly IApprovalService _approvals;

    public ApprovalsController(IApprovalService approvals)
    {
        _approvals = approvals;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ApprovalDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ApprovalDto>>> List(
        [FromQuery] ApprovalStatus? status,
        [FromQuery] ApprovalType? type,
        CancellationToken ct) =>
        Ok(await _approvals.ListAsync(status, type, ct));

    [HttpGet("summary")]
    [ProducesResponseType(typeof(ApprovalSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApprovalSummaryDto>> Summary(CancellationToken ct) =>
        Ok(await _approvals.GetSummaryAsync(ct));

    [HttpPost]
    [ProducesResponseType(typeof(ApprovalDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ApprovalDto>> Create(
        [FromBody] CreateApprovalRequest request,
        CancellationToken ct)
    {
        var created = await _approvals.CreateAsync(request, ct);
        return CreatedAtAction(nameof(List), created);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = "ManagerOrAbove")]
    [ProducesResponseType(typeof(ApprovalDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApprovalDto>> Approve(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ApprovalDecisionRequest? request,
        CancellationToken ct) =>
        Ok(await _approvals.DecideAsync(id, true, request, ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "ManagerOrAbove")]
    [ProducesResponseType(typeof(ApprovalDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApprovalDto>> Reject(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ApprovalDecisionRequest? request,
        CancellationToken ct) =>
        Ok(await _approvals.DecideAsync(id, false, request, ct));

    [HttpPost("approve-all")]
    [Authorize(Policy = "ManagerOrAbove")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult> ApproveAll(CancellationToken ct)
    {
        var count = await _approvals.ApproveAllAsync(ct);
        return Ok(new { approved = count });
    }
}
