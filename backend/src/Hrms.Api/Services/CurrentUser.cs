using System.Security.Claims;
using Hrms.Application.Abstractions.Security;
using Microsoft.AspNetCore.Http;

namespace Hrms.Api.Services;

/// <summary>Reads the authenticated principal from the current HTTP context.</summary>
public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public Guid? UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email);

    public string? Role => Principal?.FindFirstValue(ClaimTypes.Role);

    public Guid? EmployeeId =>
        Guid.TryParse(Principal?.FindFirstValue("employeeId"), out var id) ? id : null;

    public Guid? CompanyId =>
        Guid.TryParse(Principal?.FindFirstValue("companyId"), out var id) ? id : null;

    public bool IsInRole(string role) => Principal?.IsInRole(role) ?? false;
}
