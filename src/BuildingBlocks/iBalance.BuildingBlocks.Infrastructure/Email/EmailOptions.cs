namespace iBalance.BuildingBlocks.Infrastructure.Email;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public bool Enabled { get; set; } = false;

    public string Provider { get; set; } = "Resend";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.resend.com";

    public string FromAddress { get; set; } = string.Empty;
    public string FromDisplayName { get; set; } = "iBalance";

    public string ReplyToAddress { get; set; } = string.Empty;
    public string ReplyToDisplayName { get; set; } = "iBalance Support";
}