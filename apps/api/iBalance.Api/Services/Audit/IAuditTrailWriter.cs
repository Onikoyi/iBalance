namespace iBalance.Api.Services.Audit;

public interface IAuditTrailWriter
{
    Task WriteAsync(
        string moduleCode,
        string entityName,
        string action,
        Guid? entityId = null,
        string? reference = null,
        string? description = null,
        string? actorIdentifier = null,
        Guid? tenantId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default);
}
