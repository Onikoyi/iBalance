import {
    canViewBilling,
    formatBillingAmount,
    getBillingDashboard,
    useQuery,
  } from './BillingShared';
  
  export function BillingDashboardPage() {
    const canView = canViewBilling();
  
    const dashboardQ = useQuery({
      queryKey: ['billing-dashboard'],
      queryFn: getBillingDashboard,
      enabled: canView,
    });
  
    if (!canView) {
      return <div className="panel error-panel">You do not have access to Billing.</div>;
    }
  
    if (dashboardQ.isLoading) {
      return <div className="panel">Loading Billing dashboard...</div>;
    }
  
    if (dashboardQ.isError) {
      return <div className="panel error-panel">Unable to load Billing dashboard.</div>;
    }
  
    const item = dashboardQ.data?.item;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Billing & Invoicing Dashboard</h2>
          <div className="muted">
            Tenant-aware commercial invoice lifecycle, approval, posting readiness, outstanding exposure, and billing controls.
          </div>
        </section>
  
        <section className="kpi-grid">
          <div className="kpi-card"><div className="muted">Invoices</div><strong>{item?.invoiceCount ?? 0}</strong></div>
          <div className="kpi-card"><div className="muted">Submitted</div><strong>{item?.submittedCount ?? 0}</strong></div>
          <div className="kpi-card"><div className="muted">Approved</div><strong>{item?.approvedCount ?? 0}</strong></div>
          <div className="kpi-card"><div className="muted">Posted</div><strong>{item?.postedCount ?? 0}</strong></div>
          <div className="kpi-card"><div className="muted">Total Billed</div><strong>{formatBillingAmount(item?.totalBilled)}</strong></div>
          <div className="kpi-card"><div className="muted">Outstanding</div><strong>{formatBillingAmount(item?.totalOutstanding)}</strong></div>
        </section>
      </div>
    );
  }
  