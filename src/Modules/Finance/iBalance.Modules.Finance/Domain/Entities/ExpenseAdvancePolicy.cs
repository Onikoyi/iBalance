using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvancePolicy : TenantOwnedEntity
{
    private ExpenseAdvancePolicy() : base(Guid.Empty) { }

    public ExpenseAdvancePolicy(Guid id, Guid tenantId, decimal? maxAmount, int maxOpenAdvancesPerStaff, int retirementDueDays, bool attachmentsRequired, bool blockSelfApproval, bool allowExcessReimbursement, bool allowSalaryRecovery, bool requireDepartmentScope, bool requireBranchScope, bool requireCostCenterScope, bool imprestAutoCloseOnFullRetirement, bool travelRequiresDestination, bool isActive)
        : base(tenantId)
    {
        Id = id;
        MaxAmount = maxAmount;
        MaxOpenAdvancesPerStaff = maxOpenAdvancesPerStaff;
        RetirementDueDays = retirementDueDays;
        AttachmentsRequired = attachmentsRequired;
        BlockSelfApproval = blockSelfApproval;
        AllowExcessReimbursement = allowExcessReimbursement;
        AllowSalaryRecovery = allowSalaryRecovery;
        RequireDepartmentScope = requireDepartmentScope;
        RequireBranchScope = requireBranchScope;
        RequireCostCenterScope = requireCostCenterScope;
        ImprestAutoCloseOnFullRetirement = imprestAutoCloseOnFullRetirement;
        TravelRequiresDestination = travelRequiresDestination;
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public decimal? MaxAmount { get; private set; }
    public int MaxOpenAdvancesPerStaff { get; private set; }
    public int RetirementDueDays { get; private set; }
    public bool AttachmentsRequired { get; private set; }
    public bool BlockSelfApproval { get; private set; }
    public bool AllowExcessReimbursement { get; private set; }
    public bool AllowSalaryRecovery { get; private set; }
    public bool RequireDepartmentScope { get; private set; }
    public bool RequireBranchScope { get; private set; }
    public bool RequireCostCenterScope { get; private set; }
    public bool ImprestAutoCloseOnFullRetirement { get; private set; }
    public bool TravelRequiresDestination { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }
}

