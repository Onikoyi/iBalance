using iBalance.Api.Security;
using iBalance.BuildingBlocks.Infrastructure.DependencyInjection;
using iBalance.Modules.Finance.DependencyInjection;
using iBalance.Modules.OilAndGas.DependencyInjection;
using iBalance.Modules.Platform.DependencyInjection;
using iBalance.Modules.Universities.DependencyInjection;
using iBalance.Api.Services.Audit;

namespace iBalance.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddInfrastructureServices(configuration);
        services.AddPlatformModule(configuration);
        services.AddFinanceModule(configuration);
        services.AddUniversitiesModule(configuration);
        services.AddOilAndGasModule(configuration);
        services.AddScoped<IAuditTrailWriter, AuditTrailWriter>();


        services.AddAuthorization(options =>
        {
            void AddPermissionPolicy(string policyName, params string[] permissions)
            {
                options.AddPolicy(policyName, policy =>
                {
                    policy.RequireAuthenticatedUser();
                    policy.RequireAssertion(context =>
                    {
                        if (context.User.IsInRole("PlatformAdmin"))
                        {
                            return true;
                        }

                        var userPermissions = context.User.Claims
                            .Where(x => string.Equals(x.Type, "permission", StringComparison.OrdinalIgnoreCase))
                            .Select(x => x.Value)
                            .ToHashSet(StringComparer.OrdinalIgnoreCase);

                        return permissions.Any(userPermissions.Contains);
                    });
                });
            }

            AddPermissionPolicy(AuthorizationPolicies.AdminAccess, "admin.access");
            AddPermissionPolicy(AuthorizationPolicies.AdminUsersManage, "admin.users.manage");
            AddPermissionPolicy(AuthorizationPolicies.AdminRolesManage, "admin.roles.manage");
            AddPermissionPolicy(AuthorizationPolicies.AdminPermissionsManage, "admin.permissions.manage");
            AddPermissionPolicy(AuthorizationPolicies.AdminScopesManage, "admin.scopes.manage");
            AddPermissionPolicy(AuthorizationPolicies.AdminSettingsManage, "admin.settings.manage");

            AddPermissionPolicy(AuthorizationPolicies.FinanceView, "finance.view");
            AddPermissionPolicy(AuthorizationPolicies.FinanceSetupManage, "finance.setup.manage");
            AddPermissionPolicy(AuthorizationPolicies.FinanceTransactionsCreate, "finance.transactions.create");
            AddPermissionPolicy(AuthorizationPolicies.FinanceTransactionsSubmit, "finance.transactions.submit");
            AddPermissionPolicy(AuthorizationPolicies.FinanceTransactionsApprove, "finance.transactions.approve");
            AddPermissionPolicy(AuthorizationPolicies.FinanceTransactionsReject, "finance.transactions.reject");
            AddPermissionPolicy(AuthorizationPolicies.FinanceTransactionsPost, "finance.transactions.post");
            AddPermissionPolicy(AuthorizationPolicies.FinanceReportsView, "finance.reports.view");
            AddPermissionPolicy(AuthorizationPolicies.FinanceJournalsCreate, "finance.journals.create", "finance.transactions.create");
            AddPermissionPolicy(AuthorizationPolicies.FinanceJournalsPost, "finance.journals.post", "finance.transactions.post");
            AddPermissionPolicy(AuthorizationPolicies.FinanceJournalsReverse, "finance.journals.reverse");
            AddPermissionPolicy(AuthorizationPolicies.FinanceFiscalPeriodsManage, "finance.fiscal-periods.manage", "finance.setup.manage");

            AddPermissionPolicy(AuthorizationPolicies.BudgetView, "budget.view");
            AddPermissionPolicy(AuthorizationPolicies.BudgetManage, "budget.manage");
            AddPermissionPolicy(AuthorizationPolicies.BudgetCreate, "budget.create");
            AddPermissionPolicy(AuthorizationPolicies.BudgetSubmit, "budget.submit");
            AddPermissionPolicy(AuthorizationPolicies.BudgetApprove, "budget.approve");
            AddPermissionPolicy(AuthorizationPolicies.BudgetReject, "budget.reject");
            AddPermissionPolicy(AuthorizationPolicies.BudgetLock, "budget.lock");
            AddPermissionPolicy(AuthorizationPolicies.BudgetClose, "budget.close");
            AddPermissionPolicy(AuthorizationPolicies.BudgetTransfer, "budget.transfer");
            AddPermissionPolicy(AuthorizationPolicies.BudgetReportsView, "budget.reports.view");

            AddPermissionPolicy(AuthorizationPolicies.PayrollView, "payroll.view");
            AddPermissionPolicy(AuthorizationPolicies.PayrollManage, "payroll.manage");
            AddPermissionPolicy(AuthorizationPolicies.PayrollRunSubmit, "payroll.run.submit");
            AddPermissionPolicy(AuthorizationPolicies.PayrollRunApprove, "payroll.run.approve");
            AddPermissionPolicy(AuthorizationPolicies.PayrollRunReject, "payroll.run.reject");
            AddPermissionPolicy(AuthorizationPolicies.PayrollRunPost, "payroll.run.post");

            AddPermissionPolicy(AuthorizationPolicies.ProcurementView, "procurement.view");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementRequisitionCreate, "procurement.requisition.create");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementRequisitionSubmit, "procurement.requisition.submit");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementRequisitionApprove, "procurement.requisition.approve");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementRequisitionReject, "procurement.requisition.reject");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementPoCreate, "procurement.po.create");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementPoApprove, "procurement.po.approve");
            AddPermissionPolicy(AuthorizationPolicies.ProcurementReceiptCreate, "procurement.receipt.create");

            AddPermissionPolicy(AuthorizationPolicies.ApView, "ap.view");
            AddPermissionPolicy(AuthorizationPolicies.ApVendorManage, "ap.view");
            AddPermissionPolicy(AuthorizationPolicies.ApInvoiceCreate, "ap.invoice.create");
            AddPermissionPolicy(AuthorizationPolicies.ApInvoiceSubmit, "ap.invoice.submit");
            AddPermissionPolicy(AuthorizationPolicies.ApInvoiceApprove, "ap.invoice.approve");
            AddPermissionPolicy(AuthorizationPolicies.ApInvoiceReject, "ap.invoice.reject");
            AddPermissionPolicy(AuthorizationPolicies.ApInvoicePost, "ap.invoice.post");
            AddPermissionPolicy(AuthorizationPolicies.ApPaymentCreate, "ap.payment.create");
            AddPermissionPolicy(AuthorizationPolicies.ApPaymentSubmit, "ap.payment.submit");
            AddPermissionPolicy(AuthorizationPolicies.ApPaymentApprove, "ap.payment.approve");
            AddPermissionPolicy(AuthorizationPolicies.ApPaymentReject, "ap.payment.reject");
            AddPermissionPolicy(AuthorizationPolicies.ApPaymentPost, "ap.payment.post");

            AddPermissionPolicy(AuthorizationPolicies.ArView, "ar.view");
            AddPermissionPolicy(AuthorizationPolicies.ArCustomerManage, "ar.view");
            AddPermissionPolicy(AuthorizationPolicies.ArInvoiceCreate, "ar.invoice.create");
            AddPermissionPolicy(AuthorizationPolicies.ArInvoiceSubmit, "ar.invoice.submit");
            AddPermissionPolicy(AuthorizationPolicies.ArInvoiceApprove, "ar.invoice.approve");
            AddPermissionPolicy(AuthorizationPolicies.ArInvoiceReject, "ar.invoice.reject");
            AddPermissionPolicy(AuthorizationPolicies.ArInvoicePost, "ar.invoice.post");
            AddPermissionPolicy(AuthorizationPolicies.ArReceiptCreate, "ar.receipt.create");
            AddPermissionPolicy(AuthorizationPolicies.ArReceiptSubmit, "ar.receipt.submit");
            AddPermissionPolicy(AuthorizationPolicies.ArReceiptApprove, "ar.receipt.approve");
            AddPermissionPolicy(AuthorizationPolicies.ArReceiptReject, "ar.receipt.reject");
            AddPermissionPolicy(AuthorizationPolicies.ArReceiptPost, "ar.receipt.post");

            AddPermissionPolicy(AuthorizationPolicies.TreasuryView, "treasury.view");
            AddPermissionPolicy(AuthorizationPolicies.TreasuryManage, "treasury.manage", "treasury.bankaccounts.manage", "treasury.reconciliation.manage");
            AddPermissionPolicy(AuthorizationPolicies.InventoryView, "inventory.view");
            AddPermissionPolicy(AuthorizationPolicies.InventoryManage, "inventory.manage");
            AddPermissionPolicy(AuthorizationPolicies.FixedAssetsView, "fixedassets.view");
            AddPermissionPolicy(AuthorizationPolicies.FixedAssetsManage, "fixedassets.manage");

            AddPermissionPolicy(AuthorizationPolicies.ReportsView, "reports.view", "finance.reports.view", "budget.reports.view");
            AddPermissionPolicy(AuthorizationPolicies.ReportsExport, "reports.export");
        });

        services.AddCors(options =>
        {
            options.AddPolicy("WebClient", policy =>
            {
                policy
                    .WithOrigins("http://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddControllers();

        return services;
    }
}
