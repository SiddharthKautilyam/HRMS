using Hrms.Application.DTOs;
using Hrms.Domain.Enums;

namespace Hrms.Application.Abstractions.Services;

public interface ILoanService
{
    Task<LoanSummaryDto> GetSummaryAsync(CancellationToken ct = default);

    Task<IReadOnlyList<LoanDto>> ListAsync(LoanStatus? status, CancellationToken ct = default);

    Task<IReadOnlyList<LoanDto>> ListForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<LoanDto> CreateAsync(CreateLoanRequest request, CancellationToken ct = default);

    Task<LoanDto> DecideAsync(Guid id, bool approved, CancellationToken ct = default);
}

public interface IDocumentService
{
    Task<DocumentSummaryDto> GetSummaryAsync(CancellationToken ct = default);

    Task<IReadOnlyList<DocumentDto>> ListAsync(Guid? employeeId, string? search, DocumentType? type, DocumentStatus? status, CancellationToken ct = default);

    Task<IReadOnlyList<DocumentDto>> ListCompanyDocumentsAsync(CancellationToken ct = default);

    Task<DocumentDto> CreateAsync(CreateDocumentRequest request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IApprovalService
{
    Task<ApprovalSummaryDto> GetSummaryAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ApprovalDto>> ListAsync(ApprovalStatus? status, ApprovalType? type, CancellationToken ct = default);

    Task<ApprovalDto> CreateAsync(CreateApprovalRequest request, CancellationToken ct = default);

    Task<ApprovalDto> DecideAsync(Guid id, bool approved, ApprovalDecisionRequest? request, CancellationToken ct = default);

    Task<int> ApproveAllAsync(CancellationToken ct = default);
}

public interface IOrganizationService
{
    Task<IReadOnlyList<DepartmentDto>> GetDepartmentsAsync(CancellationToken ct = default);

    Task<DepartmentDto> CreateDepartmentAsync(SaveDepartmentRequest request, CancellationToken ct = default);

    Task<DepartmentDto> UpdateDepartmentAsync(Guid id, SaveDepartmentRequest request, CancellationToken ct = default);

    Task DeleteDepartmentAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<DesignationDto>> GetDesignationsAsync(CancellationToken ct = default);

    Task<DesignationDto> CreateDesignationAsync(SaveDesignationRequest request, CancellationToken ct = default);

    Task<DesignationDto> UpdateDesignationAsync(Guid id, SaveDesignationRequest request, CancellationToken ct = default);

    Task DeleteDesignationAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<BranchDto>> GetBranchesAsync(CancellationToken ct = default);

    Task<BranchDto> CreateBranchAsync(SaveBranchRequest request, CancellationToken ct = default);

    Task<BranchDto> UpdateBranchAsync(Guid id, SaveBranchRequest request, CancellationToken ct = default);

    Task DeleteBranchAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<HolidayDto>> GetHolidaysAsync(CancellationToken ct = default);

    Task<HolidayDto> CreateHolidayAsync(SaveHolidayRequest request, CancellationToken ct = default);

    Task<HolidayDto> UpdateHolidayAsync(Guid id, SaveHolidayRequest request, CancellationToken ct = default);

    Task DeleteHolidayAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<ShiftDto>> GetShiftsAsync(CancellationToken ct = default);

    Task<ShiftDto> CreateShiftAsync(SaveShiftRequest request, CancellationToken ct = default);

    Task<ShiftDto> UpdateShiftAsync(Guid id, SaveShiftRequest request, CancellationToken ct = default);

    Task DeleteShiftAsync(Guid id, CancellationToken ct = default);
}

public interface IAnnouncementService
{
    Task<IReadOnlyList<AnnouncementDto>> ListAsync(CancellationToken ct = default);

    Task<AnnouncementDto> CreateAsync(SaveAnnouncementRequest request, CancellationToken ct = default);

    Task<AnnouncementDto> UpdateAsync(Guid id, SaveAnnouncementRequest request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(CancellationToken ct = default);

    Task<EmployeeDashboardDto> GetMyDashboardAsync(Guid employeeId, CancellationToken ct = default);

    Task<IReadOnlyList<DepartmentHeadcountDto>> GetDepartmentHeadcountAsync(CancellationToken ct = default);

    Task<IReadOnlyList<AttendanceTrendPointDto>> GetAttendanceTrendAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ActivityDto>> GetRecentActivityAsync(int take, CancellationToken ct = default);

    Task<IReadOnlyList<ExpoAlertDto>> GetDocumentAlertsAsync(int take, CancellationToken ct = default);

    Task<IReadOnlyList<PendingApprovalDto>> GetPendingApprovalsAsync(int take, CancellationToken ct = default);

    Task<IReadOnlyList<RecentLeaveDto>> GetRecentLeavesAsync(int take, CancellationToken ct = default);

    Task<DashboardTemplateDataDto> GetTemplateDataAsync(Guid? employeeId, CancellationToken ct = default);
}

public interface IShiftRosterService
{
    Task<IReadOnlyList<ShiftTemplateDto>> GetShiftTemplatesAsync(CancellationToken ct = default);

    Task<ShiftTemplateDto> CreateShiftTemplateAsync(SaveShiftTemplateRequest request, CancellationToken ct = default);

    Task<ShiftTemplateDto> UpdateShiftTemplateAsync(Guid id, SaveShiftTemplateRequest request, CancellationToken ct = default);

    Task DeleteShiftTemplateAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<ShiftAssignmentDto>> GetAssignmentsAsync(Guid? departmentId, CancellationToken ct = default);

    Task<ShiftAssignmentDto> AssignShiftAsync(AssignShiftRequest request, CancellationToken ct = default);

    Task<RosterMatrixDto> GenerateRosterAsync(RosterQueryRequest request, CancellationToken ct = default);
}

public interface IRoleService
{
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct = default);

    Task<RoleDto> GetRoleByIdAsync(Guid id, CancellationToken ct = default);

    Task<RoleDto> CreateRoleAsync(CreateRoleRequest request, CancellationToken ct = default);

    Task<RoleDto> UpdateRoleAsync(Guid id, UpdateRoleRequest request, CancellationToken ct = default);

    Task DeleteRoleAsync(Guid id, CancellationToken ct = default);
}

public interface INavigationService
{
    Task<IReadOnlyList<NavigationItemDto>> GetNavigationTreeAsync(CancellationToken ct = default);

    Task<IReadOnlyList<NavigationItemDto>> GetUserNavigationAsync(Guid userId, CancellationToken ct = default);

    Task<IReadOnlyList<RoleNavigationDto>> GetRolePermissionsAsync(Guid roleId, CancellationToken ct = default);

    Task SaveRolePermissionsAsync(SaveRolePermissionsRequest request, CancellationToken ct = default);

    Task<NavigationItemDto> CreateNavigationItemAsync(SaveNavigationItemRequest request, CancellationToken ct = default);

    Task<NavigationItemDto> UpdateNavigationItemAsync(Guid id, SaveNavigationItemRequest request, CancellationToken ct = default);

    Task DeleteNavigationItemAsync(Guid id, CancellationToken ct = default);

    Task ReorderNavigationAsync(ReorderNavigationBatchRequest request, CancellationToken ct = default);
}

public interface IOptionsService
{
    Task<IReadOnlyList<KeyGroupDto>> GetKeyGroupsAsync(CancellationToken ct = default);

    Task<KeyGroupDto> GetKeyGroupByIdAsync(Guid id, CancellationToken ct = default);

    Task<KeyGroupDto> SaveKeyGroupAsync(SaveKeyGroupRequest request, CancellationToken ct = default);

    Task DeleteKeyGroupAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<KeyStoreDto>> GetKeyStoresByGroupAsync(string groupCode, CancellationToken ct = default);

    Task<Dictionary<string, IReadOnlyList<KeyStoreDto>>> GetMultipleOptionsAsync(IEnumerable<string> groupCodes, CancellationToken ct = default);

    Task<KeyStoreDto> SaveKeyStoreAsync(SaveKeyStoreRequest request, CancellationToken ct = default);

    Task DeleteKeyStoreAsync(Guid id, CancellationToken ct = default);

    Task ReorderKeyStoresAsync(ReorderKeyStoresRequest request, CancellationToken ct = default);
}

public interface IAssetService
{
    Task<IReadOnlyList<AssetDto>> ListAssetsAsync(CancellationToken ct = default);

    Task<AssetDto> CreateAssetAsync(SaveAssetRequest request, CancellationToken ct = default);

    Task<AssetAssignmentDto> AssignAssetAsync(AssignAssetRequest request, CancellationToken ct = default);

    Task<AssetAssignmentDto> ReturnAssetAsync(Guid assignmentId, ReturnAssetRequest request, CancellationToken ct = default);
}

public interface ISupportService
{
    Task<IReadOnlyList<SupportRequestDto>> ListSupportRequestsAsync(Guid? employeeId, CancellationToken ct = default);

    Task<SupportRequestDto> CreateSupportRequestAsync(CreateSupportRequest request, CancellationToken ct = default);

    Task<SupportRequestDto> UpdateSupportRequestAsync(Guid id, UpdateSupportRequest request, CancellationToken ct = default);
}
