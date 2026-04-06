using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class LedgerAccount : TenantOwnedEntity
{
    private readonly List<LedgerAccount> _children = [];

    private LedgerAccount()
    {
    }

    public LedgerAccount(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        AccountCategory category,
        AccountNature normalBalance,
        bool isHeader,
        bool isPostingAllowed,
        bool isActive,
        Guid? parentLedgerAccountId = null) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Ledger account id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException("Ledger account code cannot be null or whitespace.", nameof(code));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Ledger account name cannot be null or whitespace.", nameof(name));
        }

        ValidatePostingRules(isHeader, isPostingAllowed);

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Category = category;
        NormalBalance = normalBalance;
        IsHeader = isHeader;
        IsPostingAllowed = isPostingAllowed;
        IsActive = isActive;
        ParentLedgerAccountId = parentLedgerAccountId;
    }

    public Guid Id { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public AccountCategory Category { get; private set; }

    public AccountNature NormalBalance { get; private set; }

    public bool IsHeader { get; private set; }

    public bool IsPostingAllowed { get; private set; }

    public bool IsActive { get; private set; }

    public Guid? ParentLedgerAccountId { get; private set; }

    public LedgerAccount? ParentLedgerAccount { get; private set; }

    public IReadOnlyCollection<LedgerAccount> Children => _children;

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Ledger account name cannot be null or whitespace.", nameof(name));
        }

        Name = name.Trim();
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void AllowPosting()
    {
        if (IsHeader)
        {
            throw new InvalidOperationException("Header accounts cannot allow posting.");
        }

        IsPostingAllowed = true;
    }

    public void DisallowPosting()
    {
        IsPostingAllowed = false;
    }

    public void MarkAsHeader()
    {
        IsHeader = true;
        IsPostingAllowed = false;
    }

    public void MarkAsPosting()
    {
        IsHeader = false;
    }

    public void SetParent(Guid? parentLedgerAccountId)
    {
        ParentLedgerAccountId = parentLedgerAccountId;
    }

    private static void ValidatePostingRules(bool isHeader, bool isPostingAllowed)
    {
        if (isHeader && isPostingAllowed)
        {
            throw new ArgumentException("Header accounts cannot allow posting.");
        }
    }
}