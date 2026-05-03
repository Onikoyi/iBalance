namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class UserScopeAssignment
{
    private UserScopeAssignment()
    {
    }

    public UserScopeAssignment(
        Guid id,
        Guid tenantId,
        Guid userAccountId,
        string scopeType,
        Guid scopeEntityId,
        string? scopeCode,
        string? scopeName)
    {
        Id = id;
        TenantId = tenantId;
        UserAccountId = userAccountId;
        ScopeType = scopeType.Trim().ToLowerInvariant();
        ScopeEntityId = scopeEntityId;
        ScopeCode = string.IsNullOrWhiteSpace(scopeCode) ? null : scopeCode.Trim();
        ScopeName = string.IsNullOrWhiteSpace(scopeName) ? null : scopeName.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid UserAccountId { get; private set; }
    public string ScopeType { get; private set; } = string.Empty;
    public Guid ScopeEntityId { get; private set; }
    public string? ScopeCode { get; private set; }
    public string? ScopeName { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}
