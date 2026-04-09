import { PropsWithChildren, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getSession, logout } from '../../lib/auth';

const links = [
  { to: '/admin', label: 'Admin Dashboard' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/users', label: 'Users' },
  { to: '/dashboard', label: 'Back to Finance' },
];

export function AdminShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const session = getSession();

  const title = useMemo(() => {
    if (location.pathname.startsWith('/admin/settings')) return 'Admin Settings';
    if (location.pathname.startsWith('/admin/users')) return 'User Management';
    return 'Admin Dashboard';
  }, [location.pathname]);

  function doLogout() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">iB</div>
          <div>
            <div className="brand-name">iBalance</div>
            <div className="brand-subtitle">Admin Console</div>
          </div>
        </div>

        <nav className="nav-menu">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="muted" style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13 }}>
            Signed in as <strong>{session?.userEmail || 'Unknown'}</strong>
          </div>
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button className="button" onClick={() => nav('/onboarding')}>Onboarding</button>
            <button className="button danger" onClick={doLogout}>Logout</button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Nikosoft • iBalance</div>
            <h1>{title}</h1>
          </div>
        </header>

        <main className="page-content">{children}</main>

        <footer className="app-footer">
          <span>© Nikosoft Technologies — iBalance Accounting Cloud</span>
          <span>Administration • Tenant-ready</span>
        </footer>
      </div>
    </div>
  );
}