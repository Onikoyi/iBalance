using System.Text.Json;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class AuditEvent
{
    private AuditEvent()
    {
    }

    public AuditEvent(
        Guid id,
        Guid tenantId,
        string moduleCode,
        string entityName,
        string action,
        DateTime occurredOnUtc,
        Guid? entityId = null,
        string? reference = null,
        string? description = null,
        string? actorUserId = null,
        string? actorIdentifier = null,
        string? metadataJson = null)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(moduleCode)) throw new ArgumentException("Module code is required.", nameof(moduleCode));
        if (string.IsNullOrWhiteSpace(entityName)) throw new ArgumentException("Entity name is required.", nameof(entityName));
        if (string.IsNullOrWhiteSpace(action)) throw new ArgumentException("Action is required.", nameof(action));

        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        TenantId = tenantId;
        ModuleCode = moduleCode.Trim().ToLowerInvariant();
        EntityName = entityName.Trim();
        Action = action.Trim();
        OccurredOnUtc = occurredOnUtc;
        EntityId = entityId;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        ActorUserId = string.IsNullOrWhiteSpace(actorUserId) ? null : actorUserId.Trim();
        ActorIdentifier = string.IsNullOrWhiteSpace(actorIdentifier) ? null : actorIdentifier.Trim();
        MetadataJson = string.IsNullOrWhiteSpace(metadataJson) ? null : metadataJson.Trim();
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string ModuleCode { get; private set; } = string.Empty;
    public string EntityName { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string? Reference { get; private set; }
    public string? Description { get; private set; }
    public string? ActorUserId { get; private set; }
    public string? ActorIdentifier { get; private set; }
    public string? MetadataJson { get; private set; }
    public DateTime OccurredOnUtc { get; private set; }

    public T? ReadMetadata<T>()
    {
        if (string.IsNullOrWhiteSpace(MetadataJson)) return default;
        return JsonSerializer.Deserialize<T>(MetadataJson);
    }
}
