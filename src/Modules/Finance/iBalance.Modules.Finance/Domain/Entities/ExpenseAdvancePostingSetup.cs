using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvancePostingSetup : TenantOwnedEntity
{
    private ExpenseAdvancePostingSetup() : base(Guid.Empty) { }

    public ExpenseAdvancePostingSetup(Guid id, Guid tenantId, Guid advanceTypeId, Guid advanceControlAccountId, Guid? defaultExpenseAccountId, Guid? refundAccountId, Guid? salaryRecoveryAccountId, Guid? journalRecoveryAccountId, Guid? reimbursementPayableAccountId, Guid? clearingAccountId, Guid? defaultCashOrBankAccountId, bool isActive)
        : base(tenantId)
    {
        Id = id;
        AdvanceTypeId = advanceTypeId;
        AdvanceControlAccountId = advanceControlAccountId;
        DefaultExpenseAccountId = defaultExpenseAccountId;
        RefundAccountId = refundAccountId;
        SalaryRecoveryAccountId = salaryRecoveryAccountId;
        JournalRecoveryAccountId = journalRecoveryAccountId;
        ReimbursementPayableAccountId = reimbursementPayableAccountId;
        ClearingAccountId = clearingAccountId;
        DefaultCashOrBankAccountId = defaultCashOrBankAccountId;
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid AdvanceTypeId { get; private set; }
    public Guid AdvanceControlAccountId { get; private set; }
    public Guid? DefaultExpenseAccountId { get; private set; }
    public Guid? RefundAccountId { get; private set; }
    public Guid? SalaryRecoveryAccountId { get; private set; }
    public Guid? JournalRecoveryAccountId { get; private set; }
    public Guid? ReimbursementPayableAccountId { get; private set; }
    public Guid? ClearingAccountId { get; private set; }
    public Guid? DefaultCashOrBankAccountId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }
}

