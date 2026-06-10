import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  canAccessAdmin,
  canCreateJournals,
  canManageEnterpriseAccessControl,
  canManageFinanceSetup,
  canManagePlatformCommercials,
  canManageTenantUsers,
  canViewAccountsPayable,
  canViewAccountsReceivable,
  canViewBilling,
  canViewBudget,
  canViewExpenseAdvances,
  canViewFinance,
  canViewFleet,
  canViewOilGas,
  canViewFixedAssets,
  canViewInventory,
  canViewPayroll,
  canViewHumanResources,
  canViewApprovalInbox,
  canViewPlatformTenantConsole,
  canViewProcurement,
  canViewWorkingCapital,
  canViewReports,
  canViewTreasury,
  isPlatformAdmin,
} from "../../lib/auth";

function linkClassName(isActive: boolean) {
  return isActive ? "sidebar-link active" : "sidebar-link";
}

type SidebarSectionProps = {
  title: string;
  sectionKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function SidebarSection({
  title,
  sectionKey,
  defaultOpen,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(!!defaultOpen);

  return (
    <div className="sidebar-section">
      <button
        type="button"
        className="sidebar-section-title"
        onClick={() => setIsOpen((value) => !value)}
        style={{
          border: 0,
          width: "100%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          padding: 0,
          textAlign: "left",
        }}
        aria-expanded={isOpen}
        aria-controls={`sidebar-section-${sectionKey}`}
      >
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
      </button>

      {isOpen ? (
        <div id={`sidebar-section-${sectionKey}`} style={{ marginTop: 8 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();

  const canViewFinanceModule = canViewFinance();
  const canViewBudgetModule = canViewBudget();
  const canViewBillingModule = canViewBilling();
  const canViewApprovalInboxModule = canViewApprovalInbox();
  const canViewHumanResourcesModule = canViewHumanResources();
  const canViewPayrollModule = canViewPayroll();
  const canViewProcurementModule = canViewProcurement();
  const canViewApModule = canViewAccountsPayable();
  const canViewArModule = canViewAccountsReceivable();
  const canViewTreasuryModule = canViewTreasury();
  const canViewInventoryModule = canViewInventory();
  const canViewFixedAssetsModule = canViewFixedAssets();
  const canViewReportsModule = canViewReports();
  const canViewWorkingCapitalModule = canViewWorkingCapital();
  const canViewFleetModule = canViewFleet();
  const canViewOilGasModule = canViewOilGas();

  const canViewEamModule = canViewExpenseAdvances();

  const canManageSetup = canManageFinanceSetup();
  const canCreate = canCreateJournals();
  const canAdmin = canAccessAdmin();
  const canManageUsers = canManageTenantUsers();
  const canManageCommercials = canManagePlatformCommercials();
  const canViewTenantConsole = canViewPlatformTenantConsole();
  const canManageAccessControl = canManageEnterpriseAccessControl();

  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (
      path.startsWith("/accounts") ||
      path.startsWith("/journals") ||
      path.startsWith("/fiscal-periods")
    )
      return "gl";
    if (path.startsWith("/budgets") || path.startsWith("/budget-vs-actual"))
      return "budget";
    if (path.startsWith("/fixed-assets")) return "fixed-assets";
    if (path.startsWith("/bank-accounts")) return "treasury";
    if (path.startsWith("/reconciliation")) return "reconciliation";
    if (path.startsWith("/inventory")) return "inventory";
    if (
      path.startsWith("/customers") ||
      path.startsWith("/sales-invoices") ||
      path.startsWith("/customer-receipts")
    )
      return "ar";
    if (
      path.startsWith("/vendors") ||
      path.startsWith("/purchase-requisitions") ||
      path.startsWith("/purchase-orders") ||
      path.startsWith("/purchase-invoices") ||
      path.startsWith("/vendor-payments")
    )
      return "ap";
    if (
      path.startsWith("/reports") ||
      path.startsWith("/ageing-analysis") ||
      path.startsWith("/dashboard")
    )
      return "overview";
    if (path.startsWith("/admin")) return "admin";
    if (path.startsWith("/working-capital")) return "working-capital";
    if (path.startsWith("/eam")) return "eam";
    if (path.startsWith("/oil-gas")) return "oil-gas";
    if (path.startsWith("/fleet")) return "fleet";
    if (path.startsWith("/billing")) return "billing";
    if (path.startsWith("/approvals")) return "approvals";
    if (path.startsWith("/hr")) return "hr";
    if (path.startsWith("/payroll")) return "payroll";
    return "overview";
  }, [location.pathname]);

  return (
    <aside className="sidebar">
      <NavLink
        to="/workspace"
        className="sidebar-brand"
        aria-label="Open iBalance workspace"
      >
        <img
          src="/assets/branding/ibalance-logo.png"
          alt="iBalance ERP"
          className="sidebar-brand-logo"
        />
        <div className="sidebar-brand-copy">
          <div className="sidebar-brand-title">iBalance</div>
          <div className="muted sidebar-brand-subtitle">ERP Cloud</div>
        </div>
      </NavLink>

      <nav className="sidebar-nav">
        {canViewFinanceModule ||
        canViewBudgetModule ||
        canViewPayrollModule ||
        canViewApprovalInboxModule ||
        canViewHumanResourcesModule ||
        canViewProcurementModule ||
        canViewApModule ||
        canViewArModule ||
        canViewTreasuryModule ||
        canViewInventoryModule ||
        canViewFixedAssetsModule ||
        canViewFleetModule ||
        canViewBillingModule ||
        canViewEamModule ||
        canViewWorkingCapitalModule ? (
          <>
            {canViewReportsModule ? (
              <SidebarSection
                title="Overview"
                sectionKey="overview"
                defaultOpen={activeSection === "overview"}
              >
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
                <NavLink
                  to="/ageing-analysis"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Ageing Analysis
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewFinanceModule ? (
              <SidebarSection
                title="General Ledger"
                sectionKey="gl"
                defaultOpen={activeSection === "gl"}
              >
                <NavLink
                  to="/accounts"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Chart of Accounts
                </NavLink>
                <NavLink
                  to="/journals"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Journals
                </NavLink>
                <NavLink
                  to="/journals/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Journals
                </NavLink>
                {canManageSetup ? (
                  <NavLink
                    to="/fiscal-periods"
                    className={({ isActive }) => linkClassName(isActive)}
                  >
                    Fiscal Periods
                  </NavLink>
                ) : null}
              </SidebarSection>
            ) : null}

            {canViewBudgetModule ? (
              <SidebarSection
                title="Budget Control"
                sectionKey="budget"
                defaultOpen={activeSection === "budget"}
              >
                <NavLink
                  to="/budgets"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Budgets
                </NavLink>
                <NavLink
                  to="/budgets/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Budgets
                </NavLink>
                <NavLink
                  to="/budget-vs-actual"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Budget vs Actual
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewFixedAssetsModule ? (
              <SidebarSection
                title="Fixed Assets"
                sectionKey="fixed-assets"
                defaultOpen={activeSection === "fixed-assets"}
              >
                <NavLink
                  to="/fixed-assets"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Fixed Assets
                </NavLink>
                <NavLink
                  to="/fixed-assets/depreciation-runs"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Depreciation Runs
                </NavLink>
                <NavLink
                  to="/fixed-assets/register/print"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Asset Register Print
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewTreasuryModule ? (
              <>
                <SidebarSection
                  title="Treasury & Banking"
                  sectionKey="treasury"
                  defaultOpen={activeSection === "treasury"}
                >
                  <NavLink
                    to="/bank-accounts"
                    className={({ isActive }) => linkClassName(isActive)}
                  >
                    Bank Accounts
                  </NavLink>
                </SidebarSection>

                <SidebarSection
                  title="Reconciliation"
                  sectionKey="reconciliation"
                  defaultOpen={activeSection === "reconciliation"}
                >
                  <NavLink
                    to="/reconciliation"
                    className={({ isActive }) => linkClassName(isActive)}
                  >
                    Reconciliation
                  </NavLink>
                </SidebarSection>
              </>
            ) : null}

            {canViewApprovalInboxModule ? (
              <SidebarSection
                title="Approvals"
                sectionKey="approvals"
                defaultOpen={activeSection === "approvals"}
              >
                <NavLink
                  to="/approvals"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Central Inbox
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewHumanResourcesModule ? (
              <SidebarSection
                title="Human Resources"
                sectionKey="hr"
                defaultOpen={activeSection === "hr"}
              >
                <NavLink
                  to="/hr"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/hr/employees"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Employees
                </NavLink>
                <NavLink
                  to="/hr/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Setup
                </NavLink>
                <NavLink
                  to="/hr/leave"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Leave Management
                </NavLink>
                <NavLink
                  to="/hr/training"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Training
                </NavLink>
                <NavLink
                  to="/hr/disciplinary"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Disciplinary
                </NavLink>
                <NavLink
                  to="/hr/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewPayrollModule ? (
              <SidebarSection
                title="Payroll"
                sectionKey="payroll"
                defaultOpen={activeSection === "payroll"}
              >
                <NavLink
                  to="/payroll"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Payroll Dashboard
                </NavLink>
                <NavLink
                  to="/payroll/employees"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Employees
                </NavLink>
                <NavLink
                  to="/payroll/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Payroll Setup
                </NavLink>
                <NavLink
                  to="/payroll/runs"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Payroll Runs
                </NavLink>
                <NavLink
                  to="/payroll/runs/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Payroll Runs
                </NavLink>
                <NavLink
                  to="/payroll/payslips"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Payslips
                </NavLink>
                <NavLink
                  to="/payroll/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Statutory Reports
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewOilGasModule ? (
              <SidebarSection
                title="Oil & Gas Operations"
                sectionKey="oil-gas"
                defaultOpen={activeSection === "oil-gas"}
              >
                <NavLink
                  to="/oil-gas"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/oil-gas/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Setup & Chart of Accounts
                </NavLink>
                <NavLink
                  to="/oil-gas/assets"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Assets, Tanks & Meters
                </NavLink>
                <NavLink
                  to="/oil-gas/production"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Daily Production
                </NavLink>
                <NavLink
                  to="/oil-gas/production/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Production
                </NavLink>
                <NavLink
                  to="/oil-gas/stock"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Stock Movements & Liftings
                </NavLink>
                <NavLink
                  to="/oil-gas/stock/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Stock Movements
                </NavLink>
                <NavLink
                  to="/oil-gas/reconciliation"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Tank Reconciliation
                </NavLink>
                <NavLink
                  to="/oil-gas/metering"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Meter Readings & Calibration
                </NavLink>
                <NavLink
                  to="/oil-gas/renewals"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Permit Renewals
                </NavLink>
                <NavLink
                  to="/oil-gas/compliance"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Licences & Compliance
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Upstream Control Centre
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/liftings"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Liftings & Deliveries
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/afe"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  AFE & Project Cost
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/partners"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  JV Partners & Funding
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/production-close"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Monthly Production Close
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/hse"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  HSE & Corrective Actions
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/equipment"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Equipment & Integrity
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/documents"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Operational Documents
                </NavLink>
                <NavLink
                  to="/oil-gas/upstream/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Upstream Reports
                </NavLink>
                <NavLink
                  to="/oil-gas/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewFleetModule ? (
              <SidebarSection
                title="Fleet Management"
                sectionKey="fleet"
                defaultOpen={activeSection === "fleet"}
              >
                <NavLink
                  to="/fleet"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/fleet/vehicles"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Vehicles
                </NavLink>
                <NavLink
                  to="/fleet/drivers"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Drivers
                </NavLink>
                <NavLink
                  to="/fleet/trips"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Trips
                </NavLink>
                <NavLink
                  to="/fleet/fuel-logs"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Fuel Logs
                </NavLink>
                <NavLink
                  to="/fleet/maintenance"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Maintenance
                </NavLink>
                <NavLink
                  to="/fleet/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Policy Setup
                </NavLink>
                <NavLink
                  to="/fleet/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewBillingModule ? (
              <SidebarSection
                title="Billing & Invoicing"
                sectionKey="billing"
                defaultOpen={activeSection === "billing"}
              >
                <NavLink
                  to="/billing"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/billing/invoices"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Invoices
                </NavLink>
                <NavLink
                  to="/billing/invoices/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Invoices
                </NavLink>
                <NavLink
                  to="/billing/approval-queue"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Approval Queue
                </NavLink>
                <NavLink
                  to="/billing/credit-notes"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Credit Notes
                </NavLink>
                <NavLink
                  to="/billing/credit-notes/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Credit Notes
                </NavLink>
                <NavLink
                  to="/billing/payments/allocate"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Payment Allocation
                </NavLink>
                <NavLink
                  to="/billing/outstanding"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Outstanding
                </NavLink>
                <NavLink
                  to="/billing/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
                <NavLink
                  to="/billing/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Setup
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewWorkingCapitalModule ? (
              <SidebarSection
                title="Working Capital"
                sectionKey="working-capital"
                defaultOpen={activeSection === "working-capital"}
              >
                <NavLink
                  to="/working-capital"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Working Capital Management Dashboard
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewInventoryModule ? (
              <SidebarSection
                title="Inventory"
                sectionKey="inventory"
                defaultOpen={activeSection === "inventory"}
              >
                <NavLink
                  to="/inventory"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Inventory Management
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewArModule ? (
              <SidebarSection
                title="Accounts Receivable"
                sectionKey="ar"
                defaultOpen={activeSection === "ar"}
              >
                <NavLink
                  to="/customers"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Customers
                </NavLink>
                <NavLink
                  to="/sales-invoices"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Sales Invoices
                </NavLink>
                <NavLink
                  to="/sales-invoices/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Sales Invoices
                </NavLink>
                <NavLink
                  to="/customer-receipts"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Customer Receipts
                </NavLink>
                <NavLink
                  to="/customer-receipts/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Customer Receipts
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewProcurementModule || canViewApModule ? (
              <SidebarSection
                title="Accounts Payable / Procurement"
                sectionKey="ap"
                defaultOpen={activeSection === "ap"}
              >
                {canViewApModule ? (
                  <>
                    <NavLink
                      to="/vendors"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Vendors
                    </NavLink>
                    <NavLink
                      to="/purchase-invoices"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Purchase Invoices
                    </NavLink>
                    <NavLink
                      to="/purchase-invoices/rejected"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Rejected Purchase Invoices
                    </NavLink>
                    <NavLink
                      to="/vendor-payments"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Vendor Payments
                    </NavLink>
                    <NavLink
                      to="/vendor-payments/rejected"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Rejected Vendor Payments
                    </NavLink>
                  </>
                ) : null}

                {canViewProcurementModule ? (
                  <>
                    <NavLink
                      to="/purchase-requisitions"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Purchase Requisitions
                    </NavLink>
                    <NavLink
                      to="/purchase-requisitions/rejected"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Rejected Requisitions
                    </NavLink>
                    <NavLink
                      to="/purchase-orders"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Purchase Orders
                    </NavLink>
                    <NavLink
                      to="/purchase-order-receipts"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Purchase Order Receipts
                    </NavLink>
                    <NavLink
                      to="/purchase-orders/rejected"
                      className={({ isActive }) => linkClassName(isActive)}
                    >
                      Rejected Purchase Orders
                    </NavLink>
                  </>
                ) : null}
              </SidebarSection>
            ) : null}

            {canViewEamModule ? (
              <SidebarSection
                title="Expense & Advance Management"
                sectionKey="eam"
                defaultOpen={activeSection === "eam"}
              >
                <NavLink
                  to="/eam"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/eam/requests"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Advance Requests
                </NavLink>
                <NavLink
                  to="/eam/requests/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Advances
                </NavLink>
                <NavLink
                  to="/eam/approval-queue"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Approval Queue
                </NavLink>
                <NavLink
                  to="/eam/disbursements"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Disbursements
                </NavLink>
                <NavLink
                  to="/eam/retirements"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Retirements
                </NavLink>
                <NavLink
                  to="/eam/retirements/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Rejected Retirements
                </NavLink>
                <NavLink
                  to="/eam/refunds"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Refunds
                </NavLink>
                <NavLink
                  to="/eam/recoveries"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Recoveries
                </NavLink>
                <NavLink
                  to="/eam/imprest-register"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Imprest Register
                </NavLink>
                <NavLink
                  to="/eam/travel-advances"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Travel Advances
                </NavLink>
                <NavLink
                  to="/eam/operational-float"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Operational Float
                </NavLink>
                <NavLink
                  to="/eam/outstanding"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Outstanding Advances
                </NavLink>
                <NavLink
                  to="/eam/overdue"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Overdue Advances
                </NavLink>
                <NavLink
                  to="/eam/setup"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Policy Setup
                </NavLink>
                <NavLink
                  to="/eam/reports"
                  className={({ isActive }) => linkClassName(isActive)}
                >
                  Reports
                </NavLink>
              </SidebarSection>
            ) : null}

            {canViewFinanceModule ? (
              <SidebarSection
                title="Workflow"
                sectionKey="workflow"
                defaultOpen={false}
              >
                <div className="sidebar-note">
                  {canCreate
                    ? "You can create and manage accounting transactions in this workspace."
                    : "You currently have read-only access to accounting information."}
                </div>
              </SidebarSection>
            ) : null}
          </>
        ) : null}

        {canAdmin ? (
          <SidebarSection
            title="Administration"
            sectionKey="admin"
            defaultOpen={activeSection === "admin"}
          >
            <NavLink
              to="/admin"
              className={({ isActive }) => linkClassName(isActive)}
            >
              Administration
            </NavLink>

            {canManageAccessControl ? (
              <NavLink
                to="/admin/access-control"
                className={({ isActive }) => linkClassName(isActive)}
              >
                Access Control
              </NavLink>
            ) : null}

            <NavLink
              to="/admin/audit-trail"
              className={({ isActive }) => linkClassName(isActive)}
            >
              Audit Trail
            </NavLink>

            {canManageUsers ? (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => linkClassName(isActive)}
              >
                User Management
              </NavLink>
            ) : null}

            {canManageCommercials ? (
              <NavLink
                to="/admin/settings"
                className={({ isActive }) => linkClassName(isActive)}
              >
                Commercial Settings
              </NavLink>
            ) : null}

            {canViewTenantConsole ? (
              <NavLink
                to="/admin/tenants/00000000-0000-0000-0000-000000000000"
                className={({ isActive }) => linkClassName(isActive)}
              >
                Platform Tenant Console
              </NavLink>
            ) : null}

            {isPlatformAdmin() ? (
              <NavLink
                to="/admin/tenant-modules"
                className={({ isActive }) => linkClassName(isActive)}
              >
                Tenant Module Activation
              </NavLink>
            ) : null}
          </SidebarSection>
        ) : null}
      </nav>
    </aside>
  );
}
