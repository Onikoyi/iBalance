namespace iBalance.Api.Security;

public static class AuthorizationPolicies
{
    public const string AdminAccess = "AdminAccess";
    public const string AdminUsersManage = "AdminUsersManage";
    public const string AdminRolesManage = "AdminRolesManage";
    public const string AdminPermissionsManage = "AdminPermissionsManage";
    public const string AdminScopesManage = "AdminScopesManage";
    public const string AdminSettingsManage = "AdminSettingsManage";

    public const string FinanceView = "FinanceView";
    public const string FinanceSetupManage = "FinanceSetupManage";
    public const string FinanceTransactionsCreate = "FinanceTransactionsCreate";
    public const string FinanceTransactionsSubmit = "FinanceTransactionsSubmit";
    public const string FinanceTransactionsApprove = "FinanceTransactionsApprove";
    public const string FinanceTransactionsReject = "FinanceTransactionsReject";
    public const string FinanceTransactionsPost = "FinanceTransactionsPost";
    public const string FinanceReportsView = "FinanceReportsView";
    public const string FinanceJournalsCreate = "FinanceJournalsCreate";
    public const string FinanceJournalsPost = "FinanceJournalsPost";
    public const string FinanceJournalsReverse = "FinanceJournalsReverse";
    public const string FinanceFiscalPeriodsManage = "FinanceFiscalPeriodsManage";

    public const string BudgetView = "BudgetView";
    public const string BudgetManage = "BudgetManage";
    public const string BudgetCreate = "BudgetCreate";
    public const string BudgetSubmit = "BudgetSubmit";
    public const string BudgetApprove = "BudgetApprove";
    public const string BudgetReject = "BudgetReject";
    public const string BudgetLock = "BudgetLock";
    public const string BudgetClose = "BudgetClose";
    public const string BudgetTransfer = "BudgetTransfer";
    public const string BudgetReportsView = "BudgetReportsView";

    public const string PayrollView = "PayrollView";
    public const string PayrollManage = "PayrollManage";
    public const string PayrollRunSubmit = "PayrollRunSubmit";
    public const string PayrollRunApprove = "PayrollRunApprove";
    public const string PayrollRunReject = "PayrollRunReject";
    public const string PayrollRunPost = "PayrollRunPost";

    public const string ProcurementView = "ProcurementView";
    public const string ProcurementRequisitionCreate = "ProcurementRequisitionCreate";
    public const string ProcurementRequisitionSubmit = "ProcurementRequisitionSubmit";
    public const string ProcurementRequisitionApprove = "ProcurementRequisitionApprove";
    public const string ProcurementRequisitionReject = "ProcurementRequisitionReject";
    public const string ProcurementPoCreate = "ProcurementPoCreate";
    public const string ProcurementPoApprove = "ProcurementPoApprove";
    public const string ProcurementReceiptCreate = "ProcurementReceiptCreate";

    public const string ApView = "ApView";
    public const string ApVendorManage = "ApVendorManage";
    public const string ApInvoiceCreate = "ApInvoiceCreate";
    public const string ApInvoiceSubmit = "ApInvoiceSubmit";
    public const string ApInvoiceApprove = "ApInvoiceApprove";
    public const string ApInvoiceReject = "ApInvoiceReject";
    public const string ApInvoicePost = "ApInvoicePost";
    public const string ApPaymentCreate = "ApPaymentCreate";
    public const string ApPaymentSubmit = "ApPaymentSubmit";
    public const string ApPaymentApprove = "ApPaymentApprove";
    public const string ApPaymentReject = "ApPaymentReject";
    public const string ApPaymentPost = "ApPaymentPost";

    public const string ArView = "ArView";
    public const string ArCustomerManage = "ArCustomerManage";
    public const string ArInvoiceCreate = "ArInvoiceCreate";
    public const string ArInvoiceSubmit = "ArInvoiceSubmit";
    public const string ArInvoiceApprove = "ArInvoiceApprove";
    public const string ArInvoiceReject = "ArInvoiceReject";
    public const string ArInvoicePost = "ArInvoicePost";
    public const string ArReceiptCreate = "ArReceiptCreate";
    public const string ArReceiptSubmit = "ArReceiptSubmit";
    public const string ArReceiptApprove = "ArReceiptApprove";
    public const string ArReceiptReject = "ArReceiptReject";
    public const string ArReceiptPost = "ArReceiptPost";

    public const string TreasuryView = "TreasuryView";
    public const string TreasuryManage = "TreasuryManage";
    public const string InventoryView = "InventoryView";
    public const string InventoryManage = "InventoryManage";
    public const string FixedAssetsView = "FixedAssetsView";
    public const string FixedAssetsManage = "FixedAssetsManage";

    public const string ReportsView = "ReportsView";
    public const string ReportsExport = "ReportsExport";
}
