import { useState } from 'react';
import {
  getTenantKey,
  setTenantKey,
  getTenantLogoDataUrl,
  setTenantLogoDataUrl,
  getCompanyLogoDataUrl,
  setCompanyLogoDataUrl,
} from '../../lib/api';

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export function AdminSettingsPage() {
  const [tenantKeyInput, setTenantKeyInput] = useState(getTenantKey());
  const [tenantLogo, setTenantLogo] = useState(getTenantLogoDataUrl());
  const [companyLogo, setCompanyLogo] = useState(getCompanyLogoDataUrl());
  const [message, setMessage] = useState('');

  function saveTenantKeyNow() {
    setTenantKey(tenantKeyInput);
    setMessage('Tenant key saved.');
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
          <h2>Settings</h2>
          <span className="muted">Tenant and branding settings</span>
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
    </div>
  );
}