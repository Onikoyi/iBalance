using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseInvoiceLine : TenantOwnedEntity
{
    private PurchaseInvoiceLine()
    {
    }

    public PurchaseInvoiceLine(
        Guid id,
        Guid tenantId,
        Guid purchaseInvoiceId,
        string description,
        decimal quantity,
        decimal unitPrice)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice line id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (purchaseInvoiceId == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice id is required.", nameof(purchaseInvoiceId));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Line description is required.", nameof(description));
        }

        if (quantity <= 0m)
        {
            throw new ArgumentException("Quantity must be greater than zero.", nameof(quantity));
        }

        if (unitPrice < 0m)
        {
            throw new ArgumentException("Unit price cannot be negative.", nameof(unitPrice));
        }

        Id = id;
        AssignTenant(tenantId);
        PurchaseInvoiceId = purchaseInvoiceId;
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        LineTotal = quantity * unitPrice;
    }

    public Guid Id { get; private set; }

    public Guid PurchaseInvoiceId { get; private set; }

    public PurchaseInvoice? PurchaseInvoice { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public decimal Quantity { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal LineTotal { get; private set; }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        SetCreated(createdBy);
        SetModified(lastModifiedBy);
    }

    public void Update(
        string description,
        decimal quantity,
        decimal unitPrice)
        
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Line description is required.", nameof(description));
        }

        if (quantity <= 0m)
        {
            throw new ArgumentException("Quantity must be greater than zero.", nameof(quantity));
        }

        if (unitPrice < 0m)
        {
            throw new ArgumentException("Unit price cannot be negative.", nameof(unitPrice));
        }

        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        LineTotal = quantity * unitPrice;
    }
}