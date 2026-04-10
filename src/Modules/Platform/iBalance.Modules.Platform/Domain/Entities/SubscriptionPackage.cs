using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class SubscriptionPackage : AuditableEntity
{
    private SubscriptionPackage()
    {
    }

    public SubscriptionPackage(
        Guid id,
        string code,
        string name,
        string description,
        decimal monthlyPrice,
        string currencyCode,
        int displayOrder,
        bool isActive,
        bool isPublic)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Package id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException("Package code is required.", nameof(code));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Package name is required.", nameof(name));
        }

        if (monthlyPrice < 0m)
        {
            throw new ArgumentException("Monthly price cannot be negative.", nameof(monthlyPrice));
        }

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description?.Trim() ?? string.Empty;
        MonthlyPrice = monthlyPrice;
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "NGN" : currencyCode.Trim().ToUpperInvariant();
        DisplayOrder = displayOrder;
        IsActive = isActive;
        IsPublic = isPublic;
    }

    public Guid Id { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public decimal MonthlyPrice { get; private set; }

    public string CurrencyCode { get; private set; } = "NGN";

    public int DisplayOrder { get; private set; }

    public bool IsActive { get; private set; }

    public bool IsPublic { get; private set; }

    public void Update(
        string code,
        string name,
        string description,
        decimal monthlyPrice,
        string currencyCode,
        int displayOrder,
        bool isActive,
        bool isPublic)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException("Package code is required.", nameof(code));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Package name is required.", nameof(name));
        }

        if (monthlyPrice < 0m)
        {
            throw new ArgumentException("Monthly price cannot be negative.", nameof(monthlyPrice));
        }

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description?.Trim() ?? string.Empty;
        MonthlyPrice = monthlyPrice;
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "NGN" : currencyCode.Trim().ToUpperInvariant();
        DisplayOrder = displayOrder;
        IsActive = isActive;
        IsPublic = isPublic;
    }
}