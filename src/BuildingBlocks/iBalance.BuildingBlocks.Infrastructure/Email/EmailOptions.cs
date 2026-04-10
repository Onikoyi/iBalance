namespace iBalance.BuildingBlocks.Infrastructure.Email;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string SmtpUsername { get; set; } = string.Empty;
    public string SmtpPassword { get; set; } = string.Empty;

    public string FromAddress { get; set; } = string.Empty;
    public string FromDisplayName { get; set; } = "iBalance";

    public string ReplyToAddress { get; set; } = string.Empty;
    public string ReplyToDisplayName { get; set; } = "iBalance Support";

    public bool Enabled { get; set; } = false;
}