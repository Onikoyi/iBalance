using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class VendorPayment : TenantOwnedEntity
{
    private VendorPayment()
    {
    }

    public VendorPayment(
        Guid id,
        Guid tenantId,
        Guid vendorId,
        Guid purchaseInvoiceId,
        DateTime paymentDateUtc,
        string paymentNumber,
        string description,
        decimal amount)
        
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Vendor payment id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (vendorId == Guid.Empty)
        {
            throw new ArgumentException("Vendor id is required.", nameof(vendorId));
        }

        if (purchaseInvoiceId == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice id is required.", nameof(purchaseInvoiceId));
        }

        if (string.IsNullOrWhiteSpace(paymentNumber))
        {
            throw new ArgumentException("Payment number is required.", nameof(paymentNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Payment description is required.", nameof(description));
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Payment amount must be greater than zero.", nameof(amount));
        }

        Id = id;
        AssignTenant(tenantId);
        VendorId = vendorId;
        PurchaseInvoiceId = purchaseInvoiceId;
        PaymentDateUtc = paymentDateUtc;
        PaymentNumber = paymentNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Amount = amount;
        Status = VendorPaymentStatus.Draft;
    }

    public Guid Id { get; private set; }

    public Guid VendorId { get; private set; }

    public Vendor? Vendor { get; private set; }

    public Guid PurchaseInvoiceId { get; private set; }

    public PurchaseInvoice? PurchaseInvoice { get; private set; }

    public DateTime PaymentDateUtc { get; private set; }

    public string PaymentNumber { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    public VendorPaymentStatus Status { get; private set; }

    public Guid? JournalEntryId { get; private set; }

    public DateTime? PostedOnUtc { get; private set; }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        SetCreated(createdBy);
        SetModified(lastModifiedBy);
    }

    public void MarkPosted(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        if (Status != VendorPaymentStatus.Draft)
        {
            throw new InvalidOperationException("Only draft vendor payments can be posted.");
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = VendorPaymentStatus.Posted;
    }
    

    public void MarkCancelled()
    {
        if (Status == VendorPaymentStatus.Posted)
        {
            throw new InvalidOperationException("Posted vendor payments cannot be cancelled.");
        }

        Status = VendorPaymentStatus.Cancelled;
    }
}