using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/organization")]
[Authorize]
[Tags("Organization")]
public sealed class OrganizationController : ControllerBase
{
    private readonly IOrganizationService _organization;
    private readonly ICompanyService _company;

    public OrganizationController(IOrganizationService organization, ICompanyService company)
    {
        _organization = organization;
        _company = company;
    }

    // ── Company profile ──
    [HttpGet("company")]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanySettingsDto>> Company(CancellationToken ct) =>
        Ok(await _company.GetAsync(ct));

    [HttpPut("company")]
    [ProducesResponseType(typeof(CompanySettingsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<CompanySettingsDto>> UpdateCompany(
        [FromBody] SaveCompanySettingsRequest request,
        CancellationToken ct) =>
        Ok(await _company.UpdateAsync(request, ct));

    [HttpPost("company/logo")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CompanyLogoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CompanyLogoResponse>> UploadLogo(
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ProblemDetails { Status = 400, Title = "No file was uploaded." });
        }

        using var stream = file.OpenReadStream();
        var url = await _company.UploadLogoAsync(stream, file.FileName, file.ContentType, file.Length, ct);
        return Ok(new CompanyLogoResponse(url));
    }

    // ── Departments ──
    [HttpGet("departments")]
    [ProducesResponseType(typeof(IReadOnlyList<DepartmentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DepartmentDto>>> Departments(CancellationToken ct) =>
        Ok(await _organization.GetDepartmentsAsync(ct));

    [HttpPost("departments")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(DepartmentDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<DepartmentDto>> CreateDepartment(
        [FromBody] SaveDepartmentRequest request,
        CancellationToken ct)
    {
        var created = await _organization.CreateDepartmentAsync(request, ct);
        return CreatedAtAction(nameof(Departments), created);
    }

    [HttpPut("departments/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(DepartmentDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DepartmentDto>> UpdateDepartment(
        Guid id,
        [FromBody] SaveDepartmentRequest request,
        CancellationToken ct) =>
        Ok(await _organization.UpdateDepartmentAsync(id, request, ct));

    [HttpDelete("departments/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteDepartment(Guid id, CancellationToken ct)
    {
        await _organization.DeleteDepartmentAsync(id, ct);
        return NoContent();
    }

    // ── Designations ──
    [HttpGet("designations")]
    [ProducesResponseType(typeof(IReadOnlyList<DesignationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DesignationDto>>> Designations(CancellationToken ct) =>
        Ok(await _organization.GetDesignationsAsync(ct));

    [HttpPost("designations")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(DesignationDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<DesignationDto>> CreateDesignation(
        [FromBody] SaveDesignationRequest request,
        CancellationToken ct)
    {
        var created = await _organization.CreateDesignationAsync(request, ct);
        return CreatedAtAction(nameof(Designations), created);
    }

    [HttpDelete("designations/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteDesignation(Guid id, CancellationToken ct)
    {
        await _organization.DeleteDesignationAsync(id, ct);
        return NoContent();
    }

    [HttpPut("designations/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(DesignationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DesignationDto>> UpdateDesignation(
        Guid id,
        [FromBody] SaveDesignationRequest request,
        CancellationToken ct) =>
        Ok(await _organization.UpdateDesignationAsync(id, request, ct));

    // ── Branches ──
    [HttpGet("branches")]
    [ProducesResponseType(typeof(IReadOnlyList<BranchDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BranchDto>>> Branches(CancellationToken ct) =>
        Ok(await _organization.GetBranchesAsync(ct));

    [HttpPost("branches")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(BranchDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<BranchDto>> CreateBranch(
        [FromBody] SaveBranchRequest request,
        CancellationToken ct)
    {
        var created = await _organization.CreateBranchAsync(request, ct);
        return CreatedAtAction(nameof(Branches), created);
    }

    [HttpPut("branches/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(BranchDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<BranchDto>> UpdateBranch(
        Guid id,
        [FromBody] SaveBranchRequest request,
        CancellationToken ct) =>
        Ok(await _organization.UpdateBranchAsync(id, request, ct));

    [HttpDelete("branches/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteBranch(Guid id, CancellationToken ct)
    {
        await _organization.DeleteBranchAsync(id, ct);
        return NoContent();
    }

    // ── Holidays ──
    [HttpGet("holidays")]
    [ProducesResponseType(typeof(IReadOnlyList<HolidayDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<HolidayDto>>> Holidays(CancellationToken ct) =>
        Ok(await _organization.GetHolidaysAsync(ct));

    [HttpPost("holidays")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(HolidayDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<HolidayDto>> CreateHoliday(
        [FromBody] SaveHolidayRequest request,
        CancellationToken ct)
    {
        var created = await _organization.CreateHolidayAsync(request, ct);
        return CreatedAtAction(nameof(Holidays), created);
    }

    [HttpPut("holidays/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(HolidayDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<HolidayDto>> UpdateHoliday(
        Guid id,
        [FromBody] SaveHolidayRequest request,
        CancellationToken ct) =>
        Ok(await _organization.UpdateHolidayAsync(id, request, ct));

    [HttpDelete("holidays/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteHoliday(Guid id, CancellationToken ct)
    {
        await _organization.DeleteHolidayAsync(id, ct);
        return NoContent();
    }

    // ── Shifts ──
    [HttpGet("shifts")]
    [ProducesResponseType(typeof(IReadOnlyList<ShiftDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ShiftDto>>> Shifts(CancellationToken ct) =>
        Ok(await _organization.GetShiftsAsync(ct));

    [HttpPost("shifts")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<ShiftDto>> CreateShift(
        [FromBody] SaveShiftRequest request,
        CancellationToken ct)
    {
        var created = await _organization.CreateShiftAsync(request, ct);
        return CreatedAtAction(nameof(Shifts), created);
    }

    [HttpPut("shifts/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(ShiftDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ShiftDto>> UpdateShift(
        Guid id,
        [FromBody] SaveShiftRequest request,
        CancellationToken ct) =>
        Ok(await _organization.UpdateShiftAsync(id, request, ct));

    [HttpDelete("shifts/{id:guid}")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteShift(Guid id, CancellationToken ct)
    {
        await _organization.DeleteShiftAsync(id, ct);
        return NoContent();
    }
}
