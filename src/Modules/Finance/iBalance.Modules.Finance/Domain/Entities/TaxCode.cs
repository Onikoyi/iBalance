using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class TaxCode : TenantOwnedEntity
{
    private TaxCode()
    {
    }

    public TaxCode(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        TaxComponentKind componentKind,
        TaxApplicationMode applicationMode,
        TaxTransactionScope transactionScope,
        decimal ratePercent,
        Guid taxLedgerAccountId,
        bool isActive,
        DateTime effectiveFromUtc,
        DateTime? effectiveToUtc = null,
        string? description = null) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Tax code id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException("Tax code cannot be null or whitespace.", nameof(code));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Tax code name cannot be null or whitespace.", nameof(name));
        }

        if (ratePercent < 0m)
        {
            throw new ArgumentException("Tax rate cannot be negative.", nameof(ratePercent));
        }

        if (ratePercent > 100m)
        {
            throw new ArgumentException("Tax rate cannot exceed 100%.", nameof(ratePercent));
        }

        if (taxLedgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Tax ledger account id cannot be empty.", nameof(taxLedgerAccountId));
        }

        if (effectiveToUtc.HasValue && effectiveToUtc.Value < effectiveFromUtc)
        {
            throw new ArgumentException("Effective end date cannot be earlier than effective start date.");
        }

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        ComponentKind = componentKind;
        ApplicationMode = applicationMode;
        TransactionScope = transactionScope;
        RatePercent = ratePercent;
        TaxLedgerAccountId = taxLedgerAccountId;
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public Guid Id { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public TaxComponentKind ComponentKind { get; private set; }

    public TaxApplicationMode ApplicationMode { get; private set; }

    public TaxTransactionScope TransactionScope { get; private set; }

    public decimal RatePercent { get; private set; }

    public Guid TaxLedgerAccountId { get; private set; }

    public LedgerAccount? TaxLedgerAccount { get; private set; }

    public bool IsActive { get; private set; }

    public DateTime EffectiveFromUtc { get; private set; }

    public DateTime? EffectiveToUtc { get; private set; }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Tax code name cannot be null or whitespace.", nameof(name));
        }

        Name = name.Trim();
    }

    public void SetDescription(string? description)
    {
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public void SetRate(decimal ratePercent)
    {
        if (ratePercent < 0m)
        {
            throw new ArgumentException("Tax rate cannot be negative.", nameof(ratePercent));
        }

        if (ratePercent > 100m)
        {
            throw new ArgumentException("Tax rate cannot exceed 100%.", nameof(ratePercent));
        }

        RatePercent = ratePercent;
    }

    public void SetTaxLedgerAccount(Guid taxLedgerAccountId)
    {
        if (taxLedgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Tax ledger account id cannot be empty.", nameof(taxLedgerAccountId));
        }

        TaxLedgerAccountId = taxLedgerAccountId;
    }

    public void SetEffectivePeriod(DateTime effectiveFromUtc, DateTime? effectiveToUtc)
    {
        if (effectiveToUtc.HasValue && effectiveToUtc.Value < effectiveFromUtc)
        {
            throw new ArgumentException("Effective end date cannot be earlier than effective start date.");
        }

        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
    }

    public bool IsEffectiveOn(DateTime transactionDateUtc)
    {
        return transactionDateUtc >= EffectiveFromUtc &&
               (!EffectiveToUtc.HasValue || transactionDateUtc <= EffectiveToUtc.Value);
    }

    public decimal CalculateTaxAmount(decimal taxableAmount)
    {
        if (taxableAmount < 0m)
        {
            throw new ArgumentException("Taxable amount cannot be negative.", nameof(taxableAmount));
        }

        return Math.Round(taxableAmount * RatePercent / 100m, 2, MidpointRounding.AwayFromZero);
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }
}