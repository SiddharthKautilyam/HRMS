using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
[Tags("Documents")]
public sealed class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documents;

    public DocumentsController(IDocumentService documents)
    {
        _documents = documents;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DocumentDto>>> List(
        [FromQuery] Guid? employeeId,
        [FromQuery] string? search,
        [FromQuery] DocumentType? type,
        [FromQuery] DocumentStatus? status,
        CancellationToken ct) =>
        Ok(await _documents.ListAsync(employeeId, search, type, status, ct));

    [HttpGet("company")]
    [ProducesResponseType(typeof(IReadOnlyList<DocumentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DocumentDto>>> CompanyDocuments(CancellationToken ct) =>
        Ok(await _documents.ListCompanyDocumentsAsync(ct));

    [HttpGet("summary")]
    [ProducesResponseType(typeof(DocumentSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DocumentSummaryDto>> Summary(CancellationToken ct) =>
        Ok(await _documents.GetSummaryAsync(ct));

    [HttpPost]
    [ProducesResponseType(typeof(DocumentDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<DocumentDto>> Create(
        [FromBody] CreateDocumentRequest request,
        CancellationToken ct)
    {
        var created = await _documents.CreateAsync(request, ct);
        return CreatedAtAction(nameof(List), created);
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _documents.DeleteAsync(id, ct);
        return NoContent();
    }
}
