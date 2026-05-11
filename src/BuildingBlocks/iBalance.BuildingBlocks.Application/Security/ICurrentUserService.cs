namespace iBalance.BuildingBlocks.Application.Security;

public interface ICurrentUserService
{
    string? UserId { get; }
    string? UserName { get; }
    string? Email { get; }
    string? Role { get; }
    string? TenantId { get; }
    string? TenantKey { get; }
    bool IsAuthenticated { get; }

    IReadOnlyCollection<string> Roles { get; }
    IReadOnlyCollection<string> Permissions { get; }
    IReadOnlyCollection<CurrentUserScope> Scopes { get; }

    bool IsInRole(string role);
    bool HasAnyRole(params string[] roles);
    bool HasPermission(string permission);
    bool HasScope(string scopeType, string scopeEntityId);
}