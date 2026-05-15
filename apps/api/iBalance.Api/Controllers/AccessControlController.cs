using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using iBalance.Api.Services.Audit;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin,TenantAdmin")]
[Route("api/admin/access-control")]
public sealed class AccessControlController : ControllerBase
{
    private static bool IsProtectedRoleCode(string code)
    {
        return string.Equals(code, "PLATFORM_ADMIN", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsCurrentUserPlatformAdmin(ClaimsPrincipal user)
    {
        return user.IsInRole("PlatformAdmin");
    }

    [HttpPost("seed-defaults")]
    public async Task<IActionResult> SeedDefaults(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var permissionSeed = new[]
        {
            new { Code = "admin.access", Module = "admin", Action = "access", Name = "Administration Access", Description = "Access administration workspace." },
            new { Code = "admin.users.manage", Module = "admin", Action = "manage", Name = "Manage Users", Description = "Manage user accounts." },
            new { Code = "admin.roles.manage", Module = "admin", Action = "manage", Name = "Manage Roles", Description = "Manage enterprise roles." },
            new { Code = "admin.permissions.manage", Module = "admin", Action = "manage", Name = "Manage Permissions", Description = "Manage enterprise permissions." },
            new { Code = "admin.scopes.manage", Module = "admin", Action = "manage", Name = "Manage Scopes", Description = "Manage departments, branches, and cost centers." },
            new { Code = "admin.settings.manage", Module = "admin", Action = "manage", Name = "Manage Administration Settings", Description = "Manage administrative and commercial settings." },
            new { Code = "license.recovery.bypass", Module = "admin", Action = "bypass", Name = "Bypass License Enforcement", Description = "Allow protected recovery access when license is blocked." },

            new { Code = "finance.view", Module = "finance", Action = "view", Name = "View Finance", Description = "Access finance workspaces." },
            new { Code = "finance.setup.manage", Module = "finance", Action = "manage", Name = "Manage Finance Setup", Description = "Maintain finance setup." },
            new { Code = "finance.transactions.create", Module = "finance", Action = "create", Name = "Create Finance Transactions", Description = "Create finance transactions." },
            new { Code = "finance.transactions.submit", Module = "finance", Action = "submit", Name = "Submit Finance Transactions", Description = "Submit finance transactions." },
            new { Code = "finance.transactions.approve", Module = "finance", Action = "approve", Name = "Approve Finance Transactions", Description = "Approve finance transactions." },
            new { Code = "finance.transactions.reject", Module = "finance", Action = "reject", Name = "Reject Finance Transactions", Description = "Reject finance transactions." },
            new { Code = "finance.transactions.post", Module = "finance", Action = "post", Name = "Post Finance Transactions", Description = "Post finance transactions." },
            new { Code = "finance.transactions.delete", Module = "finance", Action = "delete", Name = "Delete Finance Transactions", Description = "Delete finance transactions." },
            new { Code = "finance.reports.view", Module = "finance", Action = "report", Name = "View Finance Reports", Description = "View and print finance reports." },

            new { Code = "finance.journals.create", Module = "finance", Action = "create", Name = "Create Journals", Description = "Create journal entries." },
            new { Code = "finance.journals.post", Module = "finance", Action = "post", Name = "Post Journals", Description = "Post journal entries." },
            new { Code = "finance.journals.reverse", Module = "finance", Action = "reverse", Name = "Reverse Journals", Description = "Reverse journal entries." },
            new { Code = "finance.fiscal-periods.manage", Module = "finance", Action = "manage", Name = "Manage Fiscal Periods", Description = "Maintain fiscal periods and year setup." },

            new { Code = "budget.view", Module = "budget", Action = "view", Name = "View Budgets", Description = "View budget workspaces." },
            new { Code = "budget.manage", Module = "budget", Action = "manage", Name = "Manage Budgets", Description = "Manage budget setup and maintenance." },
            new { Code = "budget.create", Module = "budget", Action = "create", Name = "Create Budgets", Description = "Create budgets." },
            new { Code = "budget.submit", Module = "budget", Action = "submit", Name = "Submit Budgets", Description = "Submit budgets for approval." },
            new { Code = "budget.approve", Module = "budget", Action = "approve", Name = "Approve Budgets", Description = "Approve budgets." },
            new { Code = "budget.reject", Module = "budget", Action = "reject", Name = "Reject Budgets", Description = "Reject budgets." },
            new { Code = "budget.lock", Module = "budget", Action = "lock", Name = "Lock Budgets", Description = "Lock approved budgets." },
            new { Code = "budget.close", Module = "budget", Action = "close", Name = "Close Budgets", Description = "Close budgets." },
            new { Code = "budget.transfer", Module = "budget", Action = "transfer", Name = "Transfer Budget Amounts", Description = "Transfer budget amounts." },
            new { Code = "budget.reports.view", Module = "budget", Action = "report", Name = "View Budget Reports", Description = "View budget reports." },

            new { Code = "payroll.view", Module = "payroll", Action = "view", Name = "View Payroll", Description = "Access payroll workspace." },
            new { Code = "payroll.manage", Module = "payroll", Action = "manage", Name = "Manage Payroll Setup", Description = "Manage payroll masters and setup." },
            new { Code = "payroll.run.submit", Module = "payroll", Action = "submit", Name = "Submit Payroll Runs", Description = "Submit payroll runs." },
            new { Code = "payroll.run.approve", Module = "payroll", Action = "approve", Name = "Approve Payroll Runs", Description = "Approve payroll runs." },
            new { Code = "payroll.run.reject", Module = "payroll", Action = "reject", Name = "Reject Payroll Runs", Description = "Reject payroll runs." },
            new { Code = "payroll.run.post", Module = "payroll", Action = "post", Name = "Post Payroll Runs", Description = "Post payroll runs." },

            new { Code = "procurement.view", Module = "procurement", Action = "view", Name = "View Procurement", Description = "Access procurement workspaces." },
            new { Code = "procurement.requisition.create", Module = "procurement", Action = "create", Name = "Create Requisitions", Description = "Create requisitions." },
            new { Code = "procurement.requisition.submit", Module = "procurement", Action = "submit", Name = "Submit Requisitions", Description = "Submit requisitions." },
            new { Code = "procurement.requisition.approve", Module = "procurement", Action = "approve", Name = "Approve Requisitions", Description = "Approve requisitions." },
            new { Code = "procurement.requisition.reject", Module = "procurement", Action = "reject", Name = "Reject Requisitions", Description = "Reject requisitions." },
            new { Code = "procurement.po.create", Module = "procurement", Action = "create", Name = "Create Purchase Orders", Description = "Create purchase orders." },
            new { Code = "procurement.po.approve", Module = "procurement", Action = "approve", Name = "Approve Purchase Orders", Description = "Approve purchase orders." },
            new { Code = "procurement.receipt.create", Module = "procurement", Action = "create", Name = "Create Receipts", Description = "Create receipts." },

            new { Code = "ap.view", Module = "ap", Action = "view", Name = "View Accounts Payable", Description = "Access accounts payable workspaces." },
            new { Code = "ap.invoice.create", Module = "ap", Action = "create", Name = "Create Purchase Invoices", Description = "Create purchase invoices." },
            new { Code = "ap.invoice.submit", Module = "ap", Action = "submit", Name = "Submit Purchase Invoices", Description = "Submit purchase invoices." },
            new { Code = "ap.invoice.approve", Module = "ap", Action = "approve", Name = "Approve Purchase Invoices", Description = "Approve purchase invoices." },
            new { Code = "ap.invoice.reject", Module = "ap", Action = "reject", Name = "Reject Purchase Invoices", Description = "Reject purchase invoices." },
            new { Code = "ap.invoice.post", Module = "ap", Action = "post", Name = "Post Purchase Invoices", Description = "Post purchase invoices." },
            new { Code = "ap.payment.create", Module = "ap", Action = "create", Name = "Create Vendor Payments", Description = "Create vendor payments." },
            new { Code = "ap.payment.submit", Module = "ap", Action = "submit", Name = "Submit Vendor Payments", Description = "Submit vendor payments." },
            new { Code = "ap.payment.approve", Module = "ap", Action = "approve", Name = "Approve Vendor Payments", Description = "Approve vendor payments." },
            new { Code = "ap.payment.reject", Module = "ap", Action = "reject", Name = "Reject Vendor Payments", Description = "Reject vendor payments." },
            new { Code = "ap.payment.post", Module = "ap", Action = "post", Name = "Post Vendor Payments", Description = "Post vendor payments." },

            new { Code = "ar.view", Module = "ar", Action = "view", Name = "View Accounts Receivable", Description = "Access accounts receivable workspaces." },
            new { Code = "ar.invoice.create", Module = "ar", Action = "create", Name = "Create Sales Invoices", Description = "Create sales invoices." },
            new { Code = "ar.invoice.submit", Module = "ar", Action = "submit", Name = "Submit Sales Invoices", Description = "Submit sales invoices." },
            new { Code = "ar.invoice.approve", Module = "ar", Action = "approve", Name = "Approve Sales Invoices", Description = "Approve sales invoices." },
            new { Code = "ar.invoice.reject", Module = "ar", Action = "reject", Name = "Reject Sales Invoices", Description = "Reject sales invoices." },
            new { Code = "ar.invoice.post", Module = "ar", Action = "post", Name = "Post Sales Invoices", Description = "Post sales invoices." },
            new { Code = "ar.receipt.create", Module = "ar", Action = "create", Name = "Create Customer Receipts", Description = "Create customer receipts." },
            new { Code = "ar.receipt.submit", Module = "ar", Action = "submit", Name = "Submit Customer Receipts", Description = "Submit customer receipts." },
            new { Code = "ar.receipt.approve", Module = "ar", Action = "approve", Name = "Approve Customer Receipts", Description = "Approve customer receipts." },
            new { Code = "ar.receipt.reject", Module = "ar", Action = "reject", Name = "Reject Customer Receipts", Description = "Reject customer receipts." },
            new { Code = "ar.receipt.post", Module = "ar", Action = "post", Name = "Post Customer Receipts", Description = "Post customer receipts." },


            new { Code = "fleet.view", Module = "fleet", Action = "view", Name = "View Fleet", Description = "Access fleet management workspace." },
            new { Code = "fleet.vehicle.manage", Module = "fleet", Action = "manage", Name = "Manage Fleet Vehicles", Description = "Create and maintain fleet vehicles." },
            new { Code = "fleet.driver.manage", Module = "fleet", Action = "manage", Name = "Manage Fleet Drivers", Description = "Create and maintain fleet drivers." },
            new { Code = "fleet.trip.create", Module = "fleet", Action = "create", Name = "Create Fleet Trips", Description = "Create fleet trip requests and journey logs." },
            new { Code = "fleet.trip.submit", Module = "fleet", Action = "submit", Name = "Submit Fleet Trips", Description = "Submit fleet trips for approval." },
            new { Code = "fleet.trip.approve", Module = "fleet", Action = "approve", Name = "Approve Fleet Trips", Description = "Approve fleet trip requests." },
            new { Code = "fleet.trip.reject", Module = "fleet", Action = "reject", Name = "Reject Fleet Trips", Description = "Reject fleet trip requests." },
            new { Code = "fleet.trip.post", Module = "fleet", Action = "post", Name = "Post Fleet Trips", Description = "Post fleet trip completions where policy requires posting." },
            new { Code = "fleet.fuel.manage", Module = "fleet", Action = "manage", Name = "Manage Fleet Fuel", Description = "Create and maintain fleet fuel logs." },
            new { Code = "fleet.fuel.approve", Module = "fleet", Action = "approve", Name = "Approve Fleet Fuel", Description = "Approve fleet fuel logs." },
            new { Code = "fleet.fuel.post", Module = "fleet", Action = "post", Name = "Post Fleet Fuel", Description = "Post fleet fuel logs to general ledger." },
            new { Code = "fleet.maintenance.manage", Module = "fleet", Action = "manage", Name = "Manage Fleet Maintenance", Description = "Create and maintain maintenance work orders." },
            new { Code = "fleet.maintenance.submit", Module = "fleet", Action = "submit", Name = "Submit Fleet Maintenance", Description = "Submit maintenance work orders." },
            new { Code = "fleet.maintenance.approve", Module = "fleet", Action = "approve", Name = "Approve Fleet Maintenance", Description = "Approve maintenance work orders." },
            new { Code = "fleet.maintenance.reject", Module = "fleet", Action = "reject", Name = "Reject Fleet Maintenance", Description = "Reject maintenance work orders." },
            new { Code = "fleet.maintenance.post", Module = "fleet", Action = "post", Name = "Post Fleet Maintenance", Description = "Post maintenance work orders to general ledger." },
            new { Code = "fleet.policy.manage", Module = "fleet", Action = "manage", Name = "Manage Fleet Policy", Description = "Manage fleet policy, posting, and control setup." },
            new { Code = "fleet.reports.view", Module = "fleet", Action = "report", Name = "View Fleet Reports", Description = "View fleet dashboards and analytical reports." },

            new { Code = "eam.view", Module = "eam", Action = "view", Name = "View Expense & Advance Management", Description = "Access expense and advance management workspaces." },
            new { Code = "eam.request.create", Module = "eam", Action = "create", Name = "Create Advance Requests", Description = "Create expense and advance requests." },
            new { Code = "eam.request.update", Module = "eam", Action = "update", Name = "Update Advance Requests", Description = "Update draft or rejected advance requests." },
            new { Code = "eam.request.delete", Module = "eam", Action = "delete", Name = "Delete Advance Requests", Description = "Delete draft or rejected advance requests." },
            new { Code = "eam.request.submit", Module = "eam", Action = "submit", Name = "Submit Advance Requests", Description = "Submit advance requests for approval." },
            new { Code = "eam.request.approve", Module = "eam", Action = "approve", Name = "Approve Advance Requests", Description = "Approve advance requests." },
            new { Code = "eam.request.reject", Module = "eam", Action = "reject", Name = "Reject Advance Requests", Description = "Reject advance requests." },
            new { Code = "eam.disburse", Module = "eam", Action = "disburse", Name = "Disburse Advances", Description = "Disburse approved advances and imprests." },
            new { Code = "eam.retirement.create", Module = "eam", Action = "create", Name = "Create Retirements", Description = "Create advance retirement transactions." },
            new { Code = "eam.retirement.update", Module = "eam", Action = "update", Name = "Update Retirements", Description = "Update draft or rejected retirement transactions." },
            new { Code = "eam.retirement.submit", Module = "eam", Action = "submit", Name = "Submit Retirements", Description = "Submit retirement transactions for approval." },
            new { Code = "eam.retirement.approve", Module = "eam", Action = "approve", Name = "Approve Retirements", Description = "Approve retirement transactions." },
            new { Code = "eam.retirement.reject", Module = "eam", Action = "reject", Name = "Reject Retirements", Description = "Reject retirement transactions." },
            new { Code = "eam.retirement.post", Module = "eam", Action = "post", Name = "Post Retirements", Description = "Post approved retirement transactions." },
            new { Code = "eam.refund.record", Module = "eam", Action = "refund", Name = "Record Refunds", Description = "Record cash and bank refunds against outstanding advances." },
            new { Code = "eam.recovery.manage", Module = "eam", Action = "recover", Name = "Manage Recoveries", Description = "Manage salary and journal recoveries and excess reimbursements." },
            new { Code = "eam.policy.manage", Module = "eam", Action = "manage", Name = "Manage EAM Policy & Setup", Description = "Manage expense and advance policies, masters, posting setup, and numbering." },
            new { Code = "eam.reports.view", Module = "eam", Action = "report", Name = "View EAM Reports", Description = "View expense and advance reports and dashboards." },

            new { Code = "treasury.view", Module = "treasury", Action = "view", Name = "View Treasury", Description = "Access treasury workspaces." },
            new { Code = "treasury.manage", Module = "treasury", Action = "manage", Name = "Manage Treasury", Description = "Manage treasury operations." },
            new { Code = "treasury.bankaccounts.manage", Module = "treasury", Action = "manage", Name = "Manage Bank Accounts", Description = "Maintain bank accounts." },
            new { Code = "treasury.reconciliation.manage", Module = "treasury", Action = "manage", Name = "Manage Reconciliation", Description = "Perform bank reconciliation activities." },

            new { Code = "inventory.view", Module = "inventory", Action = "view", Name = "View Inventory", Description = "Access inventory workspaces." },
            new { Code = "inventory.manage", Module = "inventory", Action = "manage", Name = "Manage Inventory", Description = "Manage inventory." },

            new { Code = "fixedassets.view", Module = "fixedassets", Action = "view", Name = "View Fixed Assets", Description = "Access fixed asset workspaces." },
            new { Code = "fixedassets.manage", Module = "fixedassets", Action = "manage", Name = "Manage Fixed Assets", Description = "Manage fixed assets." },
            new { Code = "fixedassets.depreciation.run", Module = "fixedassets", Action = "run", Name = "Run Depreciation", Description = "Run asset depreciation." },
            new { Code = "fixedassets.disposal.post", Module = "fixedassets", Action = "post", Name = "Post Asset Disposal", Description = "Post asset disposal transactions." },
            new { Code = "workingcapital.view", Module = "workingcapital", Action = "view", Name = "View Working Capital", Description = "Access working capital workspace." },

            new { Code = "workflow.approve", Module = "workflow", Action = "approve", Name = "Approve Workflows", Description = "Approve workflow transactions across modules." },
            new { Code = "workflow.reject", Module = "workflow", Action = "reject", Name = "Reject Workflows", Description = "Reject workflow transactions across modules." },
            new { Code = "workflow.reopen", Module = "workflow", Action = "reopen", Name = "Reopen Workflows", Description = "Reopen workflow transactions where policy allows." },

            new { Code = "reports.view", Module = "reports", Action = "view", Name = "View Reports", Description = "View cross-module reports." },
            new { Code = "reports.export", Module = "reports", Action = "export", Name = "Export Reports", Description = "Export and print reports." }
        };

        foreach (var item in permissionSeed)
        {
            var exists = await dbContext.Set<SecurityPermission>()
                .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == item.Code, cancellationToken);

            if (!exists)
            {
                dbContext.Set<SecurityPermission>().Add(new SecurityPermission(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    item.Code,
                    item.Module,
                    item.Action,
                    item.Name,
                    item.Description,
                    true,
                    true));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var permissions = await dbContext.Set<SecurityPermission>()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .ToDictionaryAsync(x => x.Code, cancellationToken);

        var roleSeed = new[]
        {
            new
            {
                Code = "PLATFORM_ADMIN",
                Name = "Platform Admin",
                Description = "Platform-wide administrative access.",
                PermissionCodes = permissionSeed.Select(x => x.Code).ToArray()
            },
            
               new
{
    Code = "TENANT_ADMIN",
    Name = "Tenant Admin",
    Description = "Tenant administrative access with module visibility bound to tenant subscription.",
    PermissionCodes = new[]
    {
        "admin.access",
        "admin.users.manage",
        "admin.roles.manage",
        "admin.permissions.manage",
        "admin.scopes.manage",

        "reports.view",
        "finance.view",
        "budget.view",
        "procurement.view",
        "ap.view",
        "ar.view",
        "payroll.view",
        "inventory.view",
        "fixedassets.view",
        "treasury.view",
        "eam.view",
        "fleet.view",
        "fleet.vehicle.manage",
        "fleet.driver.manage",
        "fleet.trip.create",
        "fleet.trip.approve",
        "fleet.fuel.manage",
        "fleet.fuel.approve",
        "fleet.fuel.post",
        "fleet.maintenance.manage",
        "fleet.maintenance.approve",
        "fleet.maintenance.post",
        "fleet.policy.manage",
        "fleet.reports.view",
        "workingcapital.view",
    }
},
            new
            {
                Code = "FINANCE_CONTROLLER",
                Name = "Finance Controller",
                Description = "Cross-finance controlling and approval authority.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.setup.manage","finance.transactions.create","finance.transactions.submit","finance.transactions.approve","finance.transactions.reject","finance.transactions.post","finance.reports.view",
                    "finance.journals.create","finance.journals.post","finance.journals.reverse","finance.fiscal-periods.manage",
                    "budget.view","budget.manage","budget.create","budget.submit","budget.approve","budget.reject","budget.lock","budget.close","budget.transfer","budget.reports.view",
                    "ap.view","ap.invoice.create","ap.invoice.submit","ap.invoice.approve","ap.invoice.reject","ap.invoice.post","ap.payment.create","ap.payment.submit","ap.payment.approve","ap.payment.reject","ap.payment.post",
                    "ar.view","ar.invoice.create","ar.invoice.submit","ar.invoice.approve","ar.invoice.reject","ar.invoice.post","ar.receipt.create","ar.receipt.submit","ar.receipt.approve","ar.receipt.reject","ar.receipt.post",
                    "treasury.view","treasury.manage","treasury.bankaccounts.manage","treasury.reconciliation.manage",
                    "fixedassets.view","fixedassets.manage","fixedassets.depreciation.run","fixedassets.disposal.post",
                    "reports.view","reports.export","workflow.approve","workflow.reject","workflow.reopen"
                }
            },
            new
            {
                Code = "ACCOUNTANT",
                Name = "Accountant",
                Description = "Core finance operational role.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.setup.manage","finance.transactions.create","finance.transactions.submit","finance.transactions.post","finance.reports.view",
                    "finance.journals.create","finance.journals.post","finance.journals.reverse","finance.fiscal-periods.manage",
                    "budget.view","budget.create","budget.submit","budget.reports.view",
                    "ap.view","ap.invoice.create","ap.invoice.submit","ap.invoice.post","ap.payment.create","ap.payment.submit","ap.payment.post",
                    "ar.view","ar.invoice.create","ar.invoice.submit","ar.invoice.post","ar.receipt.create","ar.receipt.submit","ar.receipt.post",
                    "fixedassets.view","fixedassets.manage","fixedassets.depreciation.run",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "APPROVER",
                Name = "Approver",
                Description = "Approval role across workflow modules.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.transactions.approve","finance.transactions.reject","finance.reports.view",
                    "budget.view","budget.approve","budget.reject","budget.lock","budget.close","budget.reports.view",
                    "payroll.view","payroll.run.approve","payroll.run.reject",
                    "procurement.view","procurement.requisition.approve","procurement.requisition.reject","procurement.po.approve",
                    "ap.view","ap.invoice.approve","ap.invoice.reject","ap.payment.approve","ap.payment.reject",
                    "ar.view","ar.invoice.approve","ar.invoice.reject","ar.receipt.approve","ar.receipt.reject",
                    "workflow.approve","workflow.reject",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "VIEWER",
                Name = "Viewer",
                Description = "Read-only access.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.reports.view",
                    "budget.view","budget.reports.view",
                    "payroll.view",
                    "procurement.view",
                    "ap.view",
                    "ar.view",
                    "treasury.view",
                    "inventory.view",
                    "fixedassets.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "AUDITOR",
                Name = "Auditor",
                Description = "Read-only cross-functional audit role.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.reports.view",
                    "budget.view","budget.reports.view",
                    "payroll.view",
                    "procurement.view",
                    "ap.view",
                    "ar.view",
                    "treasury.view",
                    "inventory.view",
                    "fixedassets.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "BUDGET_OFFICER",
                Name = "Budget Officer",
                Description = "Departmental budget preparation role.",
                PermissionCodes = new[]
                {
                    "finance.view",
                    "budget.view","budget.manage","budget.create","budget.submit","budget.transfer","budget.reports.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "BUDGET_OWNER",
                Name = "Budget Owner",
                Description = "Departmental budget ownership role.",
                PermissionCodes = new[]
                {
                    "finance.view",
                    "budget.view","budget.approve","budget.reject","budget.lock","budget.close","budget.reports.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "PAYROLL_OFFICER",
                Name = "Payroll Officer",
                Description = "Departmental payroll processing.",
                PermissionCodes = new[]
                {
                    "payroll.view","payroll.manage","payroll.run.submit","reports.view","reports.export"
                }
            },
            new
            {
                Code = "HR_OFFICER",
                Name = "HR Officer",
                Description = "Human resource administrative role.",
                PermissionCodes = new[]
                {
                    "payroll.view","payroll.manage","reports.view","reports.export"
                }
            },
            new
            {
                Code = "PROCUREMENT_OFFICER",
                Name = "Procurement Officer",
                Description = "Departmental procurement processing.",
                PermissionCodes = new[]
                {
                    "procurement.view","procurement.requisition.create","procurement.requisition.submit","procurement.po.create","procurement.receipt.create",
                    "reports.view","reports.export"
                }
            },

            new
            {
                Code = "FLEET_OFFICER",
                Name = "Fleet Officer",
                Description = "Create and manage operational fleet transactions.",
                PermissionCodes = new[]
                {
                    "fleet.view",
                    "fleet.vehicle.manage",
                    "fleet.driver.manage",
                    "fleet.trip.create",
                    "fleet.trip.submit",
                    "fleet.fuel.manage",
                    "fleet.maintenance.manage",
                    "fleet.maintenance.submit",
                    "fleet.policy.manage",
                    "fleet.reports.view"
                }
            },
            new
            {
                Code = "FLEET_APPROVER",
                Name = "Fleet Approver",
                Description = "Approve and post controlled fleet transactions.",
                PermissionCodes = new[]
                {
                    "fleet.view",
                    "fleet.trip.approve",
                    "fleet.trip.reject",
                    "fleet.trip.post",
                    "fleet.fuel.approve",
                    "fleet.fuel.post",
                    "fleet.maintenance.approve",
                    "fleet.maintenance.reject",
                    "fleet.maintenance.post",
                    "fleet.reports.view",
                    "workflow.approve",
                    "workflow.reject"
                }
            },
            new
            {
                Code = "FLEET_REVIEWER",
                Name = "Fleet Reviewer",
                Description = "Review fleet transactions and fleet performance.",
                PermissionCodes = new[]
                {
                    "fleet.view",
                    "fleet.reports.view"
                }
            },
            new
            {
                Code = "FLEET_VIEWER",
                Name = "Fleet Viewer",
                Description = "Read-only visibility into fleet workspace and reports.",
                PermissionCodes = new[]
                {
                    "fleet.view",
                    "fleet.reports.view"
                }
            },

            new
            {
                Code = "EXPENSE_ADVANCE_OFFICER",
                Name = "Expense & Advance Officer",
                Description = "Operational processing role for advances, retirements, refunds, and recoveries.",
                PermissionCodes = new[]
                {
                    "eam.view","eam.request.create","eam.request.update","eam.request.delete","eam.request.submit","eam.disburse",
                    "eam.retirement.create","eam.retirement.update","eam.retirement.submit","eam.refund.record","eam.recovery.manage","eam.reports.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "EXPENSE_ADVANCE_APPROVER",
                Name = "Expense & Advance Approver",
                Description = "Approver role for expense and advance transactions.",
                PermissionCodes = new[]
                {
                    "eam.view","eam.request.approve","eam.request.reject","eam.retirement.approve","eam.retirement.reject","eam.reports.view",
                    "workflow.approve","workflow.reject","reports.view","reports.export"
                }
            },
            new
            {
                Code = "EXPENSE_ADVANCE_REVIEWER",
                Name = "Expense & Advance Reviewer",
                Description = "Review, disbursement, posting, and control role for expense and advance management.",
                PermissionCodes = new[]
                {
                    "eam.view","eam.disburse","eam.retirement.post","eam.refund.record","eam.recovery.manage","eam.policy.manage","eam.reports.view",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "EXPENSE_ADVANCE_VIEWER",
                Name = "Expense & Advance Viewer",
                Description = "Read-only access to expense and advance management.",
                PermissionCodes = new[]
                {
                    "eam.view","eam.reports.view","reports.view","reports.export"
                }
            },
            new
            {
                Code = "TREASURY_OFFICER",
                Name = "Treasury Officer",
                Description = "Departmental treasury processing.",
                PermissionCodes = new[]
                {
                    "treasury.view","treasury.manage","treasury.bankaccounts.manage","treasury.reconciliation.manage",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "INVENTORY_OFFICER",
                Name = "Inventory Officer",
                Description = "Departmental inventory control role.",
                PermissionCodes = new[]
                {
                    "inventory.view","inventory.manage","reports.view","reports.export"
                }
            },
            new
            {
                Code = "AP_OFFICER",
                Name = "AP Officer",
                Description = "Accounts payable operational role.",
                PermissionCodes = new[]
                {
                    "ap.view","ap.invoice.create","ap.invoice.submit","ap.invoice.post","ap.payment.create","ap.payment.submit","ap.payment.post",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "AR_OFFICER",
                Name = "AR Officer",
                Description = "Accounts receivable operational role.",
                PermissionCodes = new[]
                {
                    "ar.view","ar.invoice.create","ar.invoice.submit","ar.invoice.post","ar.receipt.create","ar.receipt.submit","ar.receipt.post",
                    "reports.view","reports.export"
                }
            },
            new
            {
                Code = "FIXED_ASSET_OFFICER",
                Name = "Fixed Asset Officer",
                Description = "Fixed asset operational role.",
                PermissionCodes = new[]
                {
                    "fixedassets.view","fixedassets.manage","fixedassets.depreciation.run","fixedassets.disposal.post",
                    "reports.view","reports.export"
                }
            }
        };

        foreach (var item in roleSeed)
        {
            var role = await dbContext.Set<SecurityRole>()
                .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Code == item.Code, cancellationToken);

            if (role is null)
            {
                role = new SecurityRole(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    item.Code,
                    item.Name,
                    item.Description,
                    true,
                    true);

                dbContext.Set<SecurityRole>().Add(role);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            var desiredPermissionIds = item.PermissionCodes
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Where(x => permissions.ContainsKey(x))
                .Select(x => permissions[x].Id)
                .ToHashSet();

            var existingMappings = await dbContext.Set<SecurityRolePermission>()
                .Where(x => x.TenantId == tenantContext.TenantId && x.SecurityRoleId == role.Id)
                .ToListAsync(cancellationToken);

            var existingPermissionIds = existingMappings
                .Select(x => x.SecurityPermissionId)
                .ToHashSet();

            var mappingsToRemove = existingMappings
                .Where(x => !desiredPermissionIds.Contains(x.SecurityPermissionId))
                .ToList();

            if (mappingsToRemove.Count > 0)
            {
                dbContext.Set<SecurityRolePermission>().RemoveRange(mappingsToRemove);
            }

            foreach (var permissionId in desiredPermissionIds)
            {
                if (existingPermissionIds.Contains(permissionId))
                {
                    continue;
                }

                dbContext.Set<SecurityRolePermission>().Add(new SecurityRolePermission(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    role.Id,
                    permissionId));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "AccessControl",
            "SeedDefaults",
            null,
            "seed-defaults",
            "Default access control data seeded/refreshed.",
            User.Identity?.Name,
            tenantContext.TenantId,
            null,
            cancellationToken);


        return Ok(new { Message = "Default enterprise access roles and permissions seeded successfully." });
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<SecurityRole>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Description,
                x.IsSystemDefined,
                x.IsActive,
                IsProtected = IsProtectedRoleCode(x.Code),
                PermissionCount = dbContext.Set<SecurityRolePermission>().Count(m => m.SecurityRoleId == x.Id),
                PermissionIds = dbContext.Set<SecurityRolePermission>()
                    .Where(m => m.SecurityRoleId == x.Id)
                    .Select(m => m.SecurityPermissionId)
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] UpsertSecurityRoleRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Role code and name are required." });
        }

        var exists = await dbContext.Set<SecurityRole>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A role with the same code already exists." });
        }

        var role = new SecurityRole(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, false, request.IsActive);
        dbContext.Set<SecurityRole>().Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "SecurityRole",
            "RoleCreated",
            role.Id,
            role.Code,
            $"Role '{role.Name}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                role.Code,
                role.Name,
                role.Description,
                role.IsActive,
                role.IsSystemDefined
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Role created successfully.",
            Role = new { role.Id, role.Code, role.Name, role.Description, role.IsActive }
        });
    }

    [HttpPut("roles/{roleId:guid}")]
    public async Task<IActionResult> UpdateRole(
        Guid roleId,
        [FromBody] UpsertSecurityRoleRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var role = await dbContext.Set<SecurityRole>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Id == roleId, cancellationToken);

        if (role is null)
        {
            return NotFound(new { Message = "Role was not found." });
        }

        if (IsProtectedRoleCode(role.Code) && !IsCurrentUserPlatformAdmin(User))
        {
            return Forbid();
        }

        role.Update(request.Name, request.Description, request.IsActive);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "SecurityRole",
            "RoleUpdated",
            role.Id,
            role.Code,
            $"Role '{role.Name}' updated.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                role.Code,
                role.Name,
                role.Description,
                role.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Role updated successfully." });
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<SecurityPermission>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Module)
            .ThenBy(x => x.Action)
            .Select(x => new { x.Id, x.Code, x.Module, x.Action, x.Name, x.Description, x.IsSystemDefined, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("permissions")]
    public async Task<IActionResult> CreatePermission([FromBody] UpsertSecurityPermissionRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Module) || string.IsNullOrWhiteSpace(request.Action) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Permission code, module, action, and name are required." });
        }

        var exists = await dbContext.Set<SecurityPermission>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToLowerInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A permission with the same code already exists." });
        }

        var item = new SecurityPermission(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Module, request.Action, request.Name, request.Description, false, request.IsActive);
        dbContext.Set<SecurityPermission>().Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "SecurityPermission",
            "PermissionCreated",
            item.Id,
            item.Code,
            $"Permission '{item.Name}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                item.Code,
                item.Module,
                item.Action,
                item.Name,
                item.Description,
                item.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Permission created successfully." });
    }

    [HttpPut("roles/{roleId:guid}/permissions")]
    public async Task<IActionResult> SetRolePermissions(Guid roleId, [FromBody] SetRolePermissionsRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var role = await dbContext.Set<SecurityRole>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Id == roleId, cancellationToken);

        if (role is null)
        {
            return NotFound(new { Message = "Role was not found." });
        }

        if (IsProtectedRoleCode(role.Code) && !IsCurrentUserPlatformAdmin(User))
        {
            return Forbid();
        }

        if (IsProtectedRoleCode(role.Code))
        {
            return BadRequest(new
            {
                Message = "Platform Admin permissions are system-protected and cannot be modified."
            });
        }

        var existing = await dbContext.Set<SecurityRolePermission>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.SecurityRoleId == roleId)
            .ToListAsync(cancellationToken);

        dbContext.Set<SecurityRolePermission>().RemoveRange(existing);

        foreach (var permissionId in request.PermissionIds ?? new List<Guid>())
        {
            dbContext.Set<SecurityRolePermission>().Add(new SecurityRolePermission(Guid.NewGuid(), tenantContext.TenantId, roleId, permissionId));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "SecurityRolePermission",
            "RolePermissionsUpdated",
            role.Id,
            role.Code,
            $"Permissions updated for role '{role.Name}'.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                RoleId = role.Id,
                role.Code,
                role.Name,
                PermissionCount = request.PermissionIds?.Count ?? 0
            },
            cancellationToken);

        return Ok(new { Message = "Role permissions updated successfully." });
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationDepartment>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Department code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationDepartment>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A department with the same code already exists." });
        }

        var department = new OrganizationDepartment(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive);
        dbContext.Set<OrganizationDepartment>().Add(department);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "OrganizationDepartment",
            "ScopeCreated",
            department.Id,
            department.Code,
            $"Department '{department.Name}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                ScopeType = "Department",
                department.Code,
                department.Name,
                department.Description,
                department.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Department created successfully." });
    }

    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationBranch>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Branch code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationBranch>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A branch with the same code already exists." });
        }

        var branch = new OrganizationBranch(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive);
        dbContext.Set<OrganizationBranch>().Add(branch);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "OrganizationBranch",
            "ScopeCreated",
            branch.Id,
            branch.Code,
            $"Branch '{branch.Name}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                ScopeType = "Branch",
                branch.Code,
                branch.Name,
                branch.Description,
                branch.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Branch created successfully." });
    }

    [HttpGet("cost-centers")]
    public async Task<IActionResult> GetCostCenters([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationCostCenter>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("cost-centers")]
    public async Task<IActionResult> CreateCostCenter([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Cost center code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationCostCenter>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A cost center with the same code already exists." });
        }

        var costCenter = new OrganizationCostCenter(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive);
        dbContext.Set<OrganizationCostCenter>().Add(costCenter);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "OrganizationCostCenter",
            "ScopeCreated",
            costCenter.Id,
            costCenter.Code,
            $"Cost center '{costCenter.Name}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                ScopeType = "CostCenter",
                costCenter.Code,
                costCenter.Name,
                costCenter.Description,
                costCenter.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Cost center created successfully." });
    }

    [HttpGet("users/access-assignments")]
    public async Task<IActionResult> GetUserAccessAssignments([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var users = await dbContext.UserAccounts
            .AsNoTracking()
            .OrderBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                DisplayName = x.FullName,
                x.Role,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        var roleAssignments = await dbContext.Set<UserSecurityRoleAssignment>()
            .AsNoTracking()
            .Join(
                dbContext.Set<SecurityRole>().AsNoTracking(),
                a => a.SecurityRoleId,
                r => r.Id,
                (a, r) => new
                {
                    a.UserAccountId,
                    Role = new
                    {
                        r.Id,
                        r.Code,
                        r.Name,
                        a.IsPrimary
                    }
                })
            .ToListAsync(cancellationToken);

        var scopeAssignments = await dbContext.Set<UserScopeAssignment>()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var items = users.Select(user => new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.DisplayName,
            user.Role,
            user.IsActive,
            Roles = roleAssignments.Where(x => x.UserAccountId == user.Id).Select(x => x.Role).ToList(),
            Scopes = scopeAssignments.Where(x => x.UserAccountId == user.Id).Select(x => new
            {
                x.Id,
                x.ScopeType,
                x.ScopeEntityId,
                x.ScopeCode,
                x.ScopeName
            }).ToList()
        }).ToList();

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPut("users/{userId:guid}/access-assignments")]
    public async Task<IActionResult> SetUserAccessAssignments(Guid userId, [FromBody] SetUserAccessAssignmentsRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var roleIds = (request.RoleIds ?? new List<Guid>()).Distinct().ToList();

        var validRoleCount = await dbContext.Set<SecurityRole>()
            .CountAsync(x => x.TenantId == tenantContext.TenantId && roleIds.Contains(x.Id), cancellationToken);

        if (validRoleCount != roleIds.Count)
        {
            return BadRequest(new { Message = "One or more selected roles were not found." });
        }

        var selectedRoles = await dbContext.Set<SecurityRole>()
            .Where(x => x.TenantId == tenantContext.TenantId && roleIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (!IsCurrentUserPlatformAdmin(User) && selectedRoles.Any(x => IsProtectedRoleCode(x.Code)))
        {
            return Forbid();
        }

        var existingRoles = await dbContext.Set<UserSecurityRoleAssignment>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.UserAccountId == userId)
            .ToListAsync(cancellationToken);

        dbContext.Set<UserSecurityRoleAssignment>().RemoveRange(existingRoles);

        for (var i = 0; i < roleIds.Count; i++)
        {
            dbContext.Set<UserSecurityRoleAssignment>().Add(new UserSecurityRoleAssignment(
                Guid.NewGuid(),
                tenantContext.TenantId,
                userId,
                roleIds[i],
                i == 0));
        }

        var existingScopes = await dbContext.Set<UserScopeAssignment>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.UserAccountId == userId)
            .ToListAsync(cancellationToken);

        dbContext.Set<UserScopeAssignment>().RemoveRange(existingScopes);

        foreach (var scope in request.Scopes ?? new List<UserScopeAssignmentRequest>())
        {
            if (scope.ScopeEntityId == Guid.Empty || string.IsNullOrWhiteSpace(scope.ScopeType))
            {
                continue;
            }

            dbContext.Set<UserScopeAssignment>().Add(new UserScopeAssignment(
                Guid.NewGuid(),
                tenantContext.TenantId,
                userId,
                scope.ScopeType,
                scope.ScopeEntityId,
                scope.ScopeCode,
                scope.ScopeName));
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccessAssignment",
            "UserAccessAssignmentsUpdated",
            userId,
            userId.ToString(),
            "User access assignments updated successfully.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                UserId = userId,
                RoleCount = roleIds.Count,
                ScopeCount = (request.Scopes ?? new List<UserScopeAssignmentRequest>()).Count
            },
            cancellationToken);

        return Ok(new { Message = "User access assignments updated successfully." });
    }

    [HttpGet("workflow-policies")]
    public async Task<IActionResult> GetWorkflowPolicies([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<DepartmentWorkflowPolicy>()
            .AsNoTracking()
            .Join(
                dbContext.Set<OrganizationDepartment>().AsNoTracking(),
                p => p.OrganizationDepartmentId,
                d => d.Id,
                (p, d) => new
                {
                    p.Id,
                    p.ModuleCode,
                    p.OrganizationDepartmentId,
                    DepartmentCode = d.Code,
                    DepartmentName = d.Name,
                    p.MakerCheckerRequired,
                    p.EnforceSegregationOfDuties,
                    p.MinimumApproverCount,
                    p.Notes,
                    p.IsActive
                })
            .OrderBy(x => x.ModuleCode)
            .ThenBy(x => x.DepartmentName)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("workflow-policies")]
    public async Task<IActionResult> CreateWorkflowPolicy([FromBody] UpsertDepartmentWorkflowPolicyRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, [FromServices] IAuditTrailWriter auditTrailWriter, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.OrganizationDepartmentId == Guid.Empty || string.IsNullOrWhiteSpace(request.ModuleCode))
        {
            return BadRequest(new { Message = "Department and module code are required." });
        }

        var exists = await dbContext.Set<DepartmentWorkflowPolicy>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.OrganizationDepartmentId == request.OrganizationDepartmentId && x.ModuleCode == request.ModuleCode.Trim().ToLowerInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A workflow policy already exists for this department and module." });
        }

        var workflowPolicy = new DepartmentWorkflowPolicy(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.ModuleCode,
            request.OrganizationDepartmentId,
            request.MakerCheckerRequired,
            request.EnforceSegregationOfDuties,
            request.MinimumApproverCount,
            request.Notes,
            request.IsActive);

        dbContext.Set<DepartmentWorkflowPolicy>().Add(workflowPolicy);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "DepartmentWorkflowPolicy",
            "WorkflowPolicyCreated",
            workflowPolicy.Id,
            request.ModuleCode,
            "Department workflow policy created successfully.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                workflowPolicy.ModuleCode,
                workflowPolicy.OrganizationDepartmentId,
                workflowPolicy.MakerCheckerRequired,
                workflowPolicy.EnforceSegregationOfDuties,
                workflowPolicy.MinimumApproverCount,
                workflowPolicy.IsActive
            },
            cancellationToken);

        return Ok(new { Message = "Department workflow policy created successfully." });
    }

    public sealed record UpsertSecurityRoleRequest(string Code, string Name, string? Description, bool IsActive);
    public sealed record UpsertSecurityPermissionRequest(string Code, string Module, string Action, string Name, string? Description, bool IsActive);
    public sealed record SetRolePermissionsRequest(List<Guid>? PermissionIds);
    public sealed record UpsertScopeMasterRequest(string Code, string Name, string? Description, bool IsActive);
    public sealed record UserScopeAssignmentRequest(string ScopeType, Guid ScopeEntityId, string? ScopeCode, string? ScopeName);
    public sealed record SetUserAccessAssignmentsRequest(List<Guid>? RoleIds, List<UserScopeAssignmentRequest>? Scopes);
    public sealed record UpsertDepartmentWorkflowPolicyRequest(string ModuleCode, Guid OrganizationDepartmentId, bool MakerCheckerRequired, bool EnforceSegregationOfDuties, int MinimumApproverCount, string? Notes, bool IsActive);
}