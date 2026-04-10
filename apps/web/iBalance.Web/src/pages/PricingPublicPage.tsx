import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PublicShell } from '../components/layout/PublicShell';
import { getPublicSubscriptionPackages } from '../lib/api';

function formatMoney(amount: number, currencyCode: string) {
  if (amount <= 0) return 'Contact Sales';

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode || 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PricingPublicPage() {
  const packagesQ = useQuery({
    queryKey: ['public-subscription-packages'],
    queryFn: getPublicSubscriptionPackages,
  });

  const packages = packagesQ.data?.items ?? [];

  return (
    <PublicShell>
      <div className="public-container">
        <section className="hero">
          <div className="badge">Simple plans • Clear pricing • Business-ready</div>
          <h1 className="hero-title">Pricing built for growing organizations</h1>
          <p className="hero-subtitle">
            Choose the plan that fits your organization’s operational needs. Pricing is presented clearly
            so you can select the right package with confidence.
          </p>

          <div className="hero-actions">
            <Link to="/subscribe" className="button primary">Start Subscription</Link>
            <Link to="/login" className="button">Sign In</Link>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Available plans</h2>
            <span className="muted">Select a package and continue to subscription setup</span>
          </div>

          {packagesQ.isLoading ? (
            <div className="panel">Loading pricing options...</div>
          ) : packagesQ.isError ? (
            <div className="panel error-panel">Unable to load pricing information at the moment.</div>
          ) : packages.length === 0 ? (
            <div className="panel">No subscription plans are currently available.</div>
          ) : (
            <div className="price-grid">
              {packages.map((pkg) => (
                <div key={pkg.id} className="price-card">
                  <h2 style={{ margin: 0 }}>{pkg.name}</h2>

                  <div className="price-value">
                    {formatMoney(pkg.monthlyPrice, pkg.currencyCode)}
                    {pkg.monthlyPrice > 0 ? ' / year' : ''}
                  </div>

                  <div className="muted">
                    {pkg.description || 'This package is available for subscription.'}
                  </div>

                  <div className="kv">
                    <div className="kv-row">
                      <span>Billing cycle</span>
                      <span>Annual</span>
                    </div>
                    <div className="kv-row">
                      <span>Currency</span>
                      <span>{pkg.currencyCode}</span>
                    </div>
                    <div className="kv-row">
                      <span>Availability</span>
                      <span>{pkg.isActive ? 'Available' : 'Unavailable'}</span>
                    </div>
                  </div>

                  <div className="hero-actions">
                    <Link
                      to={`/subscribe?packageId=${encodeURIComponent(pkg.id)}`}
                      className="button primary"
                    >
                      Choose {pkg.name}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}