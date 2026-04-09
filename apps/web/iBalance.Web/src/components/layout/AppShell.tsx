import { PropsWithChildren, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { getTenantKey, setTenantKey } from '../../lib/api';
import { getSession, logout } from '../../lib/auth';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const [tenantKey, setTenantKeyState] = useState(getTenantKey());

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/accounts')) return 'Chart of Accounts';
    if (location.pathname.startsWith('/journals')) return 'Journal Entries';
    if (location.pathname.startsWith('/fiscal-periods')) return 'Fiscal Periods';
    if (location.pathname.startsWith('/reports')) return 'Financial Reports';
    if (location.pathname.startsWith('/admin')) return 'Administration';
    return 'Finance Dashboard';
  }, [location.pathname]);

  const session = getSession();

  function doLogout() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Nikosoft • iBalance</div>
            <h1>{pageTitle}</h1>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              Signed in as: <strong>{session?.userEmail || 'Unknown'}</strong>
            </div>
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

            <button className="button" onClick={() => nav('/admin')}>Admin</button>
            <button className="button danger" onClick={doLogout}>Logout</button>
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