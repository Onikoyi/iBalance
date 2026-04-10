import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentTenantLicense } from '../lib/api';
import { PublicShell } from '../components/layout/PublicShell';
import { getSession, isPlatformAdmin, logout } from '../lib/auth';

function licenseLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Renewal Due Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unavailable';
  }
}

function licenseMessage(value?: number, isConfigured?: boolean) {
  if (!isConfigured) {
    return 'Your organization does not currently have an active subscription record. Please contact your administrator or support team.';
  }

  switch (value) {
    case 1:
      return 'Your subscription is active and your organization can continue using the platform normally.';
    case 2:
      return 'Your subscription is approaching renewal. Please renew early to avoid any interruption to access.';
    case 3:
      return 'Your subscription has expired. Please contact your administrator or support team to restore access.';
    case 4:
      return 'Your subscription is currently suspended. Please contact your administrator or support team for assistance.';
    default:
      return 'We could not determine the current subscription status.';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString();
}

export function LicenseStatusPage() {
  const session = getSession();
  const platformAdmin = isPlatformAdmin();

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    enabled: !platformAdmin,
    staleTime: 60_000,
  });

  function signOut() {
    logout();
    window.location.href = '/login';
  }

  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Subscription status</div>
          <h1 className="hero-title">Organization subscription status</h1>
          <p className="hero-subtitle">
            Review your organization’s current subscription position, renewal timing, and access status.
          </p>
        </section>

        {platformAdmin ? (
          <section className="panel">
            <div className="section-heading">
              <h2>Platform administration access</h2>
              <span className="muted">Support and recovery access remains available</span>
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Signed-in role</span>
                <span>{session?.role || 'PlatformAdmin'}</span>
              </div>
              <div className="kv-row">
                <span>Access mode</span>
                <span>Administrative recovery access</span>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <div className="muted">
                As a Platform Administrator, you can continue into the administration area to review tenants,
                renew subscriptions, change packages, and assist with recovery operations.
              </div>
            </div>

            <div className="inline-actions" style={{ marginTop: 16 }}>
              <Link to="/admin" className="button primary">Open Administration</Link>
              <Link to="/dashboard" className="button">Open Workspace</Link>
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </section>
        ) : licenseQ.isLoading ? (
          <section className="panel">
            <div className="panel">Loading subscription details...</div>
          </section>
        ) : licenseQ.isError || !licenseQ.data ? (
          <section className="panel">
            <div className="error-panel">We could not load the subscription details at this time.</div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <Link to="/login" className="button">Back to Sign In</Link>
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="section-heading">
              <h2>Subscription overview</h2>
              <span className="muted">{licenseLabel(licenseQ.data.licenseStatus)}</span>
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Organization</span>
                <span>{licenseQ.data.tenantName || licenseQ.data.tenantKey || 'Not available'}</span>
              </div>
              <div className="kv-row">
                <span>Status</span>
                <span>{licenseLabel(licenseQ.data.licenseStatus)}</span>
              </div>
              <div className="kv-row">
                <span>Subscription Plan</span>
                <span>{licenseQ.data.packageName || 'Not assigned'}</span>
              </div>
              <div className="kv-row">
                <span>Start Date</span>
                <span>{formatDate(licenseQ.data.licenseStartDateUtc)}</span>
              </div>
              <div className="kv-row">
                <span>End Date</span>
                <span>{formatDate(licenseQ.data.licenseEndDateUtc)}</span>
              </div>
              <div className="kv-row">
                <span>Days Remaining</span>
                <span>{licenseQ.data.daysRemaining ?? 'Not available'}</span>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <div className="muted">
                {licenseMessage(licenseQ.data.licenseStatus, licenseQ.data.isConfigured)}
              </div>
            </div>

            <div className="inline-actions" style={{ marginTop: 16 }}>
              {licenseQ.data.licenseStatus === 1 || licenseQ.data.licenseStatus === 2 ? (
                <Link to="/dashboard" className="button primary">Open Workspace</Link>
              ) : (
                <Link to="/login" className="button">Back to Sign In</Link>
              )}
              <button className="button" onClick={signOut}>Sign Out</button>
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}