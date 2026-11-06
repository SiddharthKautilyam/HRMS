using System.Security.Claims;
using Hrms.Application.Abstractions.Tenancy;
using Hrms.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Middleware;

/// <summary>
/// Establishes the tenant database for the current request from the validated
/// <c>companyId</c> claim. The database is never taken from the request body or headers —
/// the claim is resolved against the trusted master registry. Anonymous requests (login,
/// activation) resolve their own tenant inside the relevant service.
/// </summary>
public sealed class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(
        HttpContext context,
        ITenantResolutionService resolver,
        ITenantContext tenantContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var claim = context.User.FindFirstValue("companyId");

            var tenant = Guid.TryParse(claim, out var companyId)
                ? await resolver.ResolveByIdAsync(companyId, context.RequestAborted)
                : await resolver.ResolveDefaultAsync(context.RequestAborted);

            if (tenant is null)
            {
                await WriteProblemAsync(context, StatusCodes.Status401Unauthorized, "Your session is not linked to a valid company.");
                return;
            }

            if (tenant.Status == CompanyStatus.Suspended)
            {
                await WriteProblemAsync(context, StatusCodes.Status403Forbidden, "This company has been suspended.", "COMPANY_SUSPENDED");
                return;
            }

            tenantContext.Set(tenant);
        }
        else if (context.Request.Headers.TryGetValue("X-Company-Code", out var companyCodeHeader) && !string.IsNullOrWhiteSpace(companyCodeHeader))
        {
            var tenant = await resolver.ResolveByCodeAsync(companyCodeHeader.ToString(), context.RequestAborted);
            if (tenant is not null && tenant.Status != CompanyStatus.Suspended)
            {
                tenantContext.Set(tenant);
            }
        }

        await _next(context);
    }

    private static async Task WriteProblemAsync(HttpContext context, int status, string title, string? errorCode = null)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = $"https://httpstatuses.io/{status}",
            Instance = context.Request.Path,
        };
        if (!string.IsNullOrEmpty(errorCode))
        {
            problem.Extensions["errorCode"] = errorCode;
        }

        await context.Response.WriteAsJsonAsync(problem);
    }
}
