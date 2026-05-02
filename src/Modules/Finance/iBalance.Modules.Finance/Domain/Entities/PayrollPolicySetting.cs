namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollPolicySetting
{
    private PayrollPolicySetting()
    {
    }

    public PayrollPolicySetting(
        Guid id,
        Guid tenantId,
        bool enforceMinimumTakeHome,
        string minimumTakeHomeRuleType,
        decimal minimumTakeHomeAmount,
        decimal minimumTakeHomePercent,
        string currencyCode)
    {
        Id = id;
        TenantId = tenantId;
        EnforceMinimumTakeHome = enforceMinimumTakeHome;
        MinimumTakeHomeRuleType = NormalizeRuleType(minimumTakeHomeRuleType);
        MinimumTakeHomeAmount = minimumTakeHomeAmount;
        MinimumTakeHomePercent = minimumTakeHomePercent;
        CurrencyCode = (currencyCode ?? "NGN").Trim().ToUpperInvariant();
        CreatedOnUtc = DateTime.UtcNow;
        UpdatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public bool EnforceMinimumTakeHome { get; private set; }
    public string MinimumTakeHomeRuleType { get; private set; } = "fixed_amount";
    public decimal MinimumTakeHomeAmount { get; private set; }
    public decimal MinimumTakeHomePercent { get; private set; }
    public string CurrencyCode { get; private set; } = "NGN";
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime UpdatedOnUtc { get; private set; }

    public void Update(
        bool enforceMinimumTakeHome,
        string minimumTakeHomeRuleType,
        decimal minimumTakeHomeAmount,
        decimal minimumTakeHomePercent,
        string currencyCode)
    {
        EnforceMinimumTakeHome = enforceMinimumTakeHome;
        MinimumTakeHomeRuleType = NormalizeRuleType(minimumTakeHomeRuleType);
        MinimumTakeHomeAmount = minimumTakeHomeAmount;
        MinimumTakeHomePercent = minimumTakeHomePercent;
        CurrencyCode = (currencyCode ?? "NGN").Trim().ToUpperInvariant();
        UpdatedOnUtc = DateTime.UtcNow;
    }

    private static string NormalizeRuleType(string? value)
    {
        var normalized = (value ?? "fixed_amount").Trim().ToLowerInvariant();
        return normalized == "gross_percentage" ? "gross_percentage" : "fixed_amount";
    }
}
