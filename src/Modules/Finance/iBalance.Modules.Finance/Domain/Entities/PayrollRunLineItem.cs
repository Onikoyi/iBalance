namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollRunLineItem
{
    private PayrollRunLineItem()
    {
    }

    public PayrollRunLineItem(
        Guid id,
        Guid tenantId,
        Guid payrollRunLineId,
        Guid? payElementId,
        string code,
        string description,
        int elementKind,
        int calculationMode,
        decimal amount,
        int sequence,
        bool isTaxable)
    {
        Id = id;
        TenantId = tenantId;
        PayrollRunLineId = payrollRunLineId;
        PayElementId = payElementId;
        Code = code.Trim().ToUpperInvariant();
        Description = description.Trim();
        ElementKind = elementKind;
        CalculationMode = calculationMode;
        Amount = amount;
        Sequence = sequence < 1 ? 1 : sequence;
        IsTaxable = isTaxable;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PayrollRunLineId { get; private set; }
    public Guid? PayElementId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public int ElementKind { get; private set; }
    public int CalculationMode { get; private set; }
    public decimal Amount { get; private set; }
    public int Sequence { get; private set; }
    public bool IsTaxable { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}
