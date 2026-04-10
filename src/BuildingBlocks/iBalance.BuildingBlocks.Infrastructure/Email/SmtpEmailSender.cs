using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace iBalance.BuildingBlocks.Infrastructure.Email;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly EmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(
        IOptions<EmailOptions> options,
        ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(
        string toAddress,
        string toDisplayName,
        string subject,
        string htmlBody,
        string? textBody,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(toAddress);
        ArgumentException.ThrowIfNullOrWhiteSpace(subject);
        ArgumentException.ThrowIfNullOrWhiteSpace(htmlBody);

        if (!_options.Enabled)
        {
            _logger.LogInformation(
                "Email delivery is disabled. Skipping outbound message to {ToAddress} with subject {Subject}.",
                toAddress,
                subject);

            return;
        }

        if (string.IsNullOrWhiteSpace(_options.SmtpHost))
        {
            throw new InvalidOperationException("Email SMTP host is not configured.");
        }

        if (string.IsNullOrWhiteSpace(_options.FromAddress))
        {
            throw new InvalidOperationException("Email from-address is not configured.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_options.FromAddress, _options.FromDisplayName),
            Subject = subject.Trim(),
            Body = htmlBody,
            IsBodyHtml = true
        };

        message.To.Add(new MailAddress(toAddress.Trim(), toDisplayName?.Trim()));

        if (!string.IsNullOrWhiteSpace(_options.ReplyToAddress))
        {
            message.ReplyToList.Add(
                new MailAddress(_options.ReplyToAddress, _options.ReplyToDisplayName));
        }

        if (!string.IsNullOrWhiteSpace(textBody))
        {
            message.AlternateViews.Add(
                AlternateView.CreateAlternateViewFromString(textBody, null, "text/plain"));
        }

        message.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(htmlBody, null, "text/html"));

        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            EnableSsl = _options.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = string.IsNullOrWhiteSpace(_options.SmtpUsername)
                ? CredentialCache.DefaultNetworkCredentials
                : new NetworkCredential(_options.SmtpUsername, _options.SmtpPassword)
        };

        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            await client.SendMailAsync(message, cancellationToken);

            _logger.LogInformation(
                "Outbound email sent successfully to {ToAddress} with subject {Subject}.",
                toAddress,
                subject);
        }
        catch (SmtpException ex)
        {
            _logger.LogError(
                ex,
                "Failed to send outbound email to {ToAddress} with subject {Subject}.",
                toAddress,
                subject);

            throw new InvalidOperationException(
                "The email could not be sent with the current SMTP configuration.",
                ex);
        }
    }
}