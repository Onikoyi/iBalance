import { Link } from 'react-router-dom';
import { canAccessAdmin } from '../lib/auth';

export function NoActiveModulesPage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <h2>No Active Modules</h2>
        <div className="muted" style={{ marginTop: 8 }}>
          Your tenant workspace currently has no active modules assigned to your account.
          Please contact your administrator or PlatformAdmin to enable the required modules.
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          {canAccessAdmin() ? (
            <Link to="/admin" className="button">
              Go to Administration
            </Link>
          ) : null}
          <Link to="/license-status" className="button">
            Subscription Status
          </Link>
        </div>
      </section>
    </div>
  );
}
