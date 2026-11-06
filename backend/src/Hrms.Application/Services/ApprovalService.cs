using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class ApprovalService : IApprovalService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public ApprovalService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<ApprovalSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var pending = await _uow.Approvals.ListPendingAsync(ct);
        var regularizations = await _uow.Regularizations.ToListAsync(
            _uow.Regularizations.Query().Where(r => r.Status == ApprovalStatus.Pending),
            ct);

        return new ApprovalSummaryDto(
            pending.Count + regularizations.Count,
            pending.Count(a => a.Type == ApprovalType.Leave),
            pending.Count(a => a.Type == ApprovalType.Overtime),
            regularizations.Count);
    }

    public async Task<IReadOnlyList<ApprovalDto>> ListAsync(
        ApprovalStatus? status,
        ApprovalType? type,
        CancellationToken ct = default)
    {
        var items = await _uow.Approvals.ListWithEmployeeAsync(status, type, ct);
        return items.Select(ToDto).ToList();
    }

    public async Task<ApprovalDto> CreateAsync(CreateApprovalRequest request, CancellationToken ct = default)
    {
        var employeeId = await ResolveEmployeeIdAsync(request.EmployeeId, ct);
        _ = await _uow.Employees.GetByIdAsync(employeeId, ct)
            ?? throw NotFoundException.For("Employee", employeeId);

        var approval = new ApprovalRequest
        {
            EmployeeId = employeeId,
            Type = request.Type,
            Title = request.Title.Trim(),
            Details = request.Details.Trim(),
            Priority = request.Priority,
            Status = ApprovalStatus.Pending,
            SubmittedAtUtc = DateTime.UtcNow,
        };

        await _uow.Approvals.AddAsync(approval, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await _uow.Approvals.GetWithEmployeeAsync(approval.Id, ct)
                     ?? throw NotFoundException.For("Approval request", approval.Id);
        return ToDto(loaded);
    }

    public async Task<ApprovalDto> DecideAsync(
        Guid id,
        bool approved,
        ApprovalDecisionRequest? request,
        CancellationToken ct = default)
    {
        var approval = await _uow.Approvals.GetWithEmployeeAsync(id, ct)
                       ?? throw NotFoundException.For("Approval request", id);

        if (approval.Status != ApprovalStatus.Pending)
        {
            throw new ConflictException("This approval has already been decided.");
        }

        approval.Status = approved ? ApprovalStatus.Approved : ApprovalStatus.Rejected;
        approval.DecidedAtUtc = DateTime.UtcNow;
        approval.DecidedByUserId = _currentUser.UserId;
        approval.DecisionNote = request?.Note;

        _uow.Approvals.Update(approval);
        await _uow.SaveChangesAsync(ct);
        return ToDto(approval);
    }

    public async Task<int> ApproveAllAsync(CancellationToken ct = default)
    {
        var pending = await _uow.Approvals.ListPendingAsync(ct);

        foreach (var approval in pending)
        {
            approval.Status = ApprovalStatus.Approved;
            approval.DecidedAtUtc = DateTime.UtcNow;
            approval.DecidedByUserId = _currentUser.UserId;
            _uow.Approvals.Update(approval);
        }

        if (pending.Count > 0)
        {
            await _uow.SaveChangesAsync(ct);
        }

        return pending.Count;
    }

    private async Task<Guid> ResolveEmployeeIdAsync(Guid? explicitId, CancellationToken ct)
    {
        if (explicitId is { } id && id != Guid.Empty) return id;
        if (_currentUser.EmployeeId is { } own) return own;

        var first = await _uow.Employees.FirstOrDefaultAsync(
            _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id),
            ct);

        return first ?? throw new NotFoundException("No employees exist yet.");
    }

    private static ApprovalDto ToDto(ApprovalRequest a)
    {
        var name = a.Employee is null ? "—" : $"{a.Employee.FirstName} {a.Employee.LastName}".Trim();
        return new ApprovalDto(
            a.Id,
            a.EmployeeId,
            name,
            Formatting.Initials(name),
            a.Type.ToString(),
            a.Title,
            a.Details,
            a.SubmittedAtUtc,
            Formatting.Relative(a.SubmittedAtUtc),
            a.Priority.ToString(),
            a.Status.ToString());
    }
}
