using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

/// <summary>
/// Super Admin management of tenant companies. Exposes company metadata and provisioning
/// status only — never a company's business data.
/// </summary>
[ApiController]
[Route("api/companies")]
[Tags("Companies")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class CompaniesController : ControllerBase
{
    private readonly ICompanyManagementService _companies;

    public CompaniesController(ICompanyManagementService companies)
    {
        _companies = companies;
    }

    /// <summary>Lists companies with provisioning and invitation status.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CompanyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CompanyListItemDto>>> List(
        [FromQuery] string? search,
        CancellationToken ct) =>
        Ok(await _companies.ListAsync(search, ct));

    /// <summary>Returns a company with its provisioning logs and invitation metadata.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyDetailDto>> Get(Guid id, CancellationToken ct) =>
        Ok(await _companies.GetAsync(id, ct));

    /// <summary>Creates a company and provisions its dedicated database.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CompanyProvisioningResultDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CompanyProvisioningResultDto>> Create(
        [FromBody] CreateCompanyRequest request,
        CancellationToken ct)
    {
        var result = await _companies.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.CompanyId }, result);
    }

    /// <summary>Updates company metadata.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanyDetailDto>> Update(
        Guid id,
        [FromBody] UpdateCompanyRequest request,
        CancellationToken ct) =>
        Ok(await _companies.UpdateAsync(id, request, ct));

    /// <summary>Activates a provisioned company.</summary>
    [HttpPost("{id:guid}/activate")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanyDetailDto>> Activate(Guid id, CancellationToken ct) =>
        Ok(await _companies.ActivateAsync(id, ct));

    /// <summary>Suspends a company, blocking its users from signing in.</summary>
    [HttpPost("{id:guid}/suspend")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanyDetailDto>> Suspend(Guid id, CancellationToken ct) =>
        Ok(await _companies.SuspendAsync(id, ct));

    /// <summary>Retries the provisioning workflow; safe to call repeatedly.</summary>
    [HttpPost("{id:guid}/retry-provisioning")]
    [ProducesResponseType(typeof(CompanyProvisioningResultDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanyProvisioningResultDto>> RetryProvisioning(Guid id, CancellationToken ct) =>
        Ok(await _companies.RetryProvisioningAsync(id, ct));

    /// <summary>Reissues and resends the company admin's activation invitation.</summary>
    [HttpPost("{id:guid}/resend-invitation")]
    [ProducesResponseType(typeof(ResendInvitationResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ResendInvitationResponse>> ResendInvitation(Guid id, CancellationToken ct) =>
        Ok(await _companies.ResendInvitationAsync(id, ct));

    /// <summary>Deletes a company, cleans up registry records and drops its tenant database.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _companies.DeleteAsync(id, ct);
        return NoContent();
    }
}
