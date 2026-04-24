import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSalesInvoice,
  getAccounts,
  getCustomers,
  getSalesInvoices,
  getTaxCodes,
  getTenantReadableError,
  postSalesInvoice,
  approveSalesInvoice,
  rejectSalesInvoice,
  submitSalesInvoiceForApproval,
  previewTaxCalculation,
  type CreateSalesInvoiceRequest,
  type TaxCodeDto,
  formatBudgetAwareSuccessMessage,
  getBudgetAwareReadableError,
  type BudgetAwareApiResponse,
} from '../lib/api';
import { canCreateJournals, canViewFinance } from '../lib/auth';

type LineForm = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type InvoiceFormState = {
  customerId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: LineForm[];
  taxCodeIds: string[];
};

const emptyForm: InvoiceFormState = {
  customerId: '',
  invoiceDateUtc: '',
  invoiceNumber: '',
  description: '',
  lines: [
    {
      description: '',
      quantity: '',
      unitPrice: '',
    },
  ],
  taxCodeIds: [],
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

function invoiceStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Draft';
    case 2:
      return 'Submitted for Approval';
    case 3:
      return 'Approved';
    case 4:
      return 'Posted';
    case 5:
      return 'Part Paid';
    case 6:
      return 'Paid';
    case 7:
      return 'Rejected';
    case 8:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function taxComponentKindLabel(value: number) {
  switch (value) {
    case 1:
      return 'VAT';
    case 2:
      return 'WHT';
    case 3:
      return 'Other';
    default:
      return 'Unknown';
  }
}

function taxApplicationModeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Add to Amount';
    case 2:
      return 'Deduct from Amount';
    default:
      return 'Unknown';
  }
}


function parseDecimal(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function SalesInvoicesPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canCreate = canCreateJournals();

  const [form, setForm] = useState<InvoiceFormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [receivableLedgerAccountId, setReceivableLedgerAccountId] = useState('');
  const [revenueLedgerAccountId, setRevenueLedgerAccountId] = useState('');
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

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const taxCodesQ = useQuery({
    queryKey: ['tax-codes', 'sales', 'active'],
    queryFn: () => getTaxCodes(null, 1, true),
    enabled: canView,
  });

  const activeCustomers = useMemo(() => {
    return (customersQ.data?.items || [])
      .filter((x) => x.isActive)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customersQ.data?.items]);

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items || [])
      .filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  }, [accountsQ.data?.items]);

  const visibleInvoices = useMemo(() => {
    return (invoicesQ.data?.items ?? []).filter((item) => item.status !== 7);
  }, [invoicesQ.data?.items]);

  const filteredInvoices = useMemo(() => {
    const items = invoicesQ.data?.items || [];
    const searchText = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !searchText ||
        item.invoiceNumber.toLowerCase().includes(searchText) ||
        item.customerCode.toLowerCase().includes(searchText) ||
        item.customerName.toLowerCase().includes(searchText) ||
        item.description.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === 'all' ||
        String(item.status) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [visibleInvoices, search, statusFilter]);

  const totals = useMemo(() => {
    const invoiceTotal = form.lines.reduce((sum, line) => {
      const quantity = parseDecimal(line.quantity);
      const unitPrice = parseDecimal(line.unitPrice);
      return sum + quantity * unitPrice;
    }, 0);

    return {
      invoiceTotal,
    };
  }, [form.lines]);

const taxPreviewQ = useQuery({
    queryKey: [
      'sales-tax-preview',
      form.invoiceDateUtc,
      totals.invoiceTotal,
      form.taxCodeIds,
    ],
    queryFn: () =>
      previewTaxCalculation({
        transactionDateUtc: new Date(`${form.invoiceDateUtc}T00:00:00`).toISOString(),
        transactionScope: 1,
        taxableAmount: totals.invoiceTotal,
        taxCodeIds: form.taxCodeIds,
      }),
    enabled:
      canView &&
      !!form.invoiceDateUtc &&
      totals.invoiceTotal > 0 &&
      form.taxCodeIds.length > 0,
  });

  const totalTaxAdditions = taxPreviewQ.data?.totalAdditions ?? 0;
  const totalTaxDeductions = taxPreviewQ.data?.totalDeductions ?? 0;
  const grossAmount = taxPreviewQ.data?.grossAmount ?? totals.invoiceTotal;
  const netReceivableAmount = taxPreviewQ.data?.netAmount ?? totals.invoiceTotal;

  const createMut = useMutation({
    mutationFn: (payload: CreateSalesInvoiceRequest) => createSalesInvoice(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
      setMessage('Sales invoice created successfully.');
      setForm(emptyForm);
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to create sales invoice.'));
    },
  });

  const submitApprovalMut = useMutation({
    mutationFn: (salesInvoiceId: string) => submitSalesInvoiceForApproval(salesInvoiceId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
      setMessage('Sales invoice submitted for approval successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to submit sales invoice for approval.'));
    },
  });
  
  const approveMut = useMutation({
    mutationFn: (salesInvoiceId: string) => approveSalesInvoice(salesInvoiceId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
      setMessage('Sales invoice approved successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to approve sales invoice.'));
    },
  });
  
  const rejectMut = useMutation({
    mutationFn: (salesInvoiceId: string) =>
      rejectSalesInvoice(salesInvoiceId, { reason: rejectReason.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
      setMessage('Sales invoice rejected successfully.');
      setRejectReason('');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to reject sales invoice.'));
    },
  });

  const postMut = useMutation({
    mutationFn: ({
      salesInvoiceId,
      receivableAccountId,
      revenueAccountId,
    }: {
      salesInvoiceId: string;
      receivableAccountId: string;
      revenueAccountId: string;
    }) =>
      postSalesInvoice(salesInvoiceId, {
        receivableLedgerAccountId: receivableAccountId,
        revenueLedgerAccountId: revenueAccountId,
      }),
    onSuccess: async (data: BudgetAwareApiResponse) => {
      await qc.invalidateQueries({ queryKey: ['ar-sales-invoices'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['trial-balance'] });
      await qc.invalidateQueries({ queryKey: ['balance-sheet'] });
      await qc.invalidateQueries({ queryKey: ['income-statement'] });
      setMessage(formatBudgetAwareSuccessMessage(data, 'Sales invoice posted successfully.'));
    },
    onError: (error) => {
      setMessage(getBudgetAwareReadableError(error, 'Unable to post sales invoice.'));
    },
  });

  function setLine(index: number, patch: Partial<LineForm>) {
    setForm((state) => {
      const next = [...state.lines];
      next[index] = { ...next[index], ...patch };
      return { ...state, lines: next };
    });
  }

  function addLine() {
    setForm((state) => ({
      ...state,
      lines: [
        ...state.lines,
        {
          description: '',
          quantity: '',
          unitPrice: '',
        },
      ],
    }));
  }

  function removeLine(index: number) {
    setForm((state) => {
      if (state.lines.length <= 1) return state;
      return {
        ...state,
        lines: state.lines.filter((_, idx) => idx !== index),
      };
    });
  }

  function toggleTaxCode(taxCodeId: string, checked: boolean) {
    setForm((state) => ({
      ...state,
      taxCodeIds: checked
        ? [...state.taxCodeIds, taxCodeId]
        : state.taxCodeIds.filter((id) => id !== taxCodeId),
    }));
  }

  function submit() {
    setMessage('');

    if (!canCreate) {
      setMessage('You do not have permission to create sales invoices.');
      return;
    }

    if (!form.customerId) {
      setMessage('Please select a customer.');
      return;
    }

    if (!form.invoiceDateUtc) {
      setMessage('Please enter the invoice date.');
      return;
    }

    if (!form.invoiceNumber.trim()) {
      setMessage('Invoice number is required.');
      return;
    }

    if (!form.description.trim()) {
      setMessage('Invoice description is required.');
      return;
    }

    if (form.lines.length === 0) {
      setMessage('At least one invoice line is required.');
      return;
    }

    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];

      if (!line.description.trim()) {
        setMessage(`Line ${i + 1}: description is required.`);
        return;
      }

      if (parseDecimal(line.quantity) <= 0) {
        setMessage(`Line ${i + 1}: quantity must be greater than zero.`);
        return;
      }

      if (parseDecimal(line.unitPrice) < 0) {
        setMessage(`Line ${i + 1}: unit price cannot be negative.`);
        return;
      }
    }

    createMut.mutate({
      customerId: form.customerId,
      invoiceDateUtc: new Date(`${form.invoiceDateUtc}T00:00:00`).toISOString(),
      invoiceNumber: form.invoiceNumber.trim(),
      description: form.description.trim(),
      lines: form.lines.map((line) => ({
        description: line.description.trim(),
        quantity: parseDecimal(line.quantity),
        unitPrice: parseDecimal(line.unitPrice),
      })),
      taxCodeIds: form.taxCodeIds,
    });
  }


  function submitForApproval(salesInvoiceId: string) {
    setMessage('');
  
    if (!canCreate) {
      setMessage('You do not have permission to submit sales invoices for approval.');
      return;
    }
  
    submitApprovalMut.mutate(salesInvoiceId);
  }
  
  function approveInvoice(salesInvoiceId: string) {
    setMessage('');
    approveMut.mutate(salesInvoiceId);
  }
  
  function rejectInvoice(salesInvoiceId: string) {
    setMessage('');
  
    if (!rejectReason.trim()) {
      setMessage('Please enter a rejection reason before rejecting the invoice.');
      return;
    }
  
    rejectMut.mutate(salesInvoiceId);
  }


  function submitPosting(salesInvoiceId: string) {
    setMessage('');

    if (!canCreate) {
      setMessage('You do not have permission to post sales invoices.');
      return;
    }

    if (!receivableLedgerAccountId) {
      setMessage('Please select the receivable ledger account.');
      return;
    }

    if (!revenueLedgerAccountId) {
      setMessage('Please select the revenue ledger account.');
      return;
    }

    postMut.mutate({
      salesInvoiceId,
      receivableAccountId: receivableLedgerAccountId,
      revenueAccountId: revenueLedgerAccountId,
    });
  }

  if (!canView) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Sales Invoices</h2>
            <span className="muted">Access restricted</span>
          </div>
          <div className="muted">
            You do not have permission to view sales invoices.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Sales Invoices</h2>
          <span className="muted">Accounts receivable invoice register</span>
        </div>

        {message ? (
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="muted">{message}</div>
          </div>
        ) : null}

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="muted">
            {(invoicesQ.data?.count || 0).toLocaleString()} invoice(s)
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
              placeholder="Invoice number, customer, description"
            />
          </div>

          <div className="form-row">
            <label>Status Filter</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Invoices</option>
              <option value="1">Draft</option>
              <option value="2">Submitted for Approval</option>
              <option value="3">Approved</option>
              <option value="4">Posted</option>
              <option value="5">Part Paid</option>
              <option value="6">Paid</option>
              <option value="8">Cancelled</option>
            </select>
          </div>
        </div>
      </section>

        
      <section className="panel">
        <div className="section-heading">
          <h2>Create Sales Invoice</h2>
          <span className="muted">Raise a customer invoice for receivables tracking</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Customer</label>
            <select
              className="select"
              value={form.customerId}
              onChange={(e) => setForm((s) => ({ ...s, customerId: e.target.value }))}
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
            <label>Invoice Date</label>
            <input
              className="input"
              type="date"
              value={form.invoiceDateUtc}
              onChange={(e) => setForm((s) => ({ ...s, invoiceDateUtc: e.target.value }))}
            />
          </div>

          <div className="form-row">
            <label>Invoice Number</label>
            <input
              className="input"
              value={form.invoiceNumber}
              onChange={(e) => setForm((s) => ({ ...s, invoiceNumber: e.target.value }))}
              placeholder="Enter invoice number"
            />
          </div>

          <div className="form-row">
            <label>Invoice Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Enter invoice description"
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="section-heading">
            <h2>Invoice Lines</h2>
            <div className="inline-actions">
              <span className="muted">Invoice Total: {formatAmount(totals.invoiceTotal)}</span>
              <button className="button" onClick={addLine}>
                Add Line
              </button>
            </div>
          </div>

          <div className="detail-stack">
            {form.lines.map((line, index) => (
              <div key={index} className="kv" style={{ marginBottom: 12 }}>
                <div className="form-grid two">
                  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <input
                      className="input"
                      value={line.description}
                      onChange={(e) => setLine(index, { description: e.target.value })}
                      placeholder="Enter line description"
                    />
                  </div>

                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-row">
                    <label>Unit Price</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                  <div className="muted">
                    Line Total: {formatAmount(parseDecimal(line.quantity) * parseDecimal(line.unitPrice))}
                  </div>
                  <button
                    className="button danger"
                    onClick={() => removeLine(index)}
                    disabled={form.lines.length <= 1}
                  >
                    Remove Line
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>


                <div style={{ marginTop: 16 }}>
          <div className="section-heading">
            <h2>VAT / WHT / Other Taxes</h2>
            <span className="muted">Select setup-driven tax codes for this sales invoice</span>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            {taxCodesQ.isLoading ? (
              <div className="muted">Loading tax codes...</div>
            ) : taxCodesQ.isError || !taxCodesQ.data ? (
              <div className="error-panel">Unable to load tax codes.</div>
            ) : taxCodesQ.data.items.length === 0 ? (
              <div className="muted">No active sales tax codes have been configured.</div>
            ) : (
              <div className="detail-stack">
                {taxCodesQ.data.items.map((taxCode: TaxCodeDto) => {
                  const checked = form.taxCodeIds.includes(taxCode.id);

                  return (
                    <label
                      key={taxCode.id}
                      className="muted"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleTaxCode(taxCode.id, e.target.checked)}
                      />
                      <span>
                        {taxCode.code} - {taxCode.name}
                        {' '}({taxComponentKindLabel(taxCode.componentKind)}, {taxApplicationModeLabel(taxCode.applicationMode)}, {formatAmount(taxCode.ratePercent)}%)
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="kv">
            <div className="kv-row">
              <span>Base Invoice Amount</span>
              <span>{formatAmount(totals.invoiceTotal)}</span>
            </div>
            <div className="kv-row">
              <span>Tax Additions</span>
              <span>{formatAmount(totalTaxAdditions)}</span>
            </div>
            <div className="kv-row">
              <span>Tax Deductions</span>
              <span>{formatAmount(totalTaxDeductions)}</span>
            </div>
            <div className="kv-row">
              <span>Gross Amount</span>
              <span>{formatAmount(grossAmount)}</span>
            </div>
            <div className="kv-row">
              <span>Net Receivable Amount</span>
              <span>{formatAmount(netReceivableAmount)}</span>
            </div>
          </div>

          {taxPreviewQ.data?.items?.length ? (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tax Code</th>
                    <th>Kind</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Rate %</th>
                    <th style={{ textAlign: 'right' }}>Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxPreviewQ.data.items.map((item) => (
                    <tr key={item.taxCodeId}>
                      <td>{item.code}</td>
                      <td>{taxComponentKindLabel(item.componentKind)}</td>
                      <td>{taxApplicationModeLabel(item.applicationMode)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.ratePercent)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="button" onClick={() => setForm(emptyForm)}>
            Reset Form
          </button>

          <Link to="/sales-invoices/rejected" className="button">
           Rejected Sales Invoices
           </Link>


          <button
            className="button primary"
            onClick={submit}
            disabled={createMut.isPending || !canCreate}
          >
            {createMut.isPending ? 'Saving…' : 'Create Sales Invoice'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Invoice Posting</h2>
          <span className="muted">Select ledger accounts for receivable and revenue posting</span>
        </div>

        <div className="form-grid two">
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

          <div className="form-row">
            <label>Revenue Ledger Account</label>
            <select
              className="select"
              value={revenueLedgerAccountId}
              onChange={(e) => setRevenueLedgerAccountId(e.target.value)}
            >
              <option value="">— Select Revenue Account —</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

        

      <div className="form-row" style={{ marginTop: 16, marginBottom: 16 }}>
          <label>Rejection Reason</label>
          <input
            className="input"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Required only when rejecting a submitted invoice"
          />
        </div>

       


      <section className="panel">
        <div className="section-heading">
          <h2>Invoice Register</h2>
          <span className="muted">Invoice status, customer balance, and operational visibility</span>
        </div>

        <div className="detail-stack">
          {invoicesQ.isLoading ? (
            <div className="muted">Loading sales invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="muted">No sales invoices found for the current filter.</div>
          ) : (
            filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="kv" style={{ marginBottom: 12 }}>
                <div className="kv-row">
                  <span>Invoice Number</span>
                  <span>{invoice.invoiceNumber}</span>
                </div>
                <div className="kv-row">
                  <span>Customer</span>
                  <span>{invoice.customerCode} - {invoice.customerName}</span>
                </div>
                <div className="kv-row">
                  <span>Description</span>
                  <span>{invoice.description}</span>
                </div>
                <div className="kv-row">
                  <span>Invoice Date</span>
                  <span>{formatUtcDate(invoice.invoiceDateUtc)}</span>
                </div>
                <div className="kv-row">
                  <span>Status</span>
                  <span>{invoiceStatusLabel(invoice.status)}</span>
                </div>
                <div className="kv-row">
                  <span>Base Amount</span>
                  <span>{formatAmount(invoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Tax Additions</span>
                  <span>{formatAmount(invoice.taxAdditionAmount || 0)}</span>
                </div>
                <div className="kv-row">
                  <span>Tax Deductions</span>
                  <span>{formatAmount(invoice.taxDeductionAmount || 0)}</span>
                </div>
                <div className="kv-row">
                  <span>Gross Amount</span>
                  <span>{formatAmount(invoice.grossAmount || invoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Net Receivable Amount</span>
                  <span>{formatAmount(invoice.netReceivableAmount || invoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Amount Paid</span>
                  <span>{formatAmount(invoice.amountPaid)}</span>
                </div>
                <div className="kv-row">
                  <span>Balance Amount</span>
                  <span>{formatAmount(invoice.balanceAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Line Count</span>
                  <span>{invoice.lineCount}</span>
                </div>
                <div className="kv-row">
                  <span>Posted On</span>
                  <span>{formatUtcDate(invoice.postedOnUtc)}</span>
                </div>

                {[1, 2, 3].includes(invoice.status) ? (
  <div className="inline-actions" style={{ marginTop: 12 }}>
    {invoice.status === 1 && canCreate ? (
      <button
        className="button"
        onClick={() => submitForApproval(invoice.id)}
        disabled={submitApprovalMut.isPending}
      >
        {submitApprovalMut.isPending ? 'Submitting…' : 'Submit'}
      </button>
    ) : null}

    {invoice.status === 2 ? (
      <>
        <button
          className="button"
          onClick={() => approveInvoice(invoice.id)}
          disabled={approveMut.isPending}
        >
          {approveMut.isPending ? 'Approving…' : 'Approve'}
        </button>

        <button
          className="button danger"
          onClick={() => rejectInvoice(invoice.id)}
          disabled={rejectMut.isPending}
        >
          {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
        </button>
      </>
    ) : null}

    {invoice.status === 3 && canCreate ? (
      <button
        className="button primary"
        onClick={() => submitPosting(invoice.id)}
        disabled={postMut.isPending || !canCreate}
      >
        {postMut.isPending ? 'Posting…' : 'Post Invoice'}
      </button>
    ) : null}
  </div>
) : null}


              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}