using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class CustomerReceipt
{
    private CustomerReceipt()
    {
    }

    public CustomerReceipt(
        Guid id,
        Guid tenantId,
        Guid customerId,
        Guid salesInvoiceId,
        DateTime receiptDateUtc,
        string receiptNumber,
        string description,
        decimal amount)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Customer receipt id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (customerId == Guid.Empty)
        {
            throw new ArgumentException("Customer id is required.", nameof(customerId));
        }

        if (salesInvoiceId == Guid.Empty)
        {
            throw new ArgumentException("Sales invoice id is required.", nameof(salesInvoiceId));
        }

        if (string.IsNullOrWhiteSpace(receiptNumber))
        {
            throw new ArgumentException("Receipt number is required.", nameof(receiptNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Receipt description is required.", nameof(description));
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Receipt amount must be greater than zero.", nameof(amount));
        }

        Id = id;
        TenantId = tenantId;
        CustomerId = customerId;
        SalesInvoiceId = salesInvoiceId;
        ReceiptDateUtc = receiptDateUtc;
        ReceiptNumber = receiptNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Amount = amount;
        Status = CustomerReceiptStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }
    public Guid SalesInvoiceId { get; private set; }

    public DateTime ReceiptDateUtc { get; private set; }
    public string ReceiptNumber { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }

    public CustomerReceiptStatus Status { get; private set; }

    public Guid? JournalEntryId { get; private set; }
    public DateTime? PostedOnUtc { get; private set; }
    public DateTime? CancelledOnUtc { get; private set; }

    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public Customer? Customer { get; private set; }
    public SalesInvoice? SalesInvoice { get; private set; }

    public void UpdateHeader(
        DateTime receiptDateUtc,
        string receiptNumber,
        string description,
        decimal amount)
    {
        EnsureDraft();

        if (string.IsNullOrWhiteSpace(receiptNumber))
        {
            throw new ArgumentException("Receipt number is required.", nameof(receiptNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Receipt description is required.", nameof(description));
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Receipt amount must be greater than zero.", nameof(amount));
        }

        ReceiptDateUtc = receiptDateUtc;
        ReceiptNumber = receiptNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Amount = amount;

        Touch();
    }

    public void MarkPosted(Guid journalEntryId)
    {
        EnsureDraft();

        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = CustomerReceiptStatus.Posted;

        Touch();
    }

    public void Cancel()
    {
        if (Status == CustomerReceiptStatus.Cancelled)
        {
            return;
        }

        if (Status == CustomerReceiptStatus.Posted)
        {
            throw new InvalidOperationException("A posted customer receipt cannot be cancelled.");
        }

        Status = CustomerReceiptStatus.Cancelled;
        CancelledOnUtc = DateTime.UtcNow;

        Touch();
    }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        if (!string.IsNullOrWhiteSpace(createdBy) && string.IsNullOrWhiteSpace(CreatedBy))
        {
            CreatedBy = createdBy.Trim();
        }

        if (!string.IsNullOrWhiteSpace(lastModifiedBy))
        {
            LastModifiedBy = lastModifiedBy.Trim();
            LastModifiedOnUtc = DateTime.UtcNow;
        }
    }

    private void EnsureDraft()
    {
        if (Status != CustomerReceiptStatus.Draft)
        {
            throw new InvalidOperationException("Only draft receipts can be changed.");
        }
    }

    private void Touch()
    {
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}