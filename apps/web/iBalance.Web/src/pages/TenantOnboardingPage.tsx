import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { PublicShell } from '../components/layout/PublicShell';
import {
  getTenantKey,
  setTenantKey,
  getTenantReadableError,
  getDashboardSummary,
  getTenantLogoDataUrl,
  setTenantLogoDataUrl,
  getCompanyLogoDataUrl,
  setCompanyLogoDataUrl,
} from '../lib/api';

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export function TenantOnboardingPage() {
  const [tenantKeyInput, setTenantKeyInput] = useState(getTenantKey());
  const [tenantLogo, setTenantLogo] = useState(getTenantLogoDataUrl());
  const [companyLogo, setCompanyLogo] = useState(getCompanyLogoDataUrl());
  const [message, setMessage] = useState<string>('');

  const checkMut = useMutation({
    mutationFn: async () => {
      // Ensure the latest key is applied before checking
      setTenantKey(tenantKeyInput);
      return await getDashboardSummary();
    },
    onSuccess: (data) => {
      if (!data.tenantContextAvailable) {
        setMessage('Tenant context is not available. Check your Tenant Key.');
        return;
      }
      setMessage(`Connected successfully for tenant key: ${data.tenantKey}. Snapshot: ${new Date(data.snapshotUtc).toLocaleString()}`);
    },
    onError: (e) => {
      setMessage(getTenantReadableError(e, 'Unable to connect. Verify API URL, CORS, and Tenant Key.'));
    },
  });

  const preview = useMemo(() => {
    return {
      tenant: tenantLogo ? 'Tenant logo set' : 'Tenant logo not set',
      company: companyLogo ? 'Company logo set' : 'Company logo not set',
    };
  }, [tenantLogo, companyLogo]);

  async function onTenantLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setTenantLogo(dataUrl);
    setTenantLogoDataUrl(dataUrl);
  }

  async function onCompanyLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCompanyLogo(dataUrl);
    setCompanyLogoDataUrl(dataUrl);
  }

  function saveTenantKeyNow() {
    setTenantKey(tenantKeyInput);
    setMessage('Tenant key saved.');
  }

  function clearTenantLogo() {
    setTenantLogo('');
    setTenantLogoDataUrl('');
  }

  function clearCompanyLogo() {
    setCompanyLogo('');
    setCompanyLogoDataUrl('');
  }

  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Tenant onboarding</div>
          <h1 className="hero-title">Set up your tenant access</h1>
          <p className="hero-subtitle">
            Configure your Tenant Key and optional branding. This sets the headers used by the finance console.
          </p>

          <div className="hero-actions">
            <button className="button primary" onClick={() => checkMut.mutate()} disabled={checkMut.isPending}>
              {checkMut.isPending ? 'Checking…' : 'Run Connection Check'}
            </button>
            <Link to="/dashboard" className="button">Open Finance Console</Link>
            <Link to="/" className="button">Back to Home</Link>
          </div>

          {message ? (
            <div className={message.toLowerCase().includes('success') ? 'kv' : 'kv'} style={{ borderColor: 'rgba(75, 29, 115, 0.20)' }}>
              <div className="muted">{message}</div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Tenant Key</h2>
            <div className="muted">Used as X-Tenant-Key request header</div>
          </div>

          <div className="form-grid two">
            <div className="form-row">
              <label>Tenant Key</label>
              <input
                className="input"
                value={tenantKeyInput}
                onChange={(e) => setTenantKeyInput(e.target.value)}
                placeholder="e.g. demo-tenant"
              />
              <div className="muted">Current saved key: <strong>{getTenantKey()}</strong></div>
            </div>

            <div className="form-row">
              <label>Action</label>
              <div className="inline-actions">
                <button className="button primary" onClick={saveTenantKeyNow}>Save Tenant Key</button>
                <button className="button" onClick={() => setTenantKeyInput('demo-tenant')}>Use demo-tenant</button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid-3">
          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Company Logo</h2>
            <div className="muted">Displayed as the platform/operator brand (Nikosoft).</div>
            <div className="kv">
              <div className="kv-row"><span>Status</span><span>{preview.company}</span></div>
            </div>

            <div className="form-row">
              <label>Upload Company Logo (optional)</label>
              <input className="input" type="file" accept="image/*" onChange={(e) => onCompanyLogoChange(e.target.files?.[0] || null)} />
              <div className="inline-actions">
                <button className="button danger" onClick={clearCompanyLogo}>Clear</button>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Tenant Logo</h2>
            <div className="muted">Optional — used for tenant-facing branding.</div>
            <div className="kv">
              <div className="kv-row"><span>Status</span><span>{preview.tenant}</span></div>
            </div>

            <div className="form-row">
              <label>Upload Tenant Logo (optional)</label>
              <input className="input" type="file" accept="image/*" onChange={(e) => onTenantLogoChange(e.target.files?.[0] || null)} />
              <div className="inline-actions">
                <button className="button danger" onClick={clearTenantLogo}>Clear</button>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Next</h2>
            <div className="muted">
              After connection check succeeds, you can proceed to create fiscal periods, accounts, and opening balances.
            </div>
            <div className="hero-actions" style={{ marginTop: 8 }}>
              <Link to="/fiscal-periods" className="button">Fiscal Periods</Link>
              <Link to="/accounts" className="button">Chart of Accounts</Link>
              <Link to="/journals" className="button primary">Journals</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}