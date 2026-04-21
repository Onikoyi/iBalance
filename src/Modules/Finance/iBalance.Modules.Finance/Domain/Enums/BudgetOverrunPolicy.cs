namespace iBalance.Modules.Finance.Domain.Enums;

public enum BudgetOverrunPolicy
{
    Disallow = 1,
    WarnOnly = 2,
    Allow = 3,
    RequireApproval = 4
}