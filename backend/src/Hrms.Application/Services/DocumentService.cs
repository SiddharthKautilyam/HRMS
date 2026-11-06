using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class DocumentService : IDocumentService
{
    private readonly IUnitOfWork _uow;

    public DocumentService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<DocumentSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        // Count in SQL (previously every document row was loaded to tally four numbers).
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff = today.AddDays(30);

        var counts = await _uow.Documents.FirstOrDefaultAsync(
            _uow.Documents.Query().GroupBy(_ => 1).Select(g => new
            {
                Total = g.Count(),
                Expired = g.Sum(d => d.ExpiryDate < today ? 1 : 0),
                Expiring = g.Sum(d => d.ExpiryDate >= today && d.ExpiryDate <= cutoff ? 1 : 0),
            }),
            ct);

        var total = counts?.Total ?? 0;
        var expired = counts?.Expired ?? 0;
        var expiring = counts?.Expiring ?? 0;

        return new DocumentSummaryDto(total, expiring, expired, total - expired - expiring);
    }

    public async Task<IReadOnlyList<DocumentDto>> ListAsync(
        Guid? employeeId,
        string? search,
        DocumentType? type,
        DocumentStatus? status,
        CancellationToken ct = default)
    {
        var documents = await _uow.Documents.SearchAsync(employeeId, search, type, status, ct);
        return documents
            .Where(d => !d.IsCompanyDocument)
            .Select(ToDto)
            .ToList();
    }

    public async Task<IReadOnlyList<DocumentDto>> ListCompanyDocumentsAsync(CancellationToken ct = default)
    {
        var documents = await _uow.Documents.ListCompanyDocumentsAsync(ct);
        return documents.Select(ToDto).ToList();
    }

    public async Task<DocumentDto> CreateAsync(CreateDocumentRequest request, CancellationToken ct = default)
    {
        var document = new EmployeeDocument
        {
            EmployeeId = request.EmployeeId ?? Guid.Empty,
            Name = request.Name.Trim(),
            Type = request.Type,
            DocumentNumber = request.DocumentNumber,
            IssuedBy = request.IssuedBy,
            IssueDate = request.IssueDate,
            ExpiryDate = request.ExpiryDate,
            Notes = request.Notes,
            FileUrl = request.FileUrl,
            FileSize = request.FileSize,
            IsCompanyDocument = request.IsCompanyDocument,
            Status = ResolveStatus(request.ExpiryDate),
        };

        if (!request.IsCompanyDocument)
        {
            if (request.EmployeeId is null)
            {
                throw new ValidationException("An employee is required for personal documents.");
            }

            _ = await _uow.Employees.GetByIdAsync(request.EmployeeId.Value, ct)
                ?? throw NotFoundException.For("Employee", request.EmployeeId.Value);

            document.EmployeeId = request.EmployeeId.Value;
        }

        await _uow.Documents.AddAsync(document, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await _uow.Documents.GetWithEmployeeAsync(document.Id, ct)
                     ?? throw NotFoundException.For("Document", document.Id);
        return ToDto(loaded);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var document = await _uow.Documents.GetByIdAsync(id, ct)
                       ?? throw NotFoundException.For("Document", id);

        _uow.Documents.Remove(document);
        await _uow.SaveChangesAsync(ct);
    }

    private static DocumentStatus ResolveStatus(DateOnly? expiry)
    {
        if (expiry is not { } date) return DocumentStatus.Valid;

        var days = date.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber;
        return days switch
        {
            < 0 => DocumentStatus.Expired,
            <= 30 => DocumentStatus.Critical,
            <= 90 => DocumentStatus.Warning,
            _ => DocumentStatus.Valid,
        };
    }

    private static DocumentDto ToDto(EmployeeDocument d)
    {
        var name = d.Employee is null ? null : $"{d.Employee.FirstName} {d.Employee.LastName}".Trim();
        var status = ResolveStatus(d.ExpiryDate);
        var daysLeft = d.ExpiryDate is { } expiry
            ? expiry.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber
            : (int?)null;

        return new DocumentDto(
            d.Id,
            d.EmployeeId == Guid.Empty ? null : d.EmployeeId,
            name,
            d.Name,
            d.Type.ToString(),
            d.DocumentNumber,
            d.IssuedBy,
            d.IssueDate,
            d.ExpiryDate,
            daysLeft,
            status.ToString(),
            d.Notes,
            d.FileSize,
            d.FileUrl,
            d.IsCompanyDocument);
    }
}
