using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/navigation")]
[Authorize]
[Tags("Navigation")]
public sealed class NavigationController : ControllerBase
{
    private readonly INavigationService _navigation;
    private readonly ICurrentUser _currentUser;

    public NavigationController(INavigationService navigation, ICurrentUser currentUser)
    {
        _navigation = navigation;
        _currentUser = currentUser;
    }

    [HttpGet("tree")]
    [ProducesResponseType(typeof(IReadOnlyList<NavigationItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NavigationItemDto>>> GetTree(CancellationToken ct) =>
        Ok(await _navigation.GetNavigationTreeAsync(ct));

    [HttpGet("user")]
    [ProducesResponseType(typeof(IReadOnlyList<NavigationItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NavigationItemDto>>> GetUserNavigation(CancellationToken ct) =>
        Ok(await _navigation.GetUserNavigationAsync(_currentUser.UserId ?? Guid.Empty, ct));

    [HttpGet("role/{roleId:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(IReadOnlyList<RoleNavigationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RoleNavigationDto>>> GetRolePermissions(Guid roleId, CancellationToken ct) =>
        Ok(await _navigation.GetRolePermissionsAsync(roleId, ct));

    [HttpPost("role")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SaveRolePermissions(
        [FromBody] SaveRolePermissionsRequest request,
        CancellationToken ct)
    {
        await _navigation.SaveRolePermissionsAsync(request, ct);
        return NoContent();
    }

    [HttpPost]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(NavigationItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NavigationItemDto>> CreateNavigationItem(
        [FromBody] SaveNavigationItemRequest request,
        CancellationToken ct)
    {
        var item = await _navigation.CreateNavigationItemAsync(request, ct);
        return CreatedAtAction(nameof(GetTree), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(NavigationItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NavigationItemDto>> UpdateNavigationItem(
        Guid id,
        [FromBody] SaveNavigationItemRequest request,
        CancellationToken ct) =>
        Ok(await _navigation.UpdateNavigationItemAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteNavigationItem(Guid id, CancellationToken ct)
    {
        await _navigation.DeleteNavigationItemAsync(id, ct);
        return NoContent();
    }

    [HttpPut("reorder")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ReorderNavigation(
        [FromBody] ReorderNavigationBatchRequest request,
        CancellationToken ct)
    {
        await _navigation.ReorderNavigationAsync(request, ct);
        return NoContent();
    }
}
