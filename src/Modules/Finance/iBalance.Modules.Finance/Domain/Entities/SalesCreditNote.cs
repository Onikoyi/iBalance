using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class SalesCreditNote
{
    private SalesCreditNote()
    {
    }

    public SalesCreditNote(
        Guid id,
        Guid tenantId,
        Guid customerId,
        Guid salesInvoiceId,
        DateTime creditNoteDateUtc,
        string creditNoteNumber,
        string description,
        decimal amount)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Sales credit note id is required.", nameof(id));
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

        if (string.IsNullOrWhiteSpace(creditNoteNumber))
        {
            throw new ArgumentException("Credit note number is required.", nameof(creditNoteNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Credit note description is required.", nameof(description));
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Credit note amount must be greater than zero.", nameof(amount));
        }

        Id = id;
        TenantId = tenantId;
        CustomerId = customerId;
        SalesInvoiceId = salesInvoiceId;
        CreditNoteDateUtc = creditNoteDateUtc;
        CreditNoteNumber = creditNoteNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Amount = amount;
        Status = SalesCreditNoteStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid CustomerId { get; private set; }

    public Guid SalesInvoiceId { get; private set; }

    public DateTime CreditNoteDateUtc { get; private set; }

    public string CreditNoteNumber { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public decimal Amount { get; private set; }

    public SalesCreditNoteStatus Status { get; private set; }

    public string? SubmittedBy { get; private set; }

    public DateTime? SubmittedOnUtc { get; private set; }

    public string? ApprovedBy { get; private set; }

    public DateTime? ApprovedOnUtc { get; private set; }

    public string? RejectedBy { get; private set; }

    public DateTime? RejectedOnUtc { get; private set; }

    public string? RejectionReason { get; private set; }

    public Guid? JournalEntryId { get; private set; }

    public DateTime? PostedOnUtc { get; private set; }

    public DateTime? CancelledOnUtc { get; private set; }

    public DateTime CreatedOnUtc { get; private set; }

    public string? CreatedBy { get; private set; }

    public DateTime? LastModifiedOnUtc { get; private set; }

    public string? LastModifiedBy { get; private set; }

    public Customer? Customer { get; private set; }

    public SalesInvoice? SalesInvoice { get; private set; }

    public void UpdateDraft(
        DateTime creditNoteDateUtc,
        string creditNoteNumber,
        string description,
        decimal amount)
    {
        EnsureEditable();

        if (string.IsNullOrWhiteSpace(creditNoteNumber))
        {
            throw new ArgumentException("Credit note number is required.", nameof(creditNoteNumber));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Credit note description is required.", nameof(description));
        }

        if (amount <= 0m)
        {
            throw new ArgumentException("Credit note amount must be greater than zero.", nameof(amount));
        }

        CreditNoteDateUtc = creditNoteDateUtc;
        CreditNoteNumber = creditNoteNumber.Trim().ToUpperInvariant();
        Description = description.Trim();
        Amount = amount;

        Touch();
    }

    public void SubmitForApproval(string submittedBy)
    {
        if (string.IsNullOrWhiteSpace(submittedBy))
        {
            throw new ArgumentException("Submitted by user is required.", nameof(submittedBy));
        }

        if (Status != SalesCreditNoteStatus.Draft && Status != SalesCreditNoteStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected credit notes can be submitted for approval.");
        }

        Status = SalesCreditNoteStatus.SubmittedForApproval;
        SubmittedBy = submittedBy.Trim();
        SubmittedOnUtc = DateTime.UtcNow;
        ApprovedBy = null;
        ApprovedOnUtc = null;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;

        Touch();
    }

    public void Approve(string approvedBy)
    {
        if (string.IsNullOrWhiteSpace(approvedBy))
        {
            throw new ArgumentException("Approved by user is required.", nameof(approvedBy));
        }

        if (Status != SalesCreditNoteStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted credit notes can be approved.");
        }

        Status = SalesCreditNoteStatus.Approved;
        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;

        Touch();
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

        if (Status != SalesCreditNoteStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted credit notes can be rejected.");
        }

        Status = SalesCreditNoteStatus.Rejected;
        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        ApprovedBy = null;
        ApprovedOnUtc = null;

        Touch();
    }

    public void MarkPosted(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        if (Status != SalesCreditNoteStatus.Approved)
        {
            throw new InvalidOperationException("Only approved credit notes can be posted.");
        }

        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
        Status = SalesCreditNoteStatus.Posted;

        Touch();
    }

    public void Cancel()
    {
        if (Status == SalesCreditNoteStatus.Cancelled)
        {
            return;
        }

        if (Status == SalesCreditNoteStatus.Posted)
        {
            throw new InvalidOperationException("A posted credit note cannot be cancelled.");
        }

        Status = SalesCreditNoteStatus.Cancelled;
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

    private void EnsureEditable()
    {
        if (Status != SalesCreditNoteStatus.Draft && Status != SalesCreditNoteStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected credit notes can be changed.");
        }
    }

    private void Touch()
    {
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
