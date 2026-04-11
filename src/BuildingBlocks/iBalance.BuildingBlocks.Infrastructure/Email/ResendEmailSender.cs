using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace iBalance.BuildingBlocks.Infrastructure.Email;

public sealed class ResendEmailSender : IEmailSender
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private readonly EmailOptions _options;
    private readonly ILogger<ResendEmailSender> _logger;
    private readonly HttpClient _httpClient;

    public ResendEmailSender(
        HttpClient httpClient,
        IOptions<EmailOptions> options,
        ILogger<ResendEmailSender> logger)
    {
        _httpClient = httpClient;
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

        if (!string.Equals(_options.Provider, "Resend", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The configured email provider is not supported by ResendEmailSender.");
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new InvalidOperationException("Email API key is not configured.");
        }

        if (string.IsNullOrWhiteSpace(_options.FromAddress))
        {
            throw new InvalidOperationException("Email from-address is not configured.");
        }

        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            throw new InvalidOperationException("Email base URL is not configured.");
        }

        var from = string.IsNullOrWhiteSpace(_options.FromDisplayName)
            ? _options.FromAddress.Trim()
            : $"{_options.FromDisplayName.Trim()} <{_options.FromAddress.Trim()}>";

        var payload = new ResendSendEmailRequest(
            from,
            [toAddress.Trim()],
            subject.Trim(),
            htmlBody,
            textBody ?? string.Empty,
            string.IsNullOrWhiteSpace(_options.ReplyToAddress)
                ? null
                : [_options.ReplyToAddress.Trim()]);

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_options.BaseUrl.TrimEnd('/')}/emails");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey.Trim());
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation(
                "Outbound email sent successfully through Resend to {ToAddress} with subject {Subject}. Response: {ResponseBody}",
                toAddress,
                subject,
                responseBody);

            return;
        }

        _logger.LogError(
            "Failed to send outbound email through Resend to {ToAddress} with subject {Subject}. Status: {StatusCode}. Response: {ResponseBody}",
            toAddress,
            subject,
            (int)response.StatusCode,
            responseBody);

        throw new InvalidOperationException("The email could not be sent with the current Resend configuration.");
    }

    private sealed record ResendSendEmailRequest(
        string From,
        string[] To,
        string Subject,
        string Html,
        string Text,
        string[]? ReplyTo);
}