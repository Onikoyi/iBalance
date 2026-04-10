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

    bool IsInRole(string role);
}