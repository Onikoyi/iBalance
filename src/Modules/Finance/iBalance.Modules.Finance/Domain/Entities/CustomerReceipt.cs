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
        decimal amount,
        bool postingRequiresApproval = true)
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
        PostingRequiresApproval = postingRequiresApproval;
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
    public bool PostingRequiresApproval { get; private set; }

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

    public void UpdateHeader(
        DateTime receiptDateUtc,
        string receiptNumber,
        string description,
        decimal amount)
    {
        EnsureEditable();

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

    public void SubmitForApproval(string? submittedBy)
    {
        EnsureActiveForWorkflow();

        if (Status != CustomerReceiptStatus.Draft && Status != CustomerReceiptStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected customer receipts can be submitted for approval.");
        }

        if (string.IsNullOrWhiteSpace(submittedBy))
        {
            throw new InvalidOperationException("Submitted by user is required.");
        }

        SubmittedBy = submittedBy.Trim();
        SubmittedOnUtc = DateTime.UtcNow;
        ApprovedBy = null;
        ApprovedOnUtc = null;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = CustomerReceiptStatus.SubmittedForApproval;

        Touch();
    }

    public void Approve(string? approvedBy)
    {
        EnsureActiveForWorkflow();

        if (Status != CustomerReceiptStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only customer receipts submitted for approval can be approved.");
        }

        if (string.IsNullOrWhiteSpace(approvedBy))
        {
            throw new InvalidOperationException("Approved by user is required.");
        }

        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = CustomerReceiptStatus.Approved;

        Touch();
    }

    public void Reject(string? rejectedBy, string rejectionReason)
    {
        EnsureActiveForWorkflow();

        if (Status != CustomerReceiptStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only customer receipts submitted for approval can be rejected.");
        }

        if (string.IsNullOrWhiteSpace(rejectedBy))
        {
            throw new InvalidOperationException("Rejected by user is required.");
        }

        if (string.IsNullOrWhiteSpace(rejectionReason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(rejectionReason));
        }

        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = rejectionReason.Trim();
        ApprovedBy = null;
        ApprovedOnUtc = null;
        Status = CustomerReceiptStatus.Rejected;

        Touch();
    }

    public void MarkPosted(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        EnsureActiveForWorkflow();

        var postingReadyStatus = PostingRequiresApproval
            ? CustomerReceiptStatus.Approved
            : CustomerReceiptStatus.Draft;

        if (Status != postingReadyStatus)
        {
            throw new InvalidOperationException(
                PostingRequiresApproval
                    ? "Only approved customer receipts can be posted."
                    : "Only draft customer receipts can be posted.");
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

    private void EnsureEditable()
    {
        if (Status != CustomerReceiptStatus.Draft && Status != CustomerReceiptStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected receipts can be changed.");
        }
    }

    private void EnsureActiveForWorkflow()
    {
        if (Status == CustomerReceiptStatus.Cancelled)
        {
            throw new InvalidOperationException("Cancelled customer receipts cannot continue in workflow.");
        }

        if (Status == CustomerReceiptStatus.Posted)
        {
            throw new InvalidOperationException("Posted customer receipts cannot continue in workflow.");
        }
    }

    private void Touch()
    {
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}