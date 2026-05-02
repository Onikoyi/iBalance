namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollSalaryStructureOverride
{
    private PayrollSalaryStructureOverride() { }

    public PayrollSalaryStructureOverride(
        Guid id,
        Guid tenantId,
        Guid payrollSalaryStructureId,
        Guid payElementId,
        decimal? amountOverride,
        decimal? rateOverride,
        bool isExcluded,
        bool isActive,
        DateTime? effectiveFromUtc,
        DateTime? effectiveToUtc,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PayrollSalaryStructureId = payrollSalaryStructureId;
        PayElementId = payElementId;
        AmountOverride = amountOverride;
        RateOverride = rateOverride;
        IsExcluded = isExcluded;
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
        Notes = notes?.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PayrollSalaryStructureId { get; private set; }
    public Guid PayElementId { get; private set; }
    public decimal? AmountOverride { get; private set; }
    public decimal? RateOverride { get; private set; }
    public bool IsExcluded { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime? EffectiveFromUtc { get; private set; }
    public DateTime? EffectiveToUtc { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(decimal? amountOverride, decimal? rateOverride, bool isExcluded, bool isActive, DateTime? effectiveFromUtc, DateTime? effectiveToUtc, string? notes)
    {
        AmountOverride = amountOverride;
        RateOverride = rateOverride;
        IsExcluded = isExcluded;
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
        Notes = notes?.Trim();
    }
}
