import { Link } from 'react-router-dom';

export function AdminDashboardPage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Administration</h2>
        <div className="detail-stack">
          <div className="muted">
            This area is for platform and tenant administration: settings, branding, onboarding controls, and (later) user/role management.
          </div>
          <div className="inline-actions">
            <Link className="button primary" to="/admin/settings">Settings</Link>
            <Link className="button" to="/admin/users">Users</Link>
            <Link className="button" to="/dashboard">Back to Finance</Link>
          </div>
        </div>
      </section>
    </div>
  );
}