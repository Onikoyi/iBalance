using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class BillingSettings : AuditableEntity
{
    private BillingSettings()
    {
    }

    public BillingSettings(
        Guid id,
        string accountName,
        string bankName,
        string accountNumber,
        string supportEmail,
        string paymentInstructions)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Billing settings id cannot be empty.", nameof(id));
        }

        Id = id;
        AccountName = accountName?.Trim() ?? string.Empty;
        BankName = bankName?.Trim() ?? string.Empty;
        AccountNumber = accountNumber?.Trim() ?? string.Empty;
        SupportEmail = supportEmail?.Trim() ?? string.Empty;
        PaymentInstructions = paymentInstructions?.Trim() ?? string.Empty;
    }

    public Guid Id { get; private set; }

    public string AccountName { get; private set; } = string.Empty;

    public string BankName { get; private set; } = string.Empty;

    public string AccountNumber { get; private set; } = string.Empty;

    public string SupportEmail { get; private set; } = string.Empty;

    public string PaymentInstructions { get; private set; } = string.Empty;

    public void Update(
        string accountName,
        string bankName,
        string accountNumber,
        string supportEmail,
        string paymentInstructions)
    {
        AccountName = accountName?.Trim() ?? string.Empty;
        BankName = bankName?.Trim() ?? string.Empty;
        AccountNumber = accountNumber?.Trim() ?? string.Empty;
        SupportEmail = supportEmail?.Trim() ?? string.Empty;
        PaymentInstructions = paymentInstructions?.Trim() ?? string.Empty;
    }
}