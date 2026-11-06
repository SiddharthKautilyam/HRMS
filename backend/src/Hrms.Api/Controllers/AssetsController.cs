using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/assets")]
[Authorize]
[Tags("Assets")]
public sealed class AssetsController : ControllerBase
{
    private readonly IAssetService _assets;

    public AssetsController(IAssetService assets)
    {
        _assets = assets;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AssetDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AssetDto>>> List(CancellationToken ct) =>
        Ok(await _assets.ListAssetsAsync(ct));

    [HttpPost]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(AssetDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<AssetDto>> Create(
        [FromBody] SaveAssetRequest request,
        CancellationToken ct)
    {
        var created = await _assets.CreateAssetAsync(request, ct);
        return CreatedAtAction(nameof(List), new { id = created.Id }, created);
    }

    [HttpPost("assign")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(AssetAssignmentDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AssetAssignmentDto>> Assign(
        [FromBody] AssignAssetRequest request,
        CancellationToken ct) =>
        Ok(await _assets.AssignAssetAsync(request, ct));

    [HttpPost("assignments/{id:guid}/return")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(AssetAssignmentDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AssetAssignmentDto>> Return(
        Guid id,
        [FromBody] ReturnAssetRequest request,
        CancellationToken ct) =>
        Ok(await _assets.ReturnAssetAsync(id, request, ct));
}
