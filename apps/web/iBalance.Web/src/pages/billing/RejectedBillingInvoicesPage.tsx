import {
    canViewBilling,
    formatBillingAmount,
    getBillingInvoices,
    useQuery,
  } from './BillingShared';
  
  export function RejectedBillingInvoicesPage() {
    const canView = canViewBilling();
  
    const invoicesQ = useQuery({
      queryKey: ['billing-invoices', 'rejected'],
      queryFn: () => getBillingInvoices(3),
      enabled: canView,
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to rejected billing invoices.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Rejected Billing Invoices</h2>
          <div className="muted">Review invoices rejected by checkers for correction and resubmission.</div>
        </section>
  
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Invoice</th><th>Customer</th><th>Reason</th><th style={{ textAlign: 'right' }}>Total</th></tr>
              </thead>
              <tbody>
                {(invoicesQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="muted">No rejected invoices.</td></tr>
                ) : (
                  (invoicesQ.data?.items ?? []).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.customerName}</td>
                      <td>{invoice.rejectionReason || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatBillingAmount(invoice.totalAmount)}</td>
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
  