import type { PropsWithChildren } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getCompanyLogoDataUrl, getTenantLogoDataUrl } from '../../lib/api';
import { isAuthenticated } from '../../lib/auth';

function LogoSlot({ dataUrl, fallbackText }: { dataUrl: string; fallbackText: string }) {
  if (dataUrl) {
    return <img src={dataUrl} alt={fallbackText} style={{ height: 34, maxWidth: 160, objectFit: 'contain' }} />;
  }
  return (
    <div
      style={{
        height: 34,
        padding: '0 12px',
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.14)',
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      {fallbackText}
    </div>
  );
}

export function PublicShell({ children }: PropsWithChildren) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const authed = isAuthenticated();

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header-inner">
          <Link to="/" className="public-brand">
            <div className="public-brand-row">
              <LogoSlot dataUrl={companyLogo} fallbackText="Nikosoft" />
              <div className="public-brand-divider" />
              <LogoSlot dataUrl={tenantLogo} fallbackText="Tenant" />
            </div>
            <div className="public-brand-sub">iBalance • Accounting Cloud</div>
          </Link>

          <nav className="public-nav">
            <NavLink to="/" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
              Home
            </NavLink>
            <NavLink to="/pricing" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
              Pricing
            </NavLink>
            <NavLink to="/onboarding" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
              Tenant Onboarding
            </NavLink>

            {!authed ? (
              <>
                <NavLink to="/signup" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
                  Sign Up
                </NavLink>
                <NavLink to="/login" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
                  Login
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
                  Finance Console
                </NavLink>
                <NavLink to="/admin" className={({ isActive }) => `public-link ${isActive ? 'active' : ''}`}>
                  Admin
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="public-main">{children}</main>

      <footer className="public-footer">
        <div>
          <strong>© Nikosoft Technologies</strong> — iBalance Accounting Cloud
        </div>
        <div className="muted">Tenant-ready •  Finance Suite • Audit-first</div>
      </footer>
    </div>
  );
}