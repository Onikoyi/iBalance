using iBalance.BuildingBlocks.Application.Security;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.DesignTime;

public sealed class DesignTimeCurrentUserService : ICurrentUserService
{
    public string? UserId => "design-time-user";

    public string? UserName => "design-time-user";

    public string? Email => "design-time@local";

    public string? Role => "PlatformAdmin";

    public string? TenantId => null;

    public string? TenantKey => null;

    public bool IsAuthenticated => false;

    public bool IsInRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return string.Equals(Role, role.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}