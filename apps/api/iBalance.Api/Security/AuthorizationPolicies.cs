namespace iBalance.Api.Security;

public static class AuthorizationPolicies
{
    public const string AdminAccess = "AdminAccess";
    public const string FinanceView = "FinanceView";
    public const string FinanceSetupManage = "FinanceSetupManage";
    public const string FinanceJournalsCreate = "FinanceJournalsCreate";
    public const string FinanceJournalsPost = "FinanceJournalsPost";
    public const string FinanceJournalsReverse = "FinanceJournalsReverse";
    public const string FinanceFiscalPeriodsManage = "FinanceFiscalPeriodsManage";
    public const string FinanceReportsView = "FinanceReportsView";
}