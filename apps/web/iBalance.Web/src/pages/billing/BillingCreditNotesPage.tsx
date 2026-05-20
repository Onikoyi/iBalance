import { useMemo, useState } from 'react';
import {
  approveBillingCreditNote,
  canApproveBillingCreditNotes,
  canCreateBillingCreditNotes,
  canPostBillingInvoices,
  canViewBilling,
  createBillingCreditNote,
  formatBillingAmount,
  getBillingCreditNotes,
  getBillingInvoices,
  getBillingPolicy,
  getBillingReadableError,
  postBillingCreditNote,
  rejectBillingCreditNote,
  submitBillingCreditNote,
  toDateInputValue,
  useMutation,
  useQuery,
  useQueryClient,
} from './BillingShared';

function statusLabel(statusName?: string | null, status?: number | null): string {
  if (statusName && statusName.trim().length > 0) return statusName;
  if (status === 1) return 'Draft';
  if (status === 2) return 'SubmittedForApproval';
  if (status === 3) return 'Approved';
  if (status === 4) return 'Posted';
  if (status === 5) return 'Rejected';
  if (status === 6) return 'Cancelled';
  return 'Unknown';
}

export function BillingCreditNotesPage() {
  const queryClient = useQueryClient();
  const canView = canViewBilling();
  const canCreate = canCreateBillingCreditNotes();
  const canApprove = canApproveBillingCreditNotes();
  const canPost = canPostBillingInvoices();

  const [form, setForm] = useState({
    billingInvoiceId: '',
    creditNoteDateUtc: new Date().toISOString().slice(0, 10),
    creditNoteNumber: '',
    amount: 0,
    reason: '',
  });
  const [postTaxAmount, setPostTaxAmount] = useState(0);
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});
  const [errorText, setErrorText] = useState('');
  const [message, setMessage] = useState('');

  const notesQ = useQuery({
    queryKey: ['billing-credit-notes'],
    queryFn: getBillingCreditNotes,
    enabled: canView,
  });

  const invoicesQ = useQuery({
    queryKey: ['billing-invoices', 'credit-note-source'],
    queryFn: () => getBillingInvoices(),
    enabled: canView,
  });

  const policyQ = useQuery({
    queryKey: ['billing-policy'],
    queryFn: getBillingPolicy,
    enabled: canView,
  });

  const creditableInvoices = useMemo(
    () =>
      (invoicesQ.data?.items ?? []).filter(
        (invoice) =>
          Number(invoice.outstandingAmount || 0) > 0 &&
          (invoice.statusName === 'Posted' ||
            invoice.statusName === 'PartPaid' ||
            invoice.status === 4 ||
            invoice.status === 5)
      ),
    [invoicesQ.data?.items]
  );

  const selectedInvoice = creditableInvoices.find((invoice) => invoice.id === form.billingInvoiceId);

  const createMut = useMutation({
    mutationFn: createBillingCreditNote,
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note created.');
      setErrorText('');
      setForm({
        billingInvoiceId: '',
        creditNoteDateUtc: new Date().toISOString().slice(0, 10),
        creditNoteNumber: '',
        amount: 0,
        reason: '',
      });
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to create credit note.')),
  });

  const submitMut = useMutation({
    mutationFn: submitBillingCreditNote,
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note submitted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to submit credit note.')),
  });

  const approveMut = useMutation({
    mutationFn: approveBillingCreditNote,
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note approved.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to approve credit note.')),
  });

  const rejectMut = useMutation({
    mutationFn: ({ creditNoteId, reason }: { creditNoteId: string; reason: string }) => {
      const normalizedReason = reason.trim();

      if (!normalizedReason) {
        throw new Error('Reason for rejection is required.');
      }

      return rejectBillingCreditNote(creditNoteId, normalizedReason);
    },
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note rejected.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to reject credit note.')),
  });

  const postMut = useMutation({
    mutationFn: (creditNoteId: string) => {
      const policy = policyQ.data?.item;

      if (!policy?.receivableControlAccountId || !policy.defaultRevenueAccountId) {
        throw new Error('Billing setup must have receivable control and default revenue accounts before credit notes can be posted.');
      }

      return postBillingCreditNote(creditNoteId, {
        receivableLedgerAccountId: policy.receivableControlAccountId,
        revenueLedgerAccountId: policy.defaultRevenueAccountId,
        taxLedgerAccountId: postTaxAmount > 0 ? policy.taxLiabilityAccountId || null : null,
        taxAmount: postTaxAmount,
      });
    },
    onSuccess: (response) => {
      setMessage(response.message || 'Credit note posted.');
      setErrorText('');
      setPostTaxAmount(0);
      queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-outstanding-report'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to post credit note.')),
  });

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to Billing credit notes.
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Billing Credit Notes</h2>
        <div className="muted">
          AR-backed credit notes reduce existing posted Sales Invoice receivables and post reversing General Ledger entries.
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {canCreate ? (
        <section className="panel">
          <h3>Create Credit Note</h3>
          <div className="form-grid three">
            <div className="form-row">
              <label>Source Invoice</label>
              <select
                className="input"
                value={form.billingInvoiceId}
                onChange={(e) => setForm({ ...form, billingInvoiceId: e.target.value })}
              >
                <option value="">Select posted/part-paid invoice</option>
                {creditableInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} - {invoice.customerName} - Outstanding {formatBillingAmount(invoice.outstandingAmount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Credit Note Number</label>
              <input
                className="input"
                value={form.creditNoteNumber}
                onChange={(e) => setForm({ ...form, creditNoteNumber: e.target.value })}
                placeholder="CN-0001"
              />
            </div>
            <div className="form-row">
              <label>Credit Note Date</label>
              <input
                className="input"
                type="date"
                value={form.creditNoteDateUtc}
                onChange={(e) => setForm({ ...form, creditNoteDateUtc: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Amount</label>
              <input
                className="input"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
              {selectedInvoice ? (
                <div className="muted">
                  Max: {formatBillingAmount(selectedInvoice.outstandingAmount)}
                </div>
              ) : null}
            </div>
            <div className="form-row" style={{ gridColumn: 'span 2' }}>
              <label>Reason / Description</label>
              <input
                className="input"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Reason for credit note"
              />
            </div>
          </div>
          <button
            className="button primary"
            type="button"
            disabled={createMut.isPending}
            onClick={() =>
              createMut.mutate({
                billingInvoiceId: form.billingInvoiceId,
                creditNoteDateUtc: form.creditNoteDateUtc ? new Date(`${form.creditNoteDateUtc}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
                creditNoteNumber: form.creditNoteNumber.trim(),
                amount: form.amount,
                reason: form.reason.trim(),
              })
            }
          >
            {createMut.isPending ? 'Creating...' : 'Create Credit Note'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Credit Notes</h3>

        <div className="form-grid three" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <label>Tax Amount for Posting</label>
            <input
              className="input"
              type="number"
              value={postTaxAmount}
              onChange={(e) => setPostTaxAmount(Number(e.target.value))}
            />
          </div>
          <div className="form-row" style={{ gridColumn: 'span 2' }}>
            <label>Posting Account Source</label>
            <div className="input" style={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>
              Billing Setup: AR control, revenue, and optional tax liability accounts
            </div>
          </div>
        </div>

        {notesQ.isLoading ? <div className="panel">Loading credit notes...</div> : null}
        {notesQ.isError ? <div className="error-panel">Unable to load credit notes.</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Credit Note</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th style={{ width: 340 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(notesQ.data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No credit notes found.
                  </td>
                </tr>
              ) : (
                (notesQ.data?.items ?? []).map((note) => (
                  <tr key={note.id}>
                    <td>{note.creditNoteNumber}</td>
                    <td>{note.invoiceNumber || note.salesInvoiceId}</td>
                    <td>{note.customerName || '—'}</td>
                    <td>{toDateInputValue(note.creditNoteDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBillingAmount(note.amount)}</td>
                    <td>{statusLabel(note.statusName, note.status)}</td>
                    <td>
                      <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                        {canCreate && note.status === 1 ? (
                          <button className="button" type="button" onClick={() => submitMut.mutate(note.id)}>
                            Submit
                          </button>
                        ) : null}
                        {canApprove && note.status === 2 ? (
                          <>
                            <button className="button" type="button" onClick={() => approveMut.mutate(note.id)}>
                              Approve
                            </button>
                            <input
                              className="input"
                              style={{ width: 150 }}
                              value={rejectReasonById[note.id] || ''}
                              onChange={(e) => setRejectReasonById({ ...rejectReasonById, [note.id]: e.target.value })}
                              placeholder="Reject reason"
                            />
                            <button
                              className="button"
                              type="button"
                              disabled={!rejectReasonById[note.id]?.trim() || rejectMut.isPending}
                              onClick={() => {
                                const reason = rejectReasonById[note.id]?.trim() || '';

                                if (!reason) {
                                  setErrorText('Reason for rejection is required.');
                                  return;
                                }

                                rejectMut.mutate({ creditNoteId: note.id, reason });
                              }}
                            >
                              {rejectMut.isPending ? 'Rejecting...' : 'Reject'}
                            </button>
                          </>
                        ) : null}
                        {canPost && note.status === 3 ? (
                          <button className="button primary" type="button" onClick={() => postMut.mutate(note.id)}>
                            Post
                          </button>
                        ) : null}
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
