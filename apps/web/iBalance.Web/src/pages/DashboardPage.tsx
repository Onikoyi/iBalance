import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../lib/api';
import { StatCard } from '../components/common/StatCard';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  if (isLoading) {
    return <div className="panel">Loading dashboard summary...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load dashboard summary.</div>;
  }

  return (
    <div className="page-grid">
      <div className="stats-grid">
        <StatCard label="Accounts" value={data.totalAccounts} />
        <StatCard label="Posted Journals" value={data.totalPostedJournals} />
        <StatCard label="Draft Journals" value={data.totalDraftJournals} />
        <StatCard label="Opening Journals" value={data.totalOpeningBalanceJournals} />
        <StatCard label="Ledger Movements" value={data.totalLedgerMovements} />
        <StatCard label="Trial Balance Debit" value={data.totalDebit.toFixed(2)} />
        <StatCard label="Trial Balance Credit" value={data.totalCredit.toFixed(2)} />
      </div>

      <section className="panel">
        <h2>Open Fiscal Period</h2>
        {data.openFiscalPeriod ? (
          <div className="detail-stack">
            <div><strong>Name:</strong> {data.openFiscalPeriod.name}</div>
            <div><strong>Start:</strong> {data.openFiscalPeriod.startDate}</div>
            <div><strong>End:</strong> {data.openFiscalPeriod.endDate}</div>
          </div>
        ) : (
          <div>No open fiscal period for today.</div>
        )}
      </section>
    </div>
  );
}