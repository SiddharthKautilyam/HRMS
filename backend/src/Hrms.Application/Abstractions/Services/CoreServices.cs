using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Domain.Enums;

namespace Hrms.Application.Abstractions.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);

    Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default);

    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);

    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
}

public interface IEmployeeService
{
    Task<PagedResult<EmployeeListItemDto>> SearchAsync(EmployeeQuery query, CancellationToken ct = default);

    Task<EmployeeDetailDto> GetAsync(Guid id, CancellationToken ct = default);

    Task<EmployeeDetailDto> CreateAsync(CreateEmployeeRequest request, CancellationToken ct = default);

    Task<EmployeeDetailDto> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<DepartmentHeadcountDto>> DepartmentHeadcountAsync(CancellationToken ct = default);

    /// <summary>Resolves the employee record linked to the current user (or the first employee).</summary>
    Task<Guid> ResolveEmployeeIdAsync(Guid? explicitEmployeeId, CancellationToken ct = default);
}

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> ListAsync(CancellationToken ct = default);

    Task MarkReadAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<NotificationPreferenceDto>> GetPreferencesAsync(CancellationToken ct = default);

    Task<NotificationPreferenceDto> UpdatePreferenceAsync(string id, bool enabled, CancellationToken ct = default);
}

public interface ILeaveService
{
    Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(CancellationToken ct = default);

    Task<LeaveTypeDto> CreateLeaveTypeAsync(SaveLeaveTypeRequest request, CancellationToken ct = default);

    Task<LeaveTypeDto> UpdateLeaveTypeAsync(Guid id, SaveLeaveTypeRequest request, CancellationToken ct = default);

    Task DeleteLeaveTypeAsync(Guid id, CancellationToken ct = default);

    Task<PagedResult<LeaveRequestDto>> SearchAsync(
        string? search,
        LeaveStatus? status,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<IReadOnlyList<LeaveRequestDto>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<LeaveRequestDto> CreateAsync(CreateLeaveRequest request, CancellationToken ct = default);

    Task<LeaveRequestDto> DecideAsync(Guid id, bool approved, LeaveDecisionRequest? request, CancellationToken ct = default);

    Task<IReadOnlyList<LeaveBalanceDto>> GetBalancesAsync(Guid employeeId, CancellationToken ct = default);
    Task<LeaveSummaryDto> GetSummaryAsync(CancellationToken ct = default);
}

public interface IAttendanceService
{
    Task<AttendanceSummaryDto> GetSummaryAsync(CancellationToken ct = default);

    Task<IReadOnlyList<AttendanceRecordDto>> GetForEmployeeMonthAsync(
        Guid employeeId,
        int year,
        int month,
        CancellationToken ct = default);

    Task<IReadOnlyList<AttendanceRecordDto>> GetTodayAsync(CancellationToken ct = default);

    Task<IReadOnlyList<MonthlyMusterDayDto>> GetMusterAsync(Guid employeeId, int year, int month, CancellationToken ct = default);

    Task<IReadOnlyList<RegularizationDto>> GetRegularizationsAsync(CancellationToken ct = default);

    Task<RegularizationDto> CreateRegularizationAsync(CreateRegularizationRequest request, CancellationToken ct = default);

    Task<RegularizationDto> DecideRegularizationAsync(Guid id, bool approved, CancellationToken ct = default);

    Task<EmployeePunchDto> RecordPunchAsync(CreatePunchRequest request, CancellationToken ct = default);

    Task<EmployeePunchStatusDto> GetPunchStatusAsync(Guid? employeeId, CancellationToken ct = default);

    Task<IReadOnlyList<EmployeePunchDto>> GetTodayPunchesAsync(Guid? employeeId, CancellationToken ct = default);

    Task<TodayAttendanceOverviewDto> GetTodayOverviewAsync(CancellationToken ct = default);

    Task<IReadOnlyList<EnrolledFaceDto>> GetEnrolledFacesAsync(CancellationToken ct = default);

    Task<FacePunchResultDto> ProcessFacePunchAsync(FacePunchRequest request, CancellationToken ct = default);

    Task<bool> EnrollFaceAsync(Guid employeeId, EnrollFaceRequest request, CancellationToken ct = default);

    Task<bool> RemoveFaceAsync(Guid employeeId, CancellationToken ct = default);
    Task<DailyAttendanceCloseoutResult> CloseoutDailyAttendanceAsync(DateOnly? targetDate = null, CancellationToken ct = default);
}

public interface IPayrollService
{
    Task<PayrollSummaryDto> GetSummaryAsync(CancellationToken ct = default);

    Task<IReadOnlyList<PayrollRunDto>> GetRunsAsync(CancellationToken ct = default);

    Task<IReadOnlyList<PayslipDto>> GetPayslipsForRunAsync(Guid runId, CancellationToken ct = default);

    Task<IReadOnlyList<PayslipDto>> GetPayslipsForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<PayrollRunDto> RunPayrollAsync(RunPayrollRequest request, CancellationToken ct = default);

    Task<(byte[] Content, string FileName)> DownloadPayslipPdfAsync(
        Guid? payslipId = null,
        Guid? employeeId = null,
        string? employeeCode = null,
        int? month = null,
        int? year = null,
        CancellationToken ct = default);
}
