using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace iBalance.BuildingBlocks.Infrastructure.Email;

[Obsolete("SMTP delivery has been replaced by ResendEmailSender. Do not register SmtpEmailSender in dependency injection.")]
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly ILogger<SmtpEmailSender> _logger;
    private readonly EmailOptions _options;

    public SmtpEmailSender(
        IOptions<EmailOptions> options,
        ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task SendAsync(
        string toAddress,
        string toDisplayName,
        string subject,
        string htmlBody,
        string? textBody,
        CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "SmtpEmailSender was invoked for {ToAddress} with subject {Subject}, but SMTP is no longer the active email transport. Provider configured: {Provider}.",
            toAddress,
            subject,
            _options.Provider);

        throw new InvalidOperationException(
            "SMTP email delivery is no longer active in this application. Use ResendEmailSender through IEmailSender.");
    }
}