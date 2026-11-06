using System.Net;
using System.Net.Mail;
using Hrms.Application.Abstractions.Notifications;
using Hrms.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hrms.Infrastructure.Notifications;

/// <summary>
/// SMTP email sender. When SMTP is not configured (typical in development) the message is
/// logged as skipped and reported as <see cref="EmailResult.Skipped"/> so the invitation is
/// still recorded and can be resent — no mail server is required to complete onboarding.
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly EmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<EmailResult> SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        if (!_options.IsConfigured)
        {
            _logger.LogInformation(
                "Email delivery is disabled; message for {Recipient} was recorded but not sent.",
                Mask(message.To));
            return EmailResult.Skipped();
        }

        try
        {
            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.UseSsl,
            };

            if (!string.IsNullOrWhiteSpace(_options.UserName))
            {
                client.Credentials = new NetworkCredential(_options.UserName, _options.Password);
            }

            using var mail = new MailMessage
            {
                From = new MailAddress(_options.FromAddress, _options.FromName),
                Subject = message.Subject,
                Body = message.HtmlBody,
                IsBodyHtml = true,
            };
            mail.To.Add(message.To);

            await client.SendMailAsync(mail, ct);
            return EmailResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send email to {Recipient}.", Mask(message.To));
            return EmailResult.Failed(ex.Message);
        }
    }

    private static string Mask(string email)
    {
        var at = email.IndexOf('@');
        return at <= 1 ? "***" : $"{email[0]}***{email[at..]}";
    }
}
