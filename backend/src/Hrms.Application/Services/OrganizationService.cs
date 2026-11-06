using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;

namespace Hrms.Application.Services;

public sealed class OrganizationService : IOrganizationService
{
    private readonly IUnitOfWork _uow;

    public OrganizationService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    // ── Departments ──
    public async Task<IReadOnlyList<DepartmentDto>> GetDepartmentsAsync(CancellationToken ct = default)
    {
        return await _uow.Departments.ToListAsync(
            _uow.Departments.Query()
                .OrderBy(d => d.Name)
                .Select(d => new DepartmentDto(d.Id, d.Name, d.Code, d.Description, d.IsActive, d.Employees.Count)),
            ct);
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(SaveDepartmentRequest request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (await _uow.Departments.AnyAsync(_uow.Departments.Query().Where(d => d.Name == name), ct))
        {
            throw new ConflictException($"A department named '{name}' already exists.");
        }

        var department = new Department
        {
            Name = name,
            Code = request.Code.Trim().ToUpperInvariant(),
            Description = request.Description,
            IsActive = request.IsActive,
        };

        await _uow.Departments.AddAsync(department, ct);
        await _uow.SaveChangesAsync(ct);
        return new DepartmentDto(department.Id, department.Name, department.Code, department.Description, department.IsActive, 0);
    }

    public async Task<DepartmentDto> UpdateDepartmentAsync(Guid id, SaveDepartmentRequest request, CancellationToken ct = default)
    {
        var department = await _uow.Departments.GetByIdAsync(id, ct)
                         ?? throw NotFoundException.For("Department", id);

        department.Name = request.Name.Trim();
        department.Code = request.Code.Trim().ToUpperInvariant();
        department.Description = request.Description;
        department.IsActive = request.IsActive;

        _uow.Departments.Update(department);
        await _uow.SaveChangesAsync(ct);

        var count = await _uow.Employees.CountQueryAsync(
            _uow.Employees.Query().Where(e => e.DepartmentId == id),
            ct);

        return new DepartmentDto(department.Id, department.Name, department.Code, department.Description, department.IsActive, count);
    }

    public async Task DeleteDepartmentAsync(Guid id, CancellationToken ct = default)
    {
        var department = await _uow.Departments.GetByIdAsync(id, ct)
                         ?? throw NotFoundException.For("Department", id);

        if (await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.DepartmentId == id), ct))
        {
            throw new ConflictException("This department still has employees assigned to it.");
        }

        _uow.Departments.Remove(department);
        await _uow.SaveChangesAsync(ct);
    }

    // ── Designations ──
    public async Task<IReadOnlyList<DesignationDto>> GetDesignationsAsync(CancellationToken ct = default)
    {
        return await _uow.Designations.ToListAsync(
            _uow.Designations.Query()
                .OrderBy(d => d.Name)
                .Select(d => new DesignationDto(d.Id, d.Name, d.Grade, d.DepartmentId, d.Department != null ? d.Department.Name : null, d.Description)),
            ct);
    }

    public async Task<DesignationDto> CreateDesignationAsync(SaveDesignationRequest request, CancellationToken ct = default)
    {
        var designation = new Designation
        {
            Name = request.Name.Trim(),
            Grade = request.Grade.Trim(),
            DepartmentId = request.DepartmentId,
            Description = request.Description,
        };

        await _uow.Designations.AddAsync(designation, ct);
        await _uow.SaveChangesAsync(ct);
        return new DesignationDto(designation.Id, designation.Name, designation.Grade, designation.DepartmentId, null, designation.Description);
    }

    public async Task<DesignationDto> UpdateDesignationAsync(Guid id, SaveDesignationRequest request, CancellationToken ct = default)
    {
        var designation = await _uow.Designations.GetByIdAsync(id, ct)
                          ?? throw NotFoundException.For("Designation", id);

        designation.Name = request.Name.Trim();
        designation.Grade = request.Grade.Trim();
        designation.DepartmentId = request.DepartmentId;
        designation.Description = request.Description;

        _uow.Designations.Update(designation);
        await _uow.SaveChangesAsync(ct);

        string? departmentName = null;
        if (designation.DepartmentId.HasValue)
        {
            var dept = await _uow.Departments.GetByIdAsync(designation.DepartmentId.Value, ct);
            departmentName = dept?.Name;
        }

        return new DesignationDto(designation.Id, designation.Name, designation.Grade, designation.DepartmentId, departmentName, designation.Description);
    }

    public async Task DeleteDesignationAsync(Guid id, CancellationToken ct = default)
    {
        var designation = await _uow.Designations.GetByIdAsync(id, ct)
                          ?? throw NotFoundException.For("Designation", id);

        _uow.Designations.Remove(designation);
        await _uow.SaveChangesAsync(ct);
    }

    // ── Branches ──
    public async Task<IReadOnlyList<BranchDto>> GetBranchesAsync(CancellationToken ct = default)
    {
        return await _uow.Branches.ToListAsync(
            _uow.Branches.Query()
                .OrderBy(b => b.Name)
                .Select(b => new BranchDto(b.Id, b.Name, b.Location, b.ManagerName, b.EmployeeCount, b.IsActive)),
            ct);
    }

    public async Task<BranchDto> CreateBranchAsync(SaveBranchRequest request, CancellationToken ct = default)
    {
        var branch = new Branch
        {
            Name = request.Name.Trim(),
            Location = request.Location.Trim(),
            ManagerName = request.ManagerName.Trim(),
            EmployeeCount = request.EmployeeCount,
        };

        await _uow.Branches.AddAsync(branch, ct);
        await _uow.SaveChangesAsync(ct);
        return new BranchDto(branch.Id, branch.Name, branch.Location, branch.ManagerName, branch.EmployeeCount, branch.IsActive);
    }

    public async Task<BranchDto> UpdateBranchAsync(Guid id, SaveBranchRequest request, CancellationToken ct = default)
    {
        var branch = await _uow.Branches.GetByIdAsync(id, ct)
                     ?? throw NotFoundException.For("Branch", id);

        branch.Name = request.Name.Trim();
        branch.Location = request.Location.Trim();
        branch.ManagerName = request.ManagerName.Trim();
        branch.EmployeeCount = request.EmployeeCount;

        _uow.Branches.Update(branch);
        await _uow.SaveChangesAsync(ct);
        return new BranchDto(branch.Id, branch.Name, branch.Location, branch.ManagerName, branch.EmployeeCount, branch.IsActive);
    }

    public async Task DeleteBranchAsync(Guid id, CancellationToken ct = default)
    {
        var branch = await _uow.Branches.GetByIdAsync(id, ct)
                     ?? throw NotFoundException.For("Branch", id);

        _uow.Branches.Remove(branch);
        await _uow.SaveChangesAsync(ct);
    }

    // ── Holidays ──
    public async Task<IReadOnlyList<HolidayDto>> GetHolidaysAsync(CancellationToken ct = default)
    {
        return await _uow.Holidays.ToListAsync(
            _uow.Holidays.Query()
                .OrderBy(h => h.Date)
                .Select(h => new HolidayDto(h.Id, h.Name, h.Date, h.Date.DayOfWeek.ToString(), h.Type.ToString())),
            ct);
    }

    public async Task<HolidayDto> CreateHolidayAsync(SaveHolidayRequest request, CancellationToken ct = default)
    {
        var holiday = new Holiday
        {
            Name = request.Name.Trim(),
            Date = request.Date,
            Type = request.Type,
        };

        await _uow.Holidays.AddAsync(holiday, ct);
        await _uow.SaveChangesAsync(ct);
        return new HolidayDto(holiday.Id, holiday.Name, holiday.Date, holiday.Date.DayOfWeek.ToString(), holiday.Type.ToString());
    }

    public async Task<HolidayDto> UpdateHolidayAsync(Guid id, SaveHolidayRequest request, CancellationToken ct = default)
    {
        var holiday = await _uow.Holidays.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Holiday", id);

        holiday.Name = request.Name.Trim();
        holiday.Date = request.Date;
        holiday.Type = request.Type;

        _uow.Holidays.Update(holiday);
        await _uow.SaveChangesAsync(ct);
        return new HolidayDto(holiday.Id, holiday.Name, holiday.Date, holiday.Date.DayOfWeek.ToString(), holiday.Type.ToString());
    }

    public async Task DeleteHolidayAsync(Guid id, CancellationToken ct = default)
    {
        var holiday = await _uow.Holidays.GetByIdAsync(id, ct)
                      ?? throw NotFoundException.For("Holiday", id);

        _uow.Holidays.Remove(holiday);
        await _uow.SaveChangesAsync(ct);
    }

    // ── Shifts ──
    public async Task<IReadOnlyList<ShiftDto>> GetShiftsAsync(CancellationToken ct = default)
    {
        return await _uow.Shifts.ToListAsync(
            _uow.Shifts.Query()
                .OrderBy(s => s.Name)
                .Select(s => new ShiftDto(s.Id, s.Name, s.StartTime.ToString(), s.EndTime.ToString(), s.DailyHours, s.WorkingDays)),
            ct);
    }

    public async Task<ShiftDto> CreateShiftAsync(SaveShiftRequest request, CancellationToken ct = default)
    {
        if (request.EndTime <= request.StartTime)
        {
            throw new ValidationException("The shift end time must be after the start time.");
        }

        var shift = new Shift
        {
            Name = request.Name.Trim(),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            DailyHours = request.DailyHours,
            WorkingDays = request.WorkingDays.Trim(),
        };

        await _uow.Shifts.AddAsync(shift, ct);
        await _uow.SaveChangesAsync(ct);
        return new ShiftDto(shift.Id, shift.Name, shift.StartTime.ToString(), shift.EndTime.ToString(), shift.DailyHours, shift.WorkingDays);
    }

    public async Task<ShiftDto> UpdateShiftAsync(Guid id, SaveShiftRequest request, CancellationToken ct = default)
    {
        if (request.EndTime <= request.StartTime)
        {
            throw new ValidationException("The shift end time must be after the start time.");
        }

        var shift = await _uow.Shifts.GetByIdAsync(id, ct)
                    ?? throw NotFoundException.For("Shift", id);

        shift.Name = request.Name.Trim();
        shift.StartTime = request.StartTime;
        shift.EndTime = request.EndTime;
        shift.DailyHours = request.DailyHours;
        shift.WorkingDays = request.WorkingDays.Trim();

        _uow.Shifts.Update(shift);
        await _uow.SaveChangesAsync(ct);
        return new ShiftDto(shift.Id, shift.Name, shift.StartTime.ToString(), shift.EndTime.ToString(), shift.DailyHours, shift.WorkingDays);
    }

    public async Task DeleteShiftAsync(Guid id, CancellationToken ct = default)
    {
        var shift = await _uow.Shifts.GetByIdAsync(id, ct)
                    ?? throw NotFoundException.For("Shift", id);

        _uow.Shifts.Remove(shift);
        await _uow.SaveChangesAsync(ct);
    }
}
