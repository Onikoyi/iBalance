namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingInvoiceLine
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BillingInvoiceId { get; set; }
    public int LineNumber { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; } = 1m;
    public decimal UnitPrice { get; set; }
    public decimal TaxRate { get; set; }
    public decimal LineSubtotal { get; set; }
    public decimal LineTax { get; set; }
    public decimal LineTotal { get; set; }
    public Guid? RevenueAccountId { get; set; }
}
