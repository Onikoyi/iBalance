namespace iBalance.BuildingBlocks.Application.Security;

public sealed record CurrentUserScope(
    string ScopeType,
    string ScopeEntityId,
    string? ScopeCode,
    string? ScopeName);