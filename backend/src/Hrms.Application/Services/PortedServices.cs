using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;

namespace Hrms.Application.Services;

public sealed class ShiftRosterService : IShiftRosterService
{
    private readonly IUnitOfWork _uow;

    public ShiftRosterService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IReadOnlyList<ShiftTemplateDto>> GetShiftTemplatesAsync(CancellationToken ct = default)
    {
        var templates = await _uow.ShiftTemplates.ToListAsync(
            _uow.ShiftTemplates.Query().OrderBy(t => t.Name), ct);

        var allDays = await _uow.Shiftdays.ToListAsync(_uow.Shiftdays.Query(), ct);
        var daysByTemplate = allDays.GroupBy(d => d.ShiftTemplateId).ToDictionary(g => g.Key, g => g.ToList());

        var departments = await _uow.Departments.ToListAsync(_uow.Departments.Query(), ct);
        var deptDict = departments.ToDictionary(d => d.Id, d => d.Name);

        return templates.Select(t =>
        {
            var days = daysByTemplate.TryGetValue(t.Id, out var list) ? list : new List<Shiftday>();
            var dayDtos = days.Select(d => new ShiftdayDto(
                d.Id, d.ShiftTemplateId, d.DayOfWeek.ToString(),
                d.StartTime.ToString("HH:mm"), d.EndTime.ToString("HH:mm"),
                d.IsWeekOff, d.BreakMinutes)).ToList();

            var deptName = t.DepartmentId.HasValue && deptDict.TryGetValue(t.DepartmentId.Value, out var dn) ? dn : null;

            return new ShiftTemplateDto(
                t.Id, t.Name, t.Description, t.DepartmentId, deptName,
                t.GracePeriodMinutes, t.HalfDayHours, t.FullDayHours,
                t.IsDefault, t.IsNightShift, dayDtos);
        }).ToList();
    }

    public async Task<ShiftTemplateDto> CreateShiftTemplateAsync(SaveShiftTemplateRequest request, CancellationToken ct = default)
    {
        var entity = new ShiftTemplate
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            DepartmentId = request.DepartmentId,
            GracePeriodMinutes = request.GracePeriodMinutes,
            HalfDayHours = request.HalfDayHours,
            FullDayHours = request.FullDayHours,
            IsDefault = request.IsDefault,
            IsNightShift = request.IsNightShift
        };

        await _uow.ShiftTemplates.AddAsync(entity, ct);

        if (request.Shiftdays != null && request.Shiftdays.Count > 0)
        {
            foreach (var d in request.Shiftdays)
            {
                await _uow.Shiftdays.AddAsync(new Shiftday
                {
                    ShiftTemplateId = entity.Id,
                    DayOfWeek = d.DayOfWeek,
                    StartTime = d.StartTime,
                    EndTime = d.EndTime,
                    IsWeekOff = d.IsWeekOff,
                    BreakMinutes = d.BreakMinutes
                }, ct);
            }
        }
        else
        {
            // Create standard Mon-Fri schedule
            foreach (DayOfWeek dow in Enum.GetValues<DayOfWeek>())
            {
                var isWeekend = dow is DayOfWeek.Saturday or DayOfWeek.Sunday;
                await _uow.Shiftdays.AddAsync(new Shiftday
                {
                    ShiftTemplateId = entity.Id,
                    DayOfWeek = dow,
                    StartTime = new TimeOnly(9, 0),
                    EndTime = new TimeOnly(18, 0),
                    IsWeekOff = isWeekend,
                    BreakMinutes = 60
                }, ct);
            }
        }

        await _uow.SaveChangesAsync(ct);
        return (await GetShiftTemplatesAsync(ct)).First(t => t.Id == entity.Id);
    }

    public async Task<ShiftTemplateDto> UpdateShiftTemplateAsync(Guid id, SaveShiftTemplateRequest request, CancellationToken ct = default)
    {
        var entity = await _uow.ShiftTemplates.GetByIdAsync(id, ct)
                     ?? throw NotFoundException.For("Shift Template", id);

        entity.Name = request.Name.Trim();
        entity.Description = request.Description?.Trim();
        entity.DepartmentId = request.DepartmentId;
        entity.GracePeriodMinutes = request.GracePeriodMinutes;
        entity.HalfDayHours = request.HalfDayHours;
        entity.FullDayHours = request.FullDayHours;
        entity.IsDefault = request.IsDefault;
        entity.IsNightShift = request.IsNightShift;

        _uow.ShiftTemplates.Update(entity);

        if (request.Shiftdays != null && request.Shiftdays.Count > 0)
        {
            var oldDays = await _uow.Shiftdays.ToListAsync(
                _uow.Shiftdays.Query().Where(d => d.ShiftTemplateId == id), ct);
            _uow.Shiftdays.RemoveRange(oldDays);

            foreach (var d in request.Shiftdays)
            {
                await _uow.Shiftdays.AddAsync(new Shiftday
                {
                    ShiftTemplateId = entity.Id,
                    DayOfWeek = d.DayOfWeek,
                    StartTime = d.StartTime,
                    EndTime = d.EndTime,
                    IsWeekOff = d.IsWeekOff,
                    BreakMinutes = d.BreakMinutes
                }, ct);
            }
        }

        await _uow.SaveChangesAsync(ct);
        return (await GetShiftTemplatesAsync(ct)).First(t => t.Id == entity.Id);
    }

    public async Task DeleteShiftTemplateAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _uow.ShiftTemplates.GetByIdAsync(id, ct)
                     ?? throw NotFoundException.For("Shift Template", id);

        var days = await _uow.Shiftdays.ToListAsync(_uow.Shiftdays.Query().Where(d => d.ShiftTemplateId == id), ct);
        _uow.Shiftdays.RemoveRange(days);

        _uow.ShiftTemplates.Remove(entity);
        await _uow.SaveChangesAsync(ct);
    }
}

public sealed class RoleService : IRoleService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public RoleService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    private bool IsHrManagerOnly()
    {
        var role = _currentUser.Role ?? string.Empty;
        return role.Equals("HR Manager", StringComparison.OrdinalIgnoreCase) ||
               role.Equals("HrManager", StringComparison.OrdinalIgnoreCase) ||
               role.Equals("HR", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct = default)
    {
        var roles = await _uow.Roles.ToListAsync(
            _uow.Roles.Query().OrderBy(r => r.IsSystem ? 0 : 1).ThenBy(r => r.Name), ct);

        // HR Managers have no R/W access to Company Admin or Super Admin
        if (IsHrManagerOnly())
        {
            roles = roles.Where(r => 
                !r.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) && 
                !r.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase) &&
                !r.Name.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) &&
                !r.Name.Equals("Company Admin", StringComparison.OrdinalIgnoreCase)
            ).ToList();
        }

        var users = await _uow.Users.ListAsync(ct);
        var userCounts = users
            .GroupBy(u => u.RoleId)
            .ToDictionary(g => g.Key, g => g.Count());

        return roles.Select(r => new RoleDto(
            r.Id,
            r.Code,
            r.Name,
            r.Description,
            r.IsSystem,
            userCounts.TryGetValue(r.Id, out var count) ? count : 0
        )).ToList();
    }

    public async Task<RoleDto> GetRoleByIdAsync(Guid id, CancellationToken ct = default)
    {
        var role = await _uow.Roles.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Role", id);

        if (IsHrManagerOnly() && (role.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || role.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ValidationException("Access denied. HR Managers do not have permission to view or manage Company Admin or Super Admin roles.");
        }

        var count = await _uow.Users.CountQueryAsync(_uow.Users.Query().Where(u => u.RoleId == id), ct);
        return new RoleDto(role.Id, role.Code, role.Name, role.Description, role.IsSystem, count);
    }

    public async Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim();
        var name = request.Name.Trim();

        var existing = await _uow.Roles.FirstOrDefaultAsync(
            _uow.Roles.Query().Where(r => r.Code.ToLower() == code.ToLower() || r.Name.ToLower() == name.ToLower()), ct);
        if (existing != null)
        {
            throw new ConflictException($"A role with code '{code}' or name '{name}' already exists.");
        }

        var role = new Role
        {
            Code = code,
            Name = name,
            Description = request.Description?.Trim(),
            IsSystem = false
        };

        await _uow.Roles.AddAsync(role, ct);
        await _uow.SaveChangesAsync(ct);

        // Seed default basic view permissions for dashboard & profile
        var allNavs = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query(), ct);
        foreach (var nav in allNavs.Where(n => n.Route == "/dashboard" || n.Route == "/me/dashboard" || n.Route == "/employee-profile" || n.Route == "/me/profile"))
        {
            await _uow.RoleNavigations.AddAsync(new RoleNavigation
            {
                RoleId = role.Id,
                NavigationItemId = nav.Id,
                IsFull = false,
                IsView = true,
                IsCreate = false,
                IsEdit = false,
                IsDelete = false
            }, ct);
        }
        await _uow.SaveChangesAsync(ct);

        return new RoleDto(role.Id, role.Code, role.Name, role.Description, false, 0);
    }

    public async Task<RoleDto> UpdateRoleAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default)
    {
        var role = await _uow.Roles.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Role", id);

        if (IsHrManagerOnly() && (role.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || role.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ValidationException("Access denied. HR Managers do not have permission to modify Company Admin or Super Admin roles.");
        }

        var code = request.Code.Trim();
        var name = request.Name.Trim();

        var conflict = await _uow.Roles.FirstOrDefaultAsync(
            _uow.Roles.Query().Where(r => r.Id != id && (r.Code.ToLower() == code.ToLower() || r.Name.ToLower() == name.ToLower())), ct);
        if (conflict != null)
        {
            throw new ConflictException($"Another role with code '{code}' or name '{name}' already exists.");
        }

        if (role.IsSystem && !string.Equals(role.Code, code, StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException("System role codes cannot be modified.");
        }

        role.Name = name;
        if (!role.IsSystem)
        {
            role.Code = code;
        }
        role.Description = request.Description?.Trim();

        _uow.Roles.Update(role);
        await _uow.SaveChangesAsync(ct);

        var count = await _uow.Users.CountQueryAsync(_uow.Users.Query().Where(u => u.RoleId == id), ct);
        return new RoleDto(role.Id, role.Code, role.Name, role.Description, role.IsSystem, count);
    }

    public async Task DeleteRoleAsync(Guid id, CancellationToken ct = default)
    {
        var role = await _uow.Roles.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("Role", id);

        if (IsHrManagerOnly() && (role.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) || role.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ValidationException("Access denied. HR Managers do not have permission to delete Company Admin or Super Admin roles.");
        }

        if (role.IsSystem)
        {
            throw new ValidationException("System roles (Super Admin, Company Admin, HR Manager, Manager, Employee) cannot be deleted.");
        }

        var hasUsers = await _uow.Users.AnyAsync(_uow.Users.Query().Where(u => u.RoleId == id), ct);
        if (hasUsers)
        {
            throw new ValidationException("Cannot delete this role because one or more users are currently assigned to it. Please reassign the users first.");
        }

        var navPerms = await _uow.RoleNavigations.ToListAsync(_uow.RoleNavigations.Query().Where(rn => rn.RoleId == id), ct);
        _uow.RoleNavigations.RemoveRange(navPerms);

        _uow.Roles.Remove(role);
        await _uow.SaveChangesAsync(ct);
    }
}

public sealed class NavigationService : INavigationService
{
    private readonly IUnitOfWork _uow;

    public NavigationService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IReadOnlyList<NavigationItemDto>> GetNavigationTreeAsync(CancellationToken ct = default)
    {
        var items = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query().OrderBy(n => n.OrderIndex), ct);
        if (items.Count == 0)
        {
            await SeedDefaultNavigationsAsync(ct);
            items = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query().OrderBy(n => n.OrderIndex), ct);
        }

        var lookup = items.ToLookup(i => i.ParentId);
        return BuildTree(null, lookup);
    }

    public async Task<IReadOnlyList<NavigationItemDto>> GetUserNavigationAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _uow.Users.GetWithRoleAsync(userId, ct);
        if (user == null) return Array.Empty<NavigationItemDto>();

        var allItems = await _uow.NavigationItems.ToListAsync(
            _uow.NavigationItems.Query().Where(n => n.IsActive).OrderBy(n => n.OrderIndex), ct);
        if (allItems.Count == 0)
        {
            await SeedDefaultNavigationsAsync(ct);
            allItems = await _uow.NavigationItems.ToListAsync(
                _uow.NavigationItems.Query().Where(n => n.IsActive).OrderBy(n => n.OrderIndex), ct);
        }

        var roleName = user.Role?.Name ?? string.Empty;
        var roleCode = user.Role?.Code ?? string.Empty;

        var permissions = await _uow.RoleNavigations.ToListAsync(
            _uow.RoleNavigations.Query().Where(rn => rn.RoleId == user.RoleId), ct);

        var allowedIds = permissions
            .Where(p => p.IsView || p.IsFull)
            .Select(p => p.NavigationItemId)
            .ToHashSet();

        bool isSuperOrAdmin = roleName.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                              roleCode.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                              roleName.Equals("Company Admin", StringComparison.OrdinalIgnoreCase) ||
                              roleCode.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase) ||
                              roleName.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                              roleCode.Contains("Admin", StringComparison.OrdinalIgnoreCase) ||
                              roleName.Contains("HR", StringComparison.OrdinalIgnoreCase) ||
                              roleCode.Contains("HR", StringComparison.OrdinalIgnoreCase);

        // Admins (Company Admin, Super Admin, HR Manager) ALWAYS retain full access to all navigation items
        if (isSuperOrAdmin)
        {
            foreach (var nav in allItems)
            {
                allowedIds.Add(nav.Id);
            }
        }
        else if (allowedIds.Count == 0)
        {
            // Fallback if role permissions have not been specifically seeded yet:
            // HR Manager has access to all operational modules
            if (roleName.Contains("HR", StringComparison.OrdinalIgnoreCase) || roleCode.Contains("HR", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var nav in allItems)
                {
                    allowedIds.Add(nav.Id);
                }
            }
            else
            {
                // General fallback for unconfigured employee/manager roles: allow operational non-settings items
                foreach (var nav in allItems.Where(n => !n.Route.StartsWith("/settings", StringComparison.OrdinalIgnoreCase)))
                {
                    allowedIds.Add(nav.Id);
                }
            }
        }

        // Filter items: item is allowed if itself is permitted or any of its children are permitted
        var allowedItems = allItems.Where(i =>
            allowedIds.Contains(i.Id) ||
            (i.ParentId.HasValue && allowedIds.Contains(i.ParentId.Value)) ||
            allItems.Any(child => child.ParentId == i.Id && allowedIds.Contains(child.Id))).ToList();

        var lookup = allowedItems.ToLookup(i => i.ParentId);
        return BuildTree(null, lookup);
    }

    public async Task<IReadOnlyList<RoleNavigationDto>> GetRolePermissionsAsync(Guid roleId, CancellationToken ct = default)
    {
        var role = await _uow.Roles.GetByIdAsync(roleId, ct)
                   ?? throw NotFoundException.For("Role", roleId);

        var allNavs = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query().OrderBy(n => n.OrderIndex), ct);
        if (allNavs.Count == 0)
        {
            await SeedDefaultNavigationsAsync(ct);
            allNavs = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query().OrderBy(n => n.OrderIndex), ct);
        }

        var existing = await _uow.RoleNavigations.ToListAsync(
            _uow.RoleNavigations.Query().Where(r => r.RoleId == roleId), ct);
        var existingDict = existing.ToDictionary(e => e.NavigationItemId);

        bool isSuperOrAdmin = role.Name.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                              role.Name.Equals("Company Admin", StringComparison.OrdinalIgnoreCase) ||
                              role.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                              role.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase);

        return allNavs.Select(n =>
        {
            if (existingDict.TryGetValue(n.Id, out var p))
            {
                return new RoleNavigationDto(p.Id, roleId, role.Name, n.Id, n.Title, n.Route, p.IsFull, p.IsView, p.IsCreate, p.IsEdit, p.IsDelete);
            }

            return new RoleNavigationDto(Guid.Empty, roleId, role.Name, n.Id, n.Title, n.Route, isSuperOrAdmin, isSuperOrAdmin, isSuperOrAdmin, isSuperOrAdmin, isSuperOrAdmin);
        }).ToList();
    }

    public async Task SaveRolePermissionsAsync(SaveRolePermissionsRequest request, CancellationToken ct = default)
    {
        var role = await _uow.Roles.GetByIdAsync(request.RoleId, ct)
                   ?? throw NotFoundException.For("Role", request.RoleId);

        var existing = await _uow.RoleNavigations.ToListAsync(
            _uow.RoleNavigations.Query().Where(r => r.RoleId == request.RoleId), ct);
        _uow.RoleNavigations.RemoveRange(existing);

        var allNavs = await _uow.NavigationItems.ToListAsync(_uow.NavigationItems.Query(), ct);
        var settingsNavIds = allNavs
            .Where(n => n.Route.StartsWith("/settings", StringComparison.OrdinalIgnoreCase) ||
                        n.Title.Equals("Settings", StringComparison.OrdinalIgnoreCase) ||
                        n.Code.Equals("SETT", StringComparison.OrdinalIgnoreCase))
            .Select(n => n.Id)
            .ToHashSet();

        var settingsParent = allNavs.FirstOrDefault(n => n.Route.Equals("/settings", StringComparison.OrdinalIgnoreCase));
        if (settingsParent != null)
        {
            foreach (var child in allNavs.Where(n => n.ParentId == settingsParent.Id))
            {
                settingsNavIds.Add(child.Id);
            }
        }

        var permDict = request.Permissions.ToDictionary(p => p.NavigationItemId);

        // Lockout protection: Super Admin and Company Admin ALWAYS retain Full access to Settings
        bool isProtectedRole = role.Name.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                               role.Name.Equals("Company Admin", StringComparison.OrdinalIgnoreCase) ||
                               role.Code.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                               role.Code.Equals("CompanyAdmin", StringComparison.OrdinalIgnoreCase);

        foreach (var nav in allNavs)
        {
            if (isProtectedRole && settingsNavIds.Contains(nav.Id))
            {
                await _uow.RoleNavigations.AddAsync(new RoleNavigation
                {
                    RoleId = request.RoleId,
                    NavigationItemId = nav.Id,
                    IsFull = true,
                    IsView = true,
                    IsCreate = true,
                    IsEdit = true,
                    IsDelete = true
                }, ct);
            }
            else if (permDict.TryGetValue(nav.Id, out var p))
            {
                await _uow.RoleNavigations.AddAsync(new RoleNavigation
                {
                    RoleId = request.RoleId,
                    NavigationItemId = p.NavigationItemId,
                    IsFull = p.IsFull,
                    IsView = p.IsView,
                    IsCreate = p.IsCreate,
                    IsEdit = p.IsEdit,
                    IsDelete = p.IsDelete
                }, ct);
            }
        }

        await _uow.SaveChangesAsync(ct);
    }

    public async Task<NavigationItemDto> CreateNavigationItemAsync(SaveNavigationItemRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim();
        var title = request.Title.Trim();
        var route = request.Route.Trim();

        var existingCode = await _uow.NavigationItems.FirstOrDefaultAsync(
            _uow.NavigationItems.Query().Where(n => n.Code.ToLower() == code.ToLower()), ct);
        if (existingCode != null)
        {
            throw new ConflictException($"Code '{code}' is already used by navigation item '{existingCode.Title}'. Please use a unique Code.");
        }

        int sortIndex = request.OrderIndex;
        if (sortIndex <= 0)
        {
            var existingIndices = await _uow.NavigationItems.ToListAsync(
                _uow.NavigationItems.Query().Where(n => n.ParentId == request.ParentId).Select(n => n.OrderIndex), ct);
            sortIndex = (existingIndices.Count > 0 ? existingIndices.Max() : 0) + 1;
        }

        var nav = new NavigationItem
        {
            Code = code,
            Title = title,
            Route = route,
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? "settings" : request.Icon.Trim(),
            ParentId = request.ParentId,
            OrderIndex = sortIndex,
            Badge = request.Badge,
            IsActive = request.IsActive
        };

        await _uow.NavigationItems.AddAsync(nav, ct);
        await _uow.SaveChangesAsync(ct);

        // Auto grant to Super Admin, Company Admin, and HR Manager
        var adminRoles = await _uow.Roles.ToListAsync(
            _uow.Roles.Query().Where(r => 
                r.Code == "SuperAdmin" || r.Code == "CompanyAdmin" || r.Code == "HrManager" ||
                r.Name == "Super Admin" || r.Name == "Company Admin" || r.Name == "HR Manager" ||
                r.Name.Contains("Admin") || r.Code.Contains("Admin")), ct);

        foreach (var role in adminRoles)
        {
            await _uow.RoleNavigations.AddAsync(new RoleNavigation
            {
                RoleId = role.Id,
                NavigationItemId = nav.Id,
                IsFull = true,
                IsView = true,
                IsCreate = true,
                IsEdit = true,
                IsDelete = true
            }, ct);
        }
        await _uow.SaveChangesAsync(ct);

        return new NavigationItemDto(nav.Id, nav.Title, nav.Route, nav.Icon, nav.ParentId, nav.OrderIndex, nav.Badge, Array.Empty<NavigationItemDto>(), nav.Code, nav.IsActive);
    }

    public async Task<NavigationItemDto> UpdateNavigationItemAsync(Guid id, SaveNavigationItemRequest request, CancellationToken ct = default)
    {
        var nav = await _uow.NavigationItems.GetByIdAsync(id, ct)
                  ?? throw NotFoundException.For("NavigationItem", id);

        var code = request.Code.Trim();
        var route = request.Route.Trim();

        // Only check code conflict if the code is actually changing to another item's code
        if (!string.IsNullOrWhiteSpace(code) && !nav.Code.Equals(code, StringComparison.OrdinalIgnoreCase))
        {
            var conflictCode = await _uow.NavigationItems.FirstOrDefaultAsync(
                _uow.NavigationItems.Query().Where(n => n.Id != id && n.Code.ToLower() == code.ToLower()), ct);
            if (conflictCode != null)
            {
                throw new ConflictException($"Code '{code}' is already used by navigation item '{conflictCode.Title}'. Please use a unique Code.");
            }
        }

        // Prevent self-referencing circular hierarchy
        var parentId = request.ParentId;
        if (parentId.HasValue && parentId.Value == id)
        {
            parentId = null;
        }

        // If orderIndex changed and another sibling under the same parent shares this orderIndex, swap them
        if (nav.OrderIndex != request.OrderIndex)
        {
            var conflictingSibling = await _uow.NavigationItems.FirstOrDefaultAsync(
                _uow.NavigationItems.Query().Where(n => n.Id != id && n.ParentId == parentId && n.OrderIndex == request.OrderIndex), ct);
            if (conflictingSibling != null)
            {
                conflictingSibling.OrderIndex = nav.OrderIndex;
                _uow.NavigationItems.Update(conflictingSibling);
            }
        }

        nav.Code = code;
        nav.Title = request.Title.Trim();
        nav.Route = route;
        nav.Icon = string.IsNullOrWhiteSpace(request.Icon) ? nav.Icon : request.Icon.Trim();
        nav.ParentId = parentId;
        nav.OrderIndex = request.OrderIndex;
        nav.Badge = request.Badge;
        nav.IsActive = request.IsActive;

        _uow.NavigationItems.Update(nav);
        await _uow.SaveChangesAsync(ct);

        return new NavigationItemDto(nav.Id, nav.Title, nav.Route, nav.Icon, nav.ParentId, nav.OrderIndex, nav.Badge, Array.Empty<NavigationItemDto>(), nav.Code, nav.IsActive);
    }

    public async Task DeleteNavigationItemAsync(Guid id, CancellationToken ct = default)
    {
        var nav = await _uow.NavigationItems.GetByIdAsync(id, ct)
                  ?? throw NotFoundException.For("NavigationItem", id);

        // Lockout protection: Core Settings navigation item cannot be deleted
        if (nav.Code == "SETT" || nav.Route.Equals("/settings", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException("The core Settings navigation module cannot be deleted.");
        }

        // Unlink or delete children
        var children = await _uow.NavigationItems.ToListAsync(
            _uow.NavigationItems.Query().Where(n => n.ParentId == id), ct);
        foreach (var child in children)
        {
            var childPerms = await _uow.RoleNavigations.ToListAsync(
                _uow.RoleNavigations.Query().Where(rn => rn.NavigationItemId == child.Id), ct);
            _uow.RoleNavigations.RemoveRange(childPerms);
            _uow.NavigationItems.Remove(child);
        }

        var perms = await _uow.RoleNavigations.ToListAsync(
            _uow.RoleNavigations.Query().Where(rn => rn.NavigationItemId == id), ct);
        _uow.RoleNavigations.RemoveRange(perms);

        _uow.NavigationItems.Remove(nav);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task ReorderNavigationAsync(ReorderNavigationBatchRequest request, CancellationToken ct = default)
    {
        var ids = request.Items.Select(i => i.Id).ToList();
        var navs = await _uow.NavigationItems.ToListAsync(
            _uow.NavigationItems.Query().Where(n => ids.Contains(n.Id)), ct);
        var dict = navs.ToDictionary(n => n.Id);

        foreach (var item in request.Items)
        {
            if (dict.TryGetValue(item.Id, out var nav))
            {
                nav.OrderIndex = item.OrderIndex;
                if (item.ParentId.HasValue)
                {
                    nav.ParentId = item.ParentId.Value == Guid.Empty ? null : item.ParentId;
                }
                _uow.NavigationItems.Update(nav);
            }
        }

        await _uow.SaveChangesAsync(ct);
    }

    private static IReadOnlyList<NavigationItemDto> BuildTree(Guid? parentId, ILookup<Guid?, NavigationItem> lookup)
    {
        return lookup[parentId]
            .OrderBy(i => i.OrderIndex)
            .Select(i => new NavigationItemDto(
                i.Id,
                i.Title,
                i.Route,
                i.Icon,
                i.ParentId,
                i.OrderIndex,
                i.Badge,
                BuildTree(i.Id, lookup),
                i.Code,
                i.IsActive)).ToList();
    }

    private async Task SeedDefaultNavigationsAsync(CancellationToken ct)
    {
        var defaults = new (string Code, string Title, string Route, string Icon, int Order)[]
        {
            ("DASH", "Dashboard", "/dashboard", "dashboard", 1),
            ("ANAL", "Analytics", "/analytics", "reports", 2),
            ("COMP", "Company", "/company", "company", 3),
            ("EMPL", "Employees", "/employees", "employees", 4),
            ("PROF", "Profile", "/employee-profile", "user", 5),
            ("SHIF", "Shift", "/shift", "clock", 6),
            ("ATTD", "Attendance", "/attendance", "attendance", 7),
            ("LEAV", "Leave", "/leave", "leave", 8),
            ("PAYR", "Payroll", "/payroll", "payroll", 9),
            ("PAYS", "Payslips", "/payslips", "payslip", 10),
            ("ONBD", "Onboarding", "/onboarding", "onboarding", 11),
            ("DOCS", "Documents", "/documents", "documents", 12),
            ("APPR", "Approvals", "/approvals", "approvals", 13),
            ("REPT", "Reports", "/reports", "reports", 14),
            ("SETT", "Settings", "/settings", "settings", 15)
        };

        var createdNavs = new List<NavigationItem>();
        foreach (var (code, title, route, icon, order) in defaults)
        {
            var nav = new NavigationItem
            {
                Code = code,
                Title = title,
                Route = route,
                Icon = icon,
                OrderIndex = order,
                IsActive = true
            };
            await _uow.NavigationItems.AddAsync(nav, ct);
            createdNavs.Add(nav);
        }
        await _uow.SaveChangesAsync(ct);

        // Seed 4 child items under Settings (supporting nested hierarchy)
        var settingsNav = createdNavs.First(n => n.Code == "SETT");
        var settingsChildren = new (string Code, string Title, string Route, string Icon, int Order)[]
        {
            ("KEYG", "Key Group", "/settings#keygroup", "grid", 1),
            ("NAVM", "Navigation", "/settings#navigation", "list", 2),
            ("PERM", "Permission", "/settings#permission", "lock", 3),
            ("ROLE", "Role", "/settings#role", "user", 4)
        };

        foreach (var (code, title, route, icon, order) in settingsChildren)
        {
            var child = new NavigationItem
            {
                Code = code,
                Title = title,
                Route = route,
                Icon = icon,
                ParentId = settingsNav.Id,
                OrderIndex = order,
                IsActive = true
            };
            await _uow.NavigationItems.AddAsync(child, ct);
            createdNavs.Add(child);
        }
        await _uow.SaveChangesAsync(ct);

        // Seed default RoleNavigations for all existing roles
        var roles = await _uow.Roles.ListAsync(ct);
        foreach (var role in roles)
        {
            var roleCode = role.Code.ToLowerInvariant();
            var roleName = role.Name.ToLowerInvariant();

            foreach (var nav in createdNavs)
            {
                bool isView = false;
                bool isCreate = false;
                bool isEdit = false;
                bool isDelete = false;
                bool isFull = false;

                if (roleCode == "superadmin" || roleName == "super admin")
                {
                    isCreate = isEdit = isDelete = isFull = true;
                    var superHiddenCodes = new[] { "ANAL", "EMPL", "SHIF", "ATTD", "LEAV", "PAYR", "PAYS", "DOCS", "APPR", "REPT" };
                    isView = !superHiddenCodes.Contains(nav.Code);
                }
                else if (roleCode == "companyadmin" || roleName == "company admin")
                {
                    isView = isCreate = isEdit = isDelete = isFull = true;
                }
                else if (roleCode == "hrmanager" || roleName == "hr manager")
                {
                    isView = isCreate = isEdit = isFull = true;
                    isDelete = nav.Code != "SETT" && nav.ParentId != settingsNav.Id;
                }
                else if (roleCode == "manager" || roleName == "manager")
                {
                    var mgrAllowed = new[] { "DASH", "ANAL", "EMPL", "PROF", "ATTD", "LEAV", "DOCS", "APPR", "REPT" };
                    if (mgrAllowed.Contains(nav.Code))
                    {
                        isView = true;
                        isCreate = isEdit = new[] { "DASH", "PROF", "APPR", "ATTD", "LEAV" }.Contains(nav.Code);
                        isFull = new[] { "DASH", "PROF", "APPR" }.Contains(nav.Code);
                    }
                }
                else // Employee
                {
                    var empAllowed = new[] { "DASH", "PROF", "ATTD", "LEAV", "PAYS", "DOCS" };
                    if (empAllowed.Contains(nav.Code))
                    {
                        isView = true;
                        isCreate = new[] { "ATTD", "LEAV" }.Contains(nav.Code);
                        isEdit = new[] { "DASH", "PROF" }.Contains(nav.Code);
                    }
                }

                await _uow.RoleNavigations.AddAsync(new RoleNavigation
                {
                    RoleId = role.Id,
                    NavigationItemId = nav.Id,
                    IsFull = isFull,
                    IsView = isView,
                    IsCreate = isCreate,
                    IsEdit = isEdit,
                    IsDelete = isDelete
                }, ct);
            }
        }

        await _uow.SaveChangesAsync(ct);
    }
}

public sealed class OptionsService : IOptionsService
{
    private readonly IUnitOfWork _uow;

    public OptionsService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    private static readonly HashSet<string> EnumLockedGroupCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "GENDER",
        "MARITAL_STATUS",
        "EMPLOYMENT_TYPE",
        "PAYMENT_MODE"
    };

    public async Task<IReadOnlyList<KeyGroupDto>> GetKeyGroupsAsync(CancellationToken ct = default)
    {
        var groups = await _uow.KeyGroups.ToListAsync(_uow.KeyGroups.Query().OrderBy(g => g.Name), ct);
        if (groups.Count == 0)
        {
            await SeedDefaultOptionsAsync(ct);
            groups = await _uow.KeyGroups.ToListAsync(_uow.KeyGroups.Query().OrderBy(g => g.Name), ct);
        }

        var stores = await _uow.KeyStores.ToListAsync(_uow.KeyStores.Query().OrderBy(s => s.DisplayOrder), ct);
        var storesByGroup = stores.GroupBy(s => s.KeyGroupId).ToDictionary(g => g.Key, g => g.ToList());

        return groups.Select(g =>
        {
            var items = storesByGroup.TryGetValue(g.Id, out var list)
                ? list.Select(s => new KeyStoreDto(s.Id, s.KeyGroupId, s.Key, s.Value, s.SubValue, s.DisplayOrder, s.IsActive)).ToList()
                : new List<KeyStoreDto>();

            var isLocked = EnumLockedGroupCodes.Contains(g.Code);
            return new KeyGroupDto(g.Id, g.Code, g.Name, g.Description, g.IsGeneric, items, isLocked);
        }).ToList();
    }

    public async Task<KeyGroupDto> GetKeyGroupByIdAsync(Guid id, CancellationToken ct = default)
    {
        var group = await _uow.KeyGroups.GetByIdAsync(id, ct)
                    ?? throw NotFoundException.For("KeyGroup", id);

        var stores = await _uow.KeyStores.ToListAsync(
            _uow.KeyStores.Query().Where(s => s.KeyGroupId == id).OrderBy(s => s.DisplayOrder), ct);

        var items = stores.Select(s => new KeyStoreDto(s.Id, s.KeyGroupId, s.Key, s.Value, s.SubValue, s.DisplayOrder, s.IsActive)).ToList();
        var isLocked = EnumLockedGroupCodes.Contains(group.Code);
        return new KeyGroupDto(group.Id, group.Code, group.Name, group.Description, group.IsGeneric, items, isLocked);
    }

    public async Task<KeyGroupDto> SaveKeyGroupAsync(SaveKeyGroupRequest request, CancellationToken ct = default)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();

        KeyGroup group;
        if (request.Id.HasValue && request.Id.Value != Guid.Empty)
        {
            group = await _uow.KeyGroups.GetByIdAsync(request.Id.Value, ct)
                    ?? throw NotFoundException.For("KeyGroup", request.Id.Value);

            if (group.IsGeneric && !string.Equals(group.Code, code, StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException($"The code of generic system Key Group '{group.Name}' is read-only and cannot be changed.");
            }

            var conflict = await _uow.KeyGroups.FirstOrDefaultAsync(
                _uow.KeyGroups.Query().Where(g => g.Id != group.Id && g.Code.ToUpper() == code), ct);
            if (conflict != null)
            {
                throw new ConflictException($"A key group with code '{code}' already exists.");
            }

            group.Code = group.IsGeneric ? group.Code : code;
            group.Name = name;
            group.Description = request.Description?.Trim();
            group.IsGeneric = request.IsGeneric;
            _uow.KeyGroups.Update(group);
        }
        else
        {
            var conflict = await _uow.KeyGroups.FirstOrDefaultAsync(
                _uow.KeyGroups.Query().Where(g => g.Code.ToUpper() == code), ct);
            if (conflict != null)
            {
                throw new ConflictException($"A key group with code '{code}' already exists.");
            }

            group = new KeyGroup
            {
                Code = code,
                Name = name,
                Description = request.Description?.Trim(),
                IsGeneric = request.IsGeneric
            };
            await _uow.KeyGroups.AddAsync(group, ct);
        }

        await _uow.SaveChangesAsync(ct);

        // Sync or add KeyStore items if provided
        if (request.Items != null)
        {
            var existingStores = await _uow.KeyStores.ToListAsync(
                _uow.KeyStores.Query().Where(s => s.KeyGroupId == group.Id), ct);

            if (request.Items.Count > 0)
            {
                // Build set of incoming IDs (only valid non-empty GUIDs)
                var incomingIds = request.Items
                    .Where(i => i.Id.HasValue && i.Id.Value != Guid.Empty)
                    .Select(i => i.Id!.Value)
                    .ToHashSet();

                // Delete rows that existed before but are no longer in the incoming list
                var toDelete = existingStores
                    .Where(s => !incomingIds.Contains(s.Id))
                    .ToList();
                if (toDelete.Count > 0)
                {
                    _uow.KeyStores.RemoveRange(toDelete);
                    await _uow.SaveChangesAsync(ct);
                }

                int order = 1;
                foreach (var itemReq in request.Items)
                {
                    if (itemReq.Id.HasValue && itemReq.Id.Value != Guid.Empty)
                    {
                        var existing = existingStores.FirstOrDefault(s => s.Id == itemReq.Id.Value);
                        if (existing != null)
                        {
                            existing.Key = itemReq.Key.Trim();
                            existing.Value = itemReq.Value.Trim();
                            existing.SubValue = itemReq.SubValue?.Trim();
                            existing.DisplayOrder = itemReq.DisplayOrder > 0 ? itemReq.DisplayOrder : order++;
                            existing.IsActive = itemReq.IsActive;
                            _uow.KeyStores.Update(existing);
                        }
                    }
                    else if (!string.IsNullOrWhiteSpace(itemReq.Key) || !string.IsNullOrWhiteSpace(itemReq.Value))
                    {
                        var storeKey = string.IsNullOrWhiteSpace(itemReq.Key) ? itemReq.Value.Trim() : itemReq.Key.Trim();
                        var storeVal = string.IsNullOrWhiteSpace(itemReq.Value) ? itemReq.Key.Trim() : itemReq.Value.Trim();
                        await _uow.KeyStores.AddAsync(new KeyStore
                        {
                            KeyGroupId = group.Id,
                            Key = storeKey,
                            Value = storeVal,
                            SubValue = itemReq.SubValue?.Trim(),
                            DisplayOrder = itemReq.DisplayOrder > 0 ? itemReq.DisplayOrder : order++,
                            IsActive = itemReq.IsActive
                        }, ct);
                    }
                }
                await _uow.SaveChangesAsync(ct);
            }
            else
            {
                // Empty items list = remove all key store items for this group
                if (existingStores.Count > 0)
                {
                    _uow.KeyStores.RemoveRange(existingStores);
                    await _uow.SaveChangesAsync(ct);
                }
            }
        }

        return await GetKeyGroupByIdAsync(group.Id, ct);
    }

    public async Task DeleteKeyGroupAsync(Guid id, CancellationToken ct = default)
    {
        var group = await _uow.KeyGroups.GetByIdAsync(id, ct)
                    ?? throw NotFoundException.For("KeyGroup", id);

        if (group.IsGeneric || EnumLockedGroupCodes.Contains(group.Code))
        {
            throw new ConflictException($"Key Group '{group.Name}' is a system group and cannot be deleted.");
        }

        var stores = await _uow.KeyStores.ToListAsync(
            _uow.KeyStores.Query().Where(s => s.KeyGroupId == id), ct);

        // Check if any child item is in use
        bool inUse = false;
        foreach (var s in stores)
        {
            if (await IsKeyStoreInUseAsync(s, group.Code, ct))
            {
                inUse = true;
                s.IsActive = false;
                _uow.KeyStores.Update(s);
            }
        }

        if (inUse)
        {
            await _uow.SaveChangesAsync(ct);
            throw new ConflictException($"Key Group '{group.Name}' contains values currently in use by employees. The values have been deactivated instead so existing records remain intact.");
        }

        _uow.KeyStores.RemoveRange(stores);
        _uow.KeyGroups.Remove(group);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<KeyStoreDto>> GetKeyStoresByGroupAsync(string groupCode, CancellationToken ct = default)
    {
        var group = await _uow.KeyGroups.FirstOrDefaultAsync(
            _uow.KeyGroups.Query().Where(g => g.Code.ToLower() == groupCode.ToLower()), ct);

        if (group == null)
        {
            var all = await GetKeyGroupsAsync(ct);
            group = await _uow.KeyGroups.FirstOrDefaultAsync(
                _uow.KeyGroups.Query().Where(g => g.Code.ToLower() == groupCode.ToLower()), ct);
            if (group == null) return Array.Empty<KeyStoreDto>();
        }

        var stores = await _uow.KeyStores.ToListAsync(
            _uow.KeyStores.Query().Where(s => s.KeyGroupId == group.Id && s.IsActive).OrderBy(s => s.DisplayOrder), ct);

        return stores.Select(s => new KeyStoreDto(s.Id, s.KeyGroupId, s.Key, s.Value, s.SubValue, s.DisplayOrder, s.IsActive)).ToList();
    }

    public async Task<Dictionary<string, IReadOnlyList<KeyStoreDto>>> GetMultipleOptionsAsync(IEnumerable<string> groupCodes, CancellationToken ct = default)
    {
        var requested = groupCodes
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var result = new Dictionary<string, IReadOnlyList<KeyStoreDto>>(StringComparer.OrdinalIgnoreCase);
        foreach (var code in requested)
        {
            result[code] = Array.Empty<KeyStoreDto>();
        }

        if (requested.Count == 0)
        {
            return result;
        }

        var codes = requested.Select(c => c.ToLowerInvariant()).ToList();
        var groups = await _uow.KeyGroups.ToListAsync(
            _uow.KeyGroups.Query().Where(g => codes.Contains(g.Code.ToLower())), ct);

        if (groups.Count == 0)
        {
            await SeedDefaultOptionsAsync(ct);
            groups = await _uow.KeyGroups.ToListAsync(
                _uow.KeyGroups.Query().Where(g => codes.Contains(g.Code.ToLower())), ct);
        }

        var groupIds = groups.Select(g => g.Id).ToList();
        var stores = groupIds.Count == 0
            ? Array.Empty<KeyStore>()
            : (await _uow.KeyStores.ToListAsync(
                _uow.KeyStores.Query()
                    .Where(s => groupIds.Contains(s.KeyGroupId) && s.IsActive)
                    .OrderBy(s => s.DisplayOrder),
                ct)).ToArray();

        var byGroup = stores
            .GroupBy(s => s.KeyGroupId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<KeyStoreDto>)g
                    .Select(s => new KeyStoreDto(s.Id, s.KeyGroupId, s.Key, s.Value, s.SubValue, s.DisplayOrder, s.IsActive))
                    .ToList());

        var groupByCode = groups.ToDictionary(g => g.Code.ToLowerInvariant());

        foreach (var code in requested)
        {
            if (groupByCode.TryGetValue(code.ToLowerInvariant(), out var group)
                && byGroup.TryGetValue(group.Id, out var items))
            {
                result[code] = items;
            }
        }

        return result;
    }

    public async Task<KeyStoreDto> SaveKeyStoreAsync(SaveKeyStoreRequest request, CancellationToken ct = default)
    {
        var keyGroupId = request.KeyGroupId ?? throw new ValidationException("KeyGroupId is required when saving an individual key store value.");
        var grp = await _uow.KeyGroups.GetByIdAsync(keyGroupId, ct)
                  ?? throw NotFoundException.For("KeyGroup", keyGroupId);
        var isLocked = EnumLockedGroupCodes.Contains(grp.Code);

        if (request.Id.HasValue && request.Id.Value != Guid.Empty)
        {
            var item = await _uow.KeyStores.GetByIdAsync(request.Id.Value, ct)
                       ?? throw NotFoundException.For("KeyStore", request.Id.Value);

            var oldVal = item.Value.Trim();
            var newVal = request.Value.Trim();

            if (isLocked)
            {
                if (!string.Equals(item.Key, request.Key.Trim(), StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(oldVal, newVal, StringComparison.OrdinalIgnoreCase))
                {
                    throw new ConflictException($"The '{grp.Name}' group is backed by backend system enumerations. Renaming keys or values is locked to preserve database consistency. You may only activate, deactivate, or reorder these options.");
                }
            }

            item.Key = request.Key.Trim();
            item.Value = newVal;
            item.SubValue = request.SubValue?.Trim();
            item.DisplayOrder = request.DisplayOrder;
            item.IsActive = request.IsActive;

            _uow.KeyStores.Update(item);

            if (!string.Equals(oldVal, newVal, StringComparison.OrdinalIgnoreCase))
            {
                await CascadeUpdateKeyValueAsync(grp.Code, oldVal, newVal, ct);
            }

            await _uow.SaveChangesAsync(ct);
            return new KeyStoreDto(item.Id, item.KeyGroupId, item.Key, item.Value, item.SubValue, item.DisplayOrder, item.IsActive);
        }

        if (isLocked)
        {
            throw new ConflictException($"The '{grp.Name}' group is backed by backend system enumerations. Adding new values is locked to preserve database consistency. You may only activate, deactivate, or reorder the existing options.");
        }

        int sortOrder = request.DisplayOrder;
        if (sortOrder <= 0)
        {
            var existingOrders = await _uow.KeyStores.ToListAsync(
                _uow.KeyStores.Query().Where(s => s.KeyGroupId == keyGroupId).Select(s => s.DisplayOrder), ct);
            sortOrder = (existingOrders.Count > 0 ? existingOrders.Max() : 0) + 1;
        }

        var newItem = new KeyStore
        {
            KeyGroupId = keyGroupId,
            Key = request.Key.Trim(),
            Value = request.Value.Trim(),
            SubValue = request.SubValue?.Trim(),
            DisplayOrder = sortOrder,
            IsActive = request.IsActive
        };

        await _uow.KeyStores.AddAsync(newItem, ct);
        await _uow.SaveChangesAsync(ct);
        return new KeyStoreDto(newItem.Id, newItem.KeyGroupId, newItem.Key, newItem.Value, newItem.SubValue, newItem.DisplayOrder, newItem.IsActive);
    }

    public async Task DeleteKeyStoreAsync(Guid id, CancellationToken ct = default)
    {
        var item = await _uow.KeyStores.GetByIdAsync(id, ct)
                   ?? throw NotFoundException.For("KeyStore", id);

        var group = await _uow.KeyGroups.GetByIdAsync(item.KeyGroupId, ct);
        string groupCode = group?.Code ?? string.Empty;

        if (EnumLockedGroupCodes.Contains(groupCode))
        {
            throw new ConflictException($"Values in '{group?.Name ?? groupCode}' cannot be deleted because this group is backed by system enumerations. You can deactivate this value instead if you wish to hide it from dropdowns.");
        }

        // In-use check against employee data
        if (await IsKeyStoreInUseAsync(item, groupCode, ct))
        {
            item.IsActive = false;
            _uow.KeyStores.Update(item);
            await _uow.SaveChangesAsync(ct);
            throw new ConflictException($"The value '{item.Value}' is currently in use by employee records. It has been deactivated instead so existing records remain intact.");
        }

        _uow.KeyStores.Remove(item);
        await _uow.SaveChangesAsync(ct);
    }

    public async Task ReorderKeyStoresAsync(ReorderKeyStoresRequest request, CancellationToken ct = default)
    {
        var stores = await _uow.KeyStores.ToListAsync(
            _uow.KeyStores.Query().Where(s => s.KeyGroupId == request.KeyGroupId), ct);

        for (int i = 0; i < request.StoreIds.Count; i++)
        {
            var id = request.StoreIds[i];
            var store = stores.FirstOrDefault(s => s.Id == id);
            if (store != null)
            {
                store.DisplayOrder = i + 1;
                _uow.KeyStores.Update(store);
            }
        }

        await _uow.SaveChangesAsync(ct);
    }

    private async Task<bool> IsKeyStoreInUseAsync(KeyStore item, string groupCode, CancellationToken ct)
    {
        var normalizedCode = groupCode.ToUpperInvariant();
        var val = item.Value.Trim();
        var key = item.Key.Trim();

        if (normalizedCode == "BLOOD_GROUP")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.BloodGroup == val || e.BloodGroup == key), ct);
        }
        if (normalizedCode == "GENDER")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.Gender.ToString() == val || e.Gender.ToString() == key), ct);
        }
        if (normalizedCode == "MARITAL_STATUS")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.MaritalStatus.ToString() == val || e.MaritalStatus.ToString() == key), ct);
        }
        if (normalizedCode == "EMPLOYMENT_TYPE")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.EmploymentType.ToString() == val || e.EmploymentType.ToString() == key), ct);
        }
        if (normalizedCode == "GRADE_LEVEL")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.Grade == val || e.Grade == key), ct);
        }
        if (normalizedCode == "PAYMENT_MODE")
        {
            return await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.PaymentMode.ToString() == val || e.PaymentMode.ToString() == key), ct);
        }
        if (normalizedCode == "DOCUMENT_TYPE")
        {
            return await _uow.Documents.AnyAsync(_uow.Documents.Query().Where(d => d.Type.ToString() == val || d.Name == val), ct);
        }
        if (normalizedCode == "ASSET_TYPE")
        {
            return await _uow.Assets.AnyAsync(_uow.Assets.Query().Where(a => a.AssetType != null && a.AssetType.Name == val), ct)
                   || await _uow.AssetTypes.AnyAsync(_uow.AssetTypes.Query().Where(at => at.Name == val), ct);
        }
        if (normalizedCode == "SUPPORT_TYPE")
        {
            return await _uow.SupportRequests.AnyAsync(_uow.SupportRequests.Query().Where(sr => sr.SupportType != null && sr.SupportType.Name == val), ct)
                   || await _uow.SupportTypes.AnyAsync(_uow.SupportTypes.Query().Where(st => st.Name == val), ct);
        }
        if (normalizedCode == "PRIORITY")
        {
            return await _uow.SupportRequests.AnyAsync(_uow.SupportRequests.Query().Where(sr => sr.Priority == val), ct)
                   || await _uow.Tasks.AnyAsync(_uow.Tasks.Query().Where(t => t.Priority.ToString() == val), ct);
        }
        return false;
    }

    private async Task CascadeUpdateKeyValueAsync(string groupCode, string oldVal, string newVal, CancellationToken ct)
    {
        var code = groupCode.ToUpperInvariant();
        var trimmedOld = oldVal.Trim();
        var trimmedNew = newVal.Trim();

        // 1. Plain String Columns: Safely cascade rename in single transaction
        if (code == "BLOOD_GROUP")
        {
            var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.BloodGroup == trimmedOld), ct);
            foreach (var e in emps) { e.BloodGroup = trimmedNew; _uow.Employees.Update(e); }
        }
        else if (code == "GRADE_LEVEL")
        {
            var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.Grade == trimmedOld), ct);
            foreach (var e in emps) { e.Grade = trimmedNew; _uow.Employees.Update(e); }
        }
        else if (code == "ASSET_TYPE")
        {
            var assetTypes = await _uow.AssetTypes.ToListAsync(_uow.AssetTypes.Query().Where(at => at.Name == trimmedOld), ct);
            foreach (var at in assetTypes) { at.Name = trimmedNew; _uow.AssetTypes.Update(at); }
        }
        else if (code == "SUPPORT_TYPE")
        {
            var supportTypes = await _uow.SupportTypes.ToListAsync(_uow.SupportTypes.Query().Where(st => st.Name == trimmedOld), ct);
            foreach (var st in supportTypes) { st.Name = trimmedNew; _uow.SupportTypes.Update(st); }
        }
        else if (code == "PRIORITY")
        {
            var srs = await _uow.SupportRequests.ToListAsync(_uow.SupportRequests.Query().Where(sr => sr.Priority == trimmedOld), ct);
            foreach (var sr in srs) { sr.Priority = trimmedNew; _uow.SupportRequests.Update(sr); }
        }
        // 2. Strongly Typed Enum Columns: If rename cannot be converted safely and value is in use, block rename
        else if (code == "GENDER")
        {
            var normalizedOld = trimmedOld.Replace(" ", "");
            var normalizedNew = trimmedNew.Replace(" ", "");
            var hasOldEnum = Enum.TryParse<Gender>(normalizedOld, true, out var oldEnum);
            var hasNewEnum = Enum.TryParse<Gender>(normalizedNew, true, out var newEnum);

            if (hasOldEnum)
            {
                var inUse = await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.Gender == oldEnum), ct);
                if (inUse)
                {
                    if (!hasNewEnum)
                    {
                        throw new ConflictException($"Cannot rename Gender value '{trimmedOld}' to '{trimmedNew}': existing employee records are assigned to this value and '{trimmedNew}' is not a recognized system Gender type. Please deactivate '{trimmedOld}' and create a new value instead.");
                    }
                    var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.Gender == oldEnum), ct);
                    foreach (var e in emps) { e.Gender = newEnum; _uow.Employees.Update(e); }
                }
            }
        }
        else if (code == "MARITAL_STATUS")
        {
            var normalizedOld = trimmedOld.Replace(" ", "");
            var normalizedNew = trimmedNew.Replace(" ", "");
            var hasOldEnum = Enum.TryParse<MaritalStatus>(normalizedOld, true, out var oldEnum);
            var hasNewEnum = Enum.TryParse<MaritalStatus>(normalizedNew, true, out var newEnum);

            if (hasOldEnum)
            {
                var inUse = await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.MaritalStatus == oldEnum), ct);
                if (inUse)
                {
                    if (!hasNewEnum)
                    {
                        throw new ConflictException($"Cannot rename Marital Status value '{trimmedOld}' to '{trimmedNew}': existing employee records are assigned to this value and '{trimmedNew}' is not a recognized system Marital Status type. Please deactivate '{trimmedOld}' and create a new value instead.");
                    }
                    var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.MaritalStatus == oldEnum), ct);
                    foreach (var e in emps) { e.MaritalStatus = newEnum; _uow.Employees.Update(e); }
                }
            }
        }
        else if (code == "EMPLOYMENT_TYPE")
        {
            var normalizedOld = trimmedOld.Replace(" ", "").Replace("-", "");
            var normalizedNew = trimmedNew.Replace(" ", "").Replace("-", "");
            var hasOldEnum = Enum.TryParse<EmploymentType>(normalizedOld, true, out var oldEnum);
            var hasNewEnum = Enum.TryParse<EmploymentType>(normalizedNew, true, out var newEnum);

            if (hasOldEnum)
            {
                var inUse = await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.EmploymentType == oldEnum), ct);
                if (inUse)
                {
                    if (!hasNewEnum)
                    {
                        throw new ConflictException($"Cannot rename Employment Type value '{trimmedOld}' to '{trimmedNew}': existing employee records are assigned to this value and '{trimmedNew}' is not a recognized system Employment Type. Please deactivate '{trimmedOld}' and create a new value instead.");
                    }
                    var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.EmploymentType == oldEnum), ct);
                    foreach (var e in emps) { e.EmploymentType = newEnum; _uow.Employees.Update(e); }
                }
            }
        }
        else if (code == "PAYMENT_MODE")
        {
            var normalizedOld = trimmedOld.Replace(" ", "");
            var normalizedNew = trimmedNew.Replace(" ", "");
            var hasOldEnum = Enum.TryParse<PaymentMode>(normalizedOld, true, out var oldEnum);
            var hasNewEnum = Enum.TryParse<PaymentMode>(normalizedNew, true, out var newEnum);

            if (hasOldEnum)
            {
                var inUse = await _uow.Employees.AnyAsync(_uow.Employees.Query().Where(e => e.PaymentMode == oldEnum), ct);
                if (inUse)
                {
                    if (!hasNewEnum)
                    {
                        throw new ConflictException($"Cannot rename Payment Mode value '{trimmedOld}' to '{trimmedNew}': existing employee records are assigned to this value and '{trimmedNew}' is not a recognized system Payment Mode. Please deactivate '{trimmedOld}' and create a new value instead.");
                    }
                    var emps = await _uow.Employees.ToListAsync(_uow.Employees.Query().Where(e => e.PaymentMode == oldEnum), ct);
                    foreach (var e in emps) { e.PaymentMode = newEnum; _uow.Employees.Update(e); }
                }
            }
        }
        else if (code == "DOCUMENT_TYPE")
        {
            var normalizedOld = trimmedOld.Replace(" ", "");
            var normalizedNew = trimmedNew.Replace(" ", "");
            var hasOldEnum = Enum.TryParse<DocumentType>(normalizedOld, true, out var oldEnum);
            var hasNewEnum = Enum.TryParse<DocumentType>(normalizedNew, true, out var newEnum);

            if (hasOldEnum)
            {
                var inUse = await _uow.Documents.AnyAsync(_uow.Documents.Query().Where(d => d.Type == oldEnum), ct);
                if (inUse)
                {
                    if (!hasNewEnum)
                    {
                        throw new ConflictException($"Cannot rename Document Type value '{trimmedOld}' to '{trimmedNew}': existing documents are linked to this type and '{trimmedNew}' is not a recognized system Document Type. Please deactivate '{trimmedOld}' and create a new value instead.");
                    }
                    var docs = await _uow.Documents.ToListAsync(_uow.Documents.Query().Where(d => d.Type == oldEnum), ct);
                    foreach (var d in docs) { d.Type = newEnum; _uow.Documents.Update(d); }
                }
            }
        }
    }

    public async Task SeedDefaultOptionsAsync(CancellationToken ct)
    {
        // Standard seed groups
        var groups = new (string Code, string Name, bool IsGeneric, string[] Options)[]
        {
            ("BLOOD_GROUP", "Blood Group", true, new[] { "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-" }),
            ("GENDER", "Gender", true, new[] { "Male", "Female", "Other", "Prefer not to say" }),
            ("MARITAL_STATUS", "Marital Status", true, new[] { "Single", "Married", "Divorced", "Widowed" }),
            ("EMPLOYMENT_TYPE", "Employment Type", true, new[] { "Full-time", "Part-time", "Contract", "Internship" }),
            ("GRADE_LEVEL", "Grade / Level", false, new[] { "L1", "L2", "L3", "L4", "L5", "L6" }),
            ("PAYMENT_MODE", "Payment Mode", true, new[] { "Bank Transfer", "WPS", "Cheque", "Cash" }),
            ("DOCUMENT_TYPE", "Document Type", false, new[] { "Passport", "Visa", "National ID", "Work Permit", "Medical Insurance", "Other" }),
            ("ASSET_TYPE", "Asset Type", false, new[] { "Laptop", "Monitor", "Keyboard", "Mouse", "Phone", "Access Card", "Other" }),
            ("SUPPORT_TYPE", "Support Type", false, new[] { "IT Hardware", "Software Access", "HR Policy", "Payroll Inquiry", "Facilities" }),
            ("PRIORITY", "Priority", false, new[] { "Low", "Medium", "High", "Critical" })
        };

        foreach (var (code, name, isGeneric, options) in groups)
        {
            var grp = await _uow.KeyGroups.FirstOrDefaultAsync(
                _uow.KeyGroups.Query().Where(g => g.Code.ToUpper() == code), ct);

            if (grp == null)
            {
                grp = new KeyGroup { Code = code, Name = name, Description = $"{name} dictionary options", IsGeneric = isGeneric };
                await _uow.KeyGroups.AddAsync(grp, ct);
                await _uow.SaveChangesAsync(ct);
            }
            else if (grp.IsGeneric != isGeneric)
            {
                grp.IsGeneric = isGeneric;
                _uow.KeyGroups.Update(grp);
                await _uow.SaveChangesAsync(ct);
            }

            var existingStores = await _uow.KeyStores.ToListAsync(
                _uow.KeyStores.Query().Where(s => s.KeyGroupId == grp.Id), ct);

            var existingKeys = existingStores.Select(s => s.Key.ToUpperInvariant()).ToHashSet();

            int order = existingStores.Count > 0 ? existingStores.Max(s => s.DisplayOrder) + 1 : 1;
            foreach (var opt in options)
            {
                if (!existingKeys.Contains(opt.ToUpperInvariant()))
                {
                    await _uow.KeyStores.AddAsync(new KeyStore
                    {
                        KeyGroupId = grp.Id,
                        Key = opt,
                        Value = opt,
                        DisplayOrder = order++,
                        IsActive = true
                    }, ct);
                }
            }
        }

        await _uow.SaveChangesAsync(ct);
    }
}

public sealed class AssetService : IAssetService
{
    private readonly IUnitOfWork _uow;

    public AssetService(IUnitOfWork uow)
    {
        _uow = uow;
    }

    public async Task<IReadOnlyList<AssetDto>> ListAssetsAsync(CancellationToken ct = default)
    {
        var assets = await _uow.Assets.ToListAsync(_uow.Assets.Query().OrderBy(a => a.AssetCode), ct);
        var types = await _uow.AssetTypes.ToListAsync(_uow.AssetTypes.Query(), ct);
        var typeDict = types.ToDictionary(t => t.Id, t => t.Name);

        var assignments = await _uow.AssetAssignments.ToListAsync(
            _uow.AssetAssignments.Query().Where(a => a.Status == "Active"), ct);
        var assignmentByAsset = assignments.ToDictionary(a => a.AssetId);

        var employees = await _uow.Employees.ToListAsync(_uow.Employees.Query(), ct);
        var empDict = employees.ToDictionary(e => e.Id, e => $"{e.FirstName} {e.LastName}".Trim());

        return assets.Select(a =>
        {
            var typeName = typeDict.TryGetValue(a.AssetTypeId, out var tn) ? tn : "Equipment";
            string? assignedName = null;
            Guid? assignedId = null;

            if (assignmentByAsset.TryGetValue(a.Id, out var assign))
            {
                assignedId = assign.EmployeeId;
                if (empDict.TryGetValue(assign.EmployeeId, out var en))
                {
                    assignedName = en;
                }
            }

            return new AssetDto(
                a.Id, a.AssetTypeId, typeName, a.AssetCode, a.Name,
                a.SerialNumber, a.PurchaseDate, a.WarrantyExpiryDate,
                a.Status, a.Cost, assignedName, assignedId);
        }).ToList();
    }

    public async Task<AssetDto> CreateAssetAsync(SaveAssetRequest request, CancellationToken ct = default)
    {
        var asset = new Asset
        {
            AssetTypeId = request.AssetTypeId,
            AssetCode = request.AssetCode.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            SerialNumber = request.SerialNumber?.Trim(),
            PurchaseDate = request.PurchaseDate,
            WarrantyExpiryDate = request.WarrantyExpiryDate,
            Status = request.Status ?? "Available",
            Cost = request.Cost
        };

        await _uow.Assets.AddAsync(asset, ct);
        await _uow.SaveChangesAsync(ct);

        var list = await ListAssetsAsync(ct);
        return list.First(a => a.Id == asset.Id);
    }

    public async Task<AssetAssignmentDto> AssignAssetAsync(AssignAssetRequest request, CancellationToken ct = default)
    {
        var asset = await _uow.Assets.GetByIdAsync(request.AssetId, ct)
                    ?? throw NotFoundException.For("Asset", request.AssetId);

        var assignment = new AssetAssignment
        {
            AssetId = request.AssetId,
            EmployeeId = request.EmployeeId,
            AssignedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ConditionOnAssign = request.ConditionOnAssign ?? "Good",
            Status = "Active"
        };

        asset.Status = "Assigned";
        _uow.Assets.Update(asset);

        await _uow.AssetAssignments.AddAsync(assignment, ct);
        await _uow.SaveChangesAsync(ct);

        var emp = await _uow.Employees.GetByIdAsync(request.EmployeeId, ct);
        return new AssetAssignmentDto(
            assignment.Id,
            asset.Id,
            asset.Name,
            asset.AssetCode,
            request.EmployeeId,
            emp is null ? "—" : $"{emp.FirstName} {emp.LastName}".Trim(),
            assignment.AssignedDate,
            null,
            assignment.ConditionOnAssign,
            null,
            "Active");
    }

    public async Task<AssetAssignmentDto> ReturnAssetAsync(Guid assignmentId, ReturnAssetRequest request, CancellationToken ct = default)
    {
        var assignment = await _uow.AssetAssignments.GetByIdAsync(assignmentId, ct)
                         ?? throw NotFoundException.For("Asset Assignment", assignmentId);

        assignment.ReturnedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        assignment.ConditionOnReturn = request.ConditionOnReturn ?? "Good";
        assignment.Status = "Returned";
        _uow.AssetAssignments.Update(assignment);

        var asset = await _uow.Assets.GetByIdAsync(assignment.AssetId, ct);
        if (asset != null)
        {
            asset.Status = "Available";
            _uow.Assets.Update(asset);
        }

        await _uow.SaveChangesAsync(ct);

        var emp = await _uow.Employees.GetByIdAsync(assignment.EmployeeId, ct);
        return new AssetAssignmentDto(
            assignment.Id,
            assignment.AssetId,
            asset?.Name ?? "—",
            asset?.AssetCode ?? "—",
            assignment.EmployeeId,
            emp is null ? "—" : $"{emp.FirstName} {emp.LastName}".Trim(),
            assignment.AssignedDate,
            assignment.ReturnedDate,
            assignment.ConditionOnAssign,
            assignment.ConditionOnReturn,
            "Returned");
    }
}

public sealed class SupportService : ISupportService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUser _currentUser;

    public SupportService(IUnitOfWork uow, ICurrentUser currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<SupportRequestDto>> ListSupportRequestsAsync(Guid? employeeId, CancellationToken ct = default)
    {
        var query = _uow.SupportRequests.Query();
        if (employeeId.HasValue && employeeId.Value != Guid.Empty)
        {
            query = query.Where(s => s.EmployeeId == employeeId.Value);
        }

        var items = await _uow.SupportRequests.ToListAsync(query.OrderByDescending(s => s.SubmittedAtUtc), ct);
        var types = await _uow.SupportTypes.ToListAsync(_uow.SupportTypes.Query(), ct);
        var typeDict = types.ToDictionary(t => t.Id, t => t.Name);

        var employees = await _uow.Employees.ToListAsync(_uow.Employees.Query(), ct);
        var empDict = employees.ToDictionary(e => e.Id, e => $"{e.FirstName} {e.LastName}".Trim());

        return items.Select(s => new SupportRequestDto(
            s.Id,
            s.SupportTypeId,
            typeDict.TryGetValue(s.SupportTypeId, out var tn) ? tn : "General",
            s.EmployeeId,
            empDict.TryGetValue(s.EmployeeId, out var en) ? en : "—",
            s.Subject,
            s.Description,
            s.Priority,
            s.Status,
            s.SubmittedAtUtc,
            s.ResolvedAtUtc,
            s.ResolutionNotes)).ToList();
    }

    public async Task<SupportRequestDto> CreateSupportRequestAsync(CreateSupportRequest request, CancellationToken ct = default)
    {
        var empId = request.EmployeeId ?? _currentUser.EmployeeId
                    ?? await _uow.Employees.FirstOrDefaultAsync(
                        _uow.Employees.Query().OrderBy(e => e.EmployeeCode).Select(e => (Guid?)e.Id), ct)
                    ?? throw new NotFoundException("No employee found for ticket creation.");

        var entity = new SupportRequest
        {
            SupportTypeId = request.SupportTypeId,
            EmployeeId = empId,
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            Priority = request.Priority ?? "Medium",
            Status = "Open",
            SubmittedAtUtc = DateTime.UtcNow
        };

        await _uow.SupportRequests.AddAsync(entity, ct);
        await _uow.SaveChangesAsync(ct);

        var list = await ListSupportRequestsAsync(empId, ct);
        return list.First(s => s.Id == entity.Id);
    }

    public async Task<SupportRequestDto> UpdateSupportRequestAsync(Guid id, UpdateSupportRequest request, CancellationToken ct = default)
    {
        var entity = await _uow.SupportRequests.GetByIdAsync(id, ct)
                     ?? throw NotFoundException.For("Support Request", id);

        entity.Status = request.Status;
        if (request.Status is "Resolved" or "Closed")
        {
            entity.ResolvedAtUtc = DateTime.UtcNow;
        }
        if (!string.IsNullOrWhiteSpace(request.ResolutionNotes))
        {
            entity.ResolutionNotes = request.ResolutionNotes.Trim();
        }

        _uow.SupportRequests.Update(entity);
        await _uow.SaveChangesAsync(ct);

        var list = await ListSupportRequestsAsync(null, ct);
        return list.First(s => s.Id == entity.Id);
    }
}
