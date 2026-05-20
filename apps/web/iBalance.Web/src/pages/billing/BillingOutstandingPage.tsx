import {
    canViewBilling,
    formatBillingAmount,
    getBillingOutstandingReport,
    useQuery,
  } from './BillingShared';
  
  function formatDate(value?: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString();
  }
  
  export function BillingOutstandingPage() {
    const canView = canViewBilling();
  
    const outstandingQ = useQuery({
      queryKey: ['billing-outstanding-report'],
      queryFn: getBillingOutstandingReport,
      enabled: canView,
    });
  
    if (!canView) {
      return (
        <div className="panel error-panel">
          You do not have access to Billing outstanding invoices.
        </div>
      );
    }
  
    if (outstandingQ.isLoading) {
      return <div className="panel">Loading outstanding Billing invoices...</div>;
    }
  
    if (outstandingQ.isError) {
      return (
        <div className="panel error-panel">
          Unable to load outstanding Billing invoices.
        </div>
      );
    }
  
    const items = outstandingQ.data?.items ?? [];
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Outstanding Billing Invoices</h2>
          <div className="muted">
            AR-backed sales invoices created or managed through the Billing workspace
            with unpaid balances.
          </div>
        </section>
  
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No outstanding invoices.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.invoiceNumber}</td>
                      <td>{row.customerName}</td>
                      <td>{formatDate(row.dueDateUtc)}</td>
                      <td>{row.daysOverdue ?? 0}</td>
                      <td style={{ textAlign: 'right' }}>
                        {formatBillingAmount(row.outstandingAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  