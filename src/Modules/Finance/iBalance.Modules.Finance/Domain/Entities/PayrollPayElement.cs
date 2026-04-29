namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollPayElement
{
    private PayrollPayElement()
    {
    }

    public PayrollPayElement(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        int elementKind,
        int calculationMode,
        decimal defaultAmount,
        decimal defaultRate,
        Guid ledgerAccountId,
        bool isTaxable,
        bool isActive,
        string? description)
    {
        Id = id;
        TenantId = tenantId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        ElementKind = elementKind;
        CalculationMode = calculationMode;
        DefaultAmount = defaultAmount;
        DefaultRate = defaultRate;
        LedgerAccountId = ledgerAccountId;
        IsTaxable = isTaxable;
        IsActive = isActive;
        Description = description?.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int ElementKind { get; private set; }
    public int CalculationMode { get; private set; }
    public decimal DefaultAmount { get; private set; }
    public decimal DefaultRate { get; private set; }
    public Guid LedgerAccountId { get; private set; }
    public bool IsTaxable { get; private set; }
    public bool IsActive { get; private set; }
    public string? Description { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(
        string name,
        int elementKind,
        int calculationMode,
        decimal defaultAmount,
        decimal defaultRate,
        Guid ledgerAccountId,
        bool isTaxable,
        bool isActive,
        string? description)
    {
        Name = name.Trim();
        ElementKind = elementKind;
        CalculationMode = calculationMode;
        DefaultAmount = defaultAmount;
        DefaultRate = defaultRate;
        LedgerAccountId = ledgerAccountId;
        IsTaxable = isTaxable;
        IsActive = isActive;
        Description = description?.Trim();
    }
}
