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
  getSession,
  isPlatformAdmin,
  logout,
} from '../../lib/auth';

function licenseLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Renewal Due Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unavailable';
  }
}

function pageTitleForPath(pathname: string) {
  if (pathname.startsWith('/payroll')) return 'Payroll / Salary Management';
  if (pathname.startsWith('/working-capital')) return 'Working Capital Management';
  if (pathname.startsWith('/reconciliation')) return 'Bank Reconciliation';
  if (pathname.startsWith('/ageing-analysis')) return 'Ageing Analysis';
  if (pathname.startsWith('/accounts')) return 'Chart of Accounts';
  if (pathname.startsWith('/journals')) return 'Journal Management';
  if (pathname.startsWith('/journals/rejected')) return 'Rejected Journals';
  if (pathname.startsWith('/customers')) return 'Customer Management';
  if (pathname.startsWith('/sales-invoices/rejected')) return 'Rejected Sales Invoices';
  if (pathname.startsWith('/sales-invoices')) return 'Sales Invoice Management';
  if (pathname.startsWith('/customer-receipts/rejected')) return 'Rejected Customer Receipts';
  if (pathname.startsWith('/customer-receipts')) return 'Customer Receipt Management';
  if (pathname.startsWith('/vendors')) return 'Vendor Management';
  if (pathname.startsWith('/purchase-invoices/rejected')) return 'Rejected Purchase Invoices';
  if (pathname.startsWith('/purchase-invoices')) return 'Purchase Invoice Management';
  if (pathname.startsWith('/vendor-payments/rejected')) return 'Rejected Vendor Payments';
  if (pathname.startsWith('/vendor-payments')) return 'Vendor Payment Management';
  if (pathname.startsWith('/fiscal-periods')) return 'Fiscal Period Management';
  if (pathname.startsWith('/fixed-assets/depreciation-runs')) return 'Fixed Asset Depreciation Runs';
  if (pathname.startsWith('/fixed-assets/register/print')) return 'Fixed Asset Register';
  if (pathname.startsWith('/fixed-assets')) return 'Fixed Asset Management';
  if (pathname.startsWith('/bank-accounts')) return 'Bank & Cash Setup';
  if (pathname.startsWith('/inventory')) return 'Inventory Management';
  if (pathname.startsWith('/reports')) return 'Financial Reports';
  if (pathname.startsWith('/admin')) return 'Administration';
  if (pathname.startsWith('/budgets/rejected')) return 'Rejected Budgets';
  if (pathname.startsWith('/budget-vs-actual')) return 'Budget vs Actual';
  if (pathname.startsWith('/budgets')) return 'Budget Management';

  return 'Finance Dashboard';
}

function pageSubtitleForPath(pathname: string) {
  if (pathname.startsWith('/ageing-analysis')) return 'Review receivables and payables ageing by customer, vendor, and ageing bucket.';
  if (pathname.startsWith('/accounts')) return 'Manage ledger structure and posting accounts.';
  if (pathname.startsWith('/journals')) return 'Manage journals, posting workflow, and reversals.';
  if (pathname.startsWith('/journals/rejected')) return 'Correct, resubmit, or void rejected journal entries.';
  if (pathname.startsWith('/customers')) return 'Register and maintain accounts receivable customers.';
  if (pathname.startsWith('/sales-invoices/rejected')) return 'Correct, resubmit, or delete rejected sales invoices.';
  if (pathname.startsWith('/sales-invoices')) return 'Raise and review sales invoices for receivables operations.';
  if (pathname.startsWith('/customer-receipts/rejected')) return 'Correct, resubmit, or delete rejected customer receipts.';
  if (pathname.startsWith('/customer-receipts')) return 'Capture customer collections and apply receipts against receivables.';
  if (pathname.startsWith('/vendors')) return 'Register and maintain accounts payable vendors.';
  if (pathname.startsWith('/purchase-invoices/rejected')) return 'Correct, resubmit, or delete rejected purchase invoices.';
  if (pathname.startsWith('/purchase-invoices')) return 'Capture and manage supplier invoices for payables operations.';
  if (pathname.startsWith('/vendor-payments/rejected')) return 'Correct, resubmit, or delete rejected vendor payments.';
  if (pathname.startsWith('/vendor-payments')) return 'Capture supplier payments and route them through approval.';
  if (pathname.startsWith('/fiscal-periods')) return 'Manage accounting periods and open or close operations.';
  if (pathname.startsWith('/fixed-assets/depreciation-runs')) return 'Preview, run, and review posted fixed asset depreciation cycles.';
  if (pathname.startsWith('/fixed-assets/register/print')) return 'Review and print the fixed asset register in a clean standalone layout.';
  if (pathname.startsWith('/fixed-assets')) return 'Manage fixed asset classes, register records, capitalization, and lifecycle actions.';
  if (pathname.startsWith('/bank-accounts')) return 'Maintain operational bank accounts linked to cash and bank ledger accounts.';
  if (pathname.startsWith('/inventory')) return 'Manage inventory items, warehouses, stock movements, and stock position.';
  if (pathname.startsWith('/reports')) return 'Review financial performance and print-ready reports.';
  if (pathname.startsWith('/admin')) return 'Manage tenant operations, users, subscriptions, and recovery.';
  if (pathname.startsWith('/budgets/rejected')) return 'Correct, resubmit, or delete rejected budgets.';
  if (pathname.startsWith('/budget-vs-actual')) return 'Compare approved budgets against posted accounting actuals.';
  if (pathname.startsWith('/budgets')) return 'Create, approve, lock, close, upload, and control budgets.';
  if (pathname.startsWith('/payroll')) return 'Manage employees, salary structures, payroll elements, and payroll processing.';
  if (pathname.startsWith('/working-capital')) return 'Monitor liquidity, optimize receivables and payables, and manage cash flow.';
  if (pathname.startsWith('/reconciliation')) return 'Match bank statements with ledger entries and resolve differences.';
  return 'Review operational activity across your accounting workspace.';
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

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const session = getSession();
  const platformAdmin = isPlatformAdmin();

  const [tenantKeyInput, setTenantKeyInput] = useState(getTenantKey());

  const title = useMemo(() => pageTitleForPath(location.pathname), [location.pathname]);
  const subtitle = useMemo(() => pageSubtitleForPath(location.pathname), [location.pathname]);

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    enabled: !platformAdmin,
    staleTime: 60_000,
  });

  function saveTenantContext() {
    const normalizedTenantKey = tenantKeyInput.trim().toLowerCase();

    if (!normalizedTenantKey) {
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
              <LogoSlot src={companyLogo} fallbackText="iBalance" />

              <div>
                <div className="eyebrow">Nikosoft Technologies</div>
                <h1>{title}</h1>
                <div className="muted topbar-subtitle">{subtitle}</div>
              </div>
            </div>

            <div className="topbar-session-row">
              <span>
                Signed in as <strong>{session?.userEmail || 'Not available'}</strong>
              </span>
              <span>
                Role <strong>{session?.role || 'Not available'}</strong>
              </span>
              <span>
                Access <strong>{licenseSummary.label}</strong>
              </span>
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

        <main className="page-content">{children}</main>

        <footer className="app-footer">
          <span>© Nikosoft Technologies — iBalance Accounting Cloud</span>
          <span>{getTenantKey() || 'Organization Workspace'}</span>
        </footer>
      </div>
    </div>
  );
}