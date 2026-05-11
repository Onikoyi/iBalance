import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteRejectedVendorPayment,
  getPurchaseInvoices,
  getRejectedVendorPayments,
  getTenantReadableError,
  getVendors,
  submitVendorPaymentForApproval,
  updateRejectedVendorPayment,
  type RejectedVendorPaymentDto,
  type UpdateVendorPaymentRequest,
} from '../lib/api';
import {
  canCreateVendorPayments,
  canSubmitVendorPayments,
  canViewAccountsPayable,
} from '../lib/auth';

const emptyForm: UpdateVendorPaymentRequest = {
  vendorId: '',
  purchaseInvoiceId: '',
  paymentDateUtc: '',
  paymentNumber: '',
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

function vendorPaymentStatusLabel(value: number) {
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

function purchaseInvoiceStatusLabel(value: number) {
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

export function RejectedVendorPaymentsPage() {
  const qc = useQueryClient();
  const canView = canViewAccountsPayable();
  const canManage = canCreateVendorPayments();
  const canSubmitApproval = canSubmitVendorPayments();

  const [selectedPayment, setSelectedPayment] = useState<RejectedVendorPaymentDto | null>(null);
  const [form, setForm] = useState<UpdateVendorPaymentRequest>(emptyForm);
  const [showEdit, setShowEdit] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [search, setSearch] = useState('');

  const rejectedPaymentsQ = useQuery({
    queryKey: ['ap-rejected-vendor-payments'],
    queryFn: getRejectedVendorPayments,
    enabled: canView,
  });

  const vendorsQ = useQuery({
    queryKey: ['ap-vendors'],
    queryFn: getVendors,
    enabled: canView,
  });

  const purchaseInvoicesQ = useQuery({
    queryKey: ['ap-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['ap-rejected-vendor-payments'] });
    await qc.invalidateQueries({ queryKey: ['ap-vendor-payments'] });
    await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
  }

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selectedPayment) {
        throw new Error('No vendor payment selected.');
      }

      return updateRejectedVendorPayment(selectedPayment.id, form);
    },
    onSuccess: async () => {
      await refresh();
      setShowEdit(false);
      setSelectedPayment(null);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Rejected vendor payment updated successfully. It remains rejected until resubmitted.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update rejected vendor payment.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (vendorPaymentId: string) => submitVendorPaymentForApproval(vendorPaymentId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Vendor payment resubmitted for approval successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to resubmit vendor payment for approval.'));
      setInfoText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (vendorPaymentId: string) => deleteRejectedVendorPayment(vendorPaymentId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Rejected vendor payment deleted successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to delete rejected vendor payment.'));
      setInfoText('');
    },
  });

  const filteredPayments = useMemo(() => {
    const items = rejectedPaymentsQ.data?.items ?? [];
    const text = search.trim().toLowerCase();

    if (!text) return items;

    return items.filter((item) => {
      return (
        item.paymentNumber.toLowerCase().includes(text) ||
        item.vendorCode.toLowerCase().includes(text) ||
        item.vendorName.toLowerCase().includes(text) ||
        item.invoiceNumber.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text) ||
        (item.rejectionReason || '').toLowerCase().includes(text)
      );
    });
  }, [rejectedPaymentsQ.data?.items, search]);

  const eligibleInvoices = useMemo(() => {
    const items = purchaseInvoicesQ.data?.items ?? [];

    return items
      .filter((invoice) => {
        const isPostedOrPartPaid = invoice.status === 4 || invoice.status === 5;
        const isCurrentInvoice = invoice.id === form.purchaseInvoiceId;
        const hasOutstandingBalance = Number(invoice.balanceAmount || 0) > 0;

        return isCurrentInvoice || (isPostedOrPartPaid && hasOutstandingBalance);
      })
      .sort((a, b) => `${a.invoiceNumber}`.localeCompare(`${b.invoiceNumber}`));
  }, [purchaseInvoicesQ.data?.items, form.purchaseInvoiceId]);

  const filteredEligibleInvoices = useMemo(() => {
    if (!form.vendorId) return eligibleInvoices;
    return eligibleInvoices.filter((invoice) => invoice.vendorId === form.vendorId);
  }, [eligibleInvoices, form.vendorId]);

  const selectedInvoice = useMemo(() => {
    return (purchaseInvoicesQ.data?.items ?? []).find((invoice) => invoice.id === form.purchaseInvoiceId) ?? null;
  }, [purchaseInvoicesQ.data?.items, form.purchaseInvoiceId]);

  function openEdit(payment: RejectedVendorPaymentDto) {
    if (!canManage) {
      setErrorText('You do not have permission to edit rejected vendor payments.');
      setInfoText('');
      return;
    }

    setSelectedPayment(payment);
    setForm({
      vendorId: payment.vendorId,
      purchaseInvoiceId: payment.purchaseInvoiceId,
      paymentDateUtc: payment.paymentDateUtc,
      paymentNumber: payment.paymentNumber,
      description: payment.description,
      amount: Number(payment.amount || 0),
    });
    setErrorText('');
    setInfoText('');
    setShowEdit(true);
  }

  function closeEdit() {
    if (!updateMut.isPending) {
      setShowEdit(false);
      setSelectedPayment(null);
      setForm(emptyForm);
      setErrorText('');
    }
  }

  function update<K extends keyof UpdateVendorPaymentRequest>(key: K, value: UpdateVendorPaymentRequest[K]) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  async function submitUpdate() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to edit rejected vendor payments.');
      return;
    }

    if (!selectedPayment) {
      setErrorText('Please select a rejected vendor payment to edit.');
      return;
    }

    if (!form.vendorId) {
      setErrorText('Vendor is required.');
      return;
    }

    if (!form.purchaseInvoiceId) {
      setErrorText('Purchase invoice is required.');
      return;
    }

    if (!form.paymentDateUtc) {
      setErrorText('Payment date is required.');
      return;
    }

    if (!form.paymentNumber.trim()) {
      setErrorText('Payment number is required.');
      return;
    }

    if (!form.description.trim()) {
      setErrorText('Payment description is required.');
      return;
    }

    if (Number(form.amount || 0) <= 0) {
      setErrorText('Payment amount must be greater than zero.');
      return;
    }

    if (selectedInvoice && Number(form.amount || 0) > Number(selectedInvoice.balanceAmount || 0)) {
      setErrorText('Payment amount cannot exceed the outstanding tax-adjusted purchase invoice balance.');
      return;
    }

    await updateMut.mutateAsync();
  }

  async function submitForApproval(payment: RejectedVendorPaymentDto) {
    setErrorText('');
    setInfoText('');

    if (!canSubmitApproval) {
      setErrorText('You do not have permission to submit rejected vendor payments for approval.');
      return;
    }

    await submitMut.mutateAsync(payment.id);
  }

  async function deletePayment(payment: RejectedVendorPaymentDto) {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to delete rejected vendor payments.');
      return;
    }

    const confirmed = window.confirm(
      `Delete rejected vendor payment ${payment.paymentNumber}? This cannot be undone.`
    );

    if (!confirmed) return;

    await deleteMut.mutateAsync(payment.id);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view rejected vendor payments.</div>;
  }

  if (rejectedPaymentsQ.isLoading || vendorsQ.isLoading || purchaseInvoicesQ.isLoading) {
    return <div className="panel">Loading rejected vendor payments...</div>;
  }

  if (
    rejectedPaymentsQ.isError ||
    vendorsQ.isError ||
    purchaseInvoicesQ.isError ||
    !rejectedPaymentsQ.data ||
    !vendorsQ.data ||
    !purchaseInvoicesQ.data
  ) {
    return <div className="panel error-panel">We could not load rejected vendor payments at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Rejected Vendor Payments</h2>
            <div className="muted">
              Correct rejected payment vouchers, resubmit them for approval, or delete those no longer needed.
            </div>
          </div>
          <span className="muted">{rejectedPaymentsQ.data.count} rejected payment(s)</span>
        </div>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Payment number, vendor, invoice, description, rejection reason"
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
                <th>Payment Number</th>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th>Rejected By</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Invoice Balance</th>
                <th style={{ width: 260 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    No rejected vendor payments matched your search.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paymentNumber}</td>
                    <td>{payment.vendorCode} - {payment.vendorName}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span>{payment.invoiceNumber}</span>
                        <span className="muted">{payment.invoiceDescription || '—'}</span>
                      </div>
                    </td>
                    <td>{payment.description}</td>
                    <td>{vendorPaymentStatusLabel(payment.status)}</td>
                    <td>{payment.rejectedByDisplayName || payment.rejectedBy || '—'}</td>
                    <td>{formatDateTime(payment.rejectedOnUtc)}</td>
                    <td>{payment.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(payment.amount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(payment.invoiceBalanceAmount || 0)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => openEdit(payment)}>
                          Edit
                        </button>
                        <button
                          className="button"
                          onClick={() => submitForApproval(payment)}
                          disabled={submitMut.isPending || !canSubmitApproval}
                        >
                          {submitMut.isPending ? 'Submitting…' : 'Resubmit'}
                        </button>
                        <button
                          className="button danger"
                          onClick={() => deletePayment(payment)}
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

      {showEdit && selectedPayment ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rejected Vendor Payment</h2>
              <button className="button ghost" onClick={closeEdit} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Current Status</span><span>{vendorPaymentStatusLabel(selectedPayment.status)}</span></div>
              <div className="kv-row"><span>Rejected By</span><span>{selectedPayment.rejectedByDisplayName || selectedPayment.rejectedBy || '—'}</span></div>
              <div className="kv-row"><span>Rejected On</span><span>{formatDateTime(selectedPayment.rejectedOnUtc)}</span></div>
              <div className="kv-row"><span>Rejection Reason</span><span>{selectedPayment.rejectionReason || '—'}</span></div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Vendor</label>
                <select
                  className="select"
                  value={form.vendorId}
                  onChange={(e) => {
                    update('vendorId', e.target.value);
                    update('purchaseInvoiceId', '');
                  }}
                >
                  <option value="">— Select Vendor —</option>
                  {vendorsQ.data.items.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendorCode} - {vendor.vendorName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Purchase Invoice</label>
                <select
                  className="select"
                  value={form.purchaseInvoiceId}
                  onChange={(e) => update('purchaseInvoiceId', e.target.value)}
                >
                  <option value="">— Select Purchase Invoice —</option>
                  {filteredEligibleInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.vendorName} - Outstanding {formatAmount(invoice.balanceAmount || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Payment Number</label>
                <input
                  className="input"
                  value={form.paymentNumber}
                  onChange={(e) => update('paymentNumber', e.target.value)}
                  placeholder="Enter payment number"
                />
              </div>

              <div className="form-row">
                <label>Payment Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={toDateTimeInput(form.paymentDateUtc)}
                  onChange={(e) => update('paymentDateUtc', fromDateTimeInput(e.target.value))}
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
                <div className="kv-row"><span>Invoice Status</span><span>{purchaseInvoiceStatusLabel(selectedInvoice.status)}</span></div>
                <div className="kv-row"><span>Base Amount</span><span>{formatAmount(selectedInvoice.totalAmount || 0)}</span></div>
                <div className="kv-row"><span>Tax Additions</span><span>{formatAmount(selectedInvoice.taxAdditionAmount || 0)}</span></div>
                <div className="kv-row"><span>Tax Deductions</span><span>{formatAmount(selectedInvoice.taxDeductionAmount || 0)}</span></div>
                <div className="kv-row"><span>Gross Amount</span><span>{formatAmount(selectedInvoice.grossAmount || selectedInvoice.totalAmount || 0)}</span></div>
                <div className="kv-row"><span>Net Payable Amount</span><span>{formatAmount(selectedInvoice.netPayableAmount || selectedInvoice.totalAmount || 0)}</span></div>
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