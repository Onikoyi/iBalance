import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createVendorPayment,
  getAccounts,
  getPurchaseInvoices,
  getTenantReadableError,
  getVendorPayments,
  getVendors,
  postVendorPayment,
  type CreateVendorPaymentRequest,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

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

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function vendorPaymentStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Cancelled';
    default: return 'Unknown';
  }
}

export function VendorPaymentsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [showCreate, setShowCreate] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [form, setForm] = useState<CreateVendorPaymentRequest>({
    ...emptyForm,
    paymentDateUtc: new Date().toISOString(),
  });
  const [postForm, setPostForm] = useState({
    cashOrBankLedgerAccountId: '',
    payableLedgerAccountId: '',
  });
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

  const createMut = useMutation({
    mutationFn: createVendorPayment,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ap-vendor-payments'] });
      setShowCreate(false);
      setForm({
        ...emptyForm,
        paymentDateUtc: new Date().toISOString(),
      });
      setErrorText('');
      setInfoText('Vendor payment created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const postMut = useMutation({
    mutationFn: () => postVendorPayment(selectedPaymentId, postForm),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ap-vendor-payments'] });
      await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      setShowPost(false);
      setSelectedPaymentId('');
      setPostForm({
        cashOrBankLedgerAccountId: '',
        payableLedgerAccountId: '',
      });
      setErrorText('');
      setInfoText('Vendor payment posted successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not post the vendor payment at this time.'));
      setInfoText('');
    },
  });

  const summary = useMemo(() => {
    const items = paymentsQ.data?.items ?? [];
    return {
      total: items.length,
      totalAmount: items.reduce((sum, x) => sum + x.amount, 0),
      drafts: items.filter((x) => x.status === 1).length,
      posted: items.filter((x) => x.status === 2).length,
      cancelled: items.filter((x) => x.status === 3).length,
    };
  }, [paymentsQ.data?.items]);

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed);
  }, [accountsQ.data?.items]);

  const eligibleInvoices = useMemo(() => {
    return (purchaseInvoicesQ.data?.items ?? []).filter(
      (x) => x.status === 2 || x.status === 3
    );
  }, [purchaseInvoicesQ.data?.items]);

  const filteredEligibleInvoices = useMemo(() => {
    if (!form.vendorId) return eligibleInvoices;
    return eligibleInvoices.filter((x) => x.vendorId === form.vendorId);
  }, [eligibleInvoices, form.vendorId]);

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
    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
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

  async function submitPost() {
    setErrorText('');
    setInfoText('');

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

  if (paymentsQ.isLoading || vendorsQ.isLoading || purchaseInvoicesQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading vendor payments...</div>;
  }

  if (
    paymentsQ.isError ||
    vendorsQ.isError ||
    purchaseInvoicesQ.isError ||
    accountsQ.isError ||
    !paymentsQ.data ||
    !vendorsQ.data ||
    !purchaseInvoicesQ.data ||
    !accountsQ.data
  ) {
    return <div className="panel error-panel">We could not load vendor payments at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Vendor Payments</h2>
            <div className="muted">Capture and post supplier payments against outstanding payable balances.</div>
          </div>

          {canManage ? (
            <div className="inline-actions">
              <button className="button primary" onClick={openCreateModal}>New Vendor Payment</button>
            </div>
          ) : null}
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Vendor Payments</span><span>{summary.total}</span></div>
          <div className="kv-row"><span>Total Amount</span><span>{formatAmount(summary.totalAmount)}</span></div>
          <div className="kv-row"><span>Draft</span><span>{summary.drafts}</span></div>
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
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Vendor Payment Listing</h2>
          <span className="muted">{paymentsQ.data.count} payment(s)</span>
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
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Posted On</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQ.data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No vendor payments have been created yet.
                  </td>
                </tr>
              ) : (
                paymentsQ.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.paymentNumber}</td>
                    <td>{item.vendorCode} - {item.vendorName}</td>
                    <td>{item.invoiceNumber}</td>
                    <td>{item.description}</td>
                    <td>{formatDateTime(item.paymentDateUtc)}</td>
                    <td>{vendorPaymentStatusLabel(item.status)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                    <td>{formatDateTime(item.postedOnUtc)}</td>
                    <td>
                      <div className="inline-actions">
                        {item.status === 1 && canManage ? (
                          <button className="button" onClick={() => openPostModal(item.id)}>
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
                      {invoice.invoiceNumber} - {invoice.vendorName} - Balance {formatAmount(invoice.balanceAmount)}
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
                  value={form.paymentDateUtc ? new Date(form.paymentDateUtc).toISOString().slice(0, 16) : ''}
                  onChange={(e) => update('paymentDateUtc', new Date(e.target.value).toISOString())}
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

            <div className="modal-footer">
              <button className="button" onClick={closeCreateModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitCreate} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Vendor Payment'}
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
              <button className="button" onClick={closePostModal} disabled={postMut.isPending}>Cancel</button>
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