namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseRequisition
{
    private readonly List<PurchaseRequisitionLine> _lines = new();

    private PurchaseRequisition()
    {
    }

    public PurchaseRequisition(
        Guid id,
        Guid tenantId,
        string requisitionNumber,
        DateTime requestDateUtc,
        string requestedByName,
        string? department,
        DateTime? neededByUtc,
        string purpose,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        RequisitionNumber = requisitionNumber.Trim().ToUpperInvariant();
        RequestDateUtc = requestDateUtc;
        RequestedByName = requestedByName.Trim();
        Department = department?.Trim();
        NeededByUtc = neededByUtc;
        Purpose = purpose.Trim();
        Notes = notes?.Trim();
        Status = 1;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string RequisitionNumber { get; private set; } = string.Empty;
    public DateTime RequestDateUtc { get; private set; }
    public string RequestedByName { get; private set; } = string.Empty;
    public string? Department { get; private set; }
    public DateTime? NeededByUtc { get; private set; }
    public string Purpose { get; private set; } = string.Empty;
    public int Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }

    public IReadOnlyCollection<PurchaseRequisitionLine> Lines => _lines;

    public void ReplaceEditableDetails(
        DateTime requestDateUtc,
        string requestedByName,
        string? department,
        DateTime? neededByUtc,
        string purpose,
        string? notes,
        IEnumerable<PurchaseRequisitionLine> lines)
    {
        RequestDateUtc = requestDateUtc;
        RequestedByName = requestedByName.Trim();
        Department = department?.Trim();
        NeededByUtc = neededByUtc;
        Purpose = purpose.Trim();
        Notes = notes?.Trim();
        _lines.Clear();
        _lines.AddRange(lines);
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void MarkSubmitted()
    {
        Status = 2;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void MarkApproved()
    {
        Status = 3;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void MarkRejected()
    {
        Status = 7;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void MarkCancelled()
    {
        Status = 8;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void ResetToDraft()
    {
        Status = 1;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
