namespace iBalance.BuildingBlocks.Infrastructure.Email;

public interface IEmailSender
{
    Task SendAsync(
        string toAddress,
        string toDisplayName,
        string subject,
        string htmlBody,
        string? textBody,
        CancellationToken cancellationToken = default);
}