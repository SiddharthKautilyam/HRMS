using Hrms.Application.DTOs;
using Hrms.Domain.Enums;

namespace Hrms.Application.Abstractions.Services;

public interface ICompanyService
{
    Task<CompanySettingsDto> GetAsync(CancellationToken ct = default);

    Task<CompanySettingsDto> UpdateAsync(SaveCompanySettingsRequest request, CancellationToken ct = default);

    Task<string> UploadLogoAsync(Stream stream, string fileName, string contentType, long length, CancellationToken ct = default);
}

public interface ITaskService
{
    Task<IReadOnlyList<TaskDto>> ListAsync(Guid? employeeId, CancellationToken ct = default);

    Task<TaskDto> CreateAsync(CreateTaskRequest request, CancellationToken ct = default);

    Task<TaskDto> UpdateStatusAsync(Guid id, TaskItemStatus status, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IPerformanceService
{
    Task<PerformanceReviewDto> GetForEmployeeAsync(Guid employeeId, CancellationToken ct = default);

    Task<IReadOnlyList<PerformanceReviewDto>> ListAsync(CancellationToken ct = default);
}

public interface IErpService
{
    Task<ErpOverviewDto> GetOverviewAsync(CancellationToken ct = default);

    Task<ErpOverviewDto> SyncAsync(CancellationToken ct = default);
}

public interface IReportService
{
    Task<IReadOnlyList<PayrollReportRowDto>> PayrollAsync(CancellationToken ct = default);

    Task<IReadOnlyList<AttendanceReportRowDto>> AttendanceAsync(int? year, int? month, CancellationToken ct = default);

    Task<IReadOnlyList<LeaveReportRowDto>> LeaveAsync(CancellationToken ct = default);

    Task<IReadOnlyList<OvertimeReportRowDto>> OvertimeAsync(CancellationToken ct = default);
}
