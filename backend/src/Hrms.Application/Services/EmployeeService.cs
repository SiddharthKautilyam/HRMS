using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class EmployeeService : IEmployeeService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;
    private readonly IPasswordHasher _passwordHasher;

    public EmployeeService(IUnitOfWork uow, ICurrentUser currentUser, IPasswordHasher passwordHasher)
    {
        _uow = uow;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
    }

    public async Task<PagedResult<EmployeeListItemDto>> SearchAsync(EmployeeQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalise(query.Page, query.PageSize);
        var (items, total) = await _uow.Employees.SearchAsync(query.Search, query.DepartmentId, query.Status, page, pageSize, ct);
        return new PagedResult<EmployeeListItemDto>(items.Select(ToListDto).ToList(), total, page, pageSize);
    }

    public async Task<EmployeeDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetWithDetailsAsync(id, ct)
                       ?? throw NotFoundException.For("Employee", id);

        var linkedUser = await _uow.Users.FirstOrDefaultAsync(
            _uow.Users.Query().Where(u => u.EmployeeId == id || u.Email == employee.Email), ct);
        string? roleCode = null;
        string? roleName = null;
        if (linkedUser != null)
        {
            var role = await _uow.Roles.GetByIdAsync(linkedUser.RoleId, ct);
            roleCode = role?.Code.ToString();
            roleName = role?.Name;
        }

        return ToDetailDto(employee, roleCode, roleName);
    }

    public async Task<EmployeeDetailDto> CreateAsync(CreateEmployeeRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.Email == email), ct))
        {
            throw new ConflictException($"An employee with email '{email}' already exists.");
        }

        var department = await _uow.Departments.GetByIdAsync(request.DepartmentId, ct)
                         ?? throw NotFoundException.For("Department", request.DepartmentId);

        var existingCodes = await _uow.Employees.ToListAsync(
            _uow.Employees.Query().Select(e => e.EmployeeCode), ct);

        var nextNum = 1001;
        foreach (var c in existingCodes)
        {
            if (c.StartsWith("EMP-", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(c[4..], out var num) && num >= nextNum)
            {
                nextNum = num + 1;
            }
        }

        var employee = new Employee
        {
            EmployeeCode = $"EMP-{nextNum}",
            FirstName = request.FirstName.Trim(),
            MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim(),
            LastName = request.LastName.Trim(),
            Email = email,
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            DepartmentId = department.Id,
            DesignationId = request.DesignationId,
            BranchId = request.BranchId,
            ShiftId = request.ShiftId,
            ReportingManagerId = request.ReportingManagerId,
            JobTitle = request.JobTitle.Trim(),
            Grade = string.IsNullOrWhiteSpace(request.Grade) ? "L3" : request.Grade.Trim(),
            EmploymentType = request.EmploymentType,
            Status = EmploymentStatus.Active,
            JoinDate = request.JoinDate,
            BasicSalary = request.BasicSalary,
            HousingAllowance = request.HousingAllowance,
            TransportAllowance = request.TransportAllowance,
            MobileAllowance = request.MobileAllowance,
            OtherAllowances = request.OtherAllowances,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "USD" : request.Currency.Trim(),
            DateOfBirth = request.DateOfBirth,
            Gender = request.Gender ?? Gender.Female,
            MaritalStatus = request.MaritalStatus ?? MaritalStatus.Single,
            BloodGroup = string.IsNullOrWhiteSpace(request.BloodGroup) ? null : request.BloodGroup.Trim(),
            Nationality = string.IsNullOrWhiteSpace(request.Nationality) ? null : request.Nationality.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim(),
            State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim(),
            Country = string.IsNullOrWhiteSpace(request.Country) ? null : request.Country.Trim(),
            BankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim(),
            AccountName = string.IsNullOrWhiteSpace(request.AccountName) ? null : request.AccountName.Trim(),
            AccountNumber = string.IsNullOrWhiteSpace(request.AccountNumber) ? null : request.AccountNumber.Trim(),
            Iban = string.IsNullOrWhiteSpace(request.Iban) ? null : request.Iban.Trim(),
            PaymentMode = request.PaymentMode ?? PaymentMode.BankTransfer,
        };

        await _uow.Employees.AddAsync(employee, ct);
        await _uow.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var roles = await _uow.Roles.ListAsync(ct);
            var reqCode = request.RoleCode?.Trim() ?? string.Empty;
            var role = roles.FirstOrDefault(r => r.Code.Equals(reqCode, StringComparison.OrdinalIgnoreCase) || r.Name.Equals(reqCode, StringComparison.OrdinalIgnoreCase));

            if (role is null && (request.JobTitle.Contains("HR", StringComparison.OrdinalIgnoreCase) || department.Name.Contains("HR", StringComparison.OrdinalIgnoreCase)))
            {
                role = roles.FirstOrDefault(r => r.Code.Equals("HrManager", StringComparison.OrdinalIgnoreCase));
            }

            role ??= roles.FirstOrDefault(r => r.Code.Equals("Employee", StringComparison.OrdinalIgnoreCase)) ?? roles.First();

            var existingUser = await _uow.Users.GetByEmailAsync(email, ct);
            if (existingUser is not null)
            {
                existingUser.PasswordHash = _passwordHasher.Hash(request.Password);
                existingUser.EmployeeId = employee.Id;
                existingUser.RoleId = role.Id;
                existingUser.IsActive = true;
            }
            else
            {
                var firstInitial = request.FirstName.Trim().Length > 0 ? request.FirstName.Trim()[0] : 'E';
                var lastInitial = request.LastName.Trim().Length > 0 ? request.LastName.Trim()[0] : 'M';
                var initials = $"{firstInitial}{lastInitial}".Trim().ToUpperInvariant();

                var user = new User
                {
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    PasswordHash = _passwordHasher.Hash(request.Password),
                    FullName = $"{request.FirstName.Trim()} {request.LastName.Trim()}".Trim(),
                    Initials = string.IsNullOrWhiteSpace(initials) ? "EM" : initials,
                    RoleId = role.Id,
                    EmployeeId = employee.Id,
                    IsActive = true,
                };
                await _uow.Users.AddAsync(user, ct);
            }

            await _uow.SaveChangesAsync(ct);
        }

        return await GetAsync(employee.Id, ct);
    }

    public async Task<EmployeeDetailDto> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetWithDetailsAsync(id, ct)
                       ?? throw NotFoundException.For("Employee", id);

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.Email == email && e.Id != id), ct))
        {
            throw new ConflictException($"An employee with email '{email}' already exists.");
        }

        _ = await _uow.Departments.GetByIdAsync(request.DepartmentId, ct)
            ?? throw NotFoundException.For("Department", request.DepartmentId);

        employee.FirstName = request.FirstName.Trim();
        employee.MiddleName = string.IsNullOrWhiteSpace(request.MiddleName) ? null : request.MiddleName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.Email = email;
        employee.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        employee.DateOfBirth = request.DateOfBirth;
        if (request.Gender.HasValue) employee.Gender = request.Gender.Value;
        if (request.MaritalStatus.HasValue) employee.MaritalStatus = request.MaritalStatus.Value;
        employee.BloodGroup = string.IsNullOrWhiteSpace(request.BloodGroup) ? null : request.BloodGroup.Trim();
        employee.Nationality = string.IsNullOrWhiteSpace(request.Nationality) ? null : request.Nationality.Trim();
        employee.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        employee.City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim();
        employee.State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim();
        employee.Country = string.IsNullOrWhiteSpace(request.Country) ? null : request.Country.Trim();
        employee.DepartmentId = request.DepartmentId;
        employee.DesignationId = request.DesignationId;
        employee.BranchId = request.BranchId;
        employee.ReportingManagerId = request.ReportingManagerId;
        employee.JobTitle = request.JobTitle.Trim();
        employee.Grade = request.Grade;
        employee.EmploymentType = request.EmploymentType;
        employee.Status = request.Status;
        employee.JoinDate = request.JoinDate;
        employee.NoticePeriodDays = request.NoticePeriodDays;
        employee.BasicSalary = request.BasicSalary;
        employee.HousingAllowance = request.HousingAllowance;
        employee.TransportAllowance = request.TransportAllowance;
        employee.MobileAllowance = request.MobileAllowance;
        employee.OtherAllowances = request.OtherAllowances;
        employee.Currency = request.Currency;
        employee.BankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim();
        employee.AccountName = string.IsNullOrWhiteSpace(request.AccountName) ? null : request.AccountName.Trim();
        employee.AccountNumber = string.IsNullOrWhiteSpace(request.AccountNumber) ? null : request.AccountNumber.Trim();
        employee.Iban = string.IsNullOrWhiteSpace(request.Iban) ? null : request.Iban.Trim();
        employee.IfscCode = string.IsNullOrWhiteSpace(request.IfscCode) ? null : request.IfscCode.Trim();
        employee.SwiftCode = string.IsNullOrWhiteSpace(request.SwiftCode) ? null : request.SwiftCode.Trim();
        employee.PaymentMode = request.PaymentMode;
        employee.WpsId = string.IsNullOrWhiteSpace(request.WpsId) ? null : request.WpsId.Trim();
        employee.PassportNumber = string.IsNullOrWhiteSpace(request.PassportNumber) ? null : request.PassportNumber.Trim();
        employee.PassportExpiry = request.PassportExpiry;
        employee.VisaNumber = string.IsNullOrWhiteSpace(request.VisaNumber) ? null : request.VisaNumber.Trim();
        employee.VisaExpiry = request.VisaExpiry;
        employee.EmiratesId = string.IsNullOrWhiteSpace(request.EmiratesId) ? null : request.EmiratesId.Trim();
        if (!string.IsNullOrWhiteSpace(request.FacePhotoUrl))
        {
            employee.FacePhotoUrl = request.FacePhotoUrl.Trim();
        }

        var linkedUser = await _uow.Users.FirstOrDefaultAsync(
            _uow.Users.Query().Where(u => u.EmployeeId == employee.Id || u.Email == employee.Email), ct);
        if (linkedUser is not null)
        {
            linkedUser.FullName = $"{employee.FirstName} {employee.LastName}".Trim();
            var firstInitial = employee.FirstName.Length > 0 ? employee.FirstName[0] : 'E';
            var lastInitial = employee.LastName.Length > 0 ? employee.LastName[0] : 'M';
            linkedUser.Initials = $"{firstInitial}{lastInitial}".Trim().ToUpperInvariant();
            linkedUser.Email = email;
            linkedUser.NormalizedEmail = email.ToUpperInvariant();

            if (!string.IsNullOrWhiteSpace(request.RoleCode))
            {
                var target = request.RoleCode.Trim();
                var role = await _uow.Roles.FirstOrDefaultAsync(
                    _uow.Roles.Query().Where(r => r.Code.ToLower() == target.ToLower() || r.Name.ToLower() == target.ToLower()), ct);
                if (role is not null)
                {
                    linkedUser.RoleId = role.Id;
                }
            }
            else if (request.JobTitle.Contains("HR", StringComparison.OrdinalIgnoreCase))
            {
                var currentRole = await _uow.Roles.GetByIdAsync(linkedUser.RoleId, ct);
                if (currentRole != null && currentRole.Code.Equals("Employee", StringComparison.OrdinalIgnoreCase))
                {
                    var hrRole = await _uow.Roles.FirstOrDefaultAsync(
                        _uow.Roles.Query().Where(r => r.Code.ToLower() == "hrmanager" || r.Name.ToLower() == "hr manager"), ct);
                    if (hrRole is not null)
                    {
                        linkedUser.RoleId = hrRole.Id;
                    }
                }
            }

            _uow.Users.Update(linkedUser);
        }

        _uow.Employees.Update(employee);
        await _uow.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var employee = await _uow.Employees.GetByIdAsync(id, ct)
                       ?? throw NotFoundException.For("Employee", id);

        var subordinates = await _uow.Employees.ToListAsync(
            _uow.Employees.Query().Where(e => e.ReportingManagerId == id), ct);
        foreach (var sub in subordinates)
        {
            sub.ReportingManagerId = null;
            _uow.Employees.Update(sub);
        }

        var users = await _uow.Users.ToListAsync(
            _uow.Users.Query().Where(u => u.EmployeeId == id), ct);
        foreach (var u in users)
        {
            _uow.Users.Remove(u);
        }

        _uow.Employees.Remove(employee);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<DepartmentHeadcountDto>> DepartmentHeadcountAsync(CancellationToken ct = default)
    {
        var rows = await _uow.Departments.ToListAsync(
            _uow.Departments.Query()
                .OrderBy(d => d.Name)
                .Select(d => new DepartmentHeadcountDto(d.Name, d.Employees.Count)),
            ct);

        return rows;
    }

    public async Task<Guid> ResolveEmployeeIdAsync(Guid? explicitEmployeeId, CancellationToken ct = default)
    {
        if (explicitEmployeeId is { } id && id != Guid.Empty)
        {
            return id;
        }

        if (_currentUser.EmployeeId is { } own)
        {
            return own;
        }

        var first = await _uow.Employees.FirstOrDefaultAsync(
            _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id),
            ct);

        return first ?? throw new NotFoundException("No employees exist yet.");
    }

    private static EmployeeListItemDto ToListDto(Employee e) => new(
        e.Id,
        e.EmployeeCode,
        $"{e.FirstName} {e.LastName}".Trim(),
        e.Email,
        e.Department?.Name ?? "—",
        e.Grade,
        e.Status.ToString(),
        e.JoinDate,
        Gross(e),
        e.Currency,
        e.JobTitle,
        e.IsFaceEnrolled,
        e.FacePhotoUrl);

    private static EmployeeDetailDto ToDetailDto(Employee e, string? roleCode = null, string? roleName = null) => new(
        e.Id,
        e.EmployeeCode,
        e.FirstName,
        e.MiddleName,
        e.LastName,
        $"{e.FirstName} {e.LastName}".Trim(),
        e.Email,
        e.Phone,
        e.DateOfBirth,
        e.Gender.ToString(),
        e.MaritalStatus.ToString(),
        e.BloodGroup,
        e.Nationality,
        e.Address,
        e.City,
        e.State,
        e.Country,
        e.DepartmentId,
        e.Department?.Name ?? "—",
        e.DesignationId,
        e.Designation?.Name,
        e.BranchId,
        e.Branch?.Name,
        e.ReportingManagerId,
        e.ReportingManager is null ? null : $"{e.ReportingManager.FirstName} {e.ReportingManager.LastName}".Trim(),
        e.JobTitle,
        e.Grade,
        e.EmploymentType.ToString(),
        e.Status.ToString(),
        e.JoinDate,
        e.NoticePeriodDays,
        e.BasicSalary,
        e.HousingAllowance,
        e.TransportAllowance,
        e.MobileAllowance,
        e.OtherAllowances,
        Gross(e),
        e.Currency,
        e.BankName,
        e.AccountName,
        e.AccountNumber,
        e.Iban,
        e.IfscCode,
        e.SwiftCode,
        e.PaymentMode.ToString(),
        e.WpsId,
        e.PassportNumber,
        e.PassportExpiry,
        e.VisaNumber,
        e.VisaExpiry,
        e.EmiratesId,
        roleCode,
        roleName,
        e.IsFaceEnrolled,
        e.FacePhotoUrl);

    private static decimal Gross(Employee e) =>
        e.BasicSalary + e.HousingAllowance + e.TransportAllowance + e.MobileAllowance + e.OtherAllowances;
}
