using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/performance")]
[Authorize]
[Tags("Performance")]
public sealed class PerformanceController : ControllerBase
{
    private readonly IPerformanceService _performance;
    private readonly IEmployeeService _employees;

    public PerformanceController(IPerformanceService performance, IEmployeeService employees)
    {
        _performance = performance;
        _employees = employees;
    }

    /// <summary>Latest review for an employee; defaults to the signed-in employee.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(PerformanceReviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PerformanceReviewDto>> Me(
        [FromQuery] Guid? employeeId,
        CancellationToken ct)
    {
        var id = await _employees.ResolveEmployeeIdAsync(employeeId, ct);
        return Ok(await _performance.GetForEmployeeAsync(id, ct));
    }

    [HttpGet]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(IReadOnlyList<PerformanceReviewDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PerformanceReviewDto>>> List(CancellationToken ct) =>
        Ok(await _performance.ListAsync(ct));
}
