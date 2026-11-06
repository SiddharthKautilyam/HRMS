using Hrms.Domain.Common;
using Hrms.Domain.Enums;

namespace Hrms.Domain.Entities;

/// <summary>
/// A tenant company registered in the master database. The <see cref="DatabaseName"/>
/// is the sanitized name of the dedicated database provisioned for this company; it is
/// generated server-side and never accepted from a client request.
/// </summary>
public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Human-facing tenant identifier (e.g. "ACME"), unique and used at login.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Sanitized physical database name for this tenant. Set once during provisioning.</summary>
    public string? DatabaseName { get; set; }

    /// <summary>True for the built-in default tenant backed by the primary connection string.</summary>
    public bool IsDefault { get; set; }

    public string? ContactName { get; set; }

    public string? ContactEmail { get; set; }

    public string AdminFullName { get; set; } = string.Empty;

    public string AdminEmail { get; set; } = string.Empty;

    public string? TimeZone { get; set; }
    public string? LogoUrl { get; set; }

    public CompanyStatus Status { get; set; } = CompanyStatus.Provisioning;

    public DateTime? ProvisionedAtUtc { get; set; }

    public DateTime? SuspendedAtUtc { get; set; }

    public string? LastProvisioningError { get; set; }

    public ICollection<CompanyInvitation> Invitations { get; set; } = new List<CompanyInvitation>();

    public ICollection<ProvisioningLog> ProvisioningLogs { get; set; } = new List<ProvisioningLog>();
}

/// <summary>
/// The account-activation invitation for a company admin. Only the SHA-256 hash of the
/// token is persisted; the raw token is emitted once (email or API response) and never stored.
/// </summary>
public class CompanyInvitation : BaseEntity
{
    public Guid CompanyId { get; set; }

    public Company? Company { get; set; }

    public string Email { get; set; } = string.Empty;

    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAtUtc { get; set; }

    public DateTime? SentAtUtc { get; set; }

    public DateTime? AcceptedAtUtc { get; set; }

    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;

    public string? LastError { get; set; }

    public int ResentCount { get; set; }
}

/// <summary>An auditable entry describing one provisioning step for a company.</summary>
public class ProvisioningLog : BaseEntity
{
    public Guid CompanyId { get; set; }

    public Company? Company { get; set; }

    public string Step { get; set; } = string.Empty;

    public bool Succeeded { get; set; }

    public string? Message { get; set; }

    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
}
