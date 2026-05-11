import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminTenantOverview, getPlatformAdminTenants, getTenantReadableError } from '../../lib/api';
import {
  canManageEnterpriseAccessControl,
  canManagePlatformCommercials,
  canManageTenantUsers,
  isPlatformAdmin,
} from '../../lib/auth';

function tenantStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Inactive';
    case 3: return 'Suspended';
    default: return 'Unavailable';
  }
}

function licenseStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Renewal Due Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unavailable';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString();
}

function formatMoney(amount?: number | null, currencyCode?: string | null) {
  if (amount === null || amount === undefined) return 'Not available';

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode || 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

type ExtendedByRole = {
  platformAdmin?: number;
  tenantAdmin?: number;
  financeController?: number;
  accountant?: number;
  approver?: number;
  viewer?: number;
  auditor?: number;
  budgetOfficer?: number;
  budgetOwner?: number;
  payrollOfficer?: number;
  hrOfficer?: number;
  procurementOfficer?: number;
  treasuryOfficer?: number;
  inventoryOfficer?: number;
  apOfficer?: number;
  arOfficer?: number;
  fixedAssetOfficer?: number;
};

export function AdminDashboardPage() {
  const platformAdmin = isPlatformAdmin();
  const canManageUsers = canManageTenantUsers();
  const canManageCommercials = canManagePlatformCommercials();
  const canManageAccessControl = canManageEnterpriseAccessControl();

  const tenantOverviewQ = useQuery({
    queryKey: ['admin-tenant-overview'],
    queryFn: getAdminTenantOverview,
    enabled: !platformAdmin,
  });

  const platformTenantsQ = useQuery({
    queryKey: ['platform-admin-tenants'],
    queryFn: getPlatformAdminTenants,
    enabled: platformAdmin,
  });

  const platformSummary = useMemo(() => {
    const items = platformTenantsQ.data?.items ?? [];

    return {
      tenants: items.length,
      activeTenants: items.filter((x) => x.tenantStatus === 1).length,
      renewalDueSoon: items.filter((x) => x.license.licenseStatus === 2).length,
      expiredOrSuspended: items.filter((x) => x.license.licenseStatus === 3 || x.license.licenseStatus === 4).length,
      totalUsers: items.reduce((sum, item) => sum + item.users.total, 0),
      activeUsers: items.reduce((sum, item) => sum + item.users.active, 0),
    };
  }, [platformTenantsQ.data?.items]);

  if (platformAdmin) {
    if (platformTenantsQ.isLoading) {
      return <div className="panel">Loading tenant and subscription overview...</div>;
    }

    if (platformTenantsQ.isError || !platformTenantsQ.data) {
      return (
        <div className="panel error-panel">
          {getTenantReadableError(platformTenantsQ.error, 'We could not load the platform administration overview at this time.')}
        </div>
      );
    }

    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Platform overview</h2>
              <div className="muted">Tenant, subscription, and user visibility across the platform.</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="panel"><div className="muted">Tenants</div><h2 style={{ marginBottom: 0 }}>{platformSummary.tenants}</h2></div>
            <div className="panel"><div className="muted">Active Tenants</div><h2 style={{ marginBottom: 0 }}>{platformSummary.activeTenants}</h2></div>
            <div className="panel"><div className="muted">Renewal Due Soon</div><h2 style={{ marginBottom: 0 }}>{platformSummary.renewalDueSoon}</h2></div>
            <div className="panel"><div className="muted">Expired or Suspended</div><h2 style={{ marginBottom: 0 }}>{platformSummary.expiredOrSuspended}</h2></div>
            <div className="panel"><div className="muted">Total Users</div><h2 style={{ marginBottom: 0 }}>{platformSummary.totalUsers}</h2></div>
            <div className="panel"><div className="muted">Active Users</div><h2 style={{ marginBottom: 0 }}>{platformSummary.activeUsers}</h2></div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Tenant and subscription register</h2>
              <div className="muted">{platformTenantsQ.data.count} tenant record(s)</div>
            </div>

            <div className="inline-actions">
              <Link to="/admin/subscription-applications" className="button primary">Subscription Applications</Link>
              {canManageUsers ? <Link to="/admin/users" className="button">User Management</Link> : null}
              {canManageAccessControl ? <Link to="/admin/access-control" className="button">Access Control</Link> : null}
              {canManageCommercials ? <Link to="/admin/settings" className="button">Commercial Settings</Link> : null}
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Tenant Key</th>
                  <th>Tenant Status</th>
                  <th>Subscription</th>
                  <th>Subscription Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Days Remaining</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                  <th style={{ textAlign: 'right' }}>Users</th>
                  <th style={{ width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {platformTenantsQ.data.items.map((item) => (
                  <tr key={item.tenantId}>
                    <td><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><strong>{item.tenantName}</strong><span className="muted">{item.license.renewalWarning}</span></div></td>
                    <td>{item.tenantKey}</td>
                    <td>{tenantStatusLabel(item.tenantStatus)}</td>
                    <td>{item.license.packageName || 'Not assigned'}</td>
                    <td>{licenseStatusLabel(item.license.licenseStatus)}</td>
                    <td>{formatDate(item.license.licenseStartDateUtc)}</td>
                    <td>{formatDate(item.license.licenseEndDateUtc)}</td>
                    <td>{item.license.daysRemaining ?? 'Not available'}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.license.amountPaid, item.license.currencyCode)}</td>
                    <td style={{ textAlign: 'right' }}>{item.users.total}</td>
                    <td><Link to={`/admin/tenants/${item.tenantId}`} className="button">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (tenantOverviewQ.isLoading) {
    return <div className="panel">Loading tenant administration overview...</div>;
  }

  if (tenantOverviewQ.isError || !tenantOverviewQ.data) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(tenantOverviewQ.error, 'We could not load the tenant administration overview at this time.')}
      </div>
    );
  }

  const overview = tenantOverviewQ.data;
  const byRole = overview.users.byRole as ExtendedByRole;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tenant administration overview</h2>
            <div className="muted">Current organization status, subscription, and user visibility.</div>
          </div>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Organization</span><span>{overview.tenantName}</span></div>
          <div className="kv-row"><span>Tenant Key</span><span>{overview.tenantKey}</span></div>
          <div className="kv-row"><span>Tenant Status</span><span>{tenantStatusLabel(overview.tenantStatus)}</span></div>
          <div className="kv-row"><span>Subscription Plan</span><span>{overview.packageName || 'Not assigned'}</span></div>
          <div className="kv-row"><span>Subscription Status</span><span>{licenseStatusLabel(overview.licenseStatus)}</span></div>
          <div className="kv-row"><span>Start Date</span><span>{formatDate(overview.licenseStartDateUtc)}</span></div>
          <div className="kv-row"><span>End Date</span><span>{formatDate(overview.licenseEndDateUtc)}</span></div>
          <div className="kv-row"><span>Days Remaining</span><span>{overview.daysRemaining ?? 'Not available'}</span></div>
          <div className="kv-row"><span>Subscription Value</span><span>{formatMoney(overview.amountPaid, overview.currencyCode)}</span></div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="muted">{overview.renewalWarning}</div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>User summary</h2>
          <span className="muted">Role distribution within this organization</span>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Users</span><span>{overview.users.total}</span></div>
          <div className="kv-row"><span>Active Users</span><span>{overview.users.active}</span></div>
          <div className="kv-row"><span>Inactive Users</span><span>{overview.users.inactive}</span></div>
          <div className="kv-row"><span>Platform Administrators</span><span>{byRole.platformAdmin ?? 0}</span></div>
          <div className="kv-row"><span>Tenant Administrators</span><span>{byRole.tenantAdmin ?? 0}</span></div>
          <div className="kv-row"><span>Finance Controllers</span><span>{byRole.financeController ?? 0}</span></div>
          <div className="kv-row"><span>Accountants</span><span>{byRole.accountant ?? 0}</span></div>
          <div className="kv-row"><span>Approvers</span><span>{byRole.approver ?? 0}</span></div>
          <div className="kv-row"><span>Viewers</span><span>{byRole.viewer ?? 0}</span></div>
          <div className="kv-row"><span>Auditors</span><span>{byRole.auditor ?? 0}</span></div>
          <div className="kv-row"><span>Budget Officers</span><span>{byRole.budgetOfficer ?? 0}</span></div>
          <div className="kv-row"><span>Budget Owners</span><span>{byRole.budgetOwner ?? 0}</span></div>
          <div className="kv-row"><span>Payroll Officers</span><span>{byRole.payrollOfficer ?? 0}</span></div>
          <div className="kv-row"><span>HR Officers</span><span>{byRole.hrOfficer ?? 0}</span></div>
          <div className="kv-row"><span>Procurement Officers</span><span>{byRole.procurementOfficer ?? 0}</span></div>
          <div className="kv-row"><span>Treasury Officers</span><span>{byRole.treasuryOfficer ?? 0}</span></div>
          <div className="kv-row"><span>Inventory Officers</span><span>{byRole.inventoryOfficer ?? 0}</span></div>
          <div className="kv-row"><span>AP Officers</span><span>{byRole.apOfficer ?? 0}</span></div>
          <div className="kv-row"><span>AR Officers</span><span>{byRole.arOfficer ?? 0}</span></div>
          <div className="kv-row"><span>Fixed Asset Officers</span><span>{byRole.fixedAssetOfficer ?? 0}</span></div>
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          {canManageUsers ? <Link to="/admin/users" className="button primary">Manage Users</Link> : null}
          {canManageAccessControl ? <Link to="/admin/access-control" className="button">Access Control</Link> : null}
          {canManageCommercials ? <Link to="/admin/settings" className="button">Commercial Settings</Link> : null}
        </div>
      </section>
    </div>
  );
}