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
  const [message, setMessage] = useState('');

  const checkMut = useMutation({
    mutationFn: async () => {
      setTenantKey(tenantKeyInput.trim().toLowerCase());
      return await getDashboardSummary();
    },
    onSuccess: (data) => {
      if (!data.tenantContextAvailable) {
        setMessage('We could not connect using the tenant key provided. Please review it and try again.');
        return;
      }

      setMessage(`Your tenant connection has been confirmed successfully.`);
    },
    onError: (e) => {
      setMessage(getTenantReadableError(e, 'We could not complete the tenant connection check at this time.'));
    },
  });

  const preview = useMemo(() => ({
    tenant: tenantLogo ? 'Uploaded' : 'Not uploaded',
    company: companyLogo ? 'Uploaded' : 'Not uploaded',
  }), [tenantLogo, companyLogo]);

  async function onTenantLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setTenantLogo(dataUrl);
    setTenantLogoDataUrl(dataUrl);
    setMessage('Tenant logo saved successfully.');
  }

  async function onCompanyLogoChange(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCompanyLogo(dataUrl);
    setCompanyLogoDataUrl(dataUrl);
    setMessage('Company logo saved successfully.');
  }

  function saveTenantKeyNow() {
    const normalizedTenantKey = tenantKeyInput.trim().toLowerCase();

    if (!normalizedTenantKey) {
      setMessage('Please enter a tenant key before saving.');
      return;
    }

    setTenantKey(normalizedTenantKey);
    setTenantKeyInput(normalizedTenantKey);
    setMessage('Tenant key saved successfully.');
  }

  function clearTenantLogo() {
    setTenantLogo('');
    setTenantLogoDataUrl('');
    setMessage('Tenant logo removed.');
  }

  function clearCompanyLogo() {
    setCompanyLogo('');
    setCompanyLogoDataUrl('');
    setMessage('Company logo removed.');
  }

  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Tenant setup</div>
          <h1 className="hero-title">Prepare your organization workspace</h1>
          <p className="hero-subtitle">
            Set your tenant key and optional branding so your organization has a consistent and professional experience from sign-in to reporting.
          </p>

          <div className="hero-actions">
            <button
              className="button primary"
              onClick={() => checkMut.mutate()}
              disabled={checkMut.isPending}
            >
              {checkMut.isPending ? 'Checking…' : 'Confirm Connection'}
            </button>
            <Link to="/subscribe" className="button">Create Subscription</Link>
            <Link to="/login" className="button">Sign In</Link>
            <Link to="/" className="button">Back to Home</Link>
          </div>

          {message ? (
            <div className="kv" style={{ borderColor: 'rgba(75, 29, 115, 0.20)' }}>
              <div className="muted">{message}</div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Tenant key</h2>
            <div className="muted">This key identifies your organization during access and setup.</div>
          </div>

          <div className="form-grid two">
            <div className="form-row">
              <label>Tenant Key</label>
              <input
                className="input"
                value={tenantKeyInput}
                onChange={(e) => setTenantKeyInput(e.target.value)}
                placeholder="Enter your tenant key"
              />
              <div className="muted">
                Saved tenant key: <strong>{getTenantKey()}</strong>
              </div>
            </div>

            <div className="form-row">
              <label>Save</label>
              <div className="inline-actions">
                <button className="button primary" onClick={saveTenantKeyNow}>
                  Save Tenant Key
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid-3">
          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Company branding</h2>
            <div className="muted">
              This logo is used for the platform or operator identity where applicable.
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Status</span>
                <span>{preview.company}</span>
              </div>
            </div>

            <div className="form-row">
              <label>Upload Company Logo</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => onCompanyLogoChange(e.target.files?.[0] || null)}
              />
              <div className="inline-actions">
                <button className="button danger" onClick={clearCompanyLogo}>
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Tenant branding</h2>
            <div className="muted">
              This logo supports your organization’s branded experience.
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Status</span>
                <span>{preview.tenant}</span>
              </div>
            </div>

            <div className="form-row">
              <label>Upload Tenant Logo</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => onTenantLogoChange(e.target.files?.[0] || null)}
              />
              <div className="inline-actions">
                <button className="button danger" onClick={clearTenantLogo}>
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Next steps</h2>
            <div className="muted">
              Once your tenant details are ready, continue to subscription setup or sign in with your organization credentials.
            </div>

            <div className="hero-actions" style={{ marginTop: 8 }}>
              <Link to="/subscribe" className="button primary">Create Subscription</Link>
              <Link to="/login" className="button">Sign In</Link>
              <Link to="/pricing" className="button">View Pricing</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}