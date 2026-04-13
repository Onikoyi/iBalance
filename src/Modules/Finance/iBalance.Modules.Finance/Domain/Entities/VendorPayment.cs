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
        decimal amount,
        bool postingRequiresApproval = true)
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
        PostingRequiresApproval = postingRequiresApproval;
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

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        SetCreated(createdBy);
        SetModified(lastModifiedBy);
    }

    public void SubmitForApproval(string? submittedBy)
    {
        EnsureActiveForWorkflow();

        if (Status != VendorPaymentStatus.Draft && Status != VendorPaymentStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected vendor payments can be submitted for approval.");
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
        Status = VendorPaymentStatus.SubmittedForApproval;
    }

    public void Approve(string? approvedBy)
    {
        EnsureActiveForWorkflow();

        if (Status != VendorPaymentStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only vendor payments submitted for approval can be approved.");
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
        Status = VendorPaymentStatus.Approved;
    }

    public void Reject(string? rejectedBy, string rejectionReason)
    {
        EnsureActiveForWorkflow();

        if (Status != VendorPaymentStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only vendor payments submitted for approval can be rejected.");
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
        Status = VendorPaymentStatus.Rejected;
    }

    public void MarkPosted(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        }

        EnsureActiveForWorkflow();

        var postingReadyStatus = PostingRequiresApproval
            ? VendorPaymentStatus.Approved
            : VendorPaymentStatus.Draft;

        if (Status != postingReadyStatus)
        {
            throw new InvalidOperationException(
                PostingRequiresApproval
                    ? "Only approved vendor payments can be posted."
                    : "Only draft vendor payments can be posted.");
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

    private void EnsureActiveForWorkflow()
    {
        if (Status == VendorPaymentStatus.Cancelled)
        {
            throw new InvalidOperationException("Cancelled vendor payments cannot continue in workflow.");
        }

        if (Status == VendorPaymentStatus.Posted)
        {
            throw new InvalidOperationException("Posted vendor payments cannot continue in workflow.");
        }
    }
}