using System.ComponentModel.DataAnnotations;

namespace Hrms.Application.DTOs;

// CompanyCode is optional: blank logs into the default company.
public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    string? CompanyCode = null);

public sealed record LoginResponse(string AccessToken, DateTime ExpiresAtUtc, UserDto User);

public sealed record UserDto(
    Guid Id,
    string FullName,
    string Email,
    string Initials,
    string Role,
    string RoleCode,
    Guid? EmployeeId,
    Guid? CompanyId = null,
    string? CompanyName = null,
    string? CompanyCode = null,
    string? CompanyLogoUrl = null);

public sealed record TenantBrandingDto(
    string CompanyName,
    string CompanyCode,
    string? LogoUrl);

public sealed record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword);

public sealed record UpdateProfileRequest(
    [Required, MaxLength(100)] string FullName);

public sealed record ActivateAccountRequest(
    [Required] string Token,
    [Required, MinLength(8)] string NewPassword);

public sealed record ActivationInfoResponse(
    bool Valid,
    string? CompanyName,
    string? CompanyCode,
    string? AdminEmail,
    string? Reason);
