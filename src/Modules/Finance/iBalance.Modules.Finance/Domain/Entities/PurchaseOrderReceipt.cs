namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseOrderReceipt
{
    private readonly List<PurchaseOrderReceiptLine> _lines = new();

    private PurchaseOrderReceipt()
    {
    }

    public PurchaseOrderReceipt(
        Guid id,
        Guid tenantId,
        string receiptNumber,
        Guid purchaseOrderId,
        Guid? warehouseId,
        DateTime receiptDateUtc,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        ReceiptNumber = receiptNumber.Trim().ToUpperInvariant();
        PurchaseOrderId = purchaseOrderId;
        WarehouseId = warehouseId;
        ReceiptDateUtc = receiptDateUtc;
        Notes = notes?.Trim();
        Status = 4; // Posted / Confirmed
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string ReceiptNumber { get; private set; } = string.Empty;
    public Guid PurchaseOrderId { get; private set; }
    public Guid? WarehouseId { get; private set; }
    public DateTime ReceiptDateUtc { get; private set; }
    public int Status { get; private set; }
    public string? Notes { get; private set; }
    public Guid? InventoryTransactionId { get; private set; }
    public Guid? JournalEntryId { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }

    public IReadOnlyCollection<PurchaseOrderReceiptLine> Lines => _lines;

    public void AddLine(PurchaseOrderReceiptLine line)
    {
        _lines.Add(line);
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void LinkInventoryTransaction(Guid inventoryTransactionId)
    {
        InventoryTransactionId = inventoryTransactionId;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void LinkJournal(Guid journalEntryId)
    {
        JournalEntryId = journalEntryId;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
