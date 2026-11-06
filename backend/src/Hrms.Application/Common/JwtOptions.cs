namespace Hrms.Application.Common;

/// <summary>JWT settings bound from the "Jwt" configuration section.</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "Hrms.Api";

    public string Audience { get; set; } = "Hrms.Client";

    /// <summary>Symmetric signing key. Override in production via configuration or secrets.</summary>
    public string Key { get; set; } = string.Empty;

    public int ExpiryMinutes { get; set; } = 480;
}
