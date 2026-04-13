import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { getCompanyLogoDataUrl, getTenantLogoDataUrl } from '../../lib/api';

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

type AuthShellProps = PropsWithChildren<{
  wide?: boolean;
}>;

export function AuthShell({ children, wide = false }: AuthShellProps) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <div className="auth-header-inner">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-row">
              <LogoSlot dataUrl={companyLogo} fallbackText="Nikosoft" />
              <div className="auth-brand-divider" />
              <LogoSlot dataUrl={tenantLogo} fallbackText="Tenant" />
            </div>
            <div className="auth-brand-sub">iBalance • Secure Access</div>
          </Link>
        </div>
      </header>

      <main className="auth-main">
        <div className={`auth-card ${wide ? 'wide' : ''}`} data-variant={wide ? 'wide' : 'default'}>
          {children}
        </div>
      </main>

      <footer className="auth-footer">
        <span>© Nikosoft Technologies — iBalance Accounting Cloud</span>
        <span>Secure sign-in • Tenant-ready</span>
      </footer>
    </div>
  );
}