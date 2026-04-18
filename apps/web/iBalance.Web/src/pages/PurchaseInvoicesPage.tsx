import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPurchaseInvoice,
  getAccounts,
  getPurchaseInvoices,
  getTaxCodes,
  getTenantReadableError,
  getVendors,
  postPurchaseInvoice,
  previewTaxCalculation,
  type CreatePurchaseInvoiceRequest,
  type PurchaseInvoiceLineDto,
  type TaxCodeDto,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

const emptyLine: PurchaseInvoiceLineDto = {
  description: '',
  quantity: 1,
  unitPrice: 0,
};

const emptyForm: CreatePurchaseInvoiceRequest = {
  vendorId: '',
  invoiceDateUtc: '',
  invoiceNumber: '',
  description: '',
  lines: [{ ...emptyLine }],
  taxCodeIds: [],
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

function purchaseInvoiceStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Part Paid';
    case 4: return 'Paid';
    case 5: return 'Cancelled';
    default: return 'Unknown';
  }
}

function taxComponentKindLabel(value: number) {
  switch (value) {
    case 1: return 'VAT';
    case 2: return 'WHT';
    case 3: return 'Other';
    default: return 'Unknown';
  }
}

function taxApplicationModeLabel(value: number) {
  switch (value) {
    case 1: return 'Add to Amount';
    case 2: return 'Deduct from Amount';
    default: return 'Unknown';
  }
}

export function PurchaseInvoicesPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [showCreate, setShowCreate] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [form, setForm] = useState<CreatePurchaseInvoiceRequest>({
    ...emptyForm,
    invoiceDateUtc: new Date().toISOString(),
  });
  const [postForm, setPostForm] = useState({
    payableLedgerAccountId: '',
    expenseLedgerAccountId: '',
  });
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const invoicesQ = useQuery({
    queryKey: ['ap-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  const vendorsQ = useQuery({
    queryKey: ['ap-vendors'],
    queryFn: getVendors,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });


  const taxCodesQ = useQuery({
    queryKey: ['tax-codes', 'purchases', 'active'],
    queryFn: () => getTaxCodes(null, 2, true),
    enabled: canView,
  });

  const createMut = useMutation({
    mutationFn: createPurchaseInvoice,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
      setShowCreate(false);
      setForm({
        ...emptyForm,
        invoiceDateUtc: new Date().toISOString(),
      });
      setErrorText('');
      setInfoText('Purchase invoice created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the purchase invoice at this time.'));
      setInfoText('');
    },
  });

  const postMut = useMutation({
    mutationFn: () => postPurchaseInvoice(selectedInvoiceId, postForm),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      setShowPost(false);
      setSelectedInvoiceId('');
      setPostForm({
        payableLedgerAccountId: '',
        expenseLedgerAccountId: '',
      });
      setErrorText('');
      setInfoText('Purchase invoice posted successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not post the purchase invoice at this time.'));
      setInfoText('');
    },
  });

  const summary = useMemo(() => {
    const items = invoicesQ.data?.items ?? [];
    return {
      total: items.length,
      totalBaseAmount: items.reduce((sum, x) => sum + x.totalAmount, 0),
      totalTaxAdditions: items.reduce((sum, x) => sum + (x.taxAdditionAmount || 0), 0),
      totalTaxDeductions: items.reduce((sum, x) => sum + (x.taxDeductionAmount || 0), 0),
      totalNetPayable: items.reduce((sum, x) => sum + (x.netPayableAmount || x.totalAmount), 0),
      totalPaid: items.reduce((sum, x) => sum + x.amountPaid, 0),
      totalOutstanding: items.reduce((sum, x) => sum + x.balanceAmount, 0),
      drafts: items.filter((x) => x.status === 1).length,
      posted: items.filter((x) => x.status === 2).length,
      partPaid: items.filter((x) => x.status === 3).length,
      paid: items.filter((x) => x.status === 4).length,
    };
  }, [invoicesQ.data?.items]);

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed);
  }, [accountsQ.data?.items]);

  const invoiceBaseAmount = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      return sum + Number(line.quantity || 0) * Number(line.unitPrice || 0);
    }, 0);
  }, [form.lines]);

  const taxPreviewQ = useQuery({
    queryKey: [
      'purchase-tax-preview',
      form.invoiceDateUtc,
      invoiceBaseAmount,
      form.taxCodeIds,
    ],
    queryFn: () =>
      previewTaxCalculation({
        transactionDateUtc: form.invoiceDateUtc,
        transactionScope: 2,
        taxableAmount: invoiceBaseAmount,
        taxCodeIds: form.taxCodeIds ?? [],
      }),
    enabled:
      canView &&
      !!form.invoiceDateUtc &&
      invoiceBaseAmount > 0 &&
      !!form.taxCodeIds &&
      form.taxCodeIds.length > 0,
  });

  const totalTaxAdditions = taxPreviewQ.data?.totalAdditions ?? 0;
  const totalTaxDeductions = taxPreviewQ.data?.totalDeductions ?? 0;
  const grossAmount = taxPreviewQ.data?.grossAmount ?? invoiceBaseAmount;
  const netPayableAmount = taxPreviewQ.data?.netAmount ?? invoiceBaseAmount;

  function update<K extends keyof CreatePurchaseInvoiceRequest>(key: K, value: CreatePurchaseInvoiceRequest[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function updateLine(index: number, key: keyof PurchaseInvoiceLineDto, value: string | number) {
    setForm((s) => {
      const next = [...s.lines];
      next[index] = {
        ...next[index],
        [key]: value,
      };
      return { ...s, lines: next };
    });
  }

  function addLine() {
    setForm((s) => ({
      ...s,
      lines: [...s.lines, { ...emptyLine }],
    }));
  }

  function removeLine(index: number) {
    setForm((s) => ({
      ...s,
      lines: s.lines.filter((_, i) => i !== index),
    }));
  }

  function toggleTaxCode(taxCodeId: string, checked: boolean) {
    setForm((state) => ({
      ...state,
      taxCodeIds: checked
        ? [...(state.taxCodeIds ?? []), taxCodeId]
        : (state.taxCodeIds ?? []).filter((id) => id !== taxCodeId),
    }));
  }

  function openCreateModal() {
    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
      setInfoText('');
      return;
    }

    setForm({
      ...emptyForm,
      invoiceDateUtc: new Date().toISOString(),
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

  function openPostModal(invoiceId: string) {
    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
      setInfoText('');
      return;
    }

    setSelectedInvoiceId(invoiceId);
    setPostForm({
      payableLedgerAccountId: '',
      expenseLedgerAccountId: '',
    });
    setErrorText('');
    setInfoText('');
    setShowPost(true);
  }

  function closePostModal() {
    if (!postMut.isPending) {
      setShowPost(false);
      setSelectedInvoiceId('');
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

    if (!form.invoiceNumber.trim()) {
      setErrorText('Invoice number is required.');
      return;
    }

    if (!form.description.trim()) {
      setErrorText('Invoice description is required.');
      return;
    }

    if (!form.invoiceDateUtc) {
      setErrorText('Invoice date is required.');
      return;
    }

    if (form.lines.length === 0) {
      setErrorText('At least one line is required.');
      return;
    }

    for (const line of form.lines) {
      if (!line.description.trim()) {
        setErrorText('Each line must have a description.');
        return;
      }

      if (line.quantity <= 0) {
        setErrorText('Each line quantity must be greater than zero.');
        return;
      }

      if (line.unitPrice < 0) {
        setErrorText('Unit price cannot be negative.');
        return;
      }
    }

    await createMut.mutateAsync({
      vendorId: form.vendorId,
      invoiceDateUtc: form.invoiceDateUtc,
      invoiceNumber: form.invoiceNumber.trim(),
      description: form.description.trim(),
      lines: form.lines.map((x) => ({
        description: x.description.trim(),
        quantity: Number(x.quantity),
        unitPrice: Number(x.unitPrice),
      })),
      taxCodeIds: form.taxCodeIds ?? [],
    });
  }

  async function submitPost() {
    setErrorText('');
    setInfoText('');

    if (!postForm.payableLedgerAccountId) {
      setErrorText('Payable ledger account is required.');
      return;
    }

    if (!postForm.expenseLedgerAccountId) {
      setErrorText('Expense ledger account is required.');
      return;
    }

    await postMut.mutateAsync();
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view purchase invoices.</div>;
  }

  if (invoicesQ.isLoading || vendorsQ.isLoading || accountsQ.isLoading || taxCodesQ.isLoading) {
    return <div className="panel">Loading purchase invoices...</div>;
  }

  if (
    invoicesQ.isError ||
    vendorsQ.isError ||
    accountsQ.isError ||
    taxCodesQ.isError ||
    !invoicesQ.data ||
    !vendorsQ.data ||
    !accountsQ.data ||
    !taxCodesQ.data
  ) {
    return <div className="panel error-panel">We could not load purchase invoices at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Purchase Invoices</h2>
            <div className="muted">Capture and post supplier invoices for Accounts Payable.</div>
          </div>

          {canManage ? (
            <div className="inline-actions">
              <button className="button primary" onClick={openCreateModal}>New Purchase Invoice</button>
            </div>
          ) : null}
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Purchase Invoices</span><span>{summary.total}</span></div>
          <div className="kv-row"><span>Total Base Amount</span><span>{formatAmount(summary.totalBaseAmount)}</span></div>
          <div className="kv-row"><span>Total Tax Additions</span><span>{formatAmount(summary.totalTaxAdditions)}</span></div>
          <div className="kv-row"><span>Total Tax Deductions</span><span>{formatAmount(summary.totalTaxDeductions)}</span></div>
          <div className="kv-row"><span>Total Net Payable</span><span>{formatAmount(summary.totalNetPayable)}</span></div>
          <div className="kv-row"><span>Total Paid</span><span>{formatAmount(summary.totalPaid)}</span></div>
          <div className="kv-row"><span>Total Outstanding</span><span>{formatAmount(summary.totalOutstanding)}</span></div>
          <div className="kv-row"><span>Draft</span><span>{summary.drafts}</span></div>
          <div className="kv-row"><span>Posted</span><span>{summary.posted}</span></div>
          <div className="kv-row"><span>Part Paid</span><span>{summary.partPaid}</span></div>
          <div className="kv-row"><span>Paid</span><span>{summary.paid}</span></div>
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
          <h2>Purchase Invoice Listing</h2>
          <span className="muted">{invoicesQ.data.count} invoice(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Invoice Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>Tax +</th>
                <th style={{ textAlign: 'right' }}>Tax -</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Posted On</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoicesQ.data.items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="muted">
                    No purchase invoices have been created yet.
                  </td>
                </tr>
              ) : (
                invoicesQ.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.invoiceNumber}</td>
                    <td>{item.vendorCode} - {item.vendorName}</td>
                    <td>{item.description}</td>
                    <td>{formatDateTime(item.invoiceDateUtc)}</td>
                    <td>{purchaseInvoiceStatusLabel(item.status)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.taxAdditionAmount || 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.taxDeductionAmount || 0)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.netPayableAmount || item.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.amountPaid)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceAmount)}</td>
                    <td>{formatDateTime(item.postedOnUtc)}</td>
                    <td>
                      {item.status === 1 && canManage ? (
                        <button className="button" onClick={() => openPostModal(item.id)}>
                          Post
                        </button>
                      ) : (
                        '—'
                      )}
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
              <h2>Create Purchase Invoice</h2>
              <button className="button ghost" onClick={closeCreateModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Vendor</label>
                <select
                  className="select"
                  value={form.vendorId}
                  onChange={(e) => update('vendorId', e.target.value)}
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
                <label>Invoice Number</label>
                <input
                  className="input"
                  value={form.invoiceNumber}
                  onChange={(e) => update('invoiceNumber', e.target.value)}
                  placeholder="Enter invoice number"
                />
              </div>

              <div className="form-row">
                <label>Invoice Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.invoiceDateUtc ? new Date(form.invoiceDateUtc).toISOString().slice(0, 16) : ''}
                  onChange={(e) => update('invoiceDateUtc', new Date(e.target.value).toISOString())}
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Enter invoice description"
                />
              </div>
            </div>

            <div className="section-heading" style={{ marginTop: 16 }}>
              <h2>Invoice Lines</h2>
              <button className="button" onClick={addLine}>Add Line</button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ width: 120 }}>Quantity</th>
                    <th style={{ width: 140 }}>Unit Price</th>
                    <th style={{ width: 120 }}>Line Total</th>
                    <th style={{ width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          className="input"
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder="Line description"
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, 'unitPrice', Number(e.target.value))}
                        />
                      </td>
                      <td>{formatAmount(Number(line.quantity) * Number(line.unitPrice))}</td>
                      <td>
                        <button
                          className="button"
                          onClick={() => removeLine(index)}
                          disabled={form.lines.length === 1}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section-heading" style={{ marginTop: 16 }}>
              <div>
                <h2>VAT / WHT / Other Taxes</h2>
                <span className="muted">Select setup-driven purchase tax codes for this invoice</span>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 16 }}>
              {taxCodesQ.data.items.length === 0 ? (
                <div className="muted">No active purchase tax codes have been configured.</div>
              ) : (
                <div className="detail-stack">
                  {taxCodesQ.data.items.map((taxCode: TaxCodeDto) => {
                    const checked = (form.taxCodeIds ?? []).includes(taxCode.id);

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

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row">
                <span>Base Invoice Amount</span>
                <span>{formatAmount(invoiceBaseAmount)}</span>
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
                <span>Net Payable Amount</span>
                <span>{formatAmount(netPayableAmount)}</span>
              </div>
            </div>

            {taxPreviewQ.data?.items?.length ? (
              <div className="table-wrap" style={{ marginBottom: 16 }}>
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




            <div className="modal-footer">
              <button className="button" onClick={closeCreateModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitCreate} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Purchase Invoice'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPost ? (
        <div className="modal-backdrop" onMouseDown={closePostModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post Purchase Invoice</h2>
              <button className="button ghost" onClick={closePostModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
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

              <div className="form-row">
                <label>Expense Ledger Account</label>
                <select
                  className="select"
                  value={postForm.expenseLedgerAccountId}
                  onChange={(e) => setPostForm((s) => ({ ...s, expenseLedgerAccountId: e.target.value }))}
                >
                  <option value="">— Select Expense Ledger Account —</option>
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
                {postMut.isPending ? 'Posting…' : 'Post Purchase Invoice'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}