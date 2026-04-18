using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseInvoiceTaxLine
{
    private PurchaseInvoiceTaxLine()
    {
    }

    public PurchaseInvoiceTaxLine(
        Guid id,
        Guid purchaseInvoiceId,
        Guid taxCodeId,
        TaxComponentKind componentKind,
        TaxApplicationMode applicationMode,
        TaxTransactionScope transactionScope,
        decimal ratePercent,
        decimal taxableAmount,
        decimal taxAmount,
        Guid taxLedgerAccountId,
        string? description = null)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice tax line id cannot be empty.", nameof(id));
        }

        if (purchaseInvoiceId == Guid.Empty)
        {
            throw new ArgumentException("Purchase invoice id cannot be empty.", nameof(purchaseInvoiceId));
        }

        if (taxCodeId == Guid.Empty)
        {
            throw new ArgumentException("Tax code id cannot be empty.", nameof(taxCodeId));
        }

        if (ratePercent < 0m || ratePercent > 100m)
        {
            throw new ArgumentException("Tax rate must be between 0 and 100 percent.", nameof(ratePercent));
        }

        if (taxableAmount < 0m)
        {
            throw new ArgumentException("Taxable amount cannot be negative.", nameof(taxableAmount));
        }

        if (taxAmount < 0m)
        {
            throw new ArgumentException("Tax amount cannot be negative.", nameof(taxAmount));
        }

        if (taxLedgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Tax ledger account id cannot be empty.", nameof(taxLedgerAccountId));
        }

        Id = id;
        PurchaseInvoiceId = purchaseInvoiceId;
        TaxCodeId = taxCodeId;
        ComponentKind = componentKind;
        ApplicationMode = applicationMode;
        TransactionScope = transactionScope;
        RatePercent = ratePercent;
        TaxableAmount = taxableAmount;
        TaxAmount = taxAmount;
        TaxLedgerAccountId = taxLedgerAccountId;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public Guid Id { get; private set; }

    public Guid PurchaseInvoiceId { get; private set; }

    public PurchaseInvoice? PurchaseInvoice { get; private set; }

    public Guid TaxCodeId { get; private set; }

    public TaxCode? TaxCode { get; private set; }

    public TaxComponentKind ComponentKind { get; private set; }

    public TaxApplicationMode ApplicationMode { get; private set; }

    public TaxTransactionScope TransactionScope { get; private set; }

    public decimal RatePercent { get; private set; }

    public decimal TaxableAmount { get; private set; }

    public decimal TaxAmount { get; private set; }

    public Guid TaxLedgerAccountId { get; private set; }

    public LedgerAccount? TaxLedgerAccount { get; private set; }

    public string? Description { get; private set; }
}