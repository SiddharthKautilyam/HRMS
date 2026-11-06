using System.Security.Claims;
using Hrms.Api.Extensions;
using Hrms.Application.Abstractions.Services;
using Hrms.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hrms.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Tags("Authentication")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IAccountActivationService _activation;
    private readonly Hrms.Application.Abstractions.Tenancy.ITenantResolutionService _tenants;

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (int Count, DateTime WindowStart)> RateLimits = new();

    public AuthController(
        IAuthService auth,
        IAccountActivationService activation,
        Hrms.Application.Abstractions.Tenancy.ITenantResolutionService tenants)
    {
        _auth = auth;
        _activation = activation;
        _tenants = tenants;
    }

    /// <summary>Returns the public tenant branding for login screen resolution.</summary>
    [HttpGet("tenant-branding")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(TenantBrandingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<TenantBrandingDto>> TenantBranding(
        [FromQuery] string? code,
        [FromQuery] string? subdomain,
        CancellationToken ct)
    {
        // IP-based Rate Limiting (max 60 requests per minute per IP)
        // Uses RemoteIpAddress resolved by ASP.NET Core ForwardedHeaders middleware
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTime.UtcNow;
        var entry = RateLimits.AddOrUpdate(ip, (1, now), (_, old) =>
            now - old.WindowStart < TimeSpan.FromMinutes(1)
                ? (old.Count + 1, old.WindowStart)
                : (1, now));

        if (entry.Count > 60)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails
            {
                Status = 429,
                Title = "Rate limit exceeded. Please wait a moment."
            });
        }

        var lookup = !string.IsNullOrWhiteSpace(code) ? code.Trim() : (!string.IsNullOrWhiteSpace(subdomain) ? subdomain.Trim() : null);

        if (!string.IsNullOrWhiteSpace(lookup))
        {
            var resolved = await _tenants.ResolveByCodeAsync(lookup, ct);
            if (resolved != null && resolved.Status == Hrms.Domain.Enums.CompanyStatus.Active && !string.IsNullOrWhiteSpace(resolved.LogoUrl))
            {
                return Ok(new TenantBrandingDto(resolved.Name, resolved.Code, resolved.LogoUrl));
            }
        }

        // Identical response for unknown, suspended, and no-logo companies to prevent enumeration
        return Ok(new TenantBrandingDto("HR Nexus", "HRNEXUS", null));
    }

    /// <summary>Authenticates a user and returns a JWT access token.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken ct) =>
        Ok(await _auth.LoginAsync(request, ct));

    /// <summary>Returns the profile of the authenticated caller.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var userId = User.GetUserId();
        return userId is null ? Unauthorized() : Ok(await _auth.GetCurrentUserAsync(userId.Value, ct));
    }

    /// <summary>Changes the caller's password.</summary>
    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        await _auth.ChangePasswordAsync(userId.Value, request, ct);
        return NoContent();
    }

    /// <summary>Updates the caller's profile details.</summary>
    [HttpPut("profile")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> UpdateProfile(
        [FromBody] UpdateProfileRequest request,
        CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _auth.UpdateProfileAsync(userId.Value, request, ct));
    }

    /// <summary>Validates an activation token so the set-password screen can render.</summary>
    [HttpGet("activate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ActivationInfoResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ActivationInfoResponse>> ValidateActivation(
        [FromQuery] string token,
        CancellationToken ct) =>
        Ok(await _activation.ValidateAsync(token, ct));

    /// <summary>Sets the company admin password from an activation token and signs them in.</summary>
    [HttpPost("activate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LoginResponse>> Activate(
        [FromBody] ActivateAccountRequest request,
        CancellationToken ct) =>
        Ok(await _activation.ActivateAsync(request, ct));
}
