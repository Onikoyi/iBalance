namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingPolicy
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string InvoicePrefix { get; set; } = "INV";
    public int NextInvoiceNumber { get; set; } = 1;
    public string CurrencyCode { get; set; } = "NGN";
    public Guid? ReceivableControlAccountId { get; set; }
    public Guid? DefaultRevenueAccountId { get; set; }
    public Guid? TaxLiabilityAccountId { get; set; }
    public Guid? DiscountAccountId { get; set; }
    public Guid? WriteOffAccountId { get; set; }
    public bool RequireApprovalBeforePosting { get; set; } = true;
    public bool EnableMakerChecker { get; set; } = true;
    public bool AutoPostApprovedInvoices { get; set; } = false;
    public decimal DefaultTaxRate { get; set; } = 0m;
    public int DefaultDueDays { get; set; } = 30;
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? UpdatedByUserId { get; set; }
}
