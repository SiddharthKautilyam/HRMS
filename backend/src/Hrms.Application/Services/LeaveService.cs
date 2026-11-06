using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class LeaveService : ILeaveService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public LeaveService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(CancellationToken ct = default)
    {
        var types = await _uow.LeaveTypes.ToListAsync(
            _uow.LeaveTypes.Query().Where(t => t.IsActive).OrderBy(t => t.Name),
            ct);

        return types.Select(ToTypeDto).ToList();
    }

    public async Task<LeaveTypeDto> CreateLeaveTypeAsync(SaveLeaveTypeRequest request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (await _uow.LeaveTypes.GetByNameAsync(name, ct) is not null)
        {
            throw new ConflictException($"A leave type named '{name}' already exists.");
        }

        var type = new LeaveType
        {
            Name = name,
            MaxDaysPerYear = request.MaxDaysPerYear,
            IsPaid = request.IsPaid,
            Color = request.Color,
            Description = request.Description,
        };

        await _uow.LeaveTypes.AddAsync(type, ct);
        await _uow.SaveChangesAsync(ct);
        return ToTypeDto(type);
    }

    public async Task<LeaveTypeDto> UpdateLeaveTypeAsync(Guid id, SaveLeaveTypeRequest request, CancellationToken ct = default)
    {
        var type = await _uow.LeaveTypes.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Leave type", id);

        type.Name = request.Name.Trim();
        type.MaxDaysPerYear = request.MaxDaysPerYear;
        type.IsPaid = request.IsPaid;
        type.Color = request.Color;
        type.Description = request.Description;

        _uow.LeaveTypes.Update(type);
        await _uow.SaveChangesAsync(ct);
        return ToTypeDto(type);
    }

    public async Task DeleteLeaveTypeAsync(Guid id, CancellationToken ct = default)
    {
        var type = await _uow.LeaveTypes.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Leave type", id);

        type.IsActive = false;
        _uow.LeaveTypes.Update(type);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<LeaveRequestDto>> SearchAsync(
        string? search,
        LeaveStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (safePage, safeSize) = Paging.Normalise(page, pageSize);
        var (items, total) = await _uow.LeaveRequests.SearchAsync(search, status, safePage, safeSize, ct);
        return new PagedResult<LeaveRequestDto>(items.Select(ToRequestDto).ToList(), total, safePage, safeSize);
    }

    public async Task<IReadOnlyList<LeaveRequestDto>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default)
    {
        var items = await _uow.LeaveRequests.ListForEmployeeAsync(employeeId, ct);
        return items.Select(ToRequestDto).ToList();
    }

    public async Task<LeaveRequestDto> CreateAsync(CreateLeaveRequest request, CancellationToken ct = default)
    {
        if (request.ToDate < request.FromDate)
        {
            throw new ValidationException("The end date must be on or after the start date.");
        }

        var employeeId = await ResolveEmployeeIdAsync(request.EmployeeId, ct);
        _ = await _uow.Employees.GetByIdAsync(employeeId, ct)
            ?? throw NotFoundException.For("Employee", employeeId);

        var type = await _uow.LeaveTypes.GetByIdAsync(request.LeaveTypeId, ct)
                   ?? throw NotFoundException.For("Leave type", request.LeaveTypeId);

        var leave = new LeaveRequest
        {
            EmployeeId = employeeId,
            LeaveTypeId = type.Id,
            FromDate = request.FromDate,
            ToDate = request.ToDate,
            Days = request.ToDate.DayNumber - request.FromDate.DayNumber + 1,
            Reason = request.Reason.Trim(),
            Status = LeaveStatus.Pending,
            SubmittedAtUtc = DateTime.UtcNow,
        };

        await _uow.LeaveRequests.AddAsync(leave, ct);
        await _uow.SaveChangesAsync(ct);

        return await LoadDtoAsync(leave.Id, ct);
    }

    public async Task<LeaveRequestDto> DecideAsync(Guid id, bool approved, LeaveDecisionRequest? request, CancellationToken ct = default)
    {
        var leave = await _uow.LeaveRequests.GetWithDetailsAsync(id, ct)
                    ?? throw NotFoundException.For("Leave request", id);

        if (leave.Status != LeaveStatus.Pending)
        {
            throw new ConflictException("This leave request has already been decided.");
        }

        leave.Status = approved ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.DecidedAtUtc = DateTime.UtcNow;
        leave.DecidedByUserId = _currentUser.UserId;
        leave.DecisionNote = request?.Note;

        _uow.LeaveRequests.Update(leave);
        await _uow.SaveChangesAsync(ct);
        return ToRequestDto(leave);
    }

    public async Task<IReadOnlyList<LeaveBalanceDto>> GetBalancesAsync(Guid employeeId, CancellationToken ct = default)
    {
        var types = await _uow.LeaveTypes.ToListAsync(
            _uow.LeaveTypes.Query().Where(t => t.IsActive).OrderBy(t => t.Name),
            ct);

        var requests = await _uow.LeaveRequests.ListForEmployeeAsync(employeeId, ct);
        var year = DateTime.UtcNow.Year;

        return types.Select(type =>
        {
            var used = requests
                .Where(r => r.LeaveTypeId == type.Id && r.Status == LeaveStatus.Approved && r.FromDate.Year == year)
                .Sum(r => r.Days);

            return new LeaveBalanceDto(type.Name, Math.Max(0, type.MaxDaysPerYear - used), type.MaxDaysPerYear, used, type.Color);
        }).ToList();
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

    private async Task<LeaveRequestDto> LoadDtoAsync(Guid id, CancellationToken ct)
    {
        var leave = await _uow.LeaveRequests.GetWithDetailsAsync(id, ct)
                    ?? throw NotFoundException.For("Leave request", id);
        return ToRequestDto(leave);
    }

    private static LeaveTypeDto ToTypeDto(LeaveType t) =>
        new(t.Id, t.Name, t.MaxDaysPerYear, t.IsPaid, t.Color, t.Description);

    public async Task<LeaveSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        // Count in SQL instead of materialising every leave request.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var requests = _uow.LeaveRequests.Query();

        var counts = await _uow.LeaveRequests.FirstOrDefaultAsync(
            requests.GroupBy(_ => 1).Select(g => new
            {
                Total = g.Count(),
                Pending = g.Sum(r => r.Status == LeaveStatus.Pending ? 1 : 0),
                Approved = g.Sum(r => r.Status == LeaveStatus.Approved ? 1 : 0),
                Rejected = g.Sum(r => r.Status == LeaveStatus.Rejected ? 1 : 0),
                OnLeaveToday = g.Sum(r => r.Status == LeaveStatus.Approved && r.FromDate <= today && r.ToDate >= today ? 1 : 0),
            }),
            ct);

        return new LeaveSummaryDto(
            counts?.Total ?? 0,
            counts?.Pending ?? 0,
            counts?.Approved ?? 0,
            counts?.Rejected ?? 0,
            counts?.OnLeaveToday ?? 0);
    }

    private static LeaveRequestDto ToRequestDto(LeaveRequest r)
    {
        var name = r.Employee is null ? "—" : $"{r.Employee.FirstName} {r.Employee.LastName}".Trim();
        return new LeaveRequestDto(
            r.Id,
            r.EmployeeId,
            name,
            Formatting.Initials(name),
            r.LeaveType?.Name ?? "—",
            r.FromDate,
            r.ToDate,
            r.Days,
            r.Reason,
            r.Status.ToString(),
            r.SubmittedAtUtc,
            Formatting.Relative(r.SubmittedAtUtc));
    }
}
