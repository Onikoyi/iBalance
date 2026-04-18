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
        TotalAmount = 0m;
        TaxAdditionAmount = 0m;
        TaxDeductionAmount = 0m;
        GrossAmount = 0m;
        NetReceivableAmount = 0m;
        AmountPaid = 0m;
        BalanceAmount = 0m;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid CustomerId { get; private set; }

    public DateTime InvoiceDateUtc { get; private set; }

    public string InvoiceNumber { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public SalesInvoiceStatus Status { get; private set; }

    /// <summary>
    /// Base invoice amount before VAT/WHT/Other tax adjustments.
    /// </summary>
    public decimal TotalAmount { get; private set; }

    public decimal TaxAdditionAmount { get; private set; }

    public decimal TaxDeductionAmount { get; private set; }

    public decimal GrossAmount { get; private set; }

    public decimal NetReceivableAmount { get; private set; }

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
        RecalculateTotals(TaxAdditionAmount, TaxDeductionAmount);
    }

    public void RecalculateTotals(decimal taxAdditionAmount, decimal taxDeductionAmount)
    {
        if (taxAdditionAmount < 0m)
        {
            throw new ArgumentException("Tax addition amount cannot be negative.", nameof(taxAdditionAmount));
        }

        if (taxDeductionAmount < 0m)
        {
            throw new ArgumentException("Tax deduction amount cannot be negative.", nameof(taxDeductionAmount));
        }

        TotalAmount = Lines.Sum(x => x.LineTotal);
        TaxAdditionAmount = taxAdditionAmount;
        TaxDeductionAmount = taxDeductionAmount;
        GrossAmount = TotalAmount + TaxAdditionAmount;
        NetReceivableAmount = GrossAmount - TaxDeductionAmount;
        BalanceAmount = NetReceivableAmount - AmountPaid;

        if (NetReceivableAmount < 0m)
        {
            throw new InvalidOperationException("Sales invoice net receivable amount cannot be negative.");
        }

        if (BalanceAmount < 0m)
        {
            throw new InvalidOperationException("Sales invoice balance cannot be negative.");
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

        if (NetReceivableAmount <= 0m)
        {
            throw new InvalidOperationException("Only invoices with a positive net receivable amount can be posted.");
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = BalanceAmount == 0m
            ? SalesInvoiceStatus.Paid
            : SalesInvoiceStatus.Posted;

        Touch();
    }

    public void ApplyPayment(decimal amount)
    {
        if (Status != SalesInvoiceStatus.Posted && Status != SalesInvoiceStatus.PartPaid)
        {
            throw new InvalidOperationException("Payments can only be applied to posted invoices.");
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Payment amount must be greater than zero.", nameof(amount));
        }

        if (amount > BalanceAmount)
        {
            throw new InvalidOperationException("Payment amount cannot exceed the outstanding invoice balance.");
        }

        AmountPaid += amount;
        BalanceAmount = NetReceivableAmount - AmountPaid;

        if (BalanceAmount < 0m)
        {
            throw new InvalidOperationException("Sales invoice balance cannot be negative.");
        }

        if (BalanceAmount == 0m)
        {
            Status = SalesInvoiceStatus.Paid;
        }
        else if (AmountPaid > 0m)
        {
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