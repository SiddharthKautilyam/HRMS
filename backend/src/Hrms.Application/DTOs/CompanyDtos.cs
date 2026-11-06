using System.ComponentModel.DataAnnotations;

namespace Hrms.Application.DTOs;

/// <summary>Company summary for the Super Admin list (metadata only — no business data).</summary>
public sealed record CompanyListItemDto(
    Guid Id,
    string Name,
    string Code,
    string? DatabaseName,
    string Status,
    bool IsDefault,
    string AdminFullName,
    string AdminEmail,
    string? ContactName,
    string? ContactEmail,
    string? TimeZone,
    DateTime CreatedAtUtc,
    DateTime? ProvisionedAtUtc,
    string? ProvisioningError,
    string InvitationStatus,
    DateTime? InvitationSentAtUtc,
    string? InvitationError);

/// <summary>Company detail including provisioning logs and invitation metadata.</summary>
public sealed record CompanyDetailDto(
    Guid Id,
    string Name,
    string Code,
    string? DatabaseName,
    string Status,
    bool IsDefault,
    string AdminFullName,
    string AdminEmail,
    string? ContactName,
    string? ContactEmail,
    string? TimeZone,
    DateTime CreatedAtUtc,
    DateTime? ProvisionedAtUtc,
    DateTime? SuspendedAtUtc,
    string? ProvisioningError,
    string InvitationStatus,
    string? InvitationEmail,
    DateTime? InvitationSentAtUtc,
    DateTime? InvitationAcceptedAtUtc,
    string? InvitationError,
    IReadOnlyList<ProvisioningLogDto> ProvisioningLogs);

public sealed record ProvisioningLogDto(string Step, bool Succeeded, string? Message, DateTime OccurredAtUtc);

public sealed record CreateCompanyRequest(
    [Required, MaxLength(200)] string Name,
    [MaxLength(24)] string? Code,
    [Required, MaxLength(160)] string AdminFullName,
    [Required, EmailAddress, MaxLength(160)] string AdminEmail,
    [MaxLength(160)] string? ContactName,
    [EmailAddress, MaxLength(160)] string? ContactEmail,
    [MaxLength(64)] string? TimeZone);

public sealed record UpdateCompanyRequest(
    [MaxLength(200)] string? Name,
    [MaxLength(160)] string? AdminFullName,
    [MaxLength(160)] string? ContactName,
    [EmailAddress, MaxLength(160)] string? ContactEmail,
    [MaxLength(64)] string? TimeZone);

/// <summary>Result of a create/retry provisioning attempt.</summary>
public sealed record CompanyProvisioningResultDto(
    Guid CompanyId,
    string Status,
    string? DatabaseName,
    bool DatabaseReady,
    bool AdminCreated,
    string InvitationStatus,
    string? ActivationUrl,
    string? Error);

public sealed record ResendInvitationResponse(string InvitationStatus, string? ActivationUrl, string? Error);
