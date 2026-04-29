namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollSalaryStructure
{
    private PayrollSalaryStructure()
    {
    }

    public PayrollSalaryStructure(
        Guid id,
        Guid tenantId,
        Guid employeeId,
        Guid payGroupId,
        decimal basicSalary,
        string currencyCode,
        DateTime effectiveFromUtc,
        bool isActive,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        EmployeeId = employeeId;
        PayGroupId = payGroupId;
        BasicSalary = basicSalary;
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        EffectiveFromUtc = effectiveFromUtc;
        IsActive = isActive;
        Notes = notes?.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public Guid PayGroupId { get; private set; }
    public decimal BasicSalary { get; private set; }
    public string CurrencyCode { get; private set; } = "NGN";
    public DateTime EffectiveFromUtc { get; private set; }
    public bool IsActive { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(Guid payGroupId, decimal basicSalary, string currencyCode, DateTime effectiveFromUtc, bool isActive, string? notes)
    {
        PayGroupId = payGroupId;
        BasicSalary = basicSalary;
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        EffectiveFromUtc = effectiveFromUtc;
        IsActive = isActive;
        Notes = notes?.Trim();
    }
}
