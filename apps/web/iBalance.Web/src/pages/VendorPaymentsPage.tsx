import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveVendorPayment,
  createVendorPayment,
  getAccounts,
  getPurchaseInvoices,
  getTenantReadableError,
  getVendorPayments,
  getVendors,
  postVendorPayment,
  rejectVendorPayment,
  submitVendorPaymentForApproval,
  type CreateVendorPaymentRequest,
  formatBudgetAwareSuccessMessage,
  getBudgetAwareReadableError,
  type BudgetAwareApiResponse,
} from '../lib/api';
import {
  canApproveVendorPayments,
  canCreateVendorPayments,
  canPostVendorPayments,
  canRejectVendorPayments,
  canSubmitVendorPayments,
  canViewAccountsPayable,
} from '../lib/auth';

const emptyForm: CreateVendorPaymentRequest = {
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

function formatDateInput(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 16);
}

function toUtcIsoFromInput(value: string) {
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

export function VendorPaymentsPage() {
  const qc = useQueryClient();
  const canView = canViewAccountsPayable();
  const canManage = canCreateVendorPayments();
  const canSubmitApproval = canSubmitVendorPayments();
  const canApprove = canApproveVendorPayments();
  const canReject = canRejectVendorPayments();
  const canPost = canPostVendorPayments();

  const [showCreate, setShowCreate] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [form, setForm] = useState<CreateVendorPaymentRequest>({
    ...emptyForm,
    paymentDateUtc: new Date().toISOString(),
  });
  const [postForm, setPostForm] = useState({
    cashOrBankLedgerAccountId: '',
    payableLedgerAccountId: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const paymentsQ = useQuery({
    queryKey: ['ap-vendor-payments'],
    queryFn: getVendorPayments,
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

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  async function refreshAfterWorkflow() {
    await qc.invalidateQueries({ queryKey: ['ap-vendor-payments'] });
    await qc.invalidateQueries({ queryKey: ['ap-rejected-vendor-payments'] });
    await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
    await qc.invalidateQueries({ queryKey: ['accounts'] });
    await qc.invalidateQueries({ queryKey: ['journal-entries'] });
    await qc.invalidateQueries({ queryKey: ['ap-vendor-payment-detail'] });
    await qc.invalidateQueries({ queryKey: ['trial-balance'] });
    await qc.invalidateQueries({ queryKey: ['balance-sheet'] });
    await qc.invalidateQueries({ queryKey: ['income-statement'] });
  }

  const createMut = useMutation({
    mutationFn: createVendorPayment,
    onSuccess: async () => {
      await refreshAfterWorkflow();
      setShowCreate(false);
      setForm({
        ...emptyForm,
        paymentDateUtc: new Date().toISOString(),
      });
      setErrorText('');
      setInfoText('Vendor payment created successfully and saved as draft.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (vendorPaymentId: string) => submitVendorPaymentForApproval(vendorPaymentId),
    onSuccess: async () => {
      await refreshAfterWorkflow();
      setSelectedPaymentId('');
      setErrorText('');
      setInfoText('Vendor payment submitted for approval successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not submit the vendor payment for approval at this time.'));
      setInfoText('');
    },
  });

  const approveMut = useMutation({
    mutationFn: (vendorPaymentId: string) => approveVendorPayment(vendorPaymentId),
    onSuccess: async () => {
      await refreshAfterWorkflow();
      setSelectedPaymentId('');
      setErrorText('');
      setInfoText('Vendor payment approved successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not approve the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const rejectMut = useMutation({
    mutationFn: (vendorPaymentId: string) =>
      rejectVendorPayment(vendorPaymentId, { reason: rejectReason.trim() }),
    onSuccess: async () => {
      await refreshAfterWorkflow();
      setShowReject(false);
      setSelectedPaymentId('');
      setRejectReason('');
      setErrorText('');
      setInfoText('Vendor payment rejected successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not reject the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const postMut = useMutation({
    mutationFn: () => postVendorPayment(selectedPaymentId, postForm),
    onSuccess: async (data: BudgetAwareApiResponse) => {
      await refreshAfterWorkflow();
      setShowPost(false);
      setSelectedPaymentId('');
      setPostForm({
        cashOrBankLedgerAccountId: '',
        payableLedgerAccountId: '',
      });
      setErrorText('');
      setInfoText(formatBudgetAwareSuccessMessage(data, 'Vendor payment posted successfully.'));
    },
    onError: (e) => {
      setErrorText(getBudgetAwareReadableError(e, 'We could not post the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const visiblePayments = useMemo(() => {
    return (paymentsQ.data?.items ?? []).filter((item) => item.status !== 4);
  }, [paymentsQ.data?.items]);
  
  const summary = useMemo(() => {
    const items = visiblePayments;
    return {
      total: items.length,
      totalAmount: items.reduce((sum, x) => sum + x.amount, 0),
      drafts: items.filter((x) => x.status === 1).length,
      submitted: items.filter((x) => x.status === 2).length,
      approved: items.filter((x) => x.status === 3).length,
      rejected: items.filter((x) => x.status === 4).length,
      posted: items.filter((x) => x.status === 5).length,
      cancelled: items.filter((x) => x.status === 6).length,
    };
  }, [visiblePayments]);

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed);
  }, [accountsQ.data?.items]);

  const eligibleInvoices = useMemo(() => {
    return (purchaseInvoicesQ.data?.items ?? []).filter(
      (x) => (x.status === 4 || x.status === 5) && Number(x.balanceAmount || 0) > 0
    );
  }, [purchaseInvoicesQ.data?.items]);

  const filteredEligibleInvoices = useMemo(() => {
    if (!form.vendorId) return eligibleInvoices;
    return eligibleInvoices.filter((x) => x.vendorId === form.vendorId);
  }, [eligibleInvoices, form.vendorId]);

  const selectedInvoice = useMemo(() => {
    return (purchaseInvoicesQ.data?.items ?? []).find((x) => x.id === form.purchaseInvoiceId) ?? null;
  }, [purchaseInvoicesQ.data?.items, form.purchaseInvoiceId]);

  function update<K extends keyof CreateVendorPaymentRequest>(key: K, value: CreateVendorPaymentRequest[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function openCreateModal() {
    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
      setInfoText('');
      return;
    }

    setForm({
      ...emptyForm,
      paymentDateUtc: new Date().toISOString(),
    });
    setErrorText('');
    setInfoText('');
    setShowCreate(true);
  }

  function closeCreateModal() {
    if (!createMut.isPending) {
      setShowCreate(false);
      setErrorText('');
    }
  }

  function openPostModal(paymentId: string) {
    if (!canPost) {
      setErrorText('You do not have permission to post approved vendor payments.');
      setInfoText('');
      return;
    }

    setSelectedPaymentId(paymentId);
    setPostForm({
      cashOrBankLedgerAccountId: '',
      payableLedgerAccountId: '',
    });
    setErrorText('');
    setInfoText('');
    setShowPost(true);
  }

  function closePostModal() {
    if (!postMut.isPending) {
      setShowPost(false);
      setSelectedPaymentId('');
      setErrorText('');
    }
  }

  function openRejectModal(paymentId: string) {
    if (!canReject) {
      setErrorText('You do not have permission to reject vendor payments.');
      setInfoText('');
      return;
    }

    setSelectedPaymentId(paymentId);
    setRejectReason('');
    setErrorText('');
    setInfoText('');
    setShowReject(true);
  }

  function closeRejectModal() {
    if (!rejectMut.isPending) {
      setShowReject(false);
      setSelectedPaymentId('');
      setRejectReason('');
      setErrorText('');
    }
  }

  async function handleSubmitForApproval(paymentId: string) {
    setErrorText('');
    setInfoText('');
    setSelectedPaymentId(paymentId);

    if (!canSubmitApproval) {
      setErrorText('You do not have permission to submit vendor payments for approval.');
      return;
    }

    await submitMut.mutateAsync(paymentId);
  }

  async function handleApprove(paymentId: string) {
    setErrorText('');
    setInfoText('');
    setSelectedPaymentId(paymentId);

    if (!canApprove) {
      setErrorText('You do not have permission to approve vendor payments.');
      return;
    }

    await approveMut.mutateAsync(paymentId);
  }

  async function submitCreate() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
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

    if (!form.paymentNumber.trim()) {
      setErrorText('Payment number is required.');
      return;
    }

    if (!form.description.trim()) {
      setErrorText('Payment description is required.');
      return;
    }

    if (!form.paymentDateUtc) {
      setErrorText('Payment date is required.');
      return;
    }

    if (selectedInvoice && Number(form.amount || 0) > Number(selectedInvoice.balanceAmount || 0)) {
      setErrorText('Payment amount cannot exceed the outstanding tax-adjusted purchase invoice balance.');
      return;
    }

    if (form.amount <= 0) {
      setErrorText('Payment amount must be greater than zero.');
      return;
    }

    await createMut.mutateAsync({
      vendorId: form.vendorId,
      purchaseInvoiceId: form.purchaseInvoiceId,
      paymentDateUtc: form.paymentDateUtc,
      paymentNumber: form.paymentNumber.trim(),
      description: form.description.trim(),
      amount: Number(form.amount),
    });
  }

  async function submitReject() {
    setErrorText('');
    setInfoText('');

    if (!canReject) {
      setErrorText('You do not have permission to reject vendor payments.');
      return;
    }

    if (!selectedPaymentId) {
      setErrorText('Please select a vendor payment to reject.');
      return;
    }

    if (!rejectReason.trim()) {
      setErrorText('Rejection reason is required.');
      return;
    }

    await rejectMut.mutateAsync(selectedPaymentId);
  }

  async function submitPost() {
    setErrorText('');
    setInfoText('');

    if (!canPost) {
      setErrorText('You do not have permission to post approved vendor payments.');
      return;
    }

    if (!selectedPaymentId) {
      setErrorText('Please select a vendor payment to post.');
      return;
    }

    if (!postForm.cashOrBankLedgerAccountId) {
      setErrorText('Cash or bank ledger account is required.');
      return;
    }

    if (!postForm.payableLedgerAccountId) {
      setErrorText('Payable ledger account is required.');
      return;
    }

    await postMut.mutateAsync();
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view vendor payments.</div>;
  }

  if (paymentsQ.isLoading || vendorsQ.isLoading || purchaseInvoicesQ.isLoading) {
    return <div className="panel">Loading vendor payments...</div>;
  }

  if (
    paymentsQ.isError ||
    vendorsQ.isError ||
    purchaseInvoicesQ.isError ||
    !paymentsQ.data ||
    !vendorsQ.data ||
    !purchaseInvoicesQ.data
  ) {
    return <div className="panel error-panel">We could not load vendor payments at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Vendor Payments</h2>
            <div className="muted">Capture supplier payments, route them through approval, and post only after approval.</div>
          </div>

          {canManage ? (
            <div className="inline-actions">
              <button className="button primary" onClick={openCreateModal}>New Vendor Payment</button>
              <Link to="/vendor-payments/rejected" className="button">
                Rejected Vendor Payments
              </Link>
            </div>
          ) : null}
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Vendor Payments</span><span>{summary.total}</span></div>
          <div className="kv-row"><span>Total Amount</span><span>{formatAmount(summary.totalAmount)}</span></div>
          <div className="kv-row"><span>Draft</span><span>{summary.drafts}</span></div>
          <div className="kv-row"><span>Submitted for Approval</span><span>{summary.submitted}</span></div>
          <div className="kv-row"><span>Approved</span><span>{summary.approved}</span></div>
          <div className="kv-row"><span>Rejected</span><span>{summary.rejected}</span></div>
          <div className="kv-row"><span>Posted</span><span>{summary.posted}</span></div>
          <div className="kv-row"><span>Cancelled</span><span>{summary.cancelled}</span></div>
        </div>

        {infoText ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            {errorText}
          </div>
        ) : null}

        {accountsQ.isError ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">
              Ledger accounts could not be loaded. You can still view and manage vendor payments, but posting is temporarily unavailable until ledger accounts load successfully.
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Vendor Payment Listing</h2>
          <span className="muted">{visiblePayments.length} active payment(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment Number</th>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Prepared By</th>
                <th>Submitted On</th>
                <th>Approved On</th>
                <th>Posted On</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 340 }}>Action</th>
              </tr>
            </thead>
            <tbody>
            {visiblePayments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="muted">
                    No vendor payments have been created yet.
                  </td>
                </tr>
              ) : (
                visiblePayments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.paymentNumber}</td>
                    <td>{item.vendorCode} - {item.vendorName}</td>
                    <td>{item.invoiceNumber}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span>{item.description}</span>
                        {item.status === 4 && item.rejectionReason ? (
                          <span className="muted">Rejected: {item.rejectionReason}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{formatDateTime(item.paymentDateUtc)}</td>
                    <td>{vendorPaymentStatusLabel(item.status)}</td>
                    <td>{item.preparedByDisplayName || item.createdByDisplayName || item.createdBy || '—'}</td>
                    <td>{formatDateTime(item.submittedOnUtc)}</td>
                    <td>{formatDateTime(item.approvedOnUtc)}</td>
                    <td>{formatDateTime(item.postedOnUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                    <td>
                      <div className="inline-actions">
                      {item.status === 1 && canSubmitApproval ? (
                          <button
                            className="button"
                            onClick={() => handleSubmitForApproval(item.id)}
                            disabled={submitMut.isPending || !canSubmitApproval}
                          >
                            {submitMut.isPending && selectedPaymentId === item.id ? 'Submitting…' : 'Submit'}
                          </button>
                        ) : null}

                        {item.status === 2 && (canApprove || canReject) ? (
                          <>
                            <button
                              className="button"
                              onClick={() => handleApprove(item.id)}
                              disabled={approveMut.isPending}
                            >
                              {approveMut.isPending && selectedPaymentId === item.id ? 'Approving…' : 'Approve'}
                            </button>

                            <button
                              className="button danger"
                              onClick={() => openRejectModal(item.id)}
                              disabled={rejectMut.isPending}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}

                        {item.status === 3 && canPost ? (
                          <button className="button" onClick={() => openPostModal(item.id)} disabled={postMut.isPending}>
                            Post
                          </button>
                        ) : null}

                        <Link
                          to={`/vendor-payments/${item.id}/voucher`}
                          className="button"
                        >
                          Print Voucher
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeCreateModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Vendor Payment</h2>
              <button className="button ghost" onClick={closeCreateModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="muted">This document will be created as Draft and must be submitted, approved, and then posted.</div>
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
                      {invoice.invoiceNumber} - {invoice.vendorName} - Outstanding {formatAmount(invoice.balanceAmount)}
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
                  value={formatDateInput(form.paymentDateUtc)}
                  onChange={(e) => update('paymentDateUtc', toUtcIsoFromInput(e.target.value))}
                />
              </div>

              <div className="form-row">
                <label>Amount</label>
                <input
                  className="input"
                  type="number"
                  value={form.amount}
                  onChange={(e) => update('amount', Number(e.target.value))}
                  placeholder="Enter payment amount"
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Enter payment description"
                />
              </div>
            </div>

            {selectedInvoice ? (
              <div className="kv" style={{ marginTop: 16, marginBottom: 16 }}>
                <div className="kv-row">
                  <span>Selected Invoice</span>
                  <span>{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="kv-row">
                  <span>Invoice Status</span>
                  <span>{purchaseInvoiceStatusLabel(selectedInvoice.status)}</span>
                </div>
                <div className="kv-row">
                  <span>Base Amount</span>
                  <span>{formatAmount(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Tax Additions</span>
                  <span>{formatAmount(selectedInvoice.taxAdditionAmount || 0)}</span>
                </div>
                <div className="kv-row">
                  <span>Tax Deductions</span>
                  <span>{formatAmount(selectedInvoice.taxDeductionAmount || 0)}</span>
                </div>
                <div className="kv-row">
                  <span>Gross Amount</span>
                  <span>{formatAmount(selectedInvoice.grossAmount || selectedInvoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Net Payable Amount</span>
                  <span>{formatAmount(selectedInvoice.netPayableAmount || selectedInvoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Amount Paid</span>
                  <span>{formatAmount(selectedInvoice.amountPaid)}</span>
                </div>
                <div className="kv-row">
                  <span>Outstanding Balance</span>
                  <span>{formatAmount(selectedInvoice.balanceAmount)}</span>
                </div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="button" onClick={closeCreateModal} disabled={createMut.isPending}>
                Cancel
              </button>
              <button className="button primary" onClick={submitCreate} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Vendor Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReject ? (
        <div className="modal-backdrop" onMouseDown={closeRejectModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Vendor Payment</h2>
              <button className="button ghost" onClick={closeRejectModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-row">
              <label>Rejection Reason</label>
              <textarea
                className="input"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection"
              />
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeRejectModal} disabled={rejectMut.isPending}>
                Cancel
              </button>
              <button className="button danger" onClick={submitReject} disabled={rejectMut.isPending}>
                {rejectMut.isPending ? 'Rejecting…' : 'Reject Vendor Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPost ? (
        <div className="modal-backdrop" onMouseDown={closePostModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post Vendor Payment</h2>
              <button className="button ghost" onClick={closePostModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="muted">Only approved vendor payments can be posted. Posting clears payables and affects cash or bank under accrual accounting.</div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Cash or Bank Ledger Account</label>
                <select
                  className="select"
                  value={postForm.cashOrBankLedgerAccountId}
                  onChange={(e) => setPostForm((s) => ({ ...s, cashOrBankLedgerAccountId: e.target.value }))}
                >
                  <option value="">— Select Cash or Bank Ledger Account —</option>
                  {postingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Payable Ledger Account</label>
                <select
                  className="select"
                  value={postForm.payableLedgerAccountId}
                  onChange={(e) => setPostForm((s) => ({ ...s, payableLedgerAccountId: e.target.value }))}
                >
                  <option value="">— Select Payable Ledger Account —</option>
                  {postingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closePostModal} disabled={postMut.isPending}>
                Cancel
              </button>
              <button className="button primary" onClick={submitPost} disabled={postMut.isPending}>
                {postMut.isPending ? 'Posting…' : 'Post Vendor Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}