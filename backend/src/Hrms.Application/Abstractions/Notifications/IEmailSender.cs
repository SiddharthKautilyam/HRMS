namespace Hrms.Application.Abstractions.Notifications;

public sealed record EmailMessage(string To, string Subject, string HtmlBody, string? TextBody = null);

/// <summary>Outcome of a send attempt. <see cref="Simulated"/> is true when delivery was skipped
/// (e.g. SMTP disabled in development) but the message was recorded.</summary>
public sealed record EmailResult(bool Delivered, bool Simulated, string? Error)
{
    public static EmailResult Success() => new(true, false, null);

    public static EmailResult Skipped() => new(false, true, null);

    public static EmailResult Failed(string error) => new(false, false, error);
}

public interface IEmailSender
{
    Task<EmailResult> SendAsync(EmailMessage message, CancellationToken ct = default);
}
