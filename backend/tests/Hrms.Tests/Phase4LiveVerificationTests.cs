using System.Security.Claims;
using Hrms.Api.Middleware;
using Hrms.Api.Security;
using Hrms.Application.Abstractions.Persistence;
using Hrms.Application.Abstractions.Security;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Application.Common;
using Hrms.Application.DTOs;
using Hrms.Application.Services;
using Hrms.Domain.Entities;
using Hrms.Domain.Enums;
using Hrms.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Hrms.Tests;

public sealed class Phase4LiveVerificationTests
{
    private sealed class FakeTenantResolver : ITenantResolutionService
    {
        private readonly ResolvedTenant? _tenant;
        public FakeTenantResolver(ResolvedTenant? tenant) => _tenant = tenant;

        public Task<ResolvedTenant?> ResolveByIdAsync(Guid companyId, CancellationToken ct = default) => Task.FromResult(_tenant);
        public Task<ResolvedTenant?> ResolveByCodeAsync(string companyCode, CancellationToken ct = default) => Task.FromResult(_tenant);
        public Task<ResolvedTenant?> ResolveDefaultAsync(CancellationToken ct = default) => Task.FromResult(_tenant);
        public Task<ResolvedTenant?> ResolveByEmailAsync(string email, CancellationToken ct = default) => Task.FromResult(_tenant);
        public void InvalidateCache(Guid companyId, string code) { }
    }

    [Fact]
    public async Task NonAdmin_LogoUpload_Returns403Forbidden_FromPermissionFilter()
    {
        // Setup in-memory DbContext with employee role lacking IsEdit on COMP module
        var options = new DbContextOptionsBuilder<HrmsDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new HrmsDbContext(options);

        var employeeRole = new Role { Code = "Employee", Name = "Employee", IsSystem = true };
        db.Roles.Add(employeeRole);

        var compModule = new NavigationItem
        {
            Code = "COMP",
            Title = "Company",
            Route = "/company",
            IsActive = true
        };
        db.NavigationItems.Add(compModule);

        // Employee role only has IsView = true, IsEdit = false
        db.RoleNavigations.Add(new RoleNavigation
        {
            RoleId = employeeRole.Id,
            NavigationItemId = compModule.Id,
            IsView = true,
            IsCreate = false,
            IsEdit = false,
            IsDelete = false
        });

        await db.SaveChangesAsync();

        var uow = new UnitOfWork(db);

        // Create HttpContext authenticated as Employee
        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.Role, "Employee"),
            new Claim("roleCode", "Employee"),
            new Claim("email", "employee@test.com"),
            new Claim("sub", Guid.NewGuid().ToString())
        };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
        httpContext.Request.Path = "/api/organization/company/logo";
        httpContext.Request.Method = "POST";

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var filterContext = new ActionExecutingContext(actionContext, new List<IFilterMetadata>(), new Dictionary<string, object?>(), controller: new object());

        // Register UoW in request services so filter can resolve permissions
        var services = new ServiceCollection();
        services.AddScoped<IUnitOfWork>(_ => uow);
        httpContext.RequestServices = services.BuildServiceProvider();

        var filter = new PermissionAuthorizationFilter();
        var nextExecuted = false;

        await filter.OnActionExecutionAsync(filterContext, () =>
        {
            nextExecuted = true;
            return Task.FromResult<ActionExecutedContext>(null!);
        });

        // Verify request was blocked with 403 Forbidden
        Assert.False(nextExecuted);
        var objResult = Assert.IsType<ObjectResult>(filterContext.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task SuspendedCompany_LoginAttempt_ThrowsForbiddenException()
    {
        var suspendedCompanyId = Guid.NewGuid();
        var suspendedTenant = new ResolvedTenant(
            suspendedCompanyId,
            "SUSP",
            "Suspended Corp",
            "hrms_t_susp",
            CompanyStatus.Suspended,
            false,
            null);

        var resolver = new FakeTenantResolver(suspendedTenant);
        var tenantDb = new FakeTenantDatabaseService();
        var tokenService = new FakeJwtTokenService();
        var hasher = new FakePasswordHasher();

        var authService = new AuthService(
            uow: null!,
            tenantDb: tenantDb,
            tenants: resolver,
            tenantContext: new StubTenantContext(),
            passwordHasher: hasher,
            tokenService: tokenService);

        // Attempting to log into a suspended company
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            authService.LoginAsync(new LoginRequest("SUSP", "admin@susp.com", "Password123!")));

        Assert.Equal("This company has been suspended. Contact your administrator.", ex.Message);
    }

    [Fact]
    public async Task SuspendedCompany_Middleware_Returns403ForbiddenResponse()
    {
        var suspendedCompanyId = Guid.NewGuid();
        var suspendedTenant = new ResolvedTenant(
            suspendedCompanyId,
            "SUSP",
            "Suspended Corp",
            "hrms_t_susp",
            CompanyStatus.Suspended,
            false,
            null);

        var resolver = new FakeTenantResolver(suspendedTenant);
        var tenantContext = new StubTenantContext();

        var nextCalled = false;
        RequestDelegate next = _ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        };

        var middleware = new TenantResolutionMiddleware(next);

        var context = new DefaultHttpContext();
        var claims = new[] { new Claim("companyId", suspendedCompanyId.ToString()) };
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"));
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context, resolver, tenantContext);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
    }
}
