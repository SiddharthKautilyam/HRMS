using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/support")]
[Authorize]
[Tags("Support")]
public sealed class SupportController : ControllerBase
{
    private readonly ISupportService _support;
    private readonly IEmployeeService _employees;

    public SupportController(ISupportService support, IEmployeeService employees)
    {
        _support = support;
        _employees = employees;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SupportRequestDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SupportRequestDto>>> List(
        [FromQuery] Guid? employeeId,
        CancellationToken ct) =>
        Ok(await _support.ListSupportRequestsAsync(employeeId, ct));

    [HttpPost]
    [ProducesResponseType(typeof(SupportRequestDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<SupportRequestDto>> Create(
        [FromBody] CreateSupportRequest request,
        CancellationToken ct)
    {
        var created = await _support.CreateSupportRequestAsync(request, ct);
        return CreatedAtAction(nameof(List), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(SupportRequestDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SupportRequestDto>> Update(
        Guid id,
        [FromBody] UpdateSupportRequest request,
        CancellationToken ct) =>
        Ok(await _support.UpdateSupportRequestAsync(id, request, ct));
}
