import { PropsWithChildren, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { getTenantKey, setTenantKey } from '../../lib/api';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [tenantKey, setTenantKeyState] = useState(getTenantKey());

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/accounts')) return 'Chart of Accounts';
    if (location.pathname.startsWith('/journals')) return 'Journal Entries';
    if (location.pathname.startsWith('/fiscal-periods')) return 'Fiscal Periods';
    if (location.pathname.startsWith('/reports')) return 'Financial Reports';
    return 'Finance Dashboard';
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Nikosoft • iBalance</div>
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-actions">
            <div className="tenant-box">
              <label htmlFor="tenantKey">Tenant</label>
              <input
                id="tenantKey"
                value={tenantKey}
                onChange={(event) => setTenantKeyState(event.target.value)}
                onBlur={() => setTenantKey(tenantKey)}
                placeholder="demo-tenant"
              />
            </div>
          </div>
        </header>

        <main className="page-content">{children}</main>

        <footer className="app-footer">
          <span>© Nikosoft Technologies — iBalance Accounting Cloud</span>
          <span>Deep Purple Finance Suite • Production Foundation</span>
        </footer>
      </div>
    </div>
  );
}