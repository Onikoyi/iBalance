using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseInvoice : TenantOwnedEntity
{
    private PurchaseInvoice()
    {
    }

    public PurchaseInvoice(
        Guid id,
        Guid tenantId,
        Guid vendorId,
        DateTime invoiceDateUtc,
        string invoiceNumber,
        string description)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (vendorId == Guid.Empty)
        {
            throw new ArgumentException("Vendor id is required.", nameof(vendorId));
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
        AssignTenant(tenantId);
        VendorId = vendorId;
        InvoiceDateUtc = invoiceDateUtc;
        InvoiceNumber = invoiceNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Status = PurchaseInvoiceStatus.Draft;
        TotalAmount = 0m;
        TaxAdditionAmount = 0m;
        TaxDeductionAmount = 0m;
        GrossAmount = 0m;
        NetPayableAmount = 0m;
        AmountPaid = 0m;
        BalanceAmount = 0m;
    }

    public Guid Id { get; private set; }

    public Guid VendorId { get; private set; }

    public Vendor? Vendor { get; private set; }

    public DateTime InvoiceDateUtc { get; private set; }

    public string InvoiceNumber { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public PurchaseInvoiceStatus Status { get; private set; }

    /// <summary>
    /// Base invoice amount before VAT/WHT/Other tax adjustments.
    /// </summary>
    public decimal TotalAmount { get; private set; }

    public decimal TaxAdditionAmount { get; private set; }

    public decimal TaxDeductionAmount { get; private set; }

    public decimal GrossAmount { get; private set; }

    public decimal NetPayableAmount { get; private set; }

    public decimal AmountPaid { get; private set; }

    public decimal BalanceAmount { get; private set; }

    public Guid? JournalEntryId { get; private set; }

    public DateTime? PostedOnUtc { get; private set; }

    public string? SubmittedBy { get; private set; }

    public DateTime? SubmittedOnUtc { get; private set; }

    public string? ApprovedBy { get; private set; }

    public DateTime? ApprovedOnUtc { get; private set; }

    public string? RejectedBy { get; private set; }

    public DateTime? RejectedOnUtc { get; private set; }

    public string? RejectionReason { get; private set; }

    public ICollection<PurchaseInvoiceLine> Lines { get; } = new List<PurchaseInvoiceLine>();

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        SetCreated(createdBy);
        SetModified(lastModifiedBy);
    }

    public void CorrectRejectedInvoice(
    Guid vendorId,
    DateTime invoiceDateUtc,
    string invoiceNumber,
    string description,
    string? modifiedBy)
{
    if (Status != PurchaseInvoiceStatus.Rejected)
    {
        throw new InvalidOperationException("Only rejected purchase invoices can be corrected.");
    }

    if (JournalEntryId.HasValue || PostedOnUtc.HasValue)
    {
        throw new InvalidOperationException("Posted purchase invoices cannot be corrected.");
    }

    if (vendorId == Guid.Empty)
    {
        throw new ArgumentException("Vendor is required.", nameof(vendorId));
    }

    if (string.IsNullOrWhiteSpace(invoiceNumber))
    {
        throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
    }

    if (string.IsNullOrWhiteSpace(description))
    {
        throw new ArgumentException("Invoice description is required.", nameof(description));
    }

    VendorId = vendorId;
    InvoiceDateUtc = invoiceDateUtc;
    InvoiceNumber = invoiceNumber.Trim().ToUpperInvariant();
    Description = description.Trim();

    SetModified(modifiedBy);
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
        NetPayableAmount = GrossAmount - TaxDeductionAmount;
        BalanceAmount = NetPayableAmount - AmountPaid;

        if (NetPayableAmount < 0m)
        {
            throw new InvalidOperationException("Purchase invoice net payable amount cannot be negative.");
        }

        if (BalanceAmount < 0m)
        {
            throw new InvalidOperationException("Purchase invoice balance cannot be negative.");
        }
    }


public void SubmitForApproval(string submittedBy)
{
    if (string.IsNullOrWhiteSpace(submittedBy))
    {
        throw new ArgumentException("Submitted by user is required.", nameof(submittedBy));
    }

    if (Status != PurchaseInvoiceStatus.Draft && Status != PurchaseInvoiceStatus.Rejected)
    {
        throw new InvalidOperationException("Only draft or rejected purchase invoices can be submitted for approval.");
    }

    if (NetPayableAmount <= 0m)
    {
        throw new InvalidOperationException("Only purchase invoices with a positive net payable amount can be submitted for approval.");
    }

    Status = PurchaseInvoiceStatus.SubmittedForApproval;
    SubmittedBy = submittedBy.Trim();
    SubmittedOnUtc = DateTime.UtcNow;

    RejectedBy = null;
    RejectedOnUtc = null;
    RejectionReason = null;
}

public void Approve(string approvedBy)
{
    if (string.IsNullOrWhiteSpace(approvedBy))
    {
        throw new ArgumentException("Approved by user is required.", nameof(approvedBy));
    }

    if (Status != PurchaseInvoiceStatus.SubmittedForApproval)
    {
        throw new InvalidOperationException("Only submitted purchase invoices can be approved.");
    }

    Status = PurchaseInvoiceStatus.Approved;
    ApprovedBy = approvedBy.Trim();
    ApprovedOnUtc = DateTime.UtcNow;
}

public void Reject(string rejectedBy, string reason)
{
    if (string.IsNullOrWhiteSpace(rejectedBy))
    {
        throw new ArgumentException("Rejected by user is required.", nameof(rejectedBy));
    }

    if (string.IsNullOrWhiteSpace(reason))
    {
        throw new ArgumentException("Rejection reason is required.", nameof(reason));
    }

    if (Status != PurchaseInvoiceStatus.SubmittedForApproval)
    {
        throw new InvalidOperationException("Only submitted purchase invoices can be rejected.");
    }

    Status = PurchaseInvoiceStatus.Rejected;
    RejectedBy = rejectedBy.Trim();
    RejectedOnUtc = DateTime.UtcNow;
    RejectionReason = reason.Trim();

    ApprovedBy = null;
    ApprovedOnUtc = null;
}


    public void MarkPosted(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        if (Status != PurchaseInvoiceStatus.Approved)
        {
            throw new InvalidOperationException("Only approved purchase invoices can be posted.");
        }

        if (NetPayableAmount <= 0m)
        {
            throw new InvalidOperationException("Only purchase invoices with a positive net payable amount can be posted.");
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = BalanceAmount == 0m
            ? PurchaseInvoiceStatus.Paid
            : PurchaseInvoiceStatus.Posted;
    }

    public void ApplyPayment(decimal amount)
    {
        if (amount <= 0m)
        {
            throw new ArgumentException("Payment amount must be greater than zero.", nameof(amount));
        }

        if (Status != PurchaseInvoiceStatus.Posted && Status != PurchaseInvoiceStatus.PartPaid)
        {
            throw new InvalidOperationException("Only posted or part-paid purchase invoices can receive payments.");
        }

        if (amount > BalanceAmount)
        {
            throw new InvalidOperationException("Payment amount cannot exceed the outstanding invoice balance.");
        }

        AmountPaid += amount;
        BalanceAmount = NetPayableAmount - AmountPaid;

        if (BalanceAmount < 0m)
        {
            throw new InvalidOperationException("Purchase invoice balance cannot be negative.");
        }

        if (BalanceAmount == 0m)
        {
            Status = PurchaseInvoiceStatus.Paid;
        }
        else if (AmountPaid > 0m)
        {
            Status = PurchaseInvoiceStatus.PartPaid;
        }
    }
}