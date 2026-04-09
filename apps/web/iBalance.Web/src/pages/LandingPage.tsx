import { Link } from 'react-router-dom';
import { PublicShell } from '../components/layout/PublicShell';

export function LandingPage() {
  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Production-grade • Audit-first • Multi-tenant</div>
          <h1 className="hero-title">iBalance Accounting Cloud</h1>
          <p className="hero-subtitle">
            A disciplined finance core with tenant isolation, immutable ledger movements, and reporting that can be
            reproduced from ledger history. Built for real accounting controls — not demos.
          </p>

          <div className="hero-actions">
            <Link to="/onboarding" className="button primary">
              Get Started (Tenant Onboarding)
            </Link>
            <Link to="/pricing" className="button">
              View Pricing
            </Link>
            <Link to="/dashboard" className="button">
              Open Finance Console
            </Link>
          </div>

          <div className="kv">
            <div className="kv-row">
              <span>Tenant isolation</span>
              <span>Header-based tenant context</span>
            </div>
            <div className="kv-row">
              <span>Posting engine</span>
              <span>Journal-driven • immutable movements</span>
            </div>
            <div className="kv-row">
              <span>Controls</span>
              <span>Period locks • reversal/correction flows</span>
            </div>
          </div>
        </section>

        <section className="grid-3">
          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Auditability</h2>
            <p className="muted">
              Posted effects are represented by movements; corrections happen by reversal rather than destructive edits.
            </p>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Tenant-ready</h2>
            <p className="muted">
              Configure a tenant key, optional tenant logo, and run a clean tenant-branded experience.
            </p>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Finance Console</h2>
            <p className="muted">
              Chart of accounts, journals, fiscal periods, and reports in a production-grade shell.
            </p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}