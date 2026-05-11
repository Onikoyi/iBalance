using System.Security.Claims;
using iBalance.BuildingBlocks.Application.Security;
using Microsoft.AspNetCore.Http;

namespace iBalance.BuildingBlocks.Infrastructure.Security;

public sealed class CurrentUserService : ICurrentUserService
{
    private const string AssignedRoleClaimType = "assigned_role";
    private const string PermissionClaimType = "permission";
    private const string ScopeClaimType = "scope";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public string? UserId =>
        User?.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User?.FindFirstValue("sub");

    public string? UserName =>
        User?.FindFirstValue(ClaimTypes.Email) ??
        User?.FindFirstValue(ClaimTypes.Name) ??
        User?.Identity?.Name;

    public string? Email =>
        User?.FindFirstValue(ClaimTypes.Email);

    public string? Role =>
        User?.FindFirstValue(ClaimTypes.Role);

    public string? TenantId =>
        User?.FindFirstValue("tenant_id");

    public string? TenantKey =>
        User?.FindFirstValue("tenant_key");

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public IReadOnlyCollection<string> Roles =>
        User is null
            ? Array.Empty<string>()
            : User.Claims
                .Where(x =>
                    x.Type == ClaimTypes.Role ||
                    x.Type == AssignedRoleClaimType)
                .Select(x => x.Value?.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Cast<string>()
                .ToArray();

    public IReadOnlyCollection<string> Permissions =>
        User is null
            ? Array.Empty<string>()
            : User.Claims
                .Where(x => x.Type == PermissionClaimType)
                .Select(x => x.Value?.Trim().ToLowerInvariant())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Cast<string>()
                .ToArray();

    public IReadOnlyCollection<CurrentUserScope> Scopes =>
        User is null
            ? Array.Empty<CurrentUserScope>()
            : User.Claims
                .Where(x => x.Type == ScopeClaimType)
                .Select(ParseScopeClaim)
                .Where(x => x is not null)
                .Cast<CurrentUserScope>()
                .ToArray();

    public bool IsInRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        return Roles.Any(x => string.Equals(x, role.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public bool HasAnyRole(params string[] roles)
    {
        if (roles is null || roles.Length == 0)
        {
            return false;
        }

        return roles.Any(IsInRole);
    }

    public bool HasPermission(string permission)
    {
        if (string.IsNullOrWhiteSpace(permission))
        {
            return false;
        }

        return Permissions.Contains(permission.Trim().ToLowerInvariant(), StringComparer.OrdinalIgnoreCase);
    }

    public bool HasScope(string scopeType, string scopeEntityId)
    {
        if (string.IsNullOrWhiteSpace(scopeType) || string.IsNullOrWhiteSpace(scopeEntityId))
        {
            return false;
        }

        return Scopes.Any(x =>
            string.Equals(x.ScopeType, scopeType.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(x.ScopeEntityId, scopeEntityId.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private static CurrentUserScope? ParseScopeClaim(Claim claim)
    {
        if (string.IsNullOrWhiteSpace(claim.Value))
        {
            return null;
        }

        var parts = claim.Value.Split('|');
        if (parts.Length < 2)
        {
            return null;
        }

        var scopeType = parts[0]?.Trim();
        var scopeEntityId = parts[1]?.Trim();
        var scopeCode = parts.Length > 2 && !string.IsNullOrWhiteSpace(parts[2]) ? parts[2].Trim() : null;
        var scopeName = parts.Length > 3 && !string.IsNullOrWhiteSpace(parts[3]) ? parts[3].Trim() : null;

        if (string.IsNullOrWhiteSpace(scopeType) || string.IsNullOrWhiteSpace(scopeEntityId))
        {
            return null;
        }

        return new CurrentUserScope(scopeType, scopeEntityId, scopeCode, scopeName);
    }
}