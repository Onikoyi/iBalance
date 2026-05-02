namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseOrder
{
    private readonly List<PurchaseOrderLine> _lines = new();

    private PurchaseOrder()
    {
    }

    public PurchaseOrder(
        Guid id,
        Guid tenantId,
        string purchaseOrderNumber,
        Guid? purchaseRequisitionId,
        Guid vendorId,
        DateTime orderDateUtc,
        DateTime? expectedDeliveryUtc,
        string currencyCode,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PurchaseOrderNumber = purchaseOrderNumber.Trim().ToUpperInvariant();
        PurchaseRequisitionId = purchaseRequisitionId;
        VendorId = vendorId;
        OrderDateUtc = orderDateUtc;
        ExpectedDeliveryUtc = expectedDeliveryUtc;
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        Notes = notes?.Trim();
        Status = 1;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string PurchaseOrderNumber { get; private set; } = string.Empty;
    public Guid? PurchaseRequisitionId { get; private set; }
    public Guid VendorId { get; private set; }
    public DateTime OrderDateUtc { get; private set; }
    public DateTime? ExpectedDeliveryUtc { get; private set; }
    public string CurrencyCode { get; private set; } = "NGN";
    public int Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }

    public IReadOnlyCollection<PurchaseOrderLine> Lines => _lines;

    public void ReplaceEditableDetails(
        Guid vendorId,
        DateTime orderDateUtc,
        DateTime? expectedDeliveryUtc,
        string currencyCode,
        string? notes,
        IEnumerable<PurchaseOrderLine> lines)
    {
        VendorId = vendorId;
        OrderDateUtc = orderDateUtc;
        ExpectedDeliveryUtc = expectedDeliveryUtc;
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
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

    public void MarkIssued()
    {
        Status = 4;
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
