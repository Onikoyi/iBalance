namespace iBalance.BuildingBlocks.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "iBalance";
    public string Audience { get; set; } = "iBalance.Web";
    public string SecretKey { get; set; } = "iBalance-Dev-Secret-Key-Change-In-Production-123456789";
    public int ExpiryMinutes { get; set; } = 480;
}