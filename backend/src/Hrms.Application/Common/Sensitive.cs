using System.Text.RegularExpressions;

namespace Hrms.Application.Common;

/// <summary>Helpers to keep credentials out of logs and stored error messages.</summary>
public static partial class Sensitive
{
    [GeneratedRegex("(?i)(password|pwd|user id|uid)\\s*=\\s*[^;]*")]
    private static partial Regex SecretPattern();

    /// <summary>Strips anything that looks like a credential from a message before it is stored or logged.</summary>
    public static string Redact(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        var redacted = SecretPattern().Replace(message, "$1=***");

        return redacted.Length > 1000 ? redacted[..1000] : redacted;
    }
}
