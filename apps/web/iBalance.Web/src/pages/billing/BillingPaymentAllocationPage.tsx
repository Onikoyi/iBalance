import { useState } from 'react';
import {
  allocateBillingPayment,
  canAllocateBillingPayments,
  canViewBilling,
  getBillingReadableError,
  useMutation,
} from './BillingShared';

export function BillingPaymentAllocationPage() {
  const canView = canViewBilling();
  const canAllocate = canAllocateBillingPayments();

  const [form, setForm] = useState({
    billingInvoiceId: '',
    paymentReference: '',
    amount: 0,
    paymentDateUtc: '',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const allocateMut = useMutation({
    mutationFn: allocateBillingPayment,
    onSuccess: (response) => {
      setMessage(response.message || 'Payment allocated.');
      setErrorText('');
      setForm({ billingInvoiceId: '', paymentReference: '', amount: 0, paymentDateUtc: '', notes: '' });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to allocate payment.')),
  });

  if (!canView) return <div className="panel error-panel">You do not have access to Billing payment allocation.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Billing Payment Allocation</h2>
        <div className="muted">Allocate received customer payments to posted billing invoices.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {canAllocate ? (
        <section className="panel">
          <div className="form-grid three">
            <div className="form-row"><label>Invoice ID</label><input className="input" value={form.billingInvoiceId} onChange={(e) => setForm({ ...form, billingInvoiceId: e.target.value })} /></div>
            <div className="form-row"><label>Payment Reference</label><input className="input" value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} /></div>
            <div className="form-row"><label>Amount</label><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Payment Date</label><input className="input" type="date" value={form.paymentDateUtc} onChange={(e) => setForm({ ...form, paymentDateUtc: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="button primary" onClick={() => allocateMut.mutate({
            billingInvoiceId: form.billingInvoiceId,
            paymentReference: form.paymentReference,
            amount: form.amount,
            paymentDateUtc: form.paymentDateUtc ? new Date(`${form.paymentDateUtc}T00:00:00.000Z`).toISOString() : null,
            notes: form.notes || null,
          })}>Allocate Payment</button>
        </section>
      ) : (
        <section className="panel error-panel">You do not have permission to allocate payments.</section>
      )}
    </div>
  );
}
