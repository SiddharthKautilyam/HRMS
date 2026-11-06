using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/announcements")]
[Authorize]
[Tags("Announcements")]
public sealed class AnnouncementsController : ControllerBase
{
    private readonly IAnnouncementService _announcements;

    public AnnouncementsController(IAnnouncementService announcements)
    {
        _announcements = announcements;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AnnouncementDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AnnouncementDto>>> List(CancellationToken ct) =>
        Ok(await _announcements.ListAsync(ct));

    [HttpPost]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(AnnouncementDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<AnnouncementDto>> Create(
        [FromBody] SaveAnnouncementRequest request,
        CancellationToken ct)
    {
        var created = await _announcements.CreateAsync(request, ct);
        return CreatedAtAction(nameof(List), created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(AnnouncementDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AnnouncementDto>> Update(
        Guid id,
        [FromBody] SaveAnnouncementRequest request,
        CancellationToken ct) =>
        Ok(await _announcements.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _announcements.DeleteAsync(id, ct);
        return NoContent();
    }
}
