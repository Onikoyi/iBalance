using iBalance.BuildingBlocks.Application.Security;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.DesignTime;

internal sealed class DesignTimeCurrentUserService : ICurrentUserService
{
    public string? UserId => null;

    public string? UserName => "design-time-user";

    public string? Email => null;

    public string? Role => null;

    public string? TenantId => null;

    public string? TenantKey => null;

    public bool IsAuthenticated => false;

    public IReadOnlyCollection<string> Roles => Array.Empty<string>();

    public IReadOnlyCollection<string> Permissions => Array.Empty<string>();

    public IReadOnlyCollection<CurrentUserScope> Scopes => Array.Empty<CurrentUserScope>();

    public bool IsInRole(string role) => false;

    public bool HasAnyRole(params string[] roles) => false;

    public bool HasPermission(string permission) => false;

    public bool HasScope(string scopeType, string scopeEntityId) => false;
}