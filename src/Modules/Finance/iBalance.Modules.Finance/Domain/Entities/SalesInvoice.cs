using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class SalesInvoice
{
    private SalesInvoice()
    {
    }

    public SalesInvoice(
        Guid id,
        Guid tenantId,
        Guid customerId,
        DateTime invoiceDateUtc,
        string invoiceNumber,
        string description)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Sales invoice id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (customerId == Guid.Empty)
        {
            throw new ArgumentException("Customer id is required.", nameof(customerId));
        }

        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Invoice description is required.", nameof(description));
        }

        Id = id;
        TenantId = tenantId;
        CustomerId = customerId;
        InvoiceDateUtc = invoiceDateUtc;
        InvoiceNumber = invoiceNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Status = SalesInvoiceStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid CustomerId { get; private set; }

    public DateTime InvoiceDateUtc { get; private set; }
    public string InvoiceNumber { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;

    public SalesInvoiceStatus Status { get; private set; }

    public decimal TotalAmount { get; private set; }
    public decimal AmountPaid { get; private set; }
    public decimal BalanceAmount { get; private set; }

    public Guid? JournalEntryId { get; private set; }
    public DateTime? PostedOnUtc { get; private set; }
    public DateTime? CancelledOnUtc { get; private set; }

    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public Customer? Customer { get; private set; }
    public ICollection<SalesInvoiceLine> Lines { get; private set; } = new List<SalesInvoiceLine>();

    public void UpdateHeader(
        DateTime invoiceDateUtc,
        string invoiceNumber,
        string description)
    {
        EnsureDraft();

        if (string.IsNullOrWhiteSpace(invoiceNumber))
        {
            throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Invoice description is required.", nameof(description));
        }

        InvoiceDateUtc = invoiceDateUtc;
        InvoiceNumber = invoiceNumber.Trim().ToUpperInvariant();
        Description = description.Trim();

        Touch();
    }

    public void RecalculateTotals()
    {
        TotalAmount = Lines.Sum(x => x.LineTotal);
        BalanceAmount = TotalAmount - AmountPaid;
        if (BalanceAmount < 0)
        {
            BalanceAmount = 0;
        }

        Touch();
    }

    public void MarkPosted(Guid journalEntryId)
    {
        EnsureDraft();

        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        if (TotalAmount <= 0)
        {
            throw new InvalidOperationException("Only invoices with a positive total can be posted.");
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = SalesInvoiceStatus.Posted;

        RecalculateTotals();
        Touch();
    }

    public void ApplyPayment(decimal amount)
    {
        if (Status != SalesInvoiceStatus.Posted && Status != SalesInvoiceStatus.PartPaid)
        {
            throw new InvalidOperationException("Payments can only be applied to posted invoices.");
        }

        if (amount <= 0)
        {
            throw new ArgumentException("Payment amount must be greater than zero.", nameof(amount));
        }

        AmountPaid += amount;

        if (AmountPaid >= TotalAmount)
        {
            AmountPaid = TotalAmount;
            BalanceAmount = 0;
            Status = SalesInvoiceStatus.Paid;
        }
        else
        {
            BalanceAmount = TotalAmount - AmountPaid;
            Status = SalesInvoiceStatus.PartPaid;
        }

        Touch();
    }

    public void Cancel()
    {
        if (Status == SalesInvoiceStatus.Cancelled)
        {
            return;
        }

        if (Status == SalesInvoiceStatus.Paid || Status == SalesInvoiceStatus.PartPaid)
        {
            throw new InvalidOperationException("A paid or part-paid invoice cannot be cancelled.");
        }

        Status = SalesInvoiceStatus.Cancelled;
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
        if (Status != SalesInvoiceStatus.Draft)
        {
            throw new InvalidOperationException("Only draft invoices can be changed.");
        }
    }

    private void Touch()
    {
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}