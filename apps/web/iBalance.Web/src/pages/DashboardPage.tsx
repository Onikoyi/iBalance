import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentTenantLicense, getDashboardSummary } from '../lib/api';
import { StatCard } from '../components/common/StatCard';

function licenseLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Renewal Due Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unavailable';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString();
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="panel">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">We could not load the dashboard at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Financial overview</h2>
            <div className="muted">A quick view of current activity across your finance workspace.</div>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="Accounts" value={data.totalAccounts} />
          <StatCard label="Posted Journals" value={data.totalPostedJournals} />
          <StatCard label="Draft Journals" value={data.totalDraftJournals} />
          <StatCard label="Opening Journals" value={data.totalOpeningBalanceJournals} />
          <StatCard label="Ledger Movements" value={data.totalLedgerMovements} />
          <StatCard label="Total Debit" value={data.totalDebit.toFixed(2)} />
          <StatCard label="Total Credit" value={data.totalCredit.toFixed(2)} />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Subscription summary</h2>
          <span className="muted">Current organization access status</span>
        </div>

        {licenseQ.isLoading ? (
          <div className="panel">Loading subscription summary...</div>
        ) : licenseQ.isError || !licenseQ.data ? (
          <div className="muted">Subscription information is not available right now.</div>
        ) : (
          <div className="kv">
            <div className="kv-row">
              <span>Status</span>
              <span>{licenseLabel(licenseQ.data.licenseStatus)}</span>
            </div>
            <div className="kv-row">
              <span>Subscription Plan</span>
              <span>{licenseQ.data.packageName || 'Not assigned'}</span>
            </div>
            <div className="kv-row">
              <span>Start Date</span>
              <span>{formatDate(licenseQ.data.licenseStartDateUtc)}</span>
            </div>
            <div className="kv-row">
              <span>End Date</span>
              <span>{formatDate(licenseQ.data.licenseEndDateUtc)}</span>
            </div>
            <div className="kv-row">
              <span>Days Remaining</span>
              <span>{licenseQ.data.daysRemaining ?? 'Not available'}</span>
            </div>
          </div>
        )}

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <Link to="/license-status" className="button">View Subscription</Link>
          <Link to="/reports" className="button">Open Reports</Link>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Current fiscal period</h2>
          <span className="muted">Today’s operational period</span>
        </div>

        {data.openFiscalPeriod ? (
          <div className="kv">
            <div className="kv-row">
              <span>Period Name</span>
              <span>{data.openFiscalPeriod.name}</span>
            </div>
            <div className="kv-row">
              <span>Start Date</span>
              <span>{data.openFiscalPeriod.startDate}</span>
            </div>
            <div className="kv-row">
              <span>End Date</span>
              <span>{data.openFiscalPeriod.endDate}</span>
            </div>
          </div>
        ) : (
          <div className="muted">
            There is no open fiscal period for today.
          </div>
        )}
      </section>
    </div>
  );
}