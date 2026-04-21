namespace iBalance.Modules.Finance.Domain.Enums;

public enum BudgetStatus
{
    Draft = 1,
    SubmittedForApproval = 2,
    Approved = 3,
    Rejected = 4,
    Locked = 5,
    Cancelled = 6,
    Closed = 7
}