using Hrms.Application.Abstractions.Services;
using Hrms.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Hrms.Application;

/// <summary>Registers the application services (all scoped, one unit of work per request).</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ILeaveService, LeaveService>();
        services.AddScoped<IAttendanceService, AttendanceService>();
        services.AddScoped<IPayrollService, PayrollService>();
        services.AddScoped<ILoanService, LoanService>();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IApprovalService, ApprovalService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IAnnouncementService, AnnouncementService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<ITaskService, TaskService>();
        services.AddScoped<IPerformanceService, PerformanceService>();
        services.AddScoped<IErpService, ErpService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IShiftRosterService, ShiftRosterService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<INavigationService, NavigationService>();
        services.AddScoped<IOptionsService, OptionsService>();
        services.AddScoped<IAssetService, AssetService>();
        services.AddScoped<ISupportService, SupportService>();
        services.AddScoped<ICompanyManagementService, CompanyManagementService>();
        services.AddScoped<IAccountActivationService, AccountActivationService>();

        return services;
    }
}
