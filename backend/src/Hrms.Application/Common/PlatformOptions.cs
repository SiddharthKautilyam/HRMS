namespace Hrms.Application.Common;

/// <summary>Platform-level settings bound from the "App" configuration section.</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>Base URL of the frontend, used to build account-activation links.</summary>
    public string FrontendBaseUrl { get; set; } = "http://localhost:4200";

    /// <summary>How long an invitation/activation link stays valid.</summary>
    public int InvitationExpiryHours { get; set; } = 72;
}

/// <summary>Tenant database settings bound from the "Tenancy" configuration section.</summary>
public sealed class TenancyOptions
{
    public const string SectionName = "Tenancy";

    /// <summary>
    /// Base connection string (no database) used to reach tenant databases at runtime.
    /// Falls back to <c>ConnectionStrings:DefaultConnection</c> when unset.
    /// </summary>
    public string? TenantConnectionBase { get; set; }

    /// <summary>
    /// Base connection string used to create tenant databases. Uses least-privilege,
    /// elevated credentials and falls back to the tenant base when unset.
    /// </summary>
    public string? ProvisioningConnectionBase { get; set; }
}

/// <summary>Email delivery settings bound from the "Email" configuration section.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public bool Enabled { get; set; }

    public string Host { get; set; } = string.Empty;

    public int Port { get; set; } = 587;

    public bool UseSsl { get; set; } = true;

    public string? UserName { get; set; }

    public string? Password { get; set; }

    public string FromAddress { get; set; } = "no-reply@hrnexus.com";

    public string FromName { get; set; } = "HR Nexus";

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(Host);
}
