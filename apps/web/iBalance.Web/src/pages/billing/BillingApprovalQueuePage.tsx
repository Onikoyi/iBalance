import {
    approveBillingInvoice,
    canApproveBillingInvoices,
    canRejectBillingInvoices,
    canViewBilling,
    formatBillingAmount,
    getBillingInvoices,
    getBillingReadableError,
    rejectBillingInvoice,
    useMutation,
    useQuery,
    useQueryClient,
  } from './BillingShared';
  
  export function BillingApprovalQueuePage() {
    const queryClient = useQueryClient();
    const canView = canViewBilling();
    const canApprove = canApproveBillingInvoices();
    const canReject = canRejectBillingInvoices();
  
    const invoicesQ = useQuery({
      queryKey: ['billing-invoices', 'submitted'],
      queryFn: () => getBillingInvoices(1),
      enabled: canView,
    });
  
    const actionMut = useMutation({
      mutationFn: ({ action, invoiceId }: { action: string; invoiceId: string }) =>
        action === 'approve'
          ? approveBillingInvoice(invoiceId)
          : rejectBillingInvoice(invoiceId, 'Rejected from approval queue.'),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-invoices'] }),
      onError: (error) => alert(getBillingReadableError(error, 'Unable to complete approval action.')),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Billing approval queue.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Billing Approval Queue</h2>
          <div className="muted">Checker queue for submitted billing invoices.</div>
        </section>
  
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Invoice</th><th>Customer</th><th style={{ textAlign: 'right' }}>Total</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(invoicesQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="muted">No invoices awaiting approval.</td></tr>
                ) : (
                  (invoicesQ.data?.items ?? []).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.customerName}</td>
                      <td style={{ textAlign: 'right' }}>{formatBillingAmount(invoice.totalAmount)}</td>
                      <td>
                        <div className="inline-actions">
                          {canApprove ? <button className="button" onClick={() => actionMut.mutate({ action: 'approve', invoiceId: invoice.id })}>Approve</button> : null}
                          {canReject ? <button className="button" onClick={() => actionMut.mutate({ action: 'reject', invoiceId: invoice.id })}>Reject</button> : null}
                        </div>
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
  