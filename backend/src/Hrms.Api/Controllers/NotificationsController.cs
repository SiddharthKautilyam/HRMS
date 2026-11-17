using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Tags("Notifications")]
public sealed class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public NotificationsController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> List(CancellationToken ct) =>
        Ok(await _notifications.ListAsync(ct));

    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await _notifications.MarkReadAsync(id, ct);
        return NoContent();
    }

    [HttpPost("mark-all-read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await _notifications.MarkAllReadAsync(ct);
        return NoContent();
    }

    [HttpDelete("clear-all")]
    [HttpPost("clear-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ClearAll(CancellationToken ct)
    {
        await _notifications.ClearAllAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _notifications.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/toggle")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ToggleRead(Guid id, CancellationToken ct)
    {
        await _notifications.ToggleReadAsync(id, ct);
        return NoContent();
    }

    [HttpGet("preferences")]
    [ProducesResponseType(typeof(IReadOnlyList<NotificationPreferenceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NotificationPreferenceDto>>> Preferences(CancellationToken ct) =>
        Ok(await _notifications.GetPreferencesAsync(ct));

    [HttpPut("preferences/{id}")]
    [ProducesResponseType(typeof(NotificationPreferenceDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificationPreferenceDto>> UpdatePreference(
        string id,
        [FromBody] UpdateNotificationPreferenceRequest request,
        CancellationToken ct) =>
        Ok(await _notifications.UpdatePreferenceAsync(id, request.Enabled, ct));
}
