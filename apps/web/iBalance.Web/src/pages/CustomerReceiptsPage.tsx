import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveCustomerReceipt,
  createCustomerReceipt,
  getAccounts,
  getCustomerReceipts,
  getCustomers,
  getSalesInvoices,
  getTenantReadableError,
  postCustomerReceipt,
  rejectCustomerReceipt,
  submitCustomerReceiptForApproval,
  type CreateCustomerReceiptRequest,
} from '../lib/api';
import { canApproveWorkflows, canCreateJournals, canViewFinance } from '../lib/auth';

type ReceiptFormState = {
  customerId: string;
  salesInvoiceId: string;
  receiptDateUtc: string;
  receiptNumber: string;
  description: string;
  amount: string;
};

const emptyForm: ReceiptFormState = {
  customerId: '',
  salesInvoiceId: '',
  receiptDateUtc: '',
  receiptNumber: '',
  description: '',
  amount: '',
};

function formatUtcDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function receiptStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Draft';
    case 2:
      return 'Submitted for Approval';
    case 3:
      return 'Approved';
    case 4:
      return 'Rejected';
    case 5:
      return 'Posted';
    case 6:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function invoiceStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Draft';
    case 2:
      return 'Posted';
    case 3:
      return 'Part Paid';
    case 4:
      return 'Paid';
    case 5:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function parseDecimal(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function CustomerReceiptsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canCreate = canCreateJournals();
  const canApprove = canApproveWorkflows();

  const [form, setForm] = useState<ReceiptFormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [cashOrBankLedgerAccountId, setCashOrBankLedgerAccountId] = useState('');
  const [receivableLedgerAccountId, setReceivableLedgerAccountId] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const customersQ = useQuery({
    queryKey: ['ar-customers'],
    queryFn: getCustomers,
    enabled: canView,
  });

  const invoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  const receiptsQ = useQuery({
    queryKey: ['ar-customer-receipts'],
    queryFn: getCustomerReceipts,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const activeCustomers = useMemo(() => {
    return (customersQ.data?.items || [])
      .filter((x) => x.isActive)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customersQ.data?.items]);

  const eligibleInvoices = useMemo(() => {
    const items = invoicesQ.data?.items || [];
  
    return items
      .filter((x) => {
        const belongsToCustomer = !form.customerId || x.customerId === form.customerId;
        const receivableEligible = x.status === 2 || x.status === 3;
        const hasOutstandingBalance = Number(x.balanceAmount || 0) > 0;
        return belongsToCustomer && receivableEligible && hasOutstandingBalance;
      })
      .sort((a, b) => `${a.invoiceNumber}`.localeCompare(`${b.invoiceNumber}`));
  }, [invoicesQ.data?.items, form.customerId]);

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items || [])
      .filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  }, [accountsQ.data?.items]);

  const filteredReceipts = useMemo(() => {
    const items = receiptsQ.data?.items || [];
    const searchText = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !searchText ||
        item.receiptNumber.toLowerCase().includes(searchText) ||
        item.invoiceNumber.toLowerCase().includes(searchText) ||
        item.customerCode.toLowerCase().includes(searchText) ||
        item.customerName.toLowerCase().includes(searchText) ||
        item.description.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === 'all' ||
        String(item.status) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [receiptsQ.data?.items, search, statusFilter]);

  const selectedInvoice = useMemo(() => {
    return (invoicesQ.data?.items || []).find((x) => x.id === form.salesInvoiceId) || null;
  }, [invoicesQ.data?.items, form.salesInvoiceId]);

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: ['ar-customer-receipts'] });
    await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
    await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    await qc.invalidateQueries({ queryKey: ['journal-entries'] });
    await qc.invalidateQueries({ queryKey: ['trial-balance'] });
    await qc.invalidateQueries({ queryKey: ['balance-sheet'] });
    await qc.invalidateQueries({ queryKey: ['income-statement'] });
  };

  const createMut = useMutation({
    mutationFn: (payload: CreateCustomerReceiptRequest) => createCustomerReceipt(payload),
    onSuccess: async () => {
      await refreshAll();
      setMessage('Customer receipt created successfully as draft.');
      setForm(emptyForm);
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to create customer receipt.'));
    },
  });

  const submitMut = useMutation({
    mutationFn: (customerReceiptId: string) => submitCustomerReceiptForApproval(customerReceiptId),
    onSuccess: async () => {
      await refreshAll();
      setMessage('Customer receipt submitted for approval successfully.');
      setSelectedReceiptId('');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to submit customer receipt for approval.'));
    },
  });

  const approveMut = useMutation({
    mutationFn: (customerReceiptId: string) => approveCustomerReceipt(customerReceiptId),
    onSuccess: async () => {
      await refreshAll();
      setMessage('Customer receipt approved successfully.');
      setSelectedReceiptId('');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to approve customer receipt.'));
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({
      customerReceiptId,
      reason,
    }: {
      customerReceiptId: string;
      reason: string;
    }) => rejectCustomerReceipt(customerReceiptId, { reason }),
    onSuccess: async () => {
      await refreshAll();
      setMessage('Customer receipt rejected successfully.');
      setSelectedReceiptId('');
      setRejectReason('');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to reject customer receipt.'));
    },
  });

  const postMut = useMutation({
    mutationFn: ({
      customerReceiptId,
      cashLedgerId,
      receivableLedgerId,
    }: {
      customerReceiptId: string;
      cashLedgerId: string;
      receivableLedgerId: string;
    }) =>
      postCustomerReceipt(customerReceiptId, {
        cashOrBankLedgerAccountId: cashLedgerId,
        receivableLedgerAccountId: receivableLedgerId,
      }),
    onSuccess: async () => {
      await refreshAll();
      setMessage('Customer receipt posted successfully.');
      setSelectedReceiptId('');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to post customer receipt.'));
    },
  });

  function submit() {
    setMessage('');

    if (!canCreate) {
      setMessage('You do not have permission to create customer receipts.');
      return;
    }

    if (!form.customerId) {
      setMessage('Please select a customer.');
      return;
    }

    if (!form.salesInvoiceId) {
      setMessage('Please select a sales invoice.');
      return;
    }

    if (!form.receiptDateUtc) {
      setMessage('Please enter the receipt date.');
      return;
    }

    if (!form.receiptNumber.trim()) {
      setMessage('Receipt number is required.');
      return;
    }

    if (!form.description.trim()) {
      setMessage('Receipt description is required.');
      return;
    }

    const amount = parseDecimal(form.amount);
    if (amount <= 0) {
      setMessage('Receipt amount must be greater than zero.');
      return;
    }

    if (selectedInvoice && amount > Number(selectedInvoice.balanceAmount || 0)) {
      setMessage('Receipt amount cannot exceed the outstanding tax-adjusted invoice balance.');
      return;
    }

    createMut.mutate({
      customerId: form.customerId,
      salesInvoiceId: form.salesInvoiceId,
      receiptDateUtc: new Date(`${form.receiptDateUtc}T00:00:00`).toISOString(),
      receiptNumber: form.receiptNumber.trim(),
      description: form.description.trim(),
      amount,
    });
  }

  function submitForApproval(customerReceiptId: string) {
    setMessage('');

    if (!canCreate) {
      setMessage('You do not have permission to submit customer receipts for approval.');
      return;
    }

    setSelectedReceiptId(customerReceiptId);
    submitMut.mutate(customerReceiptId);
  }

  function approve(customerReceiptId: string) {
    setMessage('');

    if (!canApprove) {
      setMessage('You do not have permission to approve customer receipts.');
      return;
    }

    setSelectedReceiptId(customerReceiptId);
    approveMut.mutate(customerReceiptId);
  }

  function reject(customerReceiptId: string) {
    setMessage('');

    if (!canApprove) {
      setMessage('You do not have permission to reject customer receipts.');
      return;
    }

    if (!rejectReason.trim()) {
      setMessage('Rejection reason is required before rejecting a receipt.');
      return;
    }

    setSelectedReceiptId(customerReceiptId);
    rejectMut.mutate({
      customerReceiptId,
      reason: rejectReason.trim(),
    });
  }

  function submitPosting(customerReceiptId: string) {
    setMessage('');

    if (!canApprove) {
      setMessage('You do not have permission to post customer receipts.');
      return;
    }

    if (!cashOrBankLedgerAccountId) {
      setMessage('Please select the cash or bank ledger account.');
      return;
    }

    if (!receivableLedgerAccountId) {
      setMessage('Please select the receivable ledger account.');
      return;
    }

    setSelectedReceiptId(customerReceiptId);
    postMut.mutate({
      customerReceiptId,
      cashLedgerId: cashOrBankLedgerAccountId,
      receivableLedgerId: receivableLedgerAccountId,
    });
  }

  if (!canView) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Customer Receipts</h2>
            <span className="muted">Access restricted</span>
          </div>
          <div className="muted">
            You do not have permission to view customer receipts.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Customer Receipts</h2>
          <span className="muted">Receipt register and receivable settlement tracking</span>
        </div>

        {message ? (
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="muted">{message}</div>
          </div>
        ) : null}

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="muted">
            {(receiptsQ.data?.count || 0).toLocaleString()} receipt(s)
          </div>
          {!canCreate ? (
            <div className="muted">Read-only access</div>
          ) : null}
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Receipt number, invoice, customer, description"
            />
          </div>

          <div className="form-row">
            <label>Status Filter</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Receipts</option>
              <option value="1">Draft</option>
              <option value="2">Submitted for Approval</option>
              <option value="3">Approved</option>
              <option value="4">Rejected</option>
              <option value="5">Posted</option>
              <option value="6">Cancelled</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Create Customer Receipt</h2>
          <span className="muted">Capture customer payment against a posted invoice</span>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="muted">New customer receipts are created as draft, then submitted, approved, and finally posted.</div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Customer</label>
            <select
              className="select"
              value={form.customerId}
              onChange={(e) => setForm((s) => ({ ...s, customerId: e.target.value, salesInvoiceId: '' }))}
            >
              <option value="">— Select Customer —</option>
              {activeCustomers.map((customer) => (
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
              onChange={(e) => setForm((s) => ({ ...s, salesInvoiceId: e.target.value }))}
            >
              <option value="">— Select Sales Invoice —</option>
              {eligibleInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} - {invoice.customerName} - Outstanding {formatAmount(invoice.balanceAmount)}
              </option>
            ))}
            </select>
          </div>

          <div className="form-row">
            <label>Receipt Date</label>
            <input
              className="input"
              type="date"
              value={form.receiptDateUtc}
              onChange={(e) => setForm((s) => ({ ...s, receiptDateUtc: e.target.value }))}
            />
          </div>

          <div className="form-row">
            <label>Receipt Number</label>
            <input
              className="input"
              value={form.receiptNumber}
              onChange={(e) => setForm((s) => ({ ...s, receiptNumber: e.target.value }))}
              placeholder="Enter receipt number"
            />
          </div>

          <div className="form-row">
            <label>Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Enter receipt description"
            />
          </div>

          <div className="form-row">
            <label>Receipt Amount</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>

        {selectedInvoice ? (
          <div className="kv" style={{ marginTop: 16 }}>
            <div className="kv-row">
              <span>Selected Invoice</span>
              <span>{selectedInvoice.invoiceNumber}</span>
            </div>
            <div className="kv-row">
              <span>Invoice Status</span>
              <span>{invoiceStatusLabel(selectedInvoice.status)}</span>
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
              <span>Net Receivable Amount</span>
              <span>{formatAmount(selectedInvoice.netReceivableAmount || selectedInvoice.totalAmount)}</span>
            </div>
            <div className="kv-row">
              <span>Outstanding Balance</span>
              <span>{formatAmount(selectedInvoice.balanceAmount)}</span>
            </div>
          </div>
        ) : null}

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="button" onClick={() => setForm(emptyForm)}>
            Reset Form
          </button>

          <button
            className="button primary"
            onClick={submit}
            disabled={createMut.isPending || !canCreate}
          >
            {createMut.isPending ? 'Saving…' : 'Create Customer Receipt'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Receipt Posting</h2>
          <span className="muted">Select ledger accounts for cash collection and receivable settlement</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Cash or Bank Ledger Account</label>
            <select
              className="select"
              value={cashOrBankLedgerAccountId}
              onChange={(e) => setCashOrBankLedgerAccountId(e.target.value)}
            >
              <option value="">— Select Cash or Bank Account —</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Receivable Ledger Account</label>
            <select
              className="select"
              value={receivableLedgerAccountId}
              onChange={(e) => setReceivableLedgerAccountId(e.target.value)}
            >
              <option value="">— Select Receivable Account —</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <label>Rejection Reason</label>
          <textarea
            className="input"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason only when rejecting a submitted receipt"
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Receipt Register</h2>
          <span className="muted">Receipt status, workflow, invoice linkage, and collection visibility</span>
        </div>

        <div className="detail-stack">
          {receiptsQ.isLoading ? (
            <div className="muted">Loading customer receipts...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="muted">No customer receipts found for the current filter.</div>
          ) : (
            filteredReceipts.map((receipt) => (
              <div key={receipt.id} className="kv" style={{ marginBottom: 12 }}>
                <div className="kv-row">
                  <span>Receipt Number</span>
                  <span>{receipt.receiptNumber}</span>
                </div>
                <div className="kv-row">
                  <span>Customer</span>
                  <span>{receipt.customerCode} - {receipt.customerName}</span>
                </div>
                <div className="kv-row">
                  <span>Invoice</span>
                  <span>{receipt.invoiceNumber}</span>
                </div>
                <div className="kv-row">
                  <span>Description</span>
                  <span>{receipt.description}</span>
                </div>
                <div className="kv-row">
                  <span>Receipt Date</span>
                  <span>{formatUtcDate(receipt.receiptDateUtc)}</span>
                </div>
                <div className="kv-row">
                  <span>Amount</span>
                  <span>{formatAmount(receipt.amount)}</span>
                </div>
                <div className="kv-row">
                  <span>Status</span>
                  <span>{receiptStatusLabel(receipt.status)}</span>
                </div>
                <div className="kv-row">
                  <span>Prepared By</span>
                  <span>{receipt.preparedByDisplayName || receipt.createdByDisplayName || receipt.createdBy || '—'}</span>
                </div>
                <div className="kv-row">
                  <span>Submitted On</span>
                  <span>{formatUtcDate(receipt.submittedOnUtc)}</span>
                </div>
                <div className="kv-row">
                  <span>Approved On</span>
                  <span>{formatUtcDate(receipt.approvedOnUtc)}</span>
                </div>
                <div className="kv-row">
                  <span>Posted On</span>
                  <span>{formatUtcDate(receipt.postedOnUtc)}</span>
                </div>
                {receipt.status === 4 && receipt.rejectionReason ? (
                  <div className="kv-row">
                    <span>Rejection Reason</span>
                    <span>{receipt.rejectionReason}</span>
                  </div>
                ) : null}

                <div className="inline-actions" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                  <div className="inline-actions">
                    {(receipt.status === 1 || receipt.status === 4) ? (
                      <button
                        className="button"
                        onClick={() => submitForApproval(receipt.id)}
                        disabled={submitMut.isPending || !canCreate}
                      >
                        {submitMut.isPending && selectedReceiptId === receipt.id ? 'Submitting…' : 'Submit'}
                      </button>
                    ) : null}

                    {receipt.status === 2 ? (
                      <>
                        <button
                          className="button"
                          onClick={() => approve(receipt.id)}
                          disabled={approveMut.isPending || !canApprove}
                        >
                          {approveMut.isPending && selectedReceiptId === receipt.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          className="button"
                          onClick={() => reject(receipt.id)}
                          disabled={rejectMut.isPending || !canApprove}
                        >
                          {rejectMut.isPending && selectedReceiptId === receipt.id ? 'Rejecting…' : 'Reject'}
                        </button>
                      </>
                    ) : null}

                    {receipt.status === 3 ? (
                      <button
                        className="button primary"
                        onClick={() => submitPosting(receipt.id)}
                        disabled={postMut.isPending || !canApprove}
                      >
                        {postMut.isPending && selectedReceiptId === receipt.id ? 'Posting…' : 'Post Receipt'}
                      </button>
                    ) : null}

                    <Link
                      to={`/customer-receipts/${receipt.id}/print`}
                      className="button"
                    >
                      View / Print Receipt
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}