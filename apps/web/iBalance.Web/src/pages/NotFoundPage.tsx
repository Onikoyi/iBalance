import { Link } from 'react-router-dom';
import { PublicShell } from '../components/layout/PublicShell';

export function NotFoundPage() {
  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">404</div>
          <h1 className="hero-title">Page not found</h1>
          <p className="hero-subtitle">
            The page you requested does not exist. Use navigation to continue.
          </p>
          <div className="hero-actions">
            <Link to="/" className="button primary">Home</Link>
            <Link to="/pricing" className="button">Pricing</Link>
            <Link to="/onboarding" className="button">Tenant Onboarding</Link>
            <Link to="/dashboard" className="button">Finance Console</Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}