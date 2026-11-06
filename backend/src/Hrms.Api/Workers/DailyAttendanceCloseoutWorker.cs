using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Services;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence;
using Hrms.Infrastructure.Persistence.Master;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Hrms.Api.Workers;

/// <summary>
/// Background worker that periodically runs daily closeout across all active tenants:
/// - Auto-closes open punches past the shift limit/grace.
/// - Finalizes attendance records for previous days.
/// - Marks active employees absent if they have no punch on a scheduled workday.
/// </summary>
public sealed class DailyAttendanceCloseoutWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DailyAttendanceCloseoutWorker> _logger;
    private readonly TimeSpan _checkInterval;
    private readonly bool _isEnabled;

    public DailyAttendanceCloseoutWorker(
        IServiceProvider serviceProvider,
        ILogger<DailyAttendanceCloseoutWorker> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _isEnabled = configuration.GetValue("Attendance:CloseoutWorkerEnabled", false);
        var intervalMinutes = configuration.GetValue("Attendance:CloseoutIntervalMinutes", 60);
        _checkInterval = TimeSpan.FromMinutes(Math.Max(5, intervalMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_isEnabled)
        {
            _logger.LogInformation("DailyAttendanceCloseoutWorker is disabled by configuration (Attendance:CloseoutWorkerEnabled = false). Standing by without running closeout cycles.");
            return;
        }

        _logger.LogInformation("DailyAttendanceCloseoutWorker started. Interval: {Interval}", _checkInterval);

        // Initial delay before first execution to let startup migrations and seeding finish
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCloseoutAcrossAllTenantsAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Unexpected error in DailyAttendanceCloseoutWorker execution cycle.");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task RunCloseoutAcrossAllTenantsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var masterDb = scope.ServiceProvider.GetRequiredService<HrmsMasterDbContext>();
        var connFactory = scope.ServiceProvider.GetRequiredService<ITenantConnectionFactory>();

        var activeCompanies = await masterDb.Companies
            .Where(c => c.Status == CompanyStatus.Active)
            .ToListAsync(ct);

        foreach (var company in activeCompanies)
        {
            if (string.IsNullOrWhiteSpace(company.DatabaseName)) continue;

            try
            {
                var connString = connFactory.BuildTenant(company.DatabaseName);
                var options = new DbContextOptionsBuilder<HrmsDbContext>()
                    .UseSqlServer(connString)
                    .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
                    .Options;

                await using var tenantDb = new HrmsDbContext(options);
                if (!await tenantDb.Database.CanConnectAsync(ct))
                {
                    continue;
                }

                var uow = new UnitOfWork(tenantDb);
                var systemUser = new SystemCloseoutUser(company.Id);
                var attendanceService = new AttendanceService(uow, systemUser);

                var result = await attendanceService.CloseoutDailyAttendanceAsync(ct: ct);
                _logger.LogInformation(
                    "Tenant '{CompanyCode}' ({DatabaseName}): Attendance closeout for {TargetDate}: {ClosedPunches} punches closed, {Absent} marked absent, {Finalized} finalized.",
                    company.Code, company.DatabaseName, result.TargetDate, result.ClosedIncompletePunches, result.MarkedAbsentCount, result.FinalizedAttendanceCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to run attendance closeout for tenant '{CompanyCode}' ({DatabaseName})", company.Code, company.DatabaseName);
            }
        }
    }

    private sealed class SystemCloseoutUser : ICurrentUser
    {
        public SystemCloseoutUser(Guid companyId)
        {
            CompanyId = companyId;
        }

        public bool IsAuthenticated => true;
        public Guid? UserId => Guid.Empty;
        public string? Email => "system-worker@hrms.internal";
        public string? Role => "Super Admin";
        public Guid? EmployeeId => null;
        public Guid? CompanyId { get; }
        public bool IsInRole(string role) => true;
    }
}
