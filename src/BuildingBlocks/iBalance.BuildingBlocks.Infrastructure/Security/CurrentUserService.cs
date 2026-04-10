using System.Security.Claims;
using iBalance.BuildingBlocks.Application.Security;
using Microsoft.AspNetCore.Http;

namespace iBalance.BuildingBlocks.Infrastructure.Security;

public sealed class CurrentUserService : ICurrentUserService
{
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

    public bool IsInRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        var currentRole = Role;

        return
            !string.IsNullOrWhiteSpace(currentRole) &&
            string.Equals(currentRole, role.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}