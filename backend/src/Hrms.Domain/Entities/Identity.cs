using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

/// <summary>A security role. Supports both system-seeded roles and custom roles created by administrators.</summary>
public class Role : BaseEntity
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsSystem { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();

    public ICollection<RoleNavigation> RoleNavigations { get; set; } = new List<RoleNavigation>();
}

/// <summary>An application login. Optionally linked to an <see cref="Employee"/> record.</summary>
public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;

    public string NormalizedEmail { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Initials { get; set; } = string.Empty;

    public Guid RoleId { get; set; }

    public Role? Role { get; set; }

    public Guid? EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAtUtc { get; set; }

    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}

/// <summary>In-app notification shown in the header bell fly-out.</summary>
public class Notification : BaseEntity
{
    public Guid? UserId { get; set; }

    public User? User { get; set; }

    public string IconKey { get; set; } = "bell";

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string TimeLabel { get; set; } = string.Empty;

    public bool IsRead { get; set; }
}

public class NavigationItem : BaseEntity
{
    public string Code { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Route { get; set; } = string.Empty;

    public string Icon { get; set; } = string.Empty;

    public Guid? ParentId { get; set; }

    public NavigationItem? Parent { get; set; }

    public int OrderIndex { get; set; }

    public string? Badge { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<NavigationItem> Children { get; set; } = new List<NavigationItem>();

    public ICollection<RoleNavigation> RoleNavigations { get; set; } = new List<RoleNavigation>();

    public ICollection<EmployeeNavigation> EmployeeNavigations { get; set; } = new List<EmployeeNavigation>();
}

public class RoleNavigation : BaseEntity
{
    public Guid RoleId { get; set; }

    public Role? Role { get; set; }

    public Guid NavigationItemId { get; set; }

    public NavigationItem? NavigationItem { get; set; }

    public bool IsFull { get; set; }

    public bool IsView { get; set; }

    public bool IsCreate { get; set; }

    public bool IsEdit { get; set; }

    public bool IsDelete { get; set; }
}

public class EmployeeNavigation : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public Guid NavigationItemId { get; set; }

    public NavigationItem? NavigationItem { get; set; }

    public bool IsFull { get; set; }

    public bool IsView { get; set; }

    public bool IsCreate { get; set; }

    public bool IsEdit { get; set; }

    public bool IsDelete { get; set; }
}
