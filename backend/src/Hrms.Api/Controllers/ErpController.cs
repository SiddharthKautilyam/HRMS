using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/erp")]
[Authorize]
[Tags("ERP Integration")]
public sealed class ErpController : ControllerBase
{
    private readonly IErpService _erp;

    public ErpController(IErpService erp)
    {
        _erp = erp;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ErpOverviewDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ErpOverviewDto>> Overview(CancellationToken ct) =>
        Ok(await _erp.GetOverviewAsync(ct));

    [HttpPost("sync")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(ErpOverviewDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ErpOverviewDto>> Sync(CancellationToken ct) =>
        Ok(await _erp.SyncAsync(ct));
}
