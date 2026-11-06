using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

public class Department : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();

    public ICollection<Designation> Designations { get; set; } = new List<Designation>();
}

public class Designation : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Grade { get; set; } = "L3";

    public Guid? DepartmentId { get; set; }

    public Department? Department { get; set; }

    public string? Description { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

public class Branch : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;

    public string ManagerName { get; set; } = string.Empty;

    public int EmployeeCount { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

public class Shift : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    public int DailyHours { get; set; } = 9;

    public string WorkingDays { get; set; } = "Mon - Fri";

    public int LateGraceMinutes { get; set; } = 15;

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

public class Holiday : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    public HolidayType Type { get; set; } = HolidayType.National;

    public Guid? HolidayTemplateId { get; set; }

    public HolidayTemplate? HolidayTemplate { get; set; }

    public string? Icon { get; set; } = "calendar";

    public string? Description { get; set; }
}

public class HolidayTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsDefault { get; set; } = true;

    public ICollection<Holiday> Holidays { get; set; } = new List<Holiday>();

    public ICollection<HolidayTemplateAssignment> Assignments { get; set; } = new List<HolidayTemplateAssignment>();
}

public class HolidayTemplateAssignment : BaseEntity
{
    public Guid HolidayTemplateId { get; set; }

    public HolidayTemplate? HolidayTemplate { get; set; }

    public Guid? DepartmentId { get; set; }

    public Department? Department { get; set; }

    public Guid? BranchId { get; set; }

    public Branch? Branch { get; set; }

    public Guid? EmployeeId { get; set; }

    public Employee? Employee { get; set; }
}

public class ShiftTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid? DepartmentId { get; set; }

    public Department? Department { get; set; }

    public int GracePeriodMinutes { get; set; } = 15;

    public decimal HalfDayHours { get; set; } = 4.5m;

    public decimal FullDayHours { get; set; } = 8.0m;

    public bool IsDefault { get; set; } = false;

    public bool IsNightShift { get; set; } = false;

    public ICollection<Shiftday> Shiftdays { get; set; } = new List<Shiftday>();

    public ICollection<ShiftAssignment> ShiftAssignments { get; set; } = new List<ShiftAssignment>();
}

public class Shiftday : BaseEntity
{
    public Guid ShiftTemplateId { get; set; }

    public ShiftTemplate? ShiftTemplate { get; set; }

    public DayOfWeek DayOfWeek { get; set; }

    public TimeOnly StartTime { get; set; } = new(9, 0);

    public TimeOnly EndTime { get; set; } = new(18, 0);

    public bool IsWeekOff { get; set; } = false;

    public int BreakMinutes { get; set; } = 60;
}

public class ShiftAssignment : BaseEntity
{
    public Guid ShiftTemplateId { get; set; }

    public ShiftTemplate? ShiftTemplate { get; set; }

    public Guid EmployeeId { get; set; }

    public Employee? Employee { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public bool IsActive { get; set; } = true;
}

public class LeaveType : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public int MaxDaysPerYear { get; set; }

    public bool IsPaid { get; set; } = true;

    /// <summary>Hex colour used for the swatch in the leave-types table.</summary>
    public string Color { get; set; } = "#2563eb";

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
}
