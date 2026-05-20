import { useMemo, useState } from 'react';
import {
  approveBillingInvoice,
  canApproveBillingInvoices,
  canCreateBillingInvoices,
  canPostBillingInvoices,
  canRejectBillingInvoices,
  canSubmitBillingInvoices,
  canViewBilling,
  createBillingInvoice,
  formatBillingAmount,
  getBillingCustomers,
  getBillingInvoices,
  getBillingPolicy,
  getBillingReadableError,
  postBillingInvoice,
  rejectBillingInvoice,
  submitBillingInvoice,
  useMutation,
  useQuery,
  useQueryClient,
  type SaveBillingInvoiceRequest,
} from './BillingShared';

const today = new Date().toISOString().slice(0, 10);

const emptyInvoice: SaveBillingInvoiceRequest = {
  customerId: '',
  customerName: '',
  customerEmail: '',
  invoiceNumber: '',
  invoiceDateUtc: `${today}T00:00:00.000Z`,
  dueDateUtc: null,
  currencyCode: 'NGN',
  receivableControlAccountId: null,
  revenueAccountId: null,
  taxLiabilityAccountId: null,
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, revenueAccountId: null }],
};

export function BillingInvoicesPage() {
  const queryClient = useQueryClient();
  const canView = canViewBilling();
  const canCreate = canCreateBillingInvoices();
  const canSubmit = canSubmitBillingInvoices();
  const canApprove = canApproveBillingInvoices();
  const canReject = canRejectBillingInvoices();
  const canPost = canPostBillingInvoices();

  const [form, setForm] = useState<SaveBillingInvoiceRequest>(emptyInvoice);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const invoicesQ = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => getBillingInvoices(),
    enabled: canView,
  });

  const customersQ = useQuery({
    queryKey: ['billing-customers'],
    queryFn: getBillingCustomers,
    enabled: canView && canCreate,
    staleTime: 60_000,
  });

  const policyQ = useQuery({
    queryKey: ['billing-policy'],
    queryFn: getBillingPolicy,
    enabled: canView && canCreate,
    staleTime: 60_000,
  });

  const nextInvoiceNumberPreview = useMemo(() => {
    const policy = policyQ.data?.item;
    if (!policy) return '';
    return `${policy.invoicePrefix}-${String(policy.nextInvoiceNumber).padStart(6, '0')}`;
  }, [policyQ.data?.item]);

  const total = useMemo(
    () => form.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0),
    [form.lines]
  );

  const createMut = useMutation({
    mutationFn: createBillingInvoice,
    onSuccess: (response) => {
      setMessage(response.message || 'Invoice created.');
      setErrorText('');
      setForm(emptyInvoice);
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-dashboard'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to create invoice.')),
  });

  const actionMut = useMutation({
    mutationFn: async ({ action, invoiceId }: { action: string; invoiceId: string }) => {
      if (action === 'submit') return submitBillingInvoice(invoiceId);
      if (action === 'approve') return approveBillingInvoice(invoiceId);
      if (action === 'reject') return rejectBillingInvoice(invoiceId, 'Rejected from billing invoice list.');
      if (action === 'post') return postBillingInvoice(invoiceId);
      throw new Error('Unknown action.');
    },
    onSuccess: (response: any) => {
      setMessage(response?.message || 'Invoice action completed.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-dashboard'] });
    },
    onError: (error) => setErrorText(getBillingReadableError(error, 'Unable to complete invoice action.')),
  });

  function selectCustomer(customerId: string) {
    const customer = customersQ.data?.items.find((item) => item.id === customerId);
    setForm((current) => ({
      ...current,
      customerId,
      customerName: customer?.customerName || '',
      customerEmail: customer?.email || '',
    }));
  }

  function updateLine(index: number, patch: Partial<SaveBillingInvoiceRequest['lines'][number]>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { description: '', quantity: 1, unitPrice: 0, taxRate: 0, revenueAccountId: null }],
    }));
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, i) => i !== index),
    }));
  }

  function submitCreate() {
    setMessage('');
    setErrorText('');

    if (!form.customerId) {
      setErrorText('Select an existing AR customer before creating a Billing invoice.');
      return;
    }

    const payload: SaveBillingInvoiceRequest = {
      ...form,
      invoiceNumber: form.invoiceNumber?.trim() || nextInvoiceNumberPreview || undefined,
      invoiceDateUtc: form.invoiceDateUtc || new Date().toISOString(),
      notes: form.notes || 'Billing & Invoicing invoice',
    };

    createMut.mutate(payload);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to Billing invoices.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Billing Invoices</h2>
        <div className="muted">
          Billing now uses the existing Accounts Receivable SalesInvoice engine as the receivable source of truth.
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {canCreate ? (
        <section className="panel">
          <h3>Create Billing Invoice</h3>
          <div className="muted">
            Select an existing AR customer. The invoice will be created as an AR SalesInvoice so customer balances, statements, receipts, ageing, and GL posting remain unified.
          </div>

          <div className="form-grid three">
            <div className="form-row">
              <label>Customer</label>
              <select className="input" value={form.customerId || ''} onChange={(e) => selectCustomer(e.target.value)}>
                <option value="">Select customer</option>
                {(customersQ.data?.items ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerCode} - {customer.customerName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Invoice Number</label>
              <input
                className="input"
                value={form.invoiceNumber || ''}
                placeholder={nextInvoiceNumberPreview || 'BILL-YYYYMMDDHHMMSS'}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Invoice Date</label>
              <input
                className="input"
                type="date"
                value={form.invoiceDateUtc ? new Date(form.invoiceDateUtc).toISOString().slice(0, 10) : today}
                onChange={(e) => setForm({ ...form, invoiceDateUtc: `${e.target.value}T00:00:00.000Z` })}
              />
            </div>
          </div>

          <h4>Lines</h4>
          {form.lines.map((line, index) => (
            <div key={index} className="form-grid four">
              <div className="form-row">
                <label>Description</label>
                <input className="input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Quantity</label>
                <input className="input" type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} />
              </div>
              <div className="form-row">
                <label>Unit Price</label>
                <input className="input" type="number" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })} />
              </div>
              <div className="form-row">
                <label>Line Total</label>
                <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
                  {formatBillingAmount(Number(line.quantity || 0) * Number(line.unitPrice || 0))}
                </div>
              </div>
              {form.lines.length > 1 ? (
                <button className="button" type="button" onClick={() => removeLine(index)}>Remove Line</button>
              ) : null}
            </div>
          ))}

          <div className="inline-actions">
            <button className="button" type="button" onClick={addLine}>Add Line</button>
            <strong>Total: {formatBillingAmount(total)}</strong>
          </div>

          <div className="form-row">
            <label>Description / Notes</label>
            <textarea className="input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <button className="button primary" type="button" onClick={submitCreate} disabled={createMut.isPending || customersQ.isLoading}>
            {createMut.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Invoice Register</h3>
        {invoicesQ.isLoading ? <div className="muted">Loading invoices...</div> : null}
        {invoicesQ.isError ? <div className="error-panel">Unable to load invoices.</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(invoicesQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={6} className="muted">No invoices found.</td></tr>
              ) : (
                (invoicesQ.data?.items ?? []).map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.customerName}</td>
                    <td>{invoice.statusName}</td>
                    <td style={{ textAlign: 'right' }}>{formatBillingAmount(invoice.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBillingAmount(invoice.outstandingAmount)}</td>
                    <td>
                      <div className="inline-actions">
                        {canSubmit && [0, 4].includes(invoice.status) ? <button className="button" onClick={() => actionMut.mutate({ action: 'submit', invoiceId: invoice.id })}>Submit</button> : null}
                        {canApprove && invoice.status === 1 ? <button className="button" onClick={() => actionMut.mutate({ action: 'approve', invoiceId: invoice.id })}>Approve</button> : null}
                        {canReject && invoice.status === 1 ? <button className="button" onClick={() => actionMut.mutate({ action: 'reject', invoiceId: invoice.id })}>Reject</button> : null}
                        {canPost && invoice.status === 2 ? <button className="button" onClick={() => actionMut.mutate({ action: 'post', invoiceId: invoice.id })}>Post</button> : null}
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
