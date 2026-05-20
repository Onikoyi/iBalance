import { useMemo, useState } from 'react';
import {
  canCreateBillingCreditNotes,
  canViewBilling,
  dateInputToUtc,
  deleteBillingCreditNote,
  formatBillingAmount,
  getBillingReadableError,
  getRejectedBillingCreditNotes,
  submitBillingCreditNote,
  toDateInputValue,
  updateBillingCreditNote,
  useMutation,
  useQuery,
  useQueryClient,
  type BillingCreditNoteDto,
} from './BillingShared';

type FormState = {
  id: string;
  creditNoteDateUtc: string;
  creditNoteNumber: string;
  amount: number;
  reason: string;
};

const emptyForm: FormState = {
  id: '',
  creditNoteDateUtc: '',
  creditNoteNumber: '',
  amount: 0,
  reason: '',
};

function toForm(item: BillingCreditNoteDto): FormState {
  return {
    id: item.id,
    creditNoteDateUtc: toDateInputValue(item.creditNoteDateUtc),
    creditNoteNumber: item.creditNoteNumber || '',
    amount: Number(item.amount || 0),
    reason: item.description || item.reason || '',
  };
}

export function RejectedBillingCreditNotesPage() {
  const queryClient = useQueryClient();
  const canView = canViewBilling();
  const canCorrect = canCreateBillingCreditNotes();

  const [selected, setSelected] = useState<BillingCreditNoteDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const rejectedQ = useQuery({
    queryKey: ['billing-credit-notes', 'rejected'],
    queryFn: getRejectedBillingCreditNotes,
    enabled: canView,
  });

  const items = useMemo(() => rejectedQ.data?.items ?? [], [rejectedQ.data?.items]);

  const updateMut = useMutation({
    mutationFn: () =>
      updateBillingCreditNote(form.id, {
        creditNoteDateUtc: dateInputToUtc(form.creditNoteDateUtc),
        creditNoteNumber: form.creditNoteNumber,
        amount: Number(form.amount || 0),
        reason: form.reason,
      }),
    onSuccess: (response) => {
      setMessage(response.message || 'Rejected credit note corrected.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes', 'rejected'] });
    },
    onError: (error) =>
      setErrorText(getBillingReadableError(error, 'Unable to correct rejected credit note.')),
  });

  const submitMut = useMutation({
    mutationFn: (creditNoteId: string) => submitBillingCreditNote(creditNoteId),
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note resubmitted for approval.');
      setErrorText('');
      setSelected(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes', 'rejected'] });
    },
    onError: (error) =>
      setErrorText(getBillingReadableError(error, 'Unable to resubmit credit note.')),
  });

  const deleteMut = useMutation({
    mutationFn: (creditNoteId: string) => deleteBillingCreditNote(creditNoteId),
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note cancelled.');
      setErrorText('');
      setSelected(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes', 'rejected'] });
    },
    onError: (error) =>
      setErrorText(getBillingReadableError(error, 'Unable to cancel credit note.')),
  });

  function selectItem(item: BillingCreditNoteDto) {
    setSelected(item);
    setForm(toForm(item));
    setMessage('');
    setErrorText('');
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to rejected Billing credit notes.
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Rejected Billing Credit Notes</h2>
        <div className="muted">
          Correct rejected AR-backed credit notes, resubmit them for approval, or cancel unposted records when required.
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      <section className="panel">
        <h3>Rejected Credit Notes</h3>
        {rejectedQ.isLoading ? <div className="muted">Loading rejected credit notes...</div> : null}
        {rejectedQ.isError ? (
          <div className="error-panel">Unable to load rejected credit notes.</div>
        ) : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Credit Note</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Rejected Reason</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rejected credit notes found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.creditNoteNumber}</td>
                    <td>{item.invoiceNumber || item.salesInvoiceId}</td>
                    <td>{item.customerName || item.customerCode || '—'}</td>
                    <td>{item.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatBillingAmount(item.amount)}</td>
                    <td>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => selectItem(item)}
                      >
                        Correct
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="panel">
          <h3>Correct / Resubmit Credit Note</h3>
          <div className="muted">
            Selected credit note: {selected.creditNoteNumber} for invoice {selected.invoiceNumber || selected.salesInvoiceId}
          </div>

          <div className="form-grid two" style={{ marginTop: 12 }}>
            <div className="form-row">
              <label>Credit Note Date</label>
              <input
                className="input"
                type="date"
                value={form.creditNoteDateUtc}
                disabled={!canCorrect}
                onChange={(event) => setForm({ ...form, creditNoteDateUtc: event.target.value })}
              />
            </div>

            <div className="form-row">
              <label>Credit Note Number</label>
              <input
                className="input"
                value={form.creditNoteNumber}
                disabled={!canCorrect}
                onChange={(event) => setForm({ ...form, creditNoteNumber: event.target.value })}
              />
            </div>

            <div className="form-row">
              <label>Amount</label>
              <input
                className="input"
                type="number"
                value={form.amount}
                disabled={!canCorrect}
                onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              />
            </div>

            <div className="form-row">
              <label>Correction Reason / Description</label>
              <textarea
                className="input"
                value={form.reason}
                disabled={!canCorrect}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>
          </div>

          {canCorrect ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                className="button secondary"
                type="button"
                disabled={updateMut.isPending}
                onClick={() => updateMut.mutate()}
              >
                {updateMut.isPending ? 'Saving...' : 'Save Correction'}
              </button>

              <button
                className="button primary"
                type="button"
                disabled={submitMut.isPending}
                onClick={() => submitMut.mutate(form.id)}
              >
                {submitMut.isPending ? 'Resubmitting...' : 'Resubmit for Approval'}
              </button>

              <button
                className="button danger"
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (window.confirm('Cancel this rejected credit note? This keeps an audit trail but removes it from active processing.')) {
                    deleteMut.mutate(form.id);
                  }
                }}
              >
                {deleteMut.isPending ? 'Cancelling...' : 'Cancel / Delete'}
              </button>

              <button
                className="button"
                type="button"
                onClick={() => {
                  setSelected(null);
                  setForm(emptyForm);
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              You can view rejected credit notes, but you do not have correction permission.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
