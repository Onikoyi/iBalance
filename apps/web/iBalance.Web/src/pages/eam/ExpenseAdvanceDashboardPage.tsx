import { formatAmount, useQuery, getEamDashboard, canViewExpenseAdvances } from './eamShared';

export function ExpenseAdvanceDashboardPage() {
  const canView = canViewExpenseAdvances();
  const dashboardQ = useQuery({ queryKey: ['eam-dashboard'], queryFn: getEamDashboard, enabled: canView });

  if (!canView) return <div className="panel error-panel">You do not have access to Expense & Advance Management.</div>;
  if (dashboardQ.isLoading) return <div className="panel">Loading Expense & Advance dashboard...</div>;
  if (dashboardQ.isError || !dashboardQ.data) return <div className="panel error-panel">Unable to load Expense & Advance dashboard.</div>;

  const d = dashboardQ.data;
  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Expense & Advance Dashboard</h2>
        <div className="muted">Track advance requests, retirement exposure, outstanding balances, and overdue pressure.</div>
        <div className="kpi-grid">
          <div className="kpi-card"><span>Total Requests</span><strong>{d.totalRequests}</strong></div>
          <div className="kpi-card"><span>Drafts</span><strong>{d.drafts}</strong></div>
          <div className="kpi-card"><span>Submitted</span><strong>{d.submitted}</strong></div>
          <div className="kpi-card"><span>Approved</span><strong>{d.approved}</strong></div>
          <div className="kpi-card"><span>Disbursed</span><strong>{d.disbursed}</strong></div>
          <div className="kpi-card"><span>Outstanding</span><strong>{d.outstandingCount}</strong></div>
          <div className="kpi-card"><span>Overdue</span><strong>{d.overdueCount}</strong></div>
          <div className="kpi-card"><span>Total Requested</span><strong>{formatAmount(d.totalRequested)}</strong></div>
          <div className="kpi-card"><span>Total Retired</span><strong>{formatAmount(d.totalRetired)}</strong></div>
          <div className="kpi-card"><span>Total Outstanding</span><strong>{formatAmount(d.totalOutstanding)}</strong></div>
        </div>
      </section>
    </div>
  );
}

