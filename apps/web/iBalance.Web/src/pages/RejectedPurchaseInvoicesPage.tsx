import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteRejectedPurchaseInvoice,
  getRejectedPurchaseInvoices,
  getTaxCodes,
  getTenantReadableError,
  getVendors,
  previewTaxCalculation,
  submitPurchaseInvoiceForApproval,
  updateRejectedPurchaseInvoice,
  type PurchaseInvoiceLineDto,
  type RejectedPurchaseInvoiceDto,
  type TaxCodeDto,
  type UpdatePurchaseInvoiceRequest,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

const emptyLine: PurchaseInvoiceLineDto = {
  description: '',
  quantity: 1,
  unitPrice: 0,
};

const emptyForm: UpdatePurchaseInvoiceRequest = {
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

export function RejectedPurchaseInvoicesPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [selectedInvoice, setSelectedInvoice] = useState<RejectedPurchaseInvoiceDto | null>(null);
  const [form, setForm] = useState<UpdatePurchaseInvoiceRequest>(emptyForm);
  const [showEdit, setShowEdit] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [search, setSearch] = useState('');

  const rejectedInvoicesQ = useQuery({
    queryKey: ['ap-rejected-purchase-invoices'],
    queryFn: getRejectedPurchaseInvoices,
    enabled: canView,
  });

  const vendorsQ = useQuery({
    queryKey: ['ap-vendors'],
    queryFn: getVendors,
    enabled: canView,
  });

  const taxCodesQ = useQuery({
    queryKey: ['tax-codes', 'purchases', 'active'],
    queryFn: () => getTaxCodes(null, 2, true),
    enabled: canView,
  });

  const invoiceBaseAmount = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      return sum + Number(line.quantity || 0) * Number(line.unitPrice || 0);
    }, 0);
  }, [form.lines]);

  const taxPreviewQ = useQuery({
    queryKey: [
      'rejected-purchase-tax-preview',
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

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['ap-rejected-purchase-invoices'] });
    await qc.invalidateQueries({ queryKey: ['ap-purchase-invoices'] });
    await qc.invalidateQueries({ queryKey: ['ap-vendor-payments'] });
  }

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selectedInvoice) {
        throw new Error('No rejected purchase invoice selected.');
      }

      return updateRejectedPurchaseInvoice(selectedInvoice.id, {
        vendorId: form.vendorId,
        invoiceDateUtc: form.invoiceDateUtc,
        invoiceNumber: form.invoiceNumber.trim(),
        description: form.description.trim(),
        lines: form.lines.map((line) => ({
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
        taxCodeIds: form.taxCodeIds ?? [],
      });
    },
    onSuccess: async () => {
      await refresh();
      setShowEdit(false);
      setSelectedInvoice(null);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Rejected purchase invoice updated successfully. It remains rejected until resubmitted.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update rejected purchase invoice.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (purchaseInvoiceId: string) => submitPurchaseInvoiceForApproval(purchaseInvoiceId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Purchase invoice resubmitted for approval successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to resubmit purchase invoice for approval.'));
      setInfoText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (purchaseInvoiceId: string) => deleteRejectedPurchaseInvoice(purchaseInvoiceId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Rejected purchase invoice deleted successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to delete rejected purchase invoice.'));
      setInfoText('');
    },
  });

  const filteredInvoices = useMemo(() => {
    const items = rejectedInvoicesQ.data?.items ?? [];
    const text = search.trim().toLowerCase();

    if (!text) return items;

    return items.filter((item) => {
      return (
        item.invoiceNumber.toLowerCase().includes(text) ||
        item.vendorCode.toLowerCase().includes(text) ||
        item.vendorName.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text) ||
        (item.rejectionReason || '').toLowerCase().includes(text)
      );
    });
  }, [rejectedInvoicesQ.data?.items, search]);

  const totalTaxAdditions = taxPreviewQ.data?.totalAdditions ?? 0;
  const totalTaxDeductions = taxPreviewQ.data?.totalDeductions ?? 0;
  const grossAmount = taxPreviewQ.data?.grossAmount ?? invoiceBaseAmount;
  const netPayableAmount = taxPreviewQ.data?.netAmount ?? invoiceBaseAmount;

  function update<K extends keyof UpdatePurchaseInvoiceRequest>(key: K, value: UpdatePurchaseInvoiceRequest[K]) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  function updateLine(index: number, key: keyof PurchaseInvoiceLineDto, value: string | number) {
    setForm((state) => {
      const next = [...state.lines];
      next[index] = {
        ...next[index],
        [key]: value,
      };
      return { ...state, lines: next };
    });
  }

  function addLine() {
    setForm((state) => ({
      ...state,
      lines: [...state.lines, { ...emptyLine }],
    }));
  }

  function removeLine(index: number) {
    setForm((state) => ({
      ...state,
      lines: state.lines.filter((_, i) => i !== index),
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

  function openEdit(invoice: RejectedPurchaseInvoiceDto) {
    if (!canManage) {
      setErrorText('You do not have permission to edit rejected purchase invoices.');
      setInfoText('');
      return;
    }

    setSelectedInvoice(invoice);
    setForm({
      vendorId: invoice.vendorId,
      invoiceDateUtc: invoice.invoiceDateUtc,
      invoiceNumber: invoice.invoiceNumber,
      description: invoice.description,
      lines: invoice.lines.length > 0
        ? invoice.lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
          }))
        : [{ ...emptyLine }],
      taxCodeIds: invoice.taxLines.map((taxLine) => taxLine.taxCodeId),
    });

    setErrorText('');
    setInfoText('');
    setShowEdit(true);
  }

  function closeEdit() {
    if (!updateMut.isPending) {
      setShowEdit(false);
      setSelectedInvoice(null);
      setForm(emptyForm);
      setErrorText('');
    }
  }

  async function submitUpdate() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to edit rejected purchase invoices.');
      return;
    }

    if (!selectedInvoice) {
      setErrorText('Please select a rejected purchase invoice to edit.');
      return;
    }

    if (!form.vendorId) {
      setErrorText('Vendor is required.');
      return;
    }

    if (!form.invoiceDateUtc) {
      setErrorText('Invoice date is required.');
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

    if (form.lines.length === 0) {
      setErrorText('At least one purchase invoice line is required.');
      return;
    }

    for (const line of form.lines) {
      if (!line.description.trim()) {
        setErrorText('Each purchase invoice line must have a description.');
        return;
      }

      if (Number(line.quantity || 0) <= 0) {
        setErrorText('Each purchase invoice line quantity must be greater than zero.');
        return;
      }

      if (Number(line.unitPrice || 0) < 0) {
        setErrorText('Purchase invoice line unit price cannot be negative.');
        return;
      }
    }

    await updateMut.mutateAsync();
  }

  async function submitForApproval(invoice: RejectedPurchaseInvoiceDto) {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to submit rejected purchase invoices for approval.');
      return;
    }

    await submitMut.mutateAsync(invoice.id);
  }

  async function deleteInvoice(invoice: RejectedPurchaseInvoiceDto) {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to delete rejected purchase invoices.');
      return;
    }

    const confirmed = window.confirm(
      `Delete rejected purchase invoice ${invoice.invoiceNumber}? This cannot be undone.`
    );

    if (!confirmed) return;

    await deleteMut.mutateAsync(invoice.id);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view rejected purchase invoices.</div>;
  }

  if (rejectedInvoicesQ.isLoading || vendorsQ.isLoading || taxCodesQ.isLoading) {
    return <div className="panel">Loading rejected purchase invoices...</div>;
  }

  if (
    rejectedInvoicesQ.isError ||
    vendorsQ.isError ||
    taxCodesQ.isError ||
    !rejectedInvoicesQ.data ||
    !vendorsQ.data ||
    !taxCodesQ.data
  ) {
    return <div className="panel error-panel">We could not load rejected purchase invoices at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Rejected Purchase Invoices</h2>
            <div className="muted">
              Correct rejected supplier invoices, resubmit them for approval, or delete invoices no longer needed.
            </div>
          </div>
          <span className="muted">{rejectedInvoicesQ.data.count} rejected invoice(s)</span>
        </div>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice number, vendor, description, rejection reason"
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
                <th>Invoice Number</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Invoice Date</th>
                <th>Status</th>
                <th>Rejected By</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ width: 280 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    No rejected purchase invoices matched your search.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.vendorCode} - {invoice.vendorName}</td>
                    <td>{invoice.description}</td>
                    <td>{formatDateTime(invoice.invoiceDateUtc)}</td>
                    <td>{purchaseInvoiceStatusLabel(invoice.status)}</td>
                    <td>{invoice.rejectedByDisplayName || invoice.rejectedBy || '—'}</td>
                    <td>{formatDateTime(invoice.rejectedOnUtc)}</td>
                    <td>{invoice.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.netPayableAmount || invoice.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.balanceAmount || 0)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => openEdit(invoice)}>
                          Edit
                        </button>

                        <button
                          className="button"
                          onClick={() => submitForApproval(invoice)}
                          disabled={submitMut.isPending}
                        >
                          {submitMut.isPending ? 'Submitting…' : 'Resubmit'}
                        </button>

                        <button
                          className="button danger"
                          onClick={() => deleteInvoice(invoice)}
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

      {showEdit && selectedInvoice ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rejected Purchase Invoice</h2>
              <button className="button ghost" onClick={closeEdit} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Current Status</span><span>{purchaseInvoiceStatusLabel(selectedInvoice.status)}</span></div>
              <div className="kv-row"><span>Rejected By</span><span>{selectedInvoice.rejectedByDisplayName || selectedInvoice.rejectedBy || '—'}</span></div>
              <div className="kv-row"><span>Rejected On</span><span>{formatDateTime(selectedInvoice.rejectedOnUtc)}</span></div>
              <div className="kv-row"><span>Rejection Reason</span><span>{selectedInvoice.rejectionReason || '—'}</span></div>
            </div>

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
                  value={toDateTimeInput(form.invoiceDateUtc)}
                  onChange={(e) => update('invoiceDateUtc', fromDateTimeInput(e.target.value))}
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
                      <td>{formatAmount(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</td>
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
              <div className="kv-row"><span>Base Invoice Amount</span><span>{formatAmount(invoiceBaseAmount)}</span></div>
              <div className="kv-row"><span>Tax Additions</span><span>{formatAmount(totalTaxAdditions)}</span></div>
              <div className="kv-row"><span>Tax Deductions</span><span>{formatAmount(totalTaxDeductions)}</span></div>
              <div className="kv-row"><span>Gross Amount</span><span>{formatAmount(grossAmount)}</span></div>
              <div className="kv-row"><span>Net Payable Amount</span><span>{formatAmount(netPayableAmount)}</span></div>
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