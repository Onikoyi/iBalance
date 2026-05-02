namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollPayGroupElement
{
    private PayrollPayGroupElement()
    {
    }

    public PayrollPayGroupElement(
        Guid id,
        Guid tenantId,
        Guid payGroupId,
        Guid payElementId,
        int sequence,
        decimal? amountOverride,
        decimal? rateOverride,
        bool isMandatory,
        bool isActive,
        DateTime? effectiveFromUtc,
        DateTime? effectiveToUtc,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PayGroupId = payGroupId;
        PayElementId = payElementId;
        Sequence = sequence < 1 ? 1 : sequence;
        AmountOverride = amountOverride;
        RateOverride = rateOverride;
        IsMandatory = isMandatory;
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
        Notes = notes?.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PayGroupId { get; private set; }
    public Guid PayElementId { get; private set; }
    public int Sequence { get; private set; }
    public decimal? AmountOverride { get; private set; }
    public decimal? RateOverride { get; private set; }
    public bool IsMandatory { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime? EffectiveFromUtc { get; private set; }
    public DateTime? EffectiveToUtc { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(
        int sequence,
        decimal? amountOverride,
        decimal? rateOverride,
        bool isMandatory,
        bool isActive,
        DateTime? effectiveFromUtc,
        DateTime? effectiveToUtc,
        string? notes)
    {
        Sequence = sequence < 1 ? 1 : sequence;
        AmountOverride = amountOverride;
        RateOverride = rateOverride;
        IsMandatory = isMandatory;
        IsActive = isActive;
        EffectiveFromUtc = effectiveFromUtc;
        EffectiveToUtc = effectiveToUtc;
        Notes = notes?.Trim();
    }
}
