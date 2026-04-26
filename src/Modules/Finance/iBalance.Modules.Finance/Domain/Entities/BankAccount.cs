using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankAccount : TenantOwnedEntity
{
    private BankAccount()
    {
    }

    public BankAccount(
        Guid id,
        Guid tenantId,
        string name,
        string bankName,
        string accountNumber,
        string currencyCode,
        Guid ledgerAccountId,
        string? branch = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Bank account id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Bank account name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(bankName)) throw new ArgumentException("Bank name is required.", nameof(bankName));
        if (string.IsNullOrWhiteSpace(accountNumber)) throw new ArgumentException("Account number is required.", nameof(accountNumber));
        if (string.IsNullOrWhiteSpace(currencyCode)) throw new ArgumentException("Currency code is required.", nameof(currencyCode));
        if (ledgerAccountId == Guid.Empty) throw new ArgumentException("Linked ledger account is required.", nameof(ledgerAccountId));

        Id = id;
        Name = name.Trim();
        BankName = bankName.Trim();
        AccountNumber = accountNumber.Trim();
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        LedgerAccountId = ledgerAccountId;
        Branch = string.IsNullOrWhiteSpace(branch) ? null : branch.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string BankName { get; private set; } = string.Empty;
    public string AccountNumber { get; private set; } = string.Empty;
    public string? Branch { get; private set; }
    public string CurrencyCode { get; private set; } = string.Empty;
    public Guid LedgerAccountId { get; private set; }
    public bool IsActive { get; private set; }
    public string? Notes { get; private set; }

    public void Update(
        string name,
        string bankName,
        string accountNumber,
        string currencyCode,
        Guid ledgerAccountId,
        string? branch,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Bank account name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(bankName)) throw new ArgumentException("Bank name is required.", nameof(bankName));
        if (string.IsNullOrWhiteSpace(accountNumber)) throw new ArgumentException("Account number is required.", nameof(accountNumber));
        if (string.IsNullOrWhiteSpace(currencyCode)) throw new ArgumentException("Currency code is required.", nameof(currencyCode));
        if (ledgerAccountId == Guid.Empty) throw new ArgumentException("Linked ledger account is required.", nameof(ledgerAccountId));

        Name = name.Trim();
        BankName = bankName.Trim();
        AccountNumber = accountNumber.Trim();
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        LedgerAccountId = ledgerAccountId;
        Branch = string.IsNullOrWhiteSpace(branch) ? null : branch.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
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
