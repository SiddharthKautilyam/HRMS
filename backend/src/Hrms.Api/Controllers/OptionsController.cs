using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/options")]
[Authorize]
[Tags("Options")]
public sealed class OptionsController : ControllerBase
{
    private readonly IOptionsService _options;

    public OptionsController(IOptionsService options)
    {
        _options = options;
    }

    [HttpGet("groups")]
    [ProducesResponseType(typeof(IReadOnlyList<KeyGroupDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<KeyGroupDto>>> GetGroups(CancellationToken ct) =>
        Ok(await _options.GetKeyGroupsAsync(ct));

    [HttpGet("groups/{id:guid}")]
    [ProducesResponseType(typeof(KeyGroupDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KeyGroupDto>> GetGroupById(Guid id, CancellationToken ct) =>
        Ok(await _options.GetKeyGroupByIdAsync(id, ct));

    [HttpPost("groups")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(KeyGroupDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KeyGroupDto>> CreateGroup(
        [FromBody] SaveKeyGroupRequest request,
        CancellationToken ct) =>
        Ok(await _options.SaveKeyGroupAsync(request, ct));

    [HttpPut("groups/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(KeyGroupDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KeyGroupDto>> UpdateGroup(
        Guid id,
        [FromBody] SaveKeyGroupRequest request,
        CancellationToken ct) =>
        Ok(await _options.SaveKeyGroupAsync(request with { Id = id }, ct));

    [HttpDelete("groups/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken ct)
    {
        await _options.DeleteKeyGroupAsync(id, ct);
        return NoContent();
    }

    [HttpGet("group/{code}")]
    [ProducesResponseType(typeof(IReadOnlyList<KeyStoreDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<KeyStoreDto>>> GetByGroup(string code, CancellationToken ct) =>
        Ok(await _options.GetKeyStoresByGroupAsync(code, ct));

    [HttpPost("multiple")]
    [ProducesResponseType(typeof(Dictionary<string, IReadOnlyList<KeyStoreDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<Dictionary<string, IReadOnlyList<KeyStoreDto>>>> GetMultiple(
        [FromBody] List<string> groupCodes,
        CancellationToken ct) =>
        Ok(await _options.GetMultipleOptionsAsync(groupCodes, ct));

    [HttpPost]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(KeyStoreDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KeyStoreDto>> Save(
        [FromBody] SaveKeyStoreRequest request,
        CancellationToken ct) =>
        Ok(await _options.SaveKeyStoreAsync(request, ct));

    [HttpPost("values")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(KeyStoreDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KeyStoreDto>> CreateValue(
        [FromBody] SaveKeyStoreRequest request,
        CancellationToken ct) =>
        Ok(await _options.SaveKeyStoreAsync(request, ct));

    [HttpPut("values/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(KeyStoreDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<KeyStoreDto>> UpdateValue(
        Guid id,
        [FromBody] SaveKeyStoreRequest request,
        CancellationToken ct) =>
        Ok(await _options.SaveKeyStoreAsync(request with { Id = id }, ct));

    [HttpDelete("values/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteValue(Guid id, CancellationToken ct)
    {
        await _options.DeleteKeyStoreAsync(id, ct);
        return NoContent();
    }

    [HttpPut("values/reorder")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ReorderValues(
        [FromBody] ReorderKeyStoresRequest request,
        CancellationToken ct)
    {
        await _options.ReorderKeyStoresAsync(request, ct);
        return NoContent();
    }
}
