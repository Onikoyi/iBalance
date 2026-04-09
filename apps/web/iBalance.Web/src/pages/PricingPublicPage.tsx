import { Link } from 'react-router-dom';
import { PublicShell } from '../components/layout/PublicShell';

export function PricingPublicPage() {
  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Transparent pricing</div>
          <h1 className="hero-title">Pricing</h1>
          <p className="hero-subtitle">
            Choose a plan that matches your operational needs. Tenant branding is supported across all tiers.
          </p>

          <div className="hero-actions">
            <Link to="/onboarding" className="button primary">Start Onboarding</Link>
            <Link to="/dashboard" className="button">Open Finance Console</Link>
          </div>
        </section>

        <section className="price-grid">
          <div className="price-card">
            <h2 style={{ margin: 0 }}>Starter</h2>
            <div className="price-value">₦ — / mo</div>
            <div className="muted">For small teams proving finance discipline.</div>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Core finance console</li>
              <li>Chart of accounts</li>
              <li>Journals + posting + reversals</li>
              <li>Basic reports</li>
              <li>Tenant key + optional logo</li>
            </ul>
          </div>

          <div className="price-card">
            <h2 style={{ margin: 0 }}>Business</h2>
            <div className="price-value">₦ — / mo</div>
            <div className="muted">For growing organizations with stronger controls.</div>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Everything in Starter</li>
              <li>Advanced reporting UX</li>
              <li>Export-ready reports (planned)</li>
              <li>Approvals framework (planned)</li>
              <li>Onboarding templates (planned)</li>
            </ul>
          </div>

          <div className="price-card">
            <h2 style={{ margin: 0 }}>Enterprise</h2>
            <div className="price-value">Contact Sales</div>
            <div className="muted">For regulated, high-scale tenants.</div>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Premium isolation options (planned)</li>
              <li>SSO / SAML (planned)</li>
              <li>Custom onboarding & integrations</li>
              <li>Compliance hardening</li>
              <li>Dedicated support</li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <h2>Notes</h2>
          <div className="detail-stack">
            <div className="muted">
              Pricing values are placeholders until the commercial package is finalized. This page is production-ready
              structurally and can be updated without UI redesign.
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}