namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingCreditNote
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BillingInvoiceId { get; set; }
    public string CreditNoteNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int Status { get; set; } = 0;
    public string? ApprovalComment { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
}
