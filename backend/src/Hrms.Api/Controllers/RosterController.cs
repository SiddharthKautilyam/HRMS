using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/roster")]
[Authorize]
[Tags("Roster")]
public sealed class RosterController : ControllerBase
{
    private readonly IShiftRosterService _roster;

    public RosterController(IShiftRosterService roster)
    {
        _roster = roster;
    }

    [HttpGet("templates")]
    [ProducesResponseType(typeof(IReadOnlyList<ShiftTemplateDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ShiftTemplateDto>>> GetTemplates(CancellationToken ct) =>
        Ok(await _roster.GetShiftTemplatesAsync(ct));

    [HttpPost("templates")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(ShiftTemplateDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ShiftTemplateDto>> CreateTemplate(
        [FromBody] SaveShiftTemplateRequest request,
        CancellationToken ct)
    {
        var created = await _roster.CreateShiftTemplateAsync(request, ct);
        return CreatedAtAction(nameof(GetTemplates), new { id = created.Id }, created);
    }

    [HttpPut("templates/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(ShiftTemplateDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ShiftTemplateDto>> UpdateTemplate(
        Guid id,
        [FromBody] SaveShiftTemplateRequest request,
        CancellationToken ct) =>
        Ok(await _roster.UpdateShiftTemplateAsync(id, request, ct));

    [HttpDelete("templates/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken ct)
    {
        await _roster.DeleteShiftTemplateAsync(id, ct);
        return NoContent();
    }
}
