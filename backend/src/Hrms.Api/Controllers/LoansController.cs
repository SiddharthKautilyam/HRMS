using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/loans")]
[Authorize]
[Tags("Loans")]
public sealed class LoansController : ControllerBase
{
    private readonly ILoanService _loans;

    public LoansController(ILoanService loans)
    {
        _loans = loans;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LoanDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LoanDto>>> List(
        [FromQuery] LoanStatus? status,
        CancellationToken ct) =>
        Ok(await _loans.ListAsync(status, ct));

    [HttpGet("summary")]
    [ProducesResponseType(typeof(LoanSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LoanSummaryDto>> Summary(CancellationToken ct) =>
        Ok(await _loans.GetSummaryAsync(ct));

    [HttpGet("employee/{employeeId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<LoanDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LoanDto>>> ForEmployee(Guid employeeId, CancellationToken ct) =>
        Ok(await _loans.ListForEmployeeAsync(employeeId, ct));

    [HttpPost]
    [ProducesResponseType(typeof(LoanDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<LoanDto>> Create([FromBody] CreateLoanRequest request, CancellationToken ct)
    {
        var created = await _loans.CreateAsync(request, ct);
        return CreatedAtAction(nameof(ForEmployee), new { employeeId = created.EmployeeId }, created);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(LoanDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LoanDto>> Approve(Guid id, CancellationToken ct) =>
        Ok(await _loans.DecideAsync(id, true, ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "HrAdmin")]
    [ProducesResponseType(typeof(LoanDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<LoanDto>> Reject(Guid id, CancellationToken ct) =>
        Ok(await _loans.DecideAsync(id, false, ct));
}
