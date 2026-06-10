import type { PropsWithChildren } from 'react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import {
  getCompanyLogoDataUrl,
  getCurrentTenantLicense,
  getTenantKey,
  getTenantLogoDataUrl,
  setTenantKey,
} from '../../lib/api';
import {
  canAccessAdmin,
  canSwitchTenantContext,
  getDisplayRoles,
  getSession,
  isPlatformAdmin,
  logout,
} from '../../lib/auth';

function licenseLabel(value?: number) {
  switch (value) {
    case 1:
      return 'Active';
    case 2:
      return 'Renewal Due Soon';
    case 3:
      return 'Expired';
    case 4:
      return 'Suspended';
    default:
      return 'Unavailable';
  }
}

const IBALANCE_LOGO_PATH = '/assets/branding/ibalance-logo.png';

type PageMetadata = {
  title: string;
  subtitle: string;
};

const pageMetadata: Array<{
  matches: (pathname: string) => boolean;
  metadata: PageMetadata;
}> = [
  { matches: (p) => p.startsWith('/oil-gas/production/rejected'), metadata: { title: 'Rejected Oil & Gas Production', subtitle: 'Correct rejected production entries, review rejection reasons, and resubmit through maker/checker.' } },
  { matches: (p) => p.startsWith('/oil-gas/stock/rejected'), metadata: { title: 'Rejected Oil & Gas Stock Movements', subtitle: 'Correct and resubmit rejected receipts, transfers, liftings, deliveries, losses, and adjustments.' } },
  { matches: (p) => p.startsWith('/oil-gas/reconciliation'), metadata: { title: 'Oil & Gas Tank Reconciliation', subtitle: 'Reconcile tank receipts, issues, adjustments, book stock, and unposted operational movements.' } },
  { matches: (p) => p.startsWith('/oil-gas/metering'), metadata: { title: 'Meter Readings & Calibration', subtitle: 'Capture meter readings, maintain calibration history, and monitor calibration due dates.' } },
  { matches: (p) => p.startsWith('/oil-gas/renewals'), metadata: { title: 'Oil & Gas Permit Renewals', subtitle: 'Manage licence and permit renewal submissions, approvals, costs, and expiry dates.' } },
  { matches: (p) => p.startsWith('/oil-gas/production'), metadata: { title: 'Daily Oil & Gas Production', subtitle: 'Capture, submit, approve, reject, and monitor daily oil, gas, water, stock, flare, and downtime records.' } },
  { matches: (p) => p.startsWith('/oil-gas/stock'), metadata: { title: 'Stock Movements & Liftings', subtitle: 'Control production receipts, transfers, liftings, deliveries, consumption, losses, and tank posting.' } },
  { matches: (p) => p.startsWith('/oil-gas/setup'), metadata: { title: 'Oil & Gas Setup & Chart of Accounts', subtitle: 'Configure operational master data and map Oil & Gas activities to the shared iBalance Chart of Accounts.' } },
  { matches: (p) => p.startsWith('/oil-gas/assets'), metadata: { title: 'Oil & Gas Assets, Tanks & Meters', subtitle: 'Manage business units, assets, operational locations, products, tanks, and measurement devices.' } },
  { matches: (p) => p.startsWith('/oil-gas/compliance'), metadata: { title: 'Oil & Gas Licences & Compliance', subtitle: 'Maintain regulatory licences, permits, responsible officers, validity periods, and expiry alerts.' } },
  { matches: (p) => p.startsWith('/oil-gas/reports'), metadata: { title: 'Oil & Gas Operational Reports', subtitle: 'Review production, flare, tank stock, meter calibration, permit expiry, and reconciliation reports.' } },
  { matches: (p) => p === '/oil-gas' || p.startsWith('/oil-gas/'), metadata: { title: 'Oil & Gas Operations Dashboard', subtitle: 'Monitor production, tank stock, approvals, metering, permits, and operational exceptions.' } },

  { matches: (p) => p.startsWith('/billing/invoices/rejected'), metadata: { title: 'Rejected Billing Invoices', subtitle: 'Correct, resubmit, or cancel rejected billing invoices.' } },
  { matches: (p) => p.startsWith('/billing/credit-notes/rejected'), metadata: { title: 'Rejected Billing Credit Notes', subtitle: 'Correct rejected credit notes and resubmit them through approval.' } },
  { matches: (p) => p.startsWith('/billing/approval-queue'), metadata: { title: 'Billing Approval Queue', subtitle: 'Review and process billing transactions awaiting checker action.' } },
  { matches: (p) => p.startsWith('/billing/credit-notes'), metadata: { title: 'Billing Credit Notes', subtitle: 'Create and process customer credit notes integrated with Accounts Receivable.' } },
  { matches: (p) => p.startsWith('/billing/payments/allocate'), metadata: { title: 'Billing Payment Allocation', subtitle: 'Allocate customer payments against outstanding billing invoices.' } },
  { matches: (p) => p.startsWith('/billing/outstanding'), metadata: { title: 'Billing Outstanding Balances', subtitle: 'Review unpaid and partially paid billing invoices and customer balances.' } },
  { matches: (p) => p.startsWith('/billing/reports'), metadata: { title: 'Billing & Invoicing Reports', subtitle: 'Review billing performance, customer balances, credit notes, and collections.' } },
  { matches: (p) => p.startsWith('/billing/setup'), metadata: { title: 'Billing & Invoicing Setup', subtitle: 'Configure billing policies, numbering, pricing, and shared posting-enabled ledger accounts.' } },
  { matches: (p) => p.startsWith('/billing/invoices'), metadata: { title: 'Billing Invoice Management', subtitle: 'Create, submit, approve, reject, post, and monitor customer billing invoices.' } },
  { matches: (p) => p === '/billing', metadata: { title: 'Billing & Invoicing Dashboard', subtitle: 'Monitor invoices, approvals, collections, credit notes, and outstanding balances.' } },

  { matches: (p) => p.startsWith('/hr/employees'), metadata: { title: 'Employee Management', subtitle: 'Create, import, edit, filter, print, and maintain employee records.' } },
  { matches: (p) => p.startsWith('/hr/setup'), metadata: { title: 'HRM Setup', subtitle: 'Manage departments, designations, grades, and Human Resources master data.' } },
  { matches: (p) => p.startsWith('/hr/leave'), metadata: { title: 'Leave Management', subtitle: 'Create, review, approve, reject, and monitor employee leave requests.' } },
  { matches: (p) => p.startsWith('/hr/training'), metadata: { title: 'Employee Training Management', subtitle: 'Maintain employee training, development, and competency records.' } },
  { matches: (p) => p.startsWith('/hr/disciplinary'), metadata: { title: 'Employee Disciplinary Management', subtitle: 'Maintain controlled employee disciplinary records and actions.' } },
  { matches: (p) => p.startsWith('/hr/reports'), metadata: { title: 'Human Resources Reports', subtitle: 'Review workforce, leave, training, status, and employee register reports.' } },
  { matches: (p) => p === '/hr', metadata: { title: 'Human Resources Dashboard', subtitle: 'Monitor workforce records, leave, training, disciplinary actions, and HR metrics.' } },

  { matches: (p) => p.startsWith('/payroll/runs/rejected'), metadata: { title: 'Rejected Payroll Runs', subtitle: 'Review, correct, and resubmit rejected payroll runs.' } },
  { matches: (p) => p.startsWith('/payroll/employees'), metadata: { title: 'Payroll Employees', subtitle: 'Manage payroll employee profiles and HRM-to-Payroll links.' } },
  { matches: (p) => p.startsWith('/payroll/setup'), metadata: { title: 'Payroll Setup', subtitle: 'Configure pay groups, pay elements, salary structures, policies, and HRM integration.' } },
  { matches: (p) => p.startsWith('/payroll/runs'), metadata: { title: 'Payroll Runs', subtitle: 'Generate, submit, approve, reject, post, and monitor payroll processing.' } },
  { matches: (p) => p.startsWith('/payroll/payslips'), metadata: { title: 'Payroll Payslips', subtitle: 'Review and generate employee payslips for completed payroll periods.' } },
  { matches: (p) => p.startsWith('/payroll/reports'), metadata: { title: 'Payroll Statutory Reports', subtitle: 'Review payroll summaries, statutory deductions, and payroll control reports.' } },
  { matches: (p) => p === '/payroll', metadata: { title: 'Payroll Dashboard', subtitle: 'Monitor payroll employees, processing periods, salary structures, approvals, and posting.' } },

  { matches: (p) => p.startsWith('/fleet/vehicles'), metadata: { title: 'Fleet Vehicle Management', subtitle: 'Register and maintain vehicles, assignments, operating status, and related details.' } },
  { matches: (p) => p.startsWith('/fleet/drivers'), metadata: { title: 'Fleet Driver Management', subtitle: 'Register and maintain drivers, licence details, status, and vehicle assignments.' } },
  { matches: (p) => p.startsWith('/fleet/trips'), metadata: { title: 'Fleet Trip Management', subtitle: 'Create, submit, approve, reject, post, and monitor vehicle trips.' } },
  { matches: (p) => p.startsWith('/fleet/fuel-logs'), metadata: { title: 'Fleet Fuel Logs', subtitle: 'Capture, review, approve, and post vehicle fuel usage and costs.' } },
  { matches: (p) => p.startsWith('/fleet/maintenance'), metadata: { title: 'Fleet Maintenance', subtitle: 'Manage maintenance work orders, approvals, costs, and ledger postings.' } },
  { matches: (p) => p.startsWith('/fleet/setup'), metadata: { title: 'Fleet Policy Setup', subtitle: 'Configure fleet operational policies and shared ledger mappings.' } },
  { matches: (p) => p.startsWith('/fleet/reports'), metadata: { title: 'Fleet Management Reports', subtitle: 'Review fleet usage, fuel, maintenance, vehicle, and operating-cost reports.' } },
  { matches: (p) => p === '/fleet', metadata: { title: 'Fleet Management Dashboard', subtitle: 'Monitor vehicles, drivers, trips, fuel, maintenance, and fleet costs.' } },

  { matches: (p) => p.startsWith('/eam/requests/rejected'), metadata: { title: 'Rejected Advance Requests', subtitle: 'Correct, delete where allowed, and resubmit rejected advance requests.' } },
  { matches: (p) => p.startsWith('/eam/retirements/rejected'), metadata: { title: 'Rejected Advance Retirements', subtitle: 'Correct and resubmit rejected advance retirement records.' } },
  { matches: (p) => p.startsWith('/eam/approval-queue'), metadata: { title: 'Advance Approval Queue', subtitle: 'Review submitted advance and retirement transactions awaiting approval.' } },
  { matches: (p) => p.startsWith('/eam/disbursements'), metadata: { title: 'Advance Disbursements', subtitle: 'Disburse approved advances through configured cash and bank accounts.' } },
  { matches: (p) => p.startsWith('/eam/retirements'), metadata: { title: 'Advance Retirements', subtitle: 'Retire disbursed advances, capture expenses, refunds, and supporting references.' } },
  { matches: (p) => p.startsWith('/eam/refunds'), metadata: { title: 'Advance Refunds', subtitle: 'Record and monitor refunds arising from advance retirement.' } },
  { matches: (p) => p.startsWith('/eam/recoveries'), metadata: { title: 'Advance Recoveries', subtitle: 'Manage recoverable balances and employee advance recovery actions.' } },
  { matches: (p) => p.startsWith('/eam/imprest-register'), metadata: { title: 'Imprest Register', subtitle: 'Review imprest balances, custodians, utilisation, and retirement status.' } },
  { matches: (p) => p.startsWith('/eam/travel-advances'), metadata: { title: 'Travel Advances', subtitle: 'Manage travel-related advances, approvals, disbursements, and retirements.' } },
  { matches: (p) => p.startsWith('/eam/operational-float'), metadata: { title: 'Operational Float', subtitle: 'Manage operational float requests, usage, retirement, and replenishment.' } },
  { matches: (p) => p.startsWith('/eam/outstanding'), metadata: { title: 'Outstanding Advances', subtitle: 'Review unretired and partially retired employee advances.' } },
  { matches: (p) => p.startsWith('/eam/overdue'), metadata: { title: 'Overdue Advances', subtitle: 'Identify overdue advances and initiate follow-up or recovery actions.' } },
  { matches: (p) => p.startsWith('/eam/setup'), metadata: { title: 'Expense & Advance Policy Setup', subtitle: 'Configure advance types, expense categories, policies, and shared posting accounts.' } },
  { matches: (p) => p.startsWith('/eam/reports'), metadata: { title: 'Expense & Advance Reports', subtitle: 'Review advance, retirement, outstanding, overdue, refund, and recovery reports.' } },
  { matches: (p) => p.startsWith('/eam/requests'), metadata: { title: 'Advance Requests', subtitle: 'Create, update, submit, and monitor employee advance requests.' } },
  { matches: (p) => p === '/eam', metadata: { title: 'Expense & Advance Dashboard', subtitle: 'Monitor staff advances, retirement, refunds, recoveries, float, and imprest controls.' } },

  { matches: (p) => p.startsWith('/journals/rejected'), metadata: { title: 'Rejected Journals', subtitle: 'Correct, resubmit, or void rejected journal entries.' } },
  { matches: (p) => p.startsWith('/sales-invoices/rejected'), metadata: { title: 'Rejected Sales Invoices', subtitle: 'Correct, resubmit, or delete rejected sales invoices.' } },
  { matches: (p) => p.startsWith('/customer-receipts/rejected'), metadata: { title: 'Rejected Customer Receipts', subtitle: 'Correct, resubmit, or delete rejected customer receipts.' } },
  { matches: (p) => p.startsWith('/purchase-requisitions/rejected'), metadata: { title: 'Rejected Purchase Requisitions', subtitle: 'Correct, resubmit, or delete rejected purchase requisitions.' } },
  { matches: (p) => p.startsWith('/purchase-orders/rejected'), metadata: { title: 'Rejected Purchase Orders', subtitle: 'Correct, resubmit, or delete rejected purchase orders.' } },
  { matches: (p) => p.startsWith('/purchase-invoices/rejected'), metadata: { title: 'Rejected Purchase Invoices', subtitle: 'Correct, resubmit, or delete rejected purchase invoices.' } },
  { matches: (p) => p.startsWith('/vendor-payments/rejected'), metadata: { title: 'Rejected Vendor Payments', subtitle: 'Correct, resubmit, or delete rejected vendor payments.' } },
  { matches: (p) => p.startsWith('/budgets/rejected'), metadata: { title: 'Rejected Budgets', subtitle: 'Correct, resubmit, or delete rejected budgets.' } },
  { matches: (p) => p.startsWith('/fixed-assets/depreciation-runs'), metadata: { title: 'Fixed Asset Depreciation Runs', subtitle: 'Preview, run, and review fixed asset depreciation cycles and postings.' } },
  { matches: (p) => p.startsWith('/fixed-assets/register/print'), metadata: { title: 'Fixed Asset Register', subtitle: 'Review and print the fixed asset register in a clean standalone layout.' } },
  { matches: (p) => p.startsWith('/customer-receipts/') && p.endsWith('/print'), metadata: { title: 'Customer Receipt', subtitle: 'Review and print the selected customer receipt.' } },
  { matches: (p) => p.startsWith('/vendor-payments/') && p.endsWith('/voucher'), metadata: { title: 'Vendor Payment Voucher', subtitle: 'Review and print the selected vendor payment voucher.' } },
  { matches: (p) => p.startsWith('/vendors/') && p.endsWith('/statement'), metadata: { title: 'Vendor Statement', subtitle: 'Review vendor transactions, payments, and outstanding balances.' } },
  { matches: (p) => p.startsWith('/admin/access-control'), metadata: { title: 'Enterprise Access Control', subtitle: 'Manage roles, permissions, organisational scopes, and workflow policies.' } },
  { matches: (p) => p.startsWith('/admin/audit-trail'), metadata: { title: 'Audit Trail', subtitle: 'Review traceable user, security, workflow, and transaction activity.' } },
  { matches: (p) => p.startsWith('/admin/tenant-modules'), metadata: { title: 'Tenant Module Activation', subtitle: 'Activate or deactivate ERP modules for each tenant.' } },
  { matches: (p) => p.startsWith('/admin/subscription-applications'), metadata: { title: 'Subscription Applications', subtitle: 'Review, confirm, or reject tenant subscription and payment applications.' } },
  { matches: (p) => p.startsWith('/admin/settings'), metadata: { title: 'Commercial Settings', subtitle: 'Manage subscription packages, payment instructions, and platform commercial settings.' } },
  { matches: (p) => p.startsWith('/admin/users'), metadata: { title: 'User Management', subtitle: 'Create, activate, deactivate, and maintain platform or tenant users.' } },
  { matches: (p) => p.startsWith('/admin/tenants/'), metadata: { title: 'Tenant Administration', subtitle: 'Review tenant details, users, subscription, modules, and administrative controls.' } },
  { matches: (p) => p === '/admin', metadata: { title: 'Administration Dashboard', subtitle: 'Manage tenants, users, subscriptions, access control, modules, and audit information.' } },

  { matches: (p) => p.startsWith('/approvals'), metadata: { title: 'Central Approval Inbox', subtitle: 'Review pending and rejected workflow items across enabled ERP modules.' } },
  { matches: (p) => p.startsWith('/budget-vs-actual'), metadata: { title: 'Budget vs Actual', subtitle: 'Compare approved budgets with posted accounting actuals and variances.' } },
  { matches: (p) => p.startsWith('/fixed-assets'), metadata: { title: 'Fixed Asset Management', subtitle: 'Manage asset classes, capitalization, depreciation, register records, and lifecycle actions.' } },
  { matches: (p) => p.startsWith('/working-capital'), metadata: { title: 'Working Capital Management', subtitle: 'Monitor liquidity, receivables, payables, and working-capital performance.' } },
  { matches: (p) => p.startsWith('/reconciliation'), metadata: { title: 'Bank Reconciliation', subtitle: 'Match bank statements with ledger entries and resolve differences.' } },
  { matches: (p) => p.startsWith('/ageing-analysis'), metadata: { title: 'Ageing Analysis', subtitle: 'Review receivable and payable balances by ageing bucket.' } },
  { matches: (p) => p.startsWith('/accounts'), metadata: { title: 'Chart of Accounts', subtitle: 'Manage the shared ledger structure and posting-enabled accounts.' } },
  { matches: (p) => p.startsWith('/journals'), metadata: { title: 'Journal Management', subtitle: 'Create, submit, approve, reject, post, reverse, and review journals.' } },
  { matches: (p) => p.startsWith('/customers'), metadata: { title: 'Customer Management', subtitle: 'Register and maintain Accounts Receivable customers.' } },
  { matches: (p) => p.startsWith('/sales-invoices'), metadata: { title: 'Sales Invoice Management', subtitle: 'Create, approve, post, and monitor sales invoices and receivables.' } },
  { matches: (p) => p.startsWith('/customer-receipts'), metadata: { title: 'Customer Receipt Management', subtitle: 'Capture collections and apply receipts against customer balances.' } },
  { matches: (p) => p.startsWith('/purchase-requisitions'), metadata: { title: 'Purchase Requisition Management', subtitle: 'Raise, approve, reject, and monitor purchase requests before commitment.' } },
  { matches: (p) => p.startsWith('/purchase-order-receipts'), metadata: { title: 'Purchase Order Receipts', subtitle: 'Receive approved purchase orders into Inventory and support AP matching.' } },
  { matches: (p) => p.startsWith('/purchase-orders'), metadata: { title: 'Purchase Order Management', subtitle: 'Create, approve, issue, and monitor vendor purchase orders.' } },
  { matches: (p) => p.startsWith('/vendors'), metadata: { title: 'Vendor Management', subtitle: 'Register and maintain Accounts Payable vendors.' } },
  { matches: (p) => p.startsWith('/purchase-invoices'), metadata: { title: 'Purchase Invoice Management', subtitle: 'Capture, approve, post, and monitor supplier invoices and payables.' } },
  { matches: (p) => p.startsWith('/vendor-payments'), metadata: { title: 'Vendor Payment Management', subtitle: 'Create, approve, post, and monitor supplier payments.' } },
  { matches: (p) => p.startsWith('/fiscal-periods'), metadata: { title: 'Fiscal Period Management', subtitle: 'Manage accounting periods and open or close posting operations.' } },
  { matches: (p) => p.startsWith('/bank-accounts'), metadata: { title: 'Bank & Cash Setup', subtitle: 'Maintain operational bank accounts linked to shared cash and bank ledgers.' } },
  { matches: (p) => p.startsWith('/inventory'), metadata: { title: 'Inventory Management', subtitle: 'Manage items, warehouses, stock movements, valuation, and stock position.' } },
  { matches: (p) => p.startsWith('/reports'), metadata: { title: 'Financial Reports', subtitle: 'Review trial balance, financial statements, cash flow, and print-ready reports.' } },
  { matches: (p) => p.startsWith('/budgets'), metadata: { title: 'Budget Management', subtitle: 'Create, approve, lock, close, upload, transfer, and control budgets.' } },
  { matches: (p) => p.startsWith('/dashboard'), metadata: { title: 'Finance Dashboard', subtitle: 'Review operational and financial activity across the ERP workspace.' } },
  { matches: (p) => p.startsWith('/no-active-modules'), metadata: { title: 'No Active Modules', subtitle: 'This tenant currently has no active application modules available.' } },
];

function pageMetadataForPath(pathname: string): PageMetadata {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return pageMetadata.find((item) => item.matches(normalizedPath))?.metadata ?? {
    title: 'iBalance ERP',
    subtitle: 'Manage, monitor, and optimize your organisation through one controlled ERP workspace.',
  };
}

function pageTitleForPath(pathname: string) {
  return pageMetadataForPath(pathname).title;
}

function pageSubtitleForPath(pathname: string) {
  return pageMetadataForPath(pathname).subtitle;
}

function LogoSlot({
  src,
  fallbackText,
}: {
  src: string;
  fallbackText: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallbackText}
        style={{ height: 36, maxWidth: 150, objectFit: 'contain' }}
      />
    );
  }

  return (
    <div className="logo-fallback">
      {fallbackText.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatRoleLabel(role: string) {
  return role.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const session = getSession();
  const platformAdmin = isPlatformAdmin();
  const canSwitchTenant = canSwitchTenantContext();

  const [tenantKeyInput, setTenantKeyInput] = useState(getTenantKey());

  const title = useMemo(() => pageTitleForPath(location.pathname), [location.pathname]);
  const subtitle = useMemo(() => pageSubtitleForPath(location.pathname), [location.pathname]);

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();

  const displayedRoles = useMemo(() => {
    return getDisplayRoles().map((role) => formatRoleLabel(role));
  }, []);

  const roleSummary =
    displayedRoles.length > 0
      ? displayedRoles.join(', ')
      : formatRoleLabel(session?.role || 'Not available');

  const primaryRoleLabel = formatRoleLabel(session?.role || 'Not available');

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    enabled: !platformAdmin,
    staleTime: 60_000,
  });

  function saveTenantContext() {
    const normalizedTenantKey = tenantKeyInput.trim().toLowerCase();

    if (!normalizedTenantKey || !canSwitchTenant) {
      return;
    }

    setTenantKey(normalizedTenantKey);
    setTenantKeyInput(normalizedTenantKey);
    window.location.reload();
  }

  function signOut() {
    logout();
    nav('/login', { replace: true });
  }

  const licenseSummary = platformAdmin
    ? {
        label: 'Administrative recovery access',
        detail: 'Platform administration remains available.',
      }
    : licenseQ.isLoading
      ? {
          label: 'Checking subscription status',
          detail: 'Please wait...',
        }
      : licenseQ.isError || !licenseQ.data
        ? {
            label: 'Subscription status unavailable',
            detail: 'Open Subscription Status for more information.',
          }
        : {
            label: licenseLabel(licenseQ.data.licenseStatus),
            detail: licenseQ.data.packageName || 'No subscription plan assigned',
          };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title-block">
            <div className="topbar-brand-row">
              <LogoSlot src={companyLogo || IBALANCE_LOGO_PATH} fallbackText="iBalance ERP" />

              <div>
                <div className="eyebrow">Nikosoft Technologies</div>
                <h1>{title}</h1>
                <div className="muted topbar-subtitle">{subtitle}</div>
              </div>
            </div>

            <div className="topbar-session-row">
              <div>
                <span>
                  Signed in as <strong>{session?.userEmail || 'Not available'}</strong>
                </span>
              </div>
              <div>
                <span>
                  Primary Role <strong>{primaryRoleLabel}</strong>
                </span>
              </div>
              <div>
                <span>
                  Assigned Roles <strong>{roleSummary}</strong>
                </span>
              </div>
              <div>
                <span>
                  Access <strong>{licenseSummary.label}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="topbar-actions-block">
            <div className="tenant-card">
              <LogoSlot src={tenantLogo} fallbackText={getTenantKey() || 'Tenant'} />
              <div className="tenant-card-meta">
                <div className="tenant-card-title">{getTenantKey() || 'Organization'}</div>
                <div className="muted tenant-card-detail">
                  {licenseSummary.detail}
                </div>
              </div>
            </div>

            <div className="inline-actions topbar-links">
              <Link to="/customers" className="button">Customers</Link>
              <Link to="/sales-invoices" className="button">Sales Invoices</Link>
              <Link to="/customer-receipts" className="button">Customer Receipts</Link>
              <Link to="/fixed-assets" className="button">Fixed Assets</Link>
              {canAccessAdmin() ? <Link to="/admin" className="button">Administration</Link> : null}
              <Link to="/license-status" className="button">Subscription Status</Link>
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </header>

        {canSwitchTenant ? (
          <section className="panel tenant-context-panel">
            <div className="section-heading">
              <div>
                <h2>Tenant workspace</h2>
                <div className="muted">Switch tenant context carefully when working across organizations.</div>
              </div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Tenant Key</label>
                <input
                  className="input"
                  value={tenantKeyInput}
                  onChange={(e) => setTenantKeyInput(e.target.value)}
                  placeholder="Enter tenant key"
                />
              </div>

              <div className="form-row">
                <label>Apply</label>
                <div className="inline-actions">
                  <button className="button" onClick={saveTenantContext}>
                    Update Tenant Context
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <main className="page-content">{children}</main>

        <footer className="app-footer">
          <span>© Nikosoft Technologies — iBalance ERP Cloud</span>
          <span>{getTenantKey() || 'Organization Workspace'}</span>
        </footer>
      </div>
    </div>
  );
}
