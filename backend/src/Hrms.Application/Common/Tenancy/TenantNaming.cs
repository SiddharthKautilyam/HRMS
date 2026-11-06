using System.Text.RegularExpressions;

namespace Hrms.Application.Common.Tenancy;

/// <summary>
/// Generates safe, unique tenant identifiers. Never accept a database name from a client —
/// always derive it here from the company name plus a collision-resistant suffix.
/// </summary>
public static partial class TenantNaming
{
    private const string DatabasePrefix = "hrms_t_";
    private const int MaxSlugLength = 32;
    private const int MaxCodeLength = 24;

    [GeneratedRegex("^[A-Za-z0-9_]{1,64}$")]
    private static partial Regex DatabaseNamePattern();

    [GeneratedRegex("^[A-Z0-9]{2,24}$")]
    private static partial Regex CodePattern();

    /// <summary>Returns true when a string is a valid, safe tenant database name.</summary>
    public static bool IsValidDatabaseName(string? databaseName) =>
        !string.IsNullOrWhiteSpace(databaseName) && DatabaseNamePattern().IsMatch(databaseName);

    /// <summary>Lower-cases and reduces a value to <c>[a-z0-9_]</c>, collapsing repeats.</summary>
    public static string Slugify(string value)
    {
        var lowered = (value ?? string.Empty).Trim().ToLowerInvariant();
        var chars = lowered.Select(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : '_').ToArray();
        var collapsed = Regex.Replace(new string(chars), "_+", "_").Trim('_');

        if (collapsed.Length > MaxSlugLength)
        {
            collapsed = collapsed[..MaxSlugLength].Trim('_');
        }

        return collapsed;
    }

    /// <summary>Uppercases a value into a tenant code of <c>[A-Z0-9]</c>.</summary>
    public static string SlugifyCode(string value)
    {
        var slug = Slugify(value).Replace("_", string.Empty).ToUpperInvariant();
        if (slug.Length == 0)
        {
            slug = "COMPANY";
        }

        return slug.Length > MaxCodeLength ? slug[..MaxCodeLength] : slug;
    }

    /// <summary>Builds a unique, sanitized database name for a company.</summary>
    public static string GenerateDatabaseName(string companyName, Guid companyId, Func<string, bool> isTaken)
    {
        var slug = Slugify(companyName);
        if (slug.Length == 0)
        {
            slug = "company";
        }

        var baseName = DatabasePrefix + slug;
        if (!isTaken(baseName))
        {
            return baseName;
        }

        var suffix = companyId.ToString("N")[..8];
        var withSuffix = $"{baseName}_{suffix}";
        if (!isTaken(withSuffix))
        {
            return withSuffix;
        }

        for (var i = 2; i < 1000; i++)
        {
            var candidate = $"{baseName}_{suffix}_{i}";
            if (!isTaken(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Could not generate a unique database name.");
    }

    /// <summary>Builds a unique company code from a name (or the supplied code).</summary>
    public static string GenerateCode(string? preferredCode, string companyName, Func<string, bool> isTaken)
    {
        var seed = string.IsNullOrWhiteSpace(preferredCode) ? companyName : preferredCode;
        var code = SlugifyCode(seed);
        if (!CodePattern().IsMatch(code))
        {
            code = SlugifyCode(companyName);
        }

        if (!isTaken(code))
        {
            return code;
        }

        for (var i = 2; i < 1000; i++)
        {
            var candidate = $"{code}{i}";
            if (CodePattern().IsMatch(candidate) && !isTaken(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Could not generate a unique company code.");
    }

    /// <summary>Creates a cryptographically random, URL-safe invitation token.</summary>
    public static string CreateToken() =>
        Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

    /// <summary>Hashes an invitation token for at-rest storage.</summary>
    public static string HashToken(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }
}
