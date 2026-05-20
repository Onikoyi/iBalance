import {
    canViewBillingReports,
    formatBillingAmount,
    getBillingAgeingReport,
    getBillingRegisterReport,
    useQuery,
  } from './BillingShared';
  
  export function BillingReportsPage() {
    const canView = canViewBillingReports();
  
    const registerQ = useQuery({ queryKey: ['billing-register-report'], queryFn: getBillingRegisterReport, enabled: canView });
    const ageingQ = useQuery({ queryKey: ['billing-ageing-report'], queryFn: getBillingAgeingReport, enabled: canView });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Billing reports.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Billing Reports</h2>
          <div className="muted">Invoice register and ageing exposure for Billing & Invoicing.</div>
        </section>
  
        <section className="panel">
          <h3>Ageing Buckets</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Bucket</th><th style={{ textAlign: 'right' }}>Count</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {(ageingQ.data?.items ?? []).length === 0 ? <tr><td colSpan={3} className="muted">No ageing rows.</td></tr> :
                  ageingQ.data?.items.map((row) => (
                    <tr key={row.bucket}><td>{row.bucket}</td><td style={{ textAlign: 'right' }}>{row.count}</td><td style={{ textAlign: 'right' }}>{formatBillingAmount(row.amount)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
  
        <section className="panel">
          <h3>Invoice Register</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Outstanding</th></tr></thead>
              <tbody>
                {(registerQ.data?.items ?? []).length === 0 ? <tr><td colSpan={5} className="muted">No invoice rows.</td></tr> :
                  registerQ.data?.items.map((row) => (
                    <tr key={row.id}><td>{row.invoiceNumber}</td><td>{row.customerName}</td><td>{row.statusName}</td><td style={{ textAlign: 'right' }}>{formatBillingAmount(row.totalAmount)}</td><td style={{ textAlign: 'right' }}>{formatBillingAmount(row.outstandingAmount)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  