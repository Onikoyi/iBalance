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
  if (pathname.startsWith('/accounts')) return 'Chart of Accounts';
  if (pathname.startsWith('/journals')) return 'Journal Management';
  if (pathname.startsWith('/customers')) return 'Customer Management';
  if (pathname.startsWith('/sales-invoices')) return 'Sales Invoice Management';
  if (pathname.startsWith('/customer-receipts')) return 'Customer Receipt Management';
  if (pathname.startsWith('/fiscal-periods')) return 'Fiscal Period Management';
  if (pathname.startsWith('/reports')) return 'Financial Reports';
  if (pathname.startsWith('/admin')) return 'Administration';
  return 'Finance Dashboard';
}

function pageSubtitleForPath(pathname: string) {
  if (pathname.startsWith('/accounts')) return 'Manage ledger structure and posting accounts.';
  if (pathname.startsWith('/journals')) return 'Manage journals, posting workflow, and reversals.';
  if (pathname.startsWith('/customers')) return 'Register and maintain accounts receivable customers.';
  if (pathname.startsWith('/sales-invoices')) return 'Raise and review sales invoices for receivables operations.';
  if (pathname.startsWith('/customer-receipts')) return 'Capture customer collections and apply receipts against receivables.';
  if (pathname.startsWith('/fiscal-periods')) return 'Manage accounting periods and open or close operations.';
  if (pathname.startsWith('/reports')) return 'Review financial performance and print-ready reports.';
  if (pathname.startsWith('/admin')) return 'Manage tenant operations, users, subscriptions, and recovery.';
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
    <div
      style={{
        minWidth: 36,
        height: 36,
        borderRadius: 10,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(75, 29, 115, 0.12)',
        fontWeight: 700,
      }}
    >
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <LogoSlot src={companyLogo} fallbackText="iBalance" />
              <div>
                <div className="eyebrow">Nikosoft Technologies</div>
                <h1 style={{ margin: 0 }}>{title}</h1>
                <div className="muted" style={{ marginTop: 4 }}>{subtitle}</div>
              </div>
            </div>

            <div className="muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 340 }}>
            <div
              className="panel"
              style={{
                margin: 0,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <LogoSlot src={tenantLogo} fallbackText={getTenantKey() || 'Tenant'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{getTenantKey() || 'Organization'}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {licenseSummary.detail}
                </div>
              </div>
            </div>

            <div className="inline-actions" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Link to="/customers" className="button">Customers</Link>
              <Link to="/sales-invoices" className="button">Sales Invoices</Link>
              <Link to="/customer-receipts" className="button">Customer Receipts</Link>
              {canAccessAdmin() ? <Link to="/admin" className="button">Administration</Link> : null}
              <Link to="/license-status" className="button">Subscription Status</Link>
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </header>

        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="section-heading">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Tenant workspace</h2>
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