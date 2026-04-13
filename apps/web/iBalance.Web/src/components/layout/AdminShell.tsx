import type { PropsWithChildren } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getTenantKey, getTenantLogoDataUrl, getCompanyLogoDataUrl } from '../../lib/api';
import { getSession, isPlatformAdmin, logout } from '../../lib/auth';

function BrandLogo({
  src,
  fallback,
}: {
  src: string;
  fallback: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        style={{ height: 36, width: 'auto', maxWidth: 140, objectFit: 'contain' }}
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
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function AdminShell({ children }: PropsWithChildren) {
  const nav = useNavigate();
  const session = getSession();
  const platformAdmin = isPlatformAdmin();
  const tenantKey = getTenantKey();
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();

  function signOut() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandLogo src={companyLogo} fallback="iBalance" />
            <div>
              <div style={{ fontWeight: 700 }}>iBalance</div>
              <div className="muted" style={{ fontSize: 12 }}>Administration</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}>
            Administration Overview
          </NavLink>

          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}>
            User Management
          </NavLink>

          <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}>
            Commercial Settings
          </NavLink>

          {platformAdmin ? (
            <div className="sidebar-section">
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Platform Administration</div>
              <Link to="/admin" className="sidebar-link">
                Tenant and Subscription Console
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <div
            className="panel"
            style={{
              margin: 0,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BrandLogo src={tenantLogo} fallback={tenantKey || 'Tenant'} />
              <div>
                <div style={{ fontWeight: 600 }}>{tenantKey || 'Organization'}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {platformAdmin ? 'Platform Administrator' : session?.role || 'Administrator'}
                </div>
              </div>
            </div>

            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <Link to="/dashboard" className="button">Open Workspace</Link>
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Administration</h1>
            <div className="muted">
              Manage tenant access, subscriptions, users, and recovery operations.
            </div>
          </div>

          <div className="inline-actions">
            <Link to="/license-status" className="button">Subscription Status</Link>
            <Link to="/dashboard" className="button">Workspace</Link>
            <button className="button" onClick={signOut}>Sign Out</button>
          </div>
        </header>

        <div className="content-area">
          {children}
        </div>

        <footer className="app-footer">
          <div>© Nikosoft Technologies — iBalance Accounting Cloud</div>
          <div>{tenantKey || 'Organization Workspace'}</div>
        </footer>
      </main>
    </div>
  );
}