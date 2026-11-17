using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/payroll")]
[Authorize]
[Tags("Payroll")]
public sealed class PayrollController : ControllerBase
{
    private readonly IPayrollService _payroll;
    private readonly IEmployeeService _employees;

    public PayrollController(IPayrollService payroll, IEmployeeService employees)
    {
        _payroll = payroll;
        _employees = employees;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(PayrollSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PayrollSummaryDto>> Summary(CancellationToken ct) =>
        Ok(await _payroll.GetSummaryAsync(ct));

    [HttpGet("runs")]
    [ProducesResponseType(typeof(IReadOnlyList<PayrollRunDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PayrollRunDto>>> Runs(CancellationToken ct) =>
        Ok(await _payroll.GetRunsAsync(ct));

    [HttpGet("runs/{runId:guid}/payslips")]
    [ProducesResponseType(typeof(IReadOnlyList<PayslipDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PayslipDto>>> RunPayslips(Guid runId, CancellationToken ct) =>
        Ok(await _payroll.GetPayslipsForRunAsync(runId, ct));

    [HttpGet("employees/{employeeId:guid}/payslips")]
    [ProducesResponseType(typeof(IReadOnlyList<PayslipDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PayslipDto>>> EmployeePayslips(Guid employeeId, CancellationToken ct) =>
        Ok(await _payroll.GetPayslipsForEmployeeAsync(employeeId, ct));

    /// <summary>Payslips for the signed-in employee (or the first employee when unlinked).</summary>
    [HttpGet("me/payslips")]
    [ProducesResponseType(typeof(IReadOnlyList<PayslipDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PayslipDto>>> MyPayslips(
        [FromQuery] Guid? employeeId,
        CancellationToken ct)
    {
        var id = await _employees.ResolveEmployeeIdAsync(employeeId, ct);
        return Ok(await _payroll.GetPayslipsForEmployeeAsync(id, ct));
    }

    /// <summary>Downloads a payslip PDF for an individual payslip ID.</summary>
    [HttpGet("payslips/{id:guid}/download")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadPayslip(Guid id, CancellationToken ct)
    {
        var (content, fileName) = await _payroll.DownloadPayslipPdfAsync(payslipId: id, ct: ct);
        return File(content, "application/pdf", fileName);
    }

    /// <summary>Downloads a payslip PDF by employee (code or GUID) and pay period.</summary>
    [HttpGet("download-slip")]
    [ProducesResponseType(typeof(FileResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadSlip(
        [FromQuery] Guid? payslipId,
        [FromQuery] Guid? employeeId,
        [FromQuery] string? employeeCode,
        [FromQuery] int? month,
        [FromQuery] int? year,
        CancellationToken ct)
    {
        var (content, fileName) = await _payroll.DownloadPayslipPdfAsync(
            payslipId: payslipId,
            employeeId: employeeId,
            employeeCode: employeeCode,
            month: month,
            year: year,
            ct: ct);

        return File(content, "application/pdf", fileName);
    }

    /// <summary>Processes payroll for a month. Fails with 409 if that period already exists.</summary>
    [HttpPost("run")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(PayrollRunDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PayrollRunDto>> Run(
        [FromBody] RunPayrollRequest request,
        CancellationToken ct)
    {
        var run = await _payroll.RunPayrollAsync(request, ct);
        return CreatedAtAction(nameof(Runs), run);
    }
}
