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


            AddPermissionPolicy(AuthorizationPolicies.ApprovalInboxView, "approval.inbox.view", "workflow.approve", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.HrView, "hr.view");
            AddPermissionPolicy(AuthorizationPolicies.HrSetupManage, "hr.setup.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrEmployeeCreate, "hr.employee.create");
            AddPermissionPolicy(AuthorizationPolicies.HrEmployeeUpdate, "hr.employee.update");
            AddPermissionPolicy(AuthorizationPolicies.HrEmployeeTerminate, "hr.employee.terminate");
            AddPermissionPolicy(AuthorizationPolicies.HrEmployeeViewSensitive, "hr.employee.view.sensitive");
            AddPermissionPolicy(AuthorizationPolicies.HrDepartmentManage, "hr.department.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrDesignationManage, "hr.designation.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrGradeManage, "hr.grade.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrLeaveView, "hr.leave.view");
            AddPermissionPolicy(AuthorizationPolicies.HrLeaveCreate, "hr.leave.create");
            AddPermissionPolicy(AuthorizationPolicies.HrLeaveApprove, "hr.leave.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.HrLeaveReject, "hr.leave.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.HrTrainingManage, "hr.training.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrDisciplinaryManage, "hr.disciplinary.manage");
            AddPermissionPolicy(AuthorizationPolicies.HrReportsView, "hr.reports.view");
            AddPermissionPolicy(AuthorizationPolicies.HrExport, "hr.export");

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

            AddPermissionPolicy(AuthorizationPolicies.EamView, "eam.view");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestCreate, "eam.request.create");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestUpdate, "eam.request.update");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestDelete, "eam.request.delete");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestSubmit, "eam.request.submit");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestApprove, "eam.request.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.EamRequestReject, "eam.request.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.EamDisburse, "eam.disburse");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementCreate, "eam.retirement.create");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementUpdate, "eam.retirement.update");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementSubmit, "eam.retirement.submit");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementApprove, "eam.retirement.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementReject, "eam.retirement.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.EamRetirementPost, "eam.retirement.post");
            AddPermissionPolicy(AuthorizationPolicies.EamRefundRecord, "eam.refund.record");
            AddPermissionPolicy(AuthorizationPolicies.EamRecoveryManage, "eam.recovery.manage");
            AddPermissionPolicy(AuthorizationPolicies.EamPolicyManage, "eam.policy.manage");
            AddPermissionPolicy(AuthorizationPolicies.EamReportsView, "eam.reports.view", "reports.view");

            AddPermissionPolicy(AuthorizationPolicies.TreasuryView, "treasury.view");
            AddPermissionPolicy(AuthorizationPolicies.TreasuryManage, "treasury.manage", "treasury.bankaccounts.manage", "treasury.reconciliation.manage");
            AddPermissionPolicy(AuthorizationPolicies.InventoryView, "inventory.view");
            AddPermissionPolicy(AuthorizationPolicies.InventoryManage, "inventory.manage");
            AddPermissionPolicy(AuthorizationPolicies.FixedAssetsView, "fixedassets.view");
            AddPermissionPolicy(AuthorizationPolicies.FixedAssetsManage, "fixedassets.manage");

            AddPermissionPolicy(AuthorizationPolicies.ReportsView, "reports.view", "finance.reports.view", "budget.reports.view");
            AddPermissionPolicy(AuthorizationPolicies.ReportsExport, "reports.export");



            AddPermissionPolicy(AuthorizationPolicies.BillingView, "billing.view");
            AddPermissionPolicy(AuthorizationPolicies.BillingSetupManage, "billing.setup.manage");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceCreate, "billing.invoice.create");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceUpdate, "billing.invoice.update");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceSubmit, "billing.invoice.submit");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceApprove, "billing.invoice.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceReject, "billing.invoice.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoicePost, "billing.invoice.post");
            AddPermissionPolicy(AuthorizationPolicies.BillingInvoiceCancel, "billing.invoice.cancel");
            AddPermissionPolicy(AuthorizationPolicies.BillingCreditNoteCreate, "billing.creditnote.create");
            AddPermissionPolicy(AuthorizationPolicies.BillingCreditNoteApprove, "billing.creditnote.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.BillingPaymentAllocate, "billing.payment.allocate");
            AddPermissionPolicy(AuthorizationPolicies.BillingReportsView, "billing.reports.view", "billing.view");
            AddPermissionPolicy(AuthorizationPolicies.BillingExport, "billing.export", "reports.export");
            AddPermissionPolicy(AuthorizationPolicies.BillingPriceManage, "billing.price.manage");


            AddPermissionPolicy(AuthorizationPolicies.OilGasView, "oilgas.view");
            AddPermissionPolicy(AuthorizationPolicies.OilGasSetupManage, "oilgas.setup.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasAssetManage, "oilgas.asset.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductManage, "oilgas.product.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasTankManage, "oilgas.tank.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMeterManage, "oilgas.meter.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasPermitManage, "oilgas.permit.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionCreate, "oilgas.production.create");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionUpdate, "oilgas.production.update", "oilgas.production.correct");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionSubmit, "oilgas.production.submit");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionApprove, "oilgas.production.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionReject, "oilgas.production.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.OilGasReportsView, "oilgas.reports.view", "oilgas.view");
            AddPermissionPolicy(AuthorizationPolicies.OilGasExport, "oilgas.export", "reports.export");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementCreate, "oilgas.movement.create");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementUpdate, "oilgas.movement.update", "oilgas.movement.correct");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementSubmit, "oilgas.movement.submit");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementApprove, "oilgas.movement.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementReject, "oilgas.movement.reject", "workflow.reject");
            AddPermissionPolicy(AuthorizationPolicies.OilGasMovementPost, "oilgas.movement.post", "finance.transactions.post");
            AddPermissionPolicy(AuthorizationPolicies.OilGasLiftingManage, "oilgas.lifting.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasReconciliationManage, "oilgas.reconciliation.manage", "oilgas.reports.view");
            AddPermissionPolicy(AuthorizationPolicies.OilGasLiftingApprove, "oilgas.lifting.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.OilGasLiftingComplete, "oilgas.lifting.complete");
            AddPermissionPolicy(AuthorizationPolicies.OilGasAfeManage, "oilgas.afe.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasAfeApprove, "oilgas.afe.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.OilGasPartnerManage, "oilgas.partner.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionClose, "oilgas.production-close.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasProductionCloseApprove, "oilgas.production-close.approve", "workflow.approve");
            AddPermissionPolicy(AuthorizationPolicies.OilGasHseManage, "oilgas.hse.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasEquipmentManage, "oilgas.equipment.manage");
            AddPermissionPolicy(AuthorizationPolicies.OilGasDocumentManage, "oilgas.document.manage");

            AddPermissionPolicy(AuthorizationPolicies.FleetView, "fleet.view");
            AddPermissionPolicy(AuthorizationPolicies.FleetVehicleManage, "fleet.vehicle.manage");
            AddPermissionPolicy(AuthorizationPolicies.FleetDriverManage, "fleet.driver.manage");
            AddPermissionPolicy(AuthorizationPolicies.FleetTripCreate, "fleet.trip.create");
            AddPermissionPolicy(AuthorizationPolicies.FleetTripSubmit, "fleet.trip.submit");
            AddPermissionPolicy(AuthorizationPolicies.FleetTripApprove, "fleet.trip.approve");
            AddPermissionPolicy(AuthorizationPolicies.FleetTripReject, "fleet.trip.reject");
            AddPermissionPolicy(AuthorizationPolicies.FleetTripPost, "fleet.trip.post");
            AddPermissionPolicy(AuthorizationPolicies.FleetFuelManage, "fleet.fuel.manage");
            AddPermissionPolicy(AuthorizationPolicies.FleetFuelApprove, "fleet.fuel.approve");
            AddPermissionPolicy(AuthorizationPolicies.FleetFuelPost, "fleet.fuel.post");
            AddPermissionPolicy(AuthorizationPolicies.FleetMaintenanceManage, "fleet.maintenance.manage");
            AddPermissionPolicy(AuthorizationPolicies.FleetMaintenanceSubmit, "fleet.maintenance.submit");
            AddPermissionPolicy(AuthorizationPolicies.FleetMaintenanceApprove, "fleet.maintenance.approve");
            AddPermissionPolicy(AuthorizationPolicies.FleetMaintenanceReject, "fleet.maintenance.reject");
            AddPermissionPolicy(AuthorizationPolicies.FleetMaintenancePost, "fleet.maintenance.post");
            AddPermissionPolicy(AuthorizationPolicies.FleetPolicyManage, "fleet.policy.manage");
            AddPermissionPolicy(AuthorizationPolicies.FleetReportsView, "fleet.reports.view");
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
        services
            .AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy =
                    System.Text.Json.JsonNamingPolicy.CamelCase;
            });

                return services;
            }
}
