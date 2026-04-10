import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSubscriptionPackage,
  getAdminBillingSettings,
  getAdminSubscriptionPackages,
  getAdminTenantOverview,
  getCompanyLogoDataUrl,
  getTenantKey,
  getTenantLogoDataUrl,
  getTenantReadableError,
  saveBillingSettings,
  setCompanyLogoDataUrl,
  setTenantKey,
  setTenantLogoDataUrl,
  updateSubscriptionPackage,
  type UpsertSubscriptionPackageRequest,
} from '../../lib/api';

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const emptyPackageForm: UpsertSubscriptionPackageRequest = {
  code: '',
  name: '',
  description: '',
  monthlyPrice: 0,
  currencyCode: 'NGN',
  displayOrder: 1,
  isActive: true,
  isPublic: true,
};

function tenantStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Inactive';
    case 3: return 'Suspended';
    default: return 'Unknown';
  }
}

function licenseStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Expiring Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unknown';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return parsed.toLocaleDateString();
}

export function AdminSettingsPage() {
  const qc = useQueryClient();

  const [tenantKeyInput, setTenantKeyInput] = useState(getTenantKey());
  const [tenantLogo, setTenantLogo] = useState(getTenantLogoDataUrl());
  const [companyLogo, setCompanyLogo] = useState(getCompanyLogoDataUrl());
  const [message, setMessage] = useState('');

  const [billingForm, setBillingForm] = useState({
    accountName: '',
    bankName: '',
    accountNumber: '',
    supportEmail: '',
    paymentInstructions: '',
  });

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<UpsertSubscriptionPackageRequest>(emptyPackageForm);

  const billingQ = useQuery({
    queryKey: ['admin-billing-settings'],
    queryFn: getAdminBillingSettings,
  });

  const packagesQ = useQuery({
    queryKey: ['admin-subscription-packages'],
    queryFn: getAdminSubscriptionPackages,
  });

  const tenantOverviewQ = useQuery({
    queryKey: ['admin-tenant-overview'],
    queryFn: getAdminTenantOverview,
  });

  useEffect(() => {
    if (billingQ.data) {
      setBillingForm({
        accountName: billingQ.data.accountName || '',
        bankName: billingQ.data.bankName || '',
        accountNumber: billingQ.data.accountNumber || '',
        supportEmail: billingQ.data.supportEmail || '',
        paymentInstructions: billingQ.data.paymentInstructions || '',
      });
    }
  }, [billingQ.data]);

  const selectedPackage = useMemo(
    () => packagesQ.data?.items.find((x) => x.id === selectedPackageId) || null,
    [packagesQ.data?.items, selectedPackageId]
  );

  useEffect(() => {
    if (!selectedPackage) {
      setPackageForm(emptyPackageForm);
      return;
    }

    setPackageForm({
      code: selectedPackage.code,
      name: selectedPackage.name,
      description: selectedPackage.description,
      monthlyPrice: selectedPackage.monthlyPrice,
      currencyCode: selectedPackage.currencyCode,
      displayOrder: selectedPackage.displayOrder,
      isActive: selectedPackage.isActive,
      isPublic: selectedPackage.isPublic,
    });
  }, [selectedPackage]);

  const saveBillingMut = useMutation({
    mutationFn: saveBillingSettings,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-billing-settings'] });
      setMessage('Billing settings saved successfully.');
    },
    onError: (e) => setMessage(getTenantReadableError(e, 'Unable to save billing settings.')),
  });

  const savePackageMut = useMutation({
    mutationFn: async () => {
      if (selectedPackageId) {
        return await updateSubscriptionPackage(selectedPackageId, packageForm);
      }

      return await createSubscriptionPackage(packageForm);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-subscription-packages'] });
      setMessage(selectedPackageId ? 'Package updated successfully.' : 'Package created successfully.');
      if (!selectedPackageId) {
        setPackageForm(emptyPackageForm);
      }
    },
    onError: (e) => setMessage(getTenantReadableError(e, 'Unable to save package.')),
  });

  function saveTenantKeyNow() {
    setTenantKey(tenantKeyInput);
    setMessage('Tenant key saved.');
    qc.invalidateQueries({ queryKey: ['admin-tenant-overview'] });
  }

  async function onTenantLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setTenantLogo(dataUrl);
    setTenantLogoDataUrl(dataUrl);
    setMessage('Tenant logo updated.');
  }

  async function onCompanyLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCompanyLogo(dataUrl);
    setCompanyLogoDataUrl(dataUrl);
    setMessage('Company logo updated.');
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Tenant Operational Overview</h2>
          <span className="muted">Tenant, license, package, and user visibility</span>
        </div>

        {tenantOverviewQ.isLoading ? (
          <div className="muted">Loading tenant operational overview...</div>
        ) : tenantOverviewQ.isError ? (
          <div className="muted">Unable to load tenant operational overview.</div>
        ) : tenantOverviewQ.data ? (
          <div className="kv">
            <div className="kv-row"><span>Tenant Name</span><span>{tenantOverviewQ.data.tenantName}</span></div>
            <div className="kv-row"><span>Tenant Key</span><span>{tenantOverviewQ.data.tenantKey}</span></div>
            <div className="kv-row"><span>Tenant Status</span><span>{tenantStatusLabel(tenantOverviewQ.data.tenantStatus)}</span></div>
            <div className="kv-row"><span>Package</span><span>{tenantOverviewQ.data.packageName || 'Not configured'}</span></div>
            <div className="kv-row"><span>License Status</span><span>{licenseStatusLabel(tenantOverviewQ.data.licenseStatus)}</span></div>
            <div className="kv-row"><span>License Start</span><span>{formatDate(tenantOverviewQ.data.licenseStartDateUtc)}</span></div>
            <div className="kv-row"><span>License End</span><span>{formatDate(tenantOverviewQ.data.licenseEndDateUtc)}</span></div>
            <div className="kv-row"><span>Days Remaining</span><span>{tenantOverviewQ.data.daysRemaining ?? 'Not available'}</span></div>
            <div className="kv-row"><span>Amount Paid</span><span>{tenantOverviewQ.data.amountPaid != null ? `${tenantOverviewQ.data.currencyCode || ''} ${tenantOverviewQ.data.amountPaid}`.trim() : 'Not available'}</span></div>
            <div className="kv-row"><span>Total Users</span><span>{tenantOverviewQ.data.users.total}</span></div>
            <div className="kv-row"><span>Active Users</span><span>{tenantOverviewQ.data.users.active}</span></div>
            <div className="kv-row"><span>Inactive Users</span><span>{tenantOverviewQ.data.users.inactive}</span></div>
            <div className="kv-row"><span>Tenant Admins</span><span>{tenantOverviewQ.data.users.byRole.tenantAdmin}</span></div>
            <div className="kv-row"><span>Accountants</span><span>{tenantOverviewQ.data.users.byRole.accountant}</span></div>
            <div className="kv-row"><span>Approvers</span><span>{tenantOverviewQ.data.users.byRole.approver}</span></div>
            <div className="kv-row"><span>Viewers</span><span>{tenantOverviewQ.data.users.byRole.viewer}</span></div>
            <div className="kv-row"><span>Support Warning</span><span>{tenantOverviewQ.data.renewalWarning}</span></div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Settings</h2>
          <span className="muted">Tenant, branding, billing, and package settings</span>
        </div>

        {message ? <div className="kv"><div className="muted">{message}</div></div> : null}

        <div className="form-grid two">
          <div className="form-row">
            <label>Tenant Key (X-Tenant-Key)</label>
            <input className="input" value={tenantKeyInput} onChange={(e) => setTenantKeyInput(e.target.value)} />
            <div className="inline-actions">
              <button className="button primary" onClick={saveTenantKeyNow}>Save</button>
              <button className="button" onClick={() => setTenantKeyInput('demo-tenant')}>Use demo-tenant</button>
            </div>
          </div>

          <div className="form-row">
            <label>Company Logo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => onCompanyLogoChange(e.target.files?.[0] || null)} />
            <div className="muted">{companyLogo ? 'Set' : 'Not set'}</div>
          </div>

          <div className="form-row">
            <label>Tenant Logo (optional)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => onTenantLogoChange(e.target.files?.[0] || null)} />
            <div className="muted">{tenantLogo ? 'Set' : 'Not set'}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Billing Settings</h2>
          <span className="muted">Shown to prospective tenants for direct bank transfer</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Account Name</label>
            <input className="input" value={billingForm.accountName} onChange={(e) => setBillingForm((s) => ({ ...s, accountName: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Bank Name</label>
            <input className="input" value={billingForm.bankName} onChange={(e) => setBillingForm((s) => ({ ...s, bankName: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Account Number</label>
            <input className="input" value={billingForm.accountNumber} onChange={(e) => setBillingForm((s) => ({ ...s, accountNumber: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Support Email</label>
            <input className="input" value={billingForm.supportEmail} onChange={(e) => setBillingForm((s) => ({ ...s, supportEmail: e.target.value }))} />
          </div>

          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
            <label>Payment Instructions</label>
            <textarea className="textarea" value={billingForm.paymentInstructions} onChange={(e) => setBillingForm((s) => ({ ...s, paymentInstructions: e.target.value }))} />
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="button primary" onClick={() => saveBillingMut.mutate(billingForm)} disabled={saveBillingMut.isPending}>
            {saveBillingMut.isPending ? 'Saving…' : 'Save Billing Settings'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Subscription Packages</h2>
          <span className="muted">Manage annual license pricing and public visibility</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Existing Packages</label>
            <select
              className="select"
              value={selectedPackageId || ''}
              onChange={(e) => setSelectedPackageId(e.target.value || null)}
            >
              <option value="">— Create New Package —</option>
              {(packagesQ.data?.items || []).map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.code} - {pkg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Package Code</label>
            <input className="input" value={packageForm.code} onChange={(e) => setPackageForm((s) => ({ ...s, code: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Package Name</label>
            <input className="input" value={packageForm.name} onChange={(e) => setPackageForm((s) => ({ ...s, name: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Annual Price</label>
            <input
              className="input"
              type="number"
              value={packageForm.monthlyPrice}
              onChange={(e) => setPackageForm((s) => ({ ...s, monthlyPrice: Number(e.target.value || 0) }))}
            />
          </div>

          <div className="form-row">
            <label>Currency Code</label>
            <input className="input" value={packageForm.currencyCode || 'NGN'} onChange={(e) => setPackageForm((s) => ({ ...s, currencyCode: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>Display Order</label>
            <input
              className="input"
              type="number"
              value={packageForm.displayOrder}
              onChange={(e) => setPackageForm((s) => ({ ...s, displayOrder: Number(e.target.value || 1) }))}
            />
          </div>

          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea className="textarea" value={packageForm.description || ''} onChange={(e) => setPackageForm((s) => ({ ...s, description: e.target.value }))} />
          </div>

          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={packageForm.isActive}
                onChange={(e) => setPackageForm((s) => ({ ...s, isActive: e.target.checked }))}
              />
              {' '}Active
            </label>
          </div>

          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={packageForm.isPublic}
                onChange={(e) => setPackageForm((s) => ({ ...s, isPublic: e.target.checked }))}
              />
              {' '}Visible on Public Pricing Page
            </label>
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <button className="button" onClick={() => { setSelectedPackageId(null); setPackageForm(emptyPackageForm); }}>
            New Package
          </button>

          <button className="button primary" onClick={() => savePackageMut.mutate()} disabled={savePackageMut.isPending}>
            {savePackageMut.isPending ? 'Saving…' : selectedPackageId ? 'Update Package' : 'Create Package'}
          </button>
        </div>
      </section>
    </div>
  );
}