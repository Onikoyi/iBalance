import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteRejectedCustomerReceipt,
  getCustomers,
  getRejectedCustomerReceipts,
  getSalesInvoices,
  getTenantReadableError,
  submitCustomerReceiptForApproval,
  updateRejectedCustomerReceipt,
  type RejectedCustomerReceiptDto,
  type UpdateCustomerReceiptRequest,
} from '../lib/api';
import {
  canManageCustomers,
  canSubmitCustomerReceipts,
  canViewAccountsReceivable,
} from '../lib/auth';

const emptyForm: UpdateCustomerReceiptRequest = {
  customerId: '',
  salesInvoiceId: '',
  receiptDateUtc: '',
  receiptNumber: '',
  description: '',
  amount: 0,
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : '';
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function customerReceiptStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Cancelled';
    default: return 'Unknown';
  }
}

function salesInvoiceStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Posted';
    case 5: return 'Part Paid';
    case 6: return 'Paid';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

export function RejectedCustomerReceiptsPage() {
  const qc = useQueryClient();
  const canView = canViewAccountsReceivable();
const canManage = canManageCustomers();
const canSubmitApproval = canSubmitCustomerReceipts();

  const [selectedReceipt, setSelectedReceipt] = useState<RejectedCustomerReceiptDto | null>(null);
  const [form, setForm] = useState<UpdateCustomerReceiptRequest>(emptyForm);
  const [showEdit, setShowEdit] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [search, setSearch] = useState('');

  const rejectedReceiptsQ = useQuery({
    queryKey: ['ar-rejected-customer-receipts'],
    queryFn: getRejectedCustomerReceipts,
    enabled: canView,
  });

  const customersQ = useQuery({
    queryKey: ['ar-customers'],
    queryFn: getCustomers,
    enabled: canView,
  });

  const salesInvoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['ar-rejected-customer-receipts'] });
    await qc.invalidateQueries({ queryKey: ['ar-customer-receipts'] });
    await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
  }

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selectedReceipt) {
        throw new Error('No rejected customer receipt selected.');
      }

      return updateRejectedCustomerReceipt(selectedReceipt.id, {
        customerId: form.customerId,
        salesInvoiceId: form.salesInvoiceId,
        receiptDateUtc: form.receiptDateUtc,
        receiptNumber: form.receiptNumber.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
      });
    },
    onSuccess: async () => {
      await refresh();
      setShowEdit(false);
      setSelectedReceipt(null);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Rejected customer receipt updated successfully. It remains rejected until resubmitted.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update rejected customer receipt.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (customerReceiptId: string) => submitCustomerReceiptForApproval(customerReceiptId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Customer receipt resubmitted for approval successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to resubmit customer receipt for approval.'));
      setInfoText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (customerReceiptId: string) => deleteRejectedCustomerReceipt(customerReceiptId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Rejected customer receipt deleted successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to delete rejected customer receipt.'));
      setInfoText('');
    },
  });

  const filteredReceipts = useMemo(() => {
    const items = rejectedReceiptsQ.data?.items ?? [];
    const text = search.trim().toLowerCase();

    if (!text) return items;

    return items.filter((item) => {
      return (
        item.receiptNumber.toLowerCase().includes(text) ||
        item.customerCode.toLowerCase().includes(text) ||
        item.customerName.toLowerCase().includes(text) ||
        item.invoiceNumber.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text) ||
        (item.rejectionReason || '').toLowerCase().includes(text)
      );
    });
  }, [rejectedReceiptsQ.data?.items, search]);

  const eligibleInvoices = useMemo(() => {
    const items = salesInvoicesQ.data?.items ?? [];

    return items
      .filter((invoice) => {
        const isPostedOrPartPaid = invoice.status === 4 || invoice.status === 5;
        const isCurrentInvoice = invoice.id === form.salesInvoiceId;
        const hasOutstandingBalance = Number(invoice.balanceAmount || 0) > 0;

        return isCurrentInvoice || (isPostedOrPartPaid && hasOutstandingBalance);
      })
      .sort((a, b) => `${a.invoiceNumber}`.localeCompare(`${b.invoiceNumber}`));
  }, [salesInvoicesQ.data?.items, form.salesInvoiceId]);

  const filteredEligibleInvoices = useMemo(() => {
    if (!form.customerId) return eligibleInvoices;
    return eligibleInvoices.filter((invoice) => invoice.customerId === form.customerId);
  }, [eligibleInvoices, form.customerId]);

  const selectedInvoice = useMemo(() => {
    return (salesInvoicesQ.data?.items ?? []).find((invoice) => invoice.id === form.salesInvoiceId) ?? null;
  }, [salesInvoicesQ.data?.items, form.salesInvoiceId]);

  function update<K extends keyof UpdateCustomerReceiptRequest>(key: K, value: UpdateCustomerReceiptRequest[K]) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  function openEdit(receipt: RejectedCustomerReceiptDto) {
    if (!canManage) {
      setErrorText('You do not have permission to edit rejected customer receipts.');
      setInfoText('');
      return;
    }

    setSelectedReceipt(receipt);
    setForm({
      customerId: receipt.customerId,
      salesInvoiceId: receipt.salesInvoiceId,
      receiptDateUtc: receipt.receiptDateUtc,
      receiptNumber: receipt.receiptNumber,
      description: receipt.description,
      amount: Number(receipt.amount || 0),
    });
    setErrorText('');
    setInfoText('');
    setShowEdit(true);
  }

  function closeEdit() {
    if (!updateMut.isPending) {
      setShowEdit(false);
      setSelectedReceipt(null);
      setForm(emptyForm);
      setErrorText('');
    }
  }

  async function submitUpdate() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to edit rejected customer receipts.');
      return;
    }

    if (!selectedReceipt) {
      setErrorText('Please select a rejected customer receipt to edit.');
      return;
    }

    if (!form.customerId) {
      setErrorText('Customer is required.');
      return;
    }

    if (!form.salesInvoiceId) {
      setErrorText('Sales invoice is required.');
      return;
    }

    if (!form.receiptDateUtc) {
      setErrorText('Receipt date is required.');
      return;
    }

    if (!form.receiptNumber.trim()) {
      setErrorText('Receipt number is required.');
      return;
    }

    if (!form.description.trim()) {
      setErrorText('Receipt description is required.');
      return;
    }

    if (Number(form.amount || 0) <= 0) {
      setErrorText('Receipt amount must be greater than zero.');
      return;
    }

    if (selectedInvoice && Number(form.amount || 0) > Number(selectedInvoice.balanceAmount || 0)) {
      setErrorText('Receipt amount cannot exceed the outstanding tax-adjusted sales invoice balance.');
      return;
    }

    await updateMut.mutateAsync();
  }

  async function submitForApproval(receipt: RejectedCustomerReceiptDto) {
    setErrorText('');
    setInfoText('');

    if (!canSubmitApproval) {
      setErrorText('You do not have permission to submit rejected customer receipts for approval.');
      return;
    }

    await submitMut.mutateAsync(receipt.id);
  }

  async function deleteReceipt(receipt: RejectedCustomerReceiptDto) {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to delete rejected customer receipts.');
      return;
    }

    const confirmed = window.confirm(
      `Delete rejected customer receipt ${receipt.receiptNumber}? This cannot be undone.`
    );

    if (!confirmed) return;

    await deleteMut.mutateAsync(receipt.id);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view rejected customer receipts.</div>;
  }

  if (rejectedReceiptsQ.isLoading || customersQ.isLoading || salesInvoicesQ.isLoading) {
    return <div className="panel">Loading rejected customer receipts...</div>;
  }

  if (
    rejectedReceiptsQ.isError ||
    customersQ.isError ||
    salesInvoicesQ.isError ||
    !rejectedReceiptsQ.data ||
    !customersQ.data ||
    !salesInvoicesQ.data
  ) {
    return <div className="panel error-panel">We could not load rejected customer receipts at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Rejected Customer Receipts</h2>
            <div className="muted">
              Correct rejected customer receipts, resubmit them for approval, or delete receipts no longer needed.
            </div>
          </div>
          <span className="muted">{rejectedReceiptsQ.data.count} rejected receipt(s)</span>
        </div>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt number, customer, invoice, description, rejection reason"
          />
        </div>

        {infoText ? (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginBottom: 16 }}>
            {errorText}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt Number</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th>Rejected By</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Invoice Balance</th>
                <th style={{ width: 280 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    No rejected customer receipts matched your search.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{receipt.receiptNumber}</td>
                    <td>{receipt.customerCode} - {receipt.customerName}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span>{receipt.invoiceNumber}</span>
                        <span className="muted">{receipt.invoiceDescription || '—'}</span>
                      </div>
                    </td>
                    <td>{receipt.description}</td>
                    <td>{customerReceiptStatusLabel(receipt.status)}</td>
                    <td>{receipt.rejectedByDisplayName || receipt.rejectedBy || '—'}</td>
                    <td>{formatDateTime(receipt.rejectedOnUtc)}</td>
                    <td>{receipt.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(receipt.amount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(receipt.invoiceBalanceAmount || 0)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => openEdit(receipt)}>
                          Edit
                        </button>

                        <button
                          className="button"
                          onClick={() => submitForApproval(receipt)}
                          disabled={submitMut.isPending || !canSubmitApproval}
                        >
                          {submitMut.isPending ? 'Submitting…' : 'Resubmit'}
                        </button>

                        <button
                          className="button danger"
                          onClick={() => deleteReceipt(receipt)}
                          disabled={deleteMut.isPending}
                        >
                          {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showEdit && selectedReceipt ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rejected Customer Receipt</h2>
              <button className="button ghost" onClick={closeEdit} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Current Status</span><span>{customerReceiptStatusLabel(selectedReceipt.status)}</span></div>
              <div className="kv-row"><span>Rejected By</span><span>{selectedReceipt.rejectedByDisplayName || selectedReceipt.rejectedBy || '—'}</span></div>
              <div className="kv-row"><span>Rejected On</span><span>{formatDateTime(selectedReceipt.rejectedOnUtc)}</span></div>
              <div className="kv-row"><span>Rejection Reason</span><span>{selectedReceipt.rejectionReason || '—'}</span></div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Customer</label>
                <select
                  className="select"
                  value={form.customerId}
                  onChange={(e) => {
                    update('customerId', e.target.value);
                    update('salesInvoiceId', '');
                  }}
                >
                  <option value="">— Select Customer —</option>
                  {customersQ.data.items.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customerCode} - {customer.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Sales Invoice</label>
                <select
                  className="select"
                  value={form.salesInvoiceId}
                  onChange={(e) => update('salesInvoiceId', e.target.value)}
                >
                  <option value="">— Select Sales Invoice —</option>
                  {filteredEligibleInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.customerName} - Outstanding {formatAmount(invoice.balanceAmount || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Receipt Number</label>
                <input
                  className="input"
                  value={form.receiptNumber}
                  onChange={(e) => update('receiptNumber', e.target.value)}
                  placeholder="Enter receipt number"
                />
              </div>

              <div className="form-row">
                <label>Receipt Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={toDateTimeInput(form.receiptDateUtc)}
                  onChange={(e) => update('receiptDateUtc', fromDateTimeInput(e.target.value))}
                />
              </div>

              <div className="form-row">
                <label>Amount</label>
                <input
                  className="input"
                  type="number"
                  value={form.amount}
                  onChange={(e) => update('amount', Number(e.target.value))}
                  placeholder="Enter amount"
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Enter description"
                />
              </div>
            </div>

            {selectedInvoice ? (
              <div className="kv" style={{ marginTop: 16 }}>
                <div className="kv-row"><span>Invoice Status</span><span>{salesInvoiceStatusLabel(selectedInvoice.status)}</span></div>
                <div className="kv-row"><span>Base Amount</span><span>{formatAmount(selectedInvoice.totalAmount || 0)}</span></div>
                <div className="kv-row"><span>Tax Additions</span><span>{formatAmount(selectedInvoice.taxAdditionAmount || 0)}</span></div>
                <div className="kv-row"><span>Tax Deductions</span><span>{formatAmount(selectedInvoice.taxDeductionAmount || 0)}</span></div>
                <div className="kv-row"><span>Gross Amount</span><span>{formatAmount(selectedInvoice.grossAmount || selectedInvoice.totalAmount || 0)}</span></div>
                <div className="kv-row"><span>Net Receivable Amount</span><span>{formatAmount(selectedInvoice.netReceivableAmount || selectedInvoice.totalAmount || 0)}</span></div>
                <div className="kv-row"><span>Amount Paid</span><span>{formatAmount(selectedInvoice.amountPaid || 0)}</span></div>
                <div className="kv-row"><span>Outstanding Balance</span><span>{formatAmount(selectedInvoice.balanceAmount || 0)}</span></div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="button" onClick={closeEdit} disabled={updateMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitUpdate} disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving…' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}