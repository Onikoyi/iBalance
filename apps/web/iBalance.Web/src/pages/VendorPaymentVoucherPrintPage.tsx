import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCompanyLogoDataUrl,
  getTenantKey,
  getTenantLogoDataUrl,
  getVendorPaymentDetail,
} from '../lib/api';

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatJournalEntry(payment: VoucherData['payment']) {
  if (payment.journalEntryReference) {
    return payment.journalEntryDescription
      ? `${payment.journalEntryReference} - ${payment.journalEntryDescription}`
      : payment.journalEntryReference;
  }

  return payment.journalEntryId ? 'Posted journal entry available' : '—';
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

type VoucherData = {
  payment: {
    id: string;
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    vendorEmail?: string | null;
    vendorPhoneNumber?: string | null;
    vendorBillingAddress?: string | null;
    purchaseInvoiceId: string;
    invoiceNumber: string;
    invoiceDescription: string;
    invoiceDateUtc?: string | null;
    invoiceTotalAmount: number;
    invoiceTaxAdditionAmount: number;
    invoiceTaxDeductionAmount: number;
    invoiceGrossAmount: number;
    invoiceNetPayableAmount: number;
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    paymentDateUtc: string;
    paymentNumber: string;
    description: string;
    amount: number;
    status: number;
    journalEntryId?: string | null;
    journalEntryReference?: string | null;
    journalEntryDescription?: string | null;
    journalEntryDateUtc?: string | null;
    journalEntryStatus?: number | null;
    journalEntryPostedAtUtc?: string | null;
    postedOnUtc?: string | null;
    createdOnUtc: string;
    createdBy?: string | null;
    createdByDisplayName?: string | null;
    preparedByDisplayName?: string | null;
    lastModifiedOnUtc?: string | null;
    lastModifiedBy?: string | null;
    lastModifiedByDisplayName?: string | null;
    approvedByDisplayName?: string | null;
    approvedOnUtc?: string | null;
    invoiceLines: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  };
};

function buildVoucherPrintHtml(args: {
  tenantKey: string;
  tenantLogo: string;
  companyLogo: string;
  data: VoucherData;
}) {
  const { tenantKey, tenantLogo, companyLogo, data } = args;
  const payment = data.payment;

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:48px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  const lineRows = payment.invoiceLines.length === 0
    ? `<tr><td colspan="4" style="padding:12px;color:#6b7280;">No invoice lines are available for this payment voucher.</td></tr>`
    : payment.invoiceLines.map((line) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${line.description}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(line.quantity)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(line.unitPrice)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(line.lineTotal)}</td>
        </tr>
      `).join('');

  const totalQuantity = payment.invoiceLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
 

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vendor Payment Voucher - ${payment.paymentNumber}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: center;
      margin-bottom: 18px;
    }
    .brand-block {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .brand-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .brand-meta strong {
      font-size: 15px;
    }
    .brand-meta span {
      font-size: 12px;
      color: #6b7280;
    }
    .title-block {
      margin-bottom: 18px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }
    .title-block h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
    .grid-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .kv {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .kv-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    .kv-row:last-child {
      border-bottom: none;
    }
    .section {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
    }
    .section h2 {
      margin: 0 0 12px 0;
      font-size: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    th {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #d1d5db;
      font-size: 14px;
    }
    tfoot th {
      border-top: 1px solid #d1d5db;
      border-bottom: none;
    }
    @media print {
      body {
        padding: 0;
      }
      .page {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-row">
      <div class="brand-block">
        ${logoOrFallback(companyLogo, 'iBalance')}
        <div class="brand-meta">
          <strong>Nikosoft Technologies</strong>
          <span>iBalance Accounting Cloud</span>
        </div>
      </div>
      <div class="brand-block">
        ${logoOrFallback(tenantLogo, 'Org')}
        <div class="brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="title-block">
      <h1>Vendor Payment Voucher</h1>
      <div class="muted">Voucher No: ${payment.paymentNumber}</div>
    </div>

    <div class="kv">
      <div class="kv-row"><span>Voucher Number</span><span>${payment.paymentNumber}</span></div>
      <div class="kv-row"><span>Payment Date</span><span>${formatDateTime(payment.paymentDateUtc)}</span></div>
      <div class="kv-row"><span>Status</span><span>${vendorPaymentStatusLabel(payment.status)}</span></div>
      <div class="kv-row"><span>Payment Amount</span><span>${formatAmount(payment.amount)}</span></div>
      <div class="kv-row"><span>Posted On</span><span>${formatDateTime(payment.postedOnUtc)}</span></div>
      // <div class="kv-row"><span>Journal Entry</span><span>${formatJournalEntry(payment)}</span></div>
    </div>

    <div class="grid-two">
      <div class="section">
        <h2>Vendor Details</h2>
        <div class="kv">
          <div class="kv-row"><span>Vendor</span><span>${payment.vendorCode} - ${payment.vendorName}</span></div>
          <div class="kv-row"><span>Email</span><span>${payment.vendorEmail || 'Not available'}</span></div>
          <div class="kv-row"><span>Phone Number</span><span>${payment.vendorPhoneNumber || 'Not available'}</span></div>
          <div class="kv-row"><span>Billing Address</span><span>${payment.vendorBillingAddress || 'Not available'}</span></div>
        </div>
      </div>

      <div class="section">
        <h2>Invoice Details</h2>
        <div class="kv">
          <div class="kv-row"><span>Invoice Number</span><span>${payment.invoiceNumber}</span></div>
          <div class="kv-row"><span>Invoice Date</span><span>${formatDateTime(payment.invoiceDateUtc)}</span></div>
          <div class="kv-row"><span>Description</span><span>${payment.invoiceDescription}</span></div>
          <div class="kv-row"><span>Base Invoice Amount</span><span>${formatAmount(payment.invoiceTotalAmount)}</span></div>
          <div class="kv-row"><span>Tax Additions</span><span>${formatAmount(payment.invoiceTaxAdditionAmount || 0)}</span></div>
          <div class="kv-row"><span>Tax Deductions</span><span>${formatAmount(payment.invoiceTaxDeductionAmount || 0)}</span></div>
          <div class="kv-row"><span>Gross Amount</span><span>${formatAmount(payment.invoiceGrossAmount || payment.invoiceTotalAmount)}</span></div>
          <div class="kv-row"><span>Net Payable Amount</span><span>${formatAmount(payment.invoiceNetPayableAmount || payment.invoiceTotalAmount)}</span></div>
          <div class="kv-row"><span>Amount Paid</span><span>${formatAmount(payment.invoiceAmountPaid)}</span></div>
          <div class="kv-row"><span>Outstanding Balance</span><span>${formatAmount(payment.invoiceBalanceAmount)}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Voucher Line Support</h2>
      <div class="muted">${payment.description}</div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Quantity</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
        <tfoot>
        <tr>
        <th>Base Invoice Amount</th>
        <th style="text-align:right;">${formatAmount(totalQuantity)}</th>
        <th></th>
        <th style="text-align:right;">${formatAmount(payment.invoiceTotalAmount)}</th>
      </tr>
      <tr>
        <th colspan="3" style="text-align:left;">Tax Additions</th>
        <th style="text-align:right;">${formatAmount(payment.invoiceTaxAdditionAmount || 0)}</th>
      </tr>
      <tr>
        <th colspan="3" style="text-align:left;">Tax Deductions</th>
        <th style="text-align:right;">${formatAmount(payment.invoiceTaxDeductionAmount || 0)}</th>
      </tr>
      <tr>
        <th colspan="3" style="text-align:left;">Net Payable Amount</th>
        <th style="text-align:right;">${formatAmount(payment.invoiceNetPayableAmount || payment.invoiceTotalAmount)}</th>
      </tr>
        </tfoot>
      </table>
    </div>

    <div class="section" style="margin-top:16px;">
      <h2>Approval / Audit Trail</h2>
      <div class="kv">
        <div class="kv-row"><span>Prepared On</span><span>${formatDateTime(payment.createdOnUtc)}</span></div>
        <div class="kv-row"><span>Prepared By</span><span>${payment.preparedByDisplayName || payment.createdByDisplayName || payment.createdBy || 'Not available'}</span></div>
        <div class="kv-row"><span>Last Modified On</span><span>${formatDateTime(payment.lastModifiedOnUtc)}</span></div>
        <div class="kv-row"><span>Last Modified By</span><span>${payment.lastModifiedByDisplayName || payment.lastModifiedBy || 'Not available'}</span></div>
        <div class="kv-row"><span>Approved On</span><span>${formatDateTime(payment.approvedOnUtc)}</span></div>
        <div class="kv-row"><span>Approved By</span><span>${payment.approvedByDisplayName || 'Pending workflow approval'}</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function VendorPaymentVoucherPrintPage() {
  const { vendorPaymentId } = useParams<{ vendorPaymentId: string }>();

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const paymentQ = useQuery({
    queryKey: ['ap-vendor-payment-detail', vendorPaymentId],
    queryFn: () => getVendorPaymentDetail(vendorPaymentId || ''),
    enabled: !!vendorPaymentId,
  });

  const totals = useMemo(() => {
    const lines = paymentQ.data?.payment.invoiceLines ?? [];
    return {
      quantity: lines.reduce((sum, x) => sum + Number(x.quantity || 0), 0),
      total: lines.reduce((sum, x) => sum + Number(x.lineTotal || 0), 0),
    };
  }, [paymentQ.data?.payment.invoiceLines]);

  function printVoucher() {
    if (!paymentQ.data) return;

    const html = buildVoucherPrintHtml({
      tenantKey,
      tenantLogo,
      companyLogo,
      data: paymentQ.data,
    });

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  if (!vendorPaymentId) {
    return <div className="panel error-panel">Vendor payment identifier is required.</div>;
  }

  if (paymentQ.isLoading) {
    return <div className="panel">Loading vendor payment voucher...</div>;
  }

  if (paymentQ.isError || !paymentQ.data) {
    return <div className="panel error-panel">We could not load the vendor payment voucher at this time.</div>;
  }

  const payment = paymentQ.data.payment;

  return (
    <div className="page-grid">
      <section className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Vendor Payment Voucher</h2>
            <span className="muted">{payment.paymentNumber}</span>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={printVoucher}>
              Print Voucher
            </button>
          </div>
        </div>

        <div className="print-report-header">
          <div className="print-report-brand-row">
            <div className="print-brand-block">
              {companyLogo ? (
                <img src={companyLogo} alt="iBalance" style={{ height: 48, maxWidth: 180, objectFit: 'contain' }} />
              ) : (
                <div
                  style={{
                    minWidth: 48,
                    height: 48,
                    borderRadius: 12,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(75, 29, 115, 0.12)',
                    fontWeight: 700,
                  }}
                >
                  iBalance
                </div>
              )}
              <div className="print-brand-meta">
                <strong>Nikosoft Technologies</strong>
                <span>iBalance Accounting Cloud</span>
              </div>
            </div>

            <div className="print-brand-block">
              {tenantLogo ? (
                <img src={tenantLogo} alt="Org" style={{ height: 48, maxWidth: 180, objectFit: 'contain' }} />
              ) : (
                <div
                  style={{
                    minWidth: 48,
                    height: 48,
                    borderRadius: 12,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(75, 29, 115, 0.12)',
                    fontWeight: 700,
                  }}
                >
                  Org
                </div>
              )}
              <div className="print-brand-meta">
                <strong>{tenantKey || 'Organization'}</strong>
                <span>Client Workspace</span>
              </div>
            </div>
          </div>

          <div className="print-report-title-block">
            <h2>Vendor Payment Voucher</h2>
            <div className="muted">Voucher No: {payment.paymentNumber}</div>
          </div>
        </div>

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row"><span>Voucher Number</span><span>{payment.paymentNumber}</span></div>
          <div className="kv-row"><span>Payment Date</span><span>{formatDateTime(payment.paymentDateUtc)}</span></div>
          <div className="kv-row"><span>Status</span><span>{vendorPaymentStatusLabel(payment.status)}</span></div>
          <div className="kv-row"><span>Payment Amount</span><span>{formatAmount(payment.amount)}</span></div>
          <div className="kv-row"><span>Posted On</span><span>{formatDateTime(payment.postedOnUtc)}</span></div>
          <div className="kv-row"><span>Journal Entry</span><span>{formatJournalEntry(payment)}</span></div>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <section className="panel" style={{ margin: 0 }}>
            <div className="section-heading">
              <h2>Vendor Details</h2>
            </div>

            <div className="kv">
              <div className="kv-row"><span>Vendor</span><span>{payment.vendorCode} - {payment.vendorName}</span></div>
              <div className="kv-row"><span>Email</span><span>{payment.vendorEmail || 'Not available'}</span></div>
              <div className="kv-row"><span>Phone Number</span><span>{payment.vendorPhoneNumber || 'Not available'}</span></div>
              <div className="kv-row"><span>Billing Address</span><span>{payment.vendorBillingAddress || 'Not available'}</span></div>
            </div>
          </section>

          <section className="panel" style={{ margin: 0 }}>
            <div className="section-heading">
              <h2>Invoice Details</h2>
            </div>

            <div className="kv">
              <div className="kv-row"><span>Invoice Number</span><span>{payment.invoiceNumber}</span></div>
              <div className="kv-row"><span>Invoice Date</span><span>{formatDateTime(payment.invoiceDateUtc)}</span></div>
              <div className="kv-row"><span>Description</span><span>{payment.invoiceDescription}</span></div>
              <div className="kv-row"><span>Base Invoice Amount</span><span>{formatAmount(payment.invoiceTotalAmount)}</span></div>
              <div className="kv-row"><span>Tax Additions</span><span>{formatAmount(payment.invoiceTaxAdditionAmount || 0)}</span></div>
              <div className="kv-row"><span>Tax Deductions</span><span>{formatAmount(payment.invoiceTaxDeductionAmount || 0)}</span></div>
              <div className="kv-row"><span>Gross Amount</span><span>{formatAmount(payment.invoiceGrossAmount || payment.invoiceTotalAmount)}</span></div>
              <div className="kv-row"><span>Net Payable Amount</span><span>{formatAmount(payment.invoiceNetPayableAmount || payment.invoiceTotalAmount)}</span></div>
              <div className="kv-row"><span>Amount Paid</span><span>{formatAmount(payment.invoiceAmountPaid)}</span></div>
              <div className="kv-row"><span>Outstanding Balance</span><span>{formatAmount(payment.invoiceBalanceAmount)}</span></div>
            </div>
          </section>
        </div>

        <section className="panel" style={{ margin: 0 }}>
          <div className="section-heading">
            <div>
              <h2>Voucher Line Support</h2>
              <div className="muted">{payment.description}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table report-print-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {payment.invoiceLines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No invoice lines are available for this payment voucher.
                    </td>
                  </tr>
                ) : (
                  payment.invoiceLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.quantity)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
              <tr>
                    <th>Base Invoice Amount</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(totals.quantity)}</th>
                    <th />
                    <th style={{ textAlign: 'right' }}>{formatAmount(payment.invoiceTotalAmount)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3}>Tax Additions</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(payment.invoiceTaxAdditionAmount || 0)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3}>Tax Deductions</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(payment.invoiceTaxDeductionAmount || 0)}</th>
                  </tr>
                  <tr>
                    <th colSpan={3}>Net Payable Amount</th>
                    <th style={{ textAlign: 'right' }}>
                      {formatAmount(payment.invoiceNetPayableAmount || payment.invoiceTotalAmount)}
                    </th>
                  </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <div className="section-heading">
            <h2>Approval / Audit Trail</h2>
          </div>

          <div className="kv">
            <div className="kv-row"><span>Prepared On</span><span>{formatDateTime(payment.createdOnUtc)}</span></div>
            <div className="kv-row"><span>Prepared By</span><span>{payment.preparedByDisplayName || payment.createdByDisplayName || payment.createdBy || 'Not available'}</span></div>
            <div className="kv-row"><span>Last Modified On</span><span>{formatDateTime(payment.lastModifiedOnUtc)}</span></div>
            <div className="kv-row"><span>Last Modified By</span><span>{payment.lastModifiedByDisplayName || payment.lastModifiedBy || 'Not available'}</span></div>
            <div className="kv-row"><span>Approved On</span><span>{formatDateTime(payment.approvedOnUtc)}</span></div>
            <div className="kv-row"><span>Approved By</span><span>{payment.approvedByDisplayName || 'Pending workflow approval'}</span></div>
          </div>
        </section>
      </section>
    </div>
  );
}