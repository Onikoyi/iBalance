namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingInvoice
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public DateTime InvoiceDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime DueDateUtc { get; set; } = DateTime.UtcNow.AddDays(30);
    public string CurrencyCode { get; set; } = "NGN";
    public int Status { get; set; } = 0;
    public decimal SubtotalAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public Guid? ReceivableControlAccountId { get; set; }
    public Guid? RevenueAccountId { get; set; }
    public Guid? TaxLiabilityAccountId { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }
    public string? CancelReason { get; set; }
    public Guid? PostedJournalEntryId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? UpdatedByUserId { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public string? RejectedByUserId { get; set; }
    public DateTime? PostedAtUtc { get; set; }
    public string? PostedByUserId { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public string? CancelledByUserId { get; set; }
}
