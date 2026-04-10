import { Link } from 'react-router-dom';
import { PublicShell } from '../components/layout/PublicShell';

export function LandingPage() {
  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Secure • Multi-tenant • Finance-ready</div>
          <h1 className="hero-title">Modern accounting for growing organizations</h1>
          <p className="hero-subtitle">
            iBalance Accounting Cloud helps organizations manage financial operations with clarity,
            control, and confidence. From setup to reporting, every experience is built for real business use.
          </p>

          <div className="hero-actions">
            <Link to="/pricing" className="button primary">View Pricing</Link>
            <Link to="/subscribe" className="button">Start Subscription</Link>
            <Link to="/login" className="button">Sign In</Link>
          </div>

          <div className="kv">
            <div className="kv-row">
              <span>For organizations</span>
              <span>Tenant-based access and branded experience</span>
            </div>
            <div className="kv-row">
              <span>For finance teams</span>
              <span>Structured records, reporting, and controlled workflows</span>
            </div>
            <div className="kv-row">
              <span>For leadership</span>
              <span>Clear visibility into financial performance and reporting</span>
            </div>
          </div>
        </section>

        <section className="grid-3">
          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Structured financial control</h2>
            <p className="muted">
              Manage accounts, journals, fiscal periods, and reports in a disciplined environment designed for professional finance operations.
            </p>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Tenant-specific experience</h2>
            <p className="muted">
              Each organization works within its own secure space, with its own access context, identity, and operational setup.
            </p>
          </div>

          <div className="feature-card">
            <h2 style={{ margin: 0 }}>Professional reporting</h2>
            <p className="muted">
              Present financial information clearly with reports that are easier to review, share, and print for operational and management use.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Get started</h2>
            <span className="muted">A simple path to productive use</span>
          </div>

          <div className="kv">
            <div className="kv-row">
              <span>1. Choose a plan</span>
              <span>Select the package that matches your organization’s needs</span>
            </div>
            <div className="kv-row">
              <span>2. Create your subscription</span>
              <span>Reserve your tenant key and create your first administrator account</span>
            </div>
            <div className="kv-row">
              <span>3. Sign in and begin setup</span>
              <span>Access your finance workspace and start configuring operations</span>
            </div>
          </div>

          <div className="hero-actions" style={{ marginTop: 16 }}>
            <Link to="/pricing" className="button primary">Explore Pricing</Link>
            <Link to="/subscribe" className="button">Create Subscription</Link>
            <Link to="/login" className="button">Sign In</Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}