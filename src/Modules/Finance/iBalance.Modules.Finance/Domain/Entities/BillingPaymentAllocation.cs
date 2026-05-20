namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingPaymentAllocation
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BillingInvoiceId { get; set; }
    public string PaymentReference { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime PaymentDateUtc { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }
}
