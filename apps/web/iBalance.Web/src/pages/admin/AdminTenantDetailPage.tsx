import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changePlatformTenantPackage,
  getAdminSubscriptionPackages,
  getPlatformAdminTenantDetail,
  getTenantReadableError,
  reactivatePlatformTenant,
  renewPlatformTenantLicense,
  suspendPlatformTenant,
} from '../../lib/api';

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

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatMoney(amount?: number | string | null, currencyCode?: string | null) {
  if (amount === null || amount === undefined) return 'Not available';

  const numericAmount =
    typeof amount === 'number'
      ? amount
      : Number(amount);

  if (Number.isNaN(numericAmount)) {
    return 'Not available';
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode || 'NGN',
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

function toUtcIsoFromDateInput(value: string, endOfDay = false) {
  if (!value) return '';
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00';
  return new Date(`${value}${time}`).toISOString();
}

export function AdminTenantDetailPage() {
  const { tenantId = '' } = useParams();
  const qc = useQueryClient();

  const [infoText, setInfoText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewAmountPaid, setRenewAmountPaid] = useState('');
  const [renewCurrencyCode, setRenewCurrencyCode] = useState('NGN');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const tenantQ = useQuery({
    queryKey: ['platform-admin-tenant-detail', tenantId],
    queryFn: () => getPlatformAdminTenantDetail(tenantId),
    enabled: !!tenantId,
  });

  const packagesQ = useQuery({
    queryKey: ['admin-subscription-packages'],
    queryFn: getAdminSubscriptionPackages,
  });

  const tenant = tenantQ.data?.tenant;
  const license = tenantQ.data?.license;
  const users = tenantQ.data?.users.items ?? [];

  const roleSummary = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((x) => x.isActive).length,
      inactive: users.filter((x) => !x.isActive).length,
      platformAdmins: users.filter((x) => x.role === 'PlatformAdmin').length,
      tenantAdmins: users.filter((x) => x.role === 'TenantAdmin').length,
      financeControllers: users.filter((x) => x.role === 'FinanceController').length,
      accountants: users.filter((x) => x.role === 'Accountant').length,
      approvers: users.filter((x) => x.role === 'Approver').length,
      viewers: users.filter((x) => x.role === 'Viewer').length,
      auditors: users.filter((x) => x.role === 'Auditor').length,
      budgetOfficers: users.filter((x) => x.role === 'BudgetOfficer').length,
      budgetOwners: users.filter((x) => x.role === 'BudgetOwner').length,
      payrollOfficers: users.filter((x) => x.role === 'PayrollOfficer').length,
      hrOfficers: users.filter((x) => x.role === 'HrOfficer').length,
      procurementOfficers: users.filter((x) => x.role === 'ProcurementOfficer').length,
      treasuryOfficers: users.filter((x) => x.role === 'TreasuryOfficer').length,
      inventoryOfficers: users.filter((x) => x.role === 'InventoryOfficer').length,
      apOfficers: users.filter((x) => x.role === 'ApOfficer').length,
      arOfficers: users.filter((x) => x.role === 'ArOfficer').length,
      fixedAssetOfficers: users.filter((x) => x.role === 'FixedAssetOfficer').length,
    };
  }, [users]);

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: ['platform-admin-tenants'] });
    await qc.invalidateQueries({ queryKey: ['platform-admin-tenant-detail', tenantId] });
  };

  const renewMut = useMutation({
    mutationFn: () =>
      renewPlatformTenantLicense(tenantId, {
        newStartDateUtc: toUtcIsoFromDateInput(renewStartDate, false),
        newEndDateUtc: toUtcIsoFromDateInput(renewEndDate, true),
        amountPaid: Number(renewAmountPaid || '0'),
        currencyCode: renewCurrencyCode.trim().toUpperCase() || 'NGN',
      }),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('The tenant subscription has been renewed successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not renew the tenant subscription at this time.'));
      setInfoText('');
    },
  });

  const changePackageMut = useMutation({
    mutationFn: () =>
      changePlatformTenantPackage(tenantId, {
        subscriptionPackageId: selectedPackageId,
      }),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('The subscription package has been updated successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not update the subscription package at this time.'));
      setInfoText('');
    },
  });

  const suspendMut = useMutation({
    mutationFn: () => suspendPlatformTenant(tenantId),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('The tenant has been suspended successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not suspend the tenant at this time.'));
      setInfoText('');
    },
  });

  const reactivateMut = useMutation({
    mutationFn: () => reactivatePlatformTenant(tenantId),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('The tenant has been reactivated successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not reactivate the tenant at this time.'));
      setInfoText('');
    },
  });

  function submitRenewal() {
    setInfoText('');
    setErrorText('');

    if (!renewStartDate || !renewEndDate) {
      setErrorText('Please enter both the subscription start date and end date.');
      return;
    }

    if (renewEndDate < renewStartDate) {
      setErrorText('The subscription end date must be later than the start date.');
      return;
    }

    if (Number(renewAmountPaid || '0') < 0) {
      setErrorText('The subscription value cannot be negative.');
      return;
    }

    renewMut.mutate();
  }

  function submitPackageChange() {
    setInfoText('');
    setErrorText('');

    if (!selectedPackageId) {
      setErrorText('Please select a subscription package.');
      return;
    }

    changePackageMut.mutate();
  }

  if (tenantQ.isLoading) {
    return <div className="panel">Loading tenant details...</div>;
  }

  if (tenantQ.isError || !tenantQ.data || !tenant) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(tenantQ.error, 'We could not load the selected tenant at this time.')}
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tenant detail</h2>
            <div className="muted">Tenant identity, subscription status, and operating controls.</div>
          </div>

          <div className="inline-actions">
            <Link to="/admin" className="button">Back to Admin Dashboard</Link>
          </div>
        </div>

        {infoText ? (
          <div className="success-panel" style={{ marginBottom: 16 }}>
            {infoText}
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginBottom: 16 }}>
            {errorText}
          </div>
        ) : null}

        <div className="kv">
          <div className="kv-row">
            <span>Tenant Name</span>
            <span>{tenant.name}</span>
          </div>
          <div className="kv-row">
            <span>Tenant Key</span>
            <span>{tenant.key}</span>
          </div>
          <div className="kv-row">
            <span>Tenant Status</span>
            <span>{tenantStatusLabel(tenant.status)}</span>
          </div>
          <div className="kv-row">
            <span>Subscription Package</span>
            <span>{license?.packageName || 'Not assigned'}</span>
          </div>
          <div className="kv-row">
            <span>Subscription Status</span>
            <span>{licenseStatusLabel(license?.licenseStatus)}</span>
          </div>
          <div className="kv-row">
            <span>Start Date</span>
            <span>{formatDate(license?.licenseStartDateUtc)}</span>
          </div>
          <div className="kv-row">
            <span>End Date</span>
            <span>{formatDate(license?.licenseEndDateUtc)}</span>
          </div>
          <div className="kv-row">
            <span>Days Remaining</span>
            <span>{license?.daysRemaining ?? 'Not available'}</span>
          </div>
          <div className="kv-row">
            <span>Subscription Value</span>
            <span>{formatMoney(license?.amountPaid, license?.currencyCode)}</span>
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          {tenant.status === 3 ? (
            <button
              className="button primary"
              onClick={() => reactivateMut.mutate()}
              disabled={reactivateMut.isPending || suspendMut.isPending}
            >
              {reactivateMut.isPending ? 'Processing…' : 'Reactivate Tenant'}
            </button>
          ) : (
            <button
              className="button danger"
              onClick={() => suspendMut.mutate()}
              disabled={reactivateMut.isPending || suspendMut.isPending}
            >
              {suspendMut.isPending ? 'Processing…' : 'Suspend Tenant'}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Renew subscription</h2>
          <span className="muted">Extend or refresh the tenant subscription period.</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Start Date</label>
            <input
              type="date"
              className="input"
              value={renewStartDate}
              onChange={(e) => setRenewStartDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>End Date</label>
            <input
              type="date"
              className="input"
              value={renewEndDate}
              onChange={(e) => setRenewEndDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Subscription Value</label>
            <input
              className="input"
              inputMode="decimal"
              value={renewAmountPaid}
              onChange={(e) => setRenewAmountPaid(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          <div className="form-row">
            <label>Currency Code</label>
            <input
              className="input"
              value={renewCurrencyCode}
              onChange={(e) => setRenewCurrencyCode(e.target.value)}
              placeholder="NGN"
            />
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="button primary" onClick={submitRenewal} disabled={renewMut.isPending}>
            {renewMut.isPending ? 'Saving…' : 'Renew Subscription'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Change subscription package</h2>
          <span className="muted">Upgrade, downgrade, or reassign the current package.</span>
        </div>

        <div className="form-row">
          <label>Available Packages</label>
          <select
            className="select"
            value={selectedPackageId}
            onChange={(e) => {
              setSelectedPackageId(e.target.value);
              setInfoText('');
              setErrorText('');
            }}
          >
            <option value="">— Select Package —</option>
            {(packagesQ.data?.items || []).map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} ({pkg.currencyCode} {pkg.monthlyPrice})
              </option>
            ))}
          </select>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            className="button primary"
            onClick={submitPackageChange}
            disabled={changePackageMut.isPending}
          >
            {changePackageMut.isPending ? 'Saving…' : 'Update Package'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>User summary</h2>
          <span className="muted">User totals and role distribution for this tenant.</span>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Users</span>
            <span>{roleSummary.total}</span>
          </div>
          <div className="kv-row">
            <span>Active Users</span>
            <span>{roleSummary.active}</span>
          </div>
          <div className="kv-row">
            <span>Inactive Users</span>
            <span>{roleSummary.inactive}</span>
          </div>
          <div className="kv-row">
            <span>Platform Administrators</span>
            <span>{roleSummary.platformAdmins}</span>
          </div>
          <div className="kv-row">
            <span>Tenant Administrators</span>
            <span>{roleSummary.tenantAdmins}</span>
          </div>
          <div className="kv-row">
            <span>Finance Controllers</span>
            <span>{roleSummary.financeControllers}</span>
          </div>
          <div className="kv-row">
            <span>Accountants</span>
            <span>{roleSummary.accountants}</span>
          </div>
          <div className="kv-row">
            <span>Approvers</span>
            <span>{roleSummary.approvers}</span>
          </div>
          <div className="kv-row">
            <span>Viewers</span>
            <span>{roleSummary.viewers}</span>
          </div>
          <div className="kv-row">
            <span>Auditors</span>
            <span>{roleSummary.auditors}</span>
          </div>
          <div className="kv-row">
            <span>Budget Officers</span>
            <span>{roleSummary.budgetOfficers}</span>
          </div>
          <div className="kv-row">
            <span>Budget Owners</span>
            <span>{roleSummary.budgetOwners}</span>
          </div>
          <div className="kv-row">
            <span>Payroll Officers</span>
            <span>{roleSummary.payrollOfficers}</span>
          </div>
          <div className="kv-row">
            <span>HR Officers</span>
            <span>{roleSummary.hrOfficers}</span>
          </div>
          <div className="kv-row">
            <span>Procurement Officers</span>
            <span>{roleSummary.procurementOfficers}</span>
          </div>
          <div className="kv-row">
            <span>Treasury Officers</span>
            <span>{roleSummary.treasuryOfficers}</span>
          </div>
          <div className="kv-row">
            <span>Inventory Officers</span>
            <span>{roleSummary.inventoryOfficers}</span>
          </div>
          <div className="kv-row">
            <span>AP Officers</span>
            <span>{roleSummary.apOfficers}</span>
          </div>
          <div className="kv-row">
            <span>AR Officers</span>
            <span>{roleSummary.arOfficers}</span>
          </div>
          <div className="kv-row">
            <span>Fixed Asset Officers</span>
            <span>{roleSummary.fixedAssetOfficers}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>User register</h2>
          <span className="muted">{tenantQ.data.users.count} user record(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName || `${user.firstName} ${user.lastName}`.trim()}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.isActive ? 'Active' : 'Inactive'}</td>
                  <td>{formatDateTime(user.createdOnUtc)}</td>
                  <td>{formatDateTime(user.lastModifiedOnUtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
