namespace Hrms.Application.DTOs;

public sealed record DashboardStatsDto(
    int TotalEmployees,
    decimal AttendanceRate,
    int PendingApprovals,
    decimal MonthlyPayroll,
    int Departments,
    int NewJoinersThisMonth,
    int OnLeaveToday,
    int Resignations);

public sealed record DepartmentHeadcountDto(string Department, int Count);

public sealed record AttendanceTrendPointDto(string Label, int Present, int Absent, int Late);

public sealed record ActivityDto(
    Guid EmployeeId,
    string EmployeeName,
    string EmployeeCode,
    string Department,
    string Action,
    string DateLabel,
    string Status);

public sealed record RecentLeaveDto(
    Guid Id,
    string EmployeeName,
    string LeaveType,
    string DateLabel,
    string Status);

public sealed record ExpoAlertDto(
    string EmployeeName,
    string Document,
    string ExpiryLabel,
    int DaysLeft,
    string Status);

public sealed record PendingApprovalDto(
    Guid Id,
    string EmployeeName,
    string Type,
    string Detail,
    string Priority);
