using iBalance.BuildingBlocks.Domain.Abstractions;

namespace iBalance.BuildingBlocks.Domain.Common;

public abstract class AuditableEntity : Entity
{
    public DateTime CreatedOnUtc { get; protected set; } = DateTime.UtcNow;
    public string? CreatedBy { get; protected set; }
    public DateTime? LastModifiedOnUtc { get; protected set; }
    public string? LastModifiedBy { get; protected set; }

    public void SetCreated(string? createdBy)
    {
        CreatedBy = createdBy;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public void SetModified(string? modifiedBy)
    {
        LastModifiedBy = modifiedBy;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}