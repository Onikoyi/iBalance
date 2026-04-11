import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCompanyLogoDataUrl,
  getCustomerReceiptDetail,
  getTenantKey,
  getTenantLogoDataUrl,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

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
      return 'Posted';
    case 3:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

function buildReceiptHtml(args: {
  companyLogo: string;
  tenantLogo: string;
  tenantKey: string;
  receipt: {
    receiptNumber: string;
    receiptDateUtc: string;
    status: number;
    amount: number;
    description: string;
    postedOnUtc?: string | null;
    customerCode: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhoneNumber?: string | null;
    customerBillingAddress?: string | null;
    invoiceNumber: string;
    invoiceDateUtc?: string | null;
    invoiceDescription: string;
    invoiceTotalAmount: number;
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    invoiceLines: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  };
}) {
  const { companyLogo, tenantLogo, tenantKey, receipt } = args;

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:48px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;font-size:18px;">${fallback.slice(0, 1).toUpperCase()}</div>`;

  const linesHtml = receipt.invoiceLines.length === 0
    ? `<div style="color:#6b7280;">No invoice line items are available.</div>`
    : `
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #d1d5db;padding:8px;">Description</th>
            <th style="text-align:right;border-bottom:1px solid #d1d5db;padding:8px;">Quantity</th>
            <th style="text-align:right;border-bottom:1px solid #d1d5db;padding:8px;">Unit Price</th>
            <th style="text-align:right;border-bottom:1px solid #d1d5db;padding:8px;">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.invoiceLines.map((line) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${line.description}</td>
              <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatAmount(line.quantity)}</td>
              <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatAmount(line.unitPrice)}</td>
              <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatAmount(line.lineTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="3" style="padding:8px;text-align:left;border-top:1px solid #d1d5db;">Invoice Total</th>
            <th style="padding:8px;text-align:right;border-top:1px solid #d1d5db;">${formatAmount(receipt.invoiceTotalAmount)}</th>
          </tr>
        </tfoot>
      </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Customer Receipt - ${receipt.receiptNumber}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
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
      margin-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }

    .title-block h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
    }

    .subtitle {
      color: #6b7280;
      font-size: 14px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section h2 {
      margin: 0 0 12px 0;
      font-size: 18px;
    }

    .kv {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
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

    .kv-row span:first-child {
      color: #6b7280;
    }

    .totals {
      margin-top: 24px;
      padding: 16px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: #fafafa;
      display: grid;
      gap: 8px;
      font-weight: 600;
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
        ${logoOrFallback(tenantLogo, 'Organization')}
        <div class="brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="title-block">
      <h1>Official Customer Receipt</h1>
      <div class="subtitle">Receipt acknowledgement for posted customer payment</div>
    </div>

    <div class="section">
      <h2>Receipt Details</h2>
      <div class="kv">
        <div class="kv-row"><span>Receipt Number</span><span>${receipt.receiptNumber}</span></div>
        <div class="kv-row"><span>Receipt Date</span><span>${formatUtcDate(receipt.receiptDateUtc)}</span></div>
        <div class="kv-row"><span>Status</span><span>${receiptStatusLabel(receipt.status)}</span></div>
        <div class="kv-row"><span>Amount Received</span><span>${formatAmount(receipt.amount)}</span></div>
        <div class="kv-row"><span>Description</span><span>${receipt.description}</span></div>
        <div class="kv-row"><span>Posted On</span><span>${formatUtcDate(receipt.postedOnUtc)}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Customer Information</h2>
      <div class="kv">
        <div class="kv-row"><span>Customer Code</span><span>${receipt.customerCode}</span></div>
        <div class="kv-row"><span>Customer Name</span><span>${receipt.customerName}</span></div>
        <div class="kv-row"><span>Email</span><span>${receipt.customerEmail || '—'}</span></div>
        <div class="kv-row"><span>Phone Number</span><span>${receipt.customerPhoneNumber || '—'}</span></div>
        <div class="kv-row"><span>Billing Address</span><span>${receipt.customerBillingAddress || '—'}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Related Invoice</h2>
      <div class="kv">
        <div class="kv-row"><span>Invoice Number</span><span>${receipt.invoiceNumber}</span></div>
        <div class="kv-row"><span>Invoice Date</span><span>${formatUtcDate(receipt.invoiceDateUtc)}</span></div>
        <div class="kv-row"><span>Invoice Description</span><span>${receipt.invoiceDescription}</span></div>
        <div class="kv-row"><span>Invoice Total</span><span>${formatAmount(receipt.invoiceTotalAmount)}</span></div>
        <div class="kv-row"><span>Total Paid</span><span>${formatAmount(receipt.invoiceAmountPaid)}</span></div>
        <div class="kv-row"><span>Outstanding Balance</span><span>${formatAmount(receipt.invoiceBalanceAmount)}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Invoice Line Items</h2>
      ${linesHtml}
    </div>

    <div class="totals">
      <div>Receipt Number: ${receipt.receiptNumber}</div>
      <div>Amount Received: ${formatAmount(receipt.amount)}</div>
      <div>Customer: ${receipt.customerName}</div>
      <div>Invoice: ${receipt.invoiceNumber}</div>
    </div>
  </div>
</body>
</html>`;
}

export function CustomerReceiptPrintPage() {
  const { customerReceiptId } = useParams<{ customerReceiptId: string }>();
  const canView = canViewFinance();

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const receiptQ = useQuery({
    queryKey: ['ar-customer-receipt-detail', customerReceiptId],
    queryFn: () => getCustomerReceiptDetail(customerReceiptId || ''),
    enabled: canView && !!customerReceiptId,
  });

  function printReceipt() {
    if (!receiptQ.data) {
      return;
    }

    const receipt = receiptQ.data.receipt;
    const html = buildReceiptHtml({
      companyLogo,
      tenantLogo,
      tenantKey,
      receipt,
    });

    const printWindow = window.open('', '_blank', 'width=1000,height=900');

    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  if (!canView) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Customer Receipt</h2>
            <span className="muted">Access restricted</span>
          </div>
          <div className="muted">
            You do not have permission to view customer receipt details.
          </div>
        </section>
      </div>
    );
  }

  if (receiptQ.isLoading) {
    return <div className="panel">Loading customer receipt...</div>;
  }

  if (receiptQ.isError || !receiptQ.data) {
    return <div className="panel error-panel">We could not load the customer receipt at this time.</div>;
  }

  const receipt = receiptQ.data.receipt;

  return (
    <div className="page-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Customer Receipt</h2>
            <div className="muted">Printable customer acknowledgement and receipt detail</div>
          </div>

          <div className="inline-actions">
            <Link to="/customer-receipts" className="button">
              Back to Receipts
            </Link>
            <button className="button primary" onClick={printReceipt}>
              Print Receipt
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Receipt Preview</h2>
          <span className="muted">Use the print button to generate the formal receipt document.</span>
        </div>

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Receipt Number</span>
            <span>{receipt.receiptNumber}</span>
          </div>
          <div className="kv-row">
            <span>Customer</span>
            <span>{receipt.customerName}</span>
          </div>
          <div className="kv-row">
            <span>Invoice</span>
            <span>{receipt.invoiceNumber}</span>
          </div>
          <div className="kv-row">
            <span>Amount Received</span>
            <span>{formatAmount(receipt.amount)}</span>
          </div>
          <div className="kv-row">
            <span>Status</span>
            <span>{receiptStatusLabel(receipt.status)}</span>
          </div>
          <div className="kv-row">
            <span>Posted On</span>
            <span>{formatUtcDate(receipt.postedOnUtc)}</span>
          </div>
        </div>

        <div className="report-block">
          <h3>Customer Information</h3>
          <div className="kv">
            <div className="kv-row">
              <span>Customer Code</span>
              <span>{receipt.customerCode}</span>
            </div>
            <div className="kv-row">
              <span>Customer Name</span>
              <span>{receipt.customerName}</span>
            </div>
            <div className="kv-row">
              <span>Email</span>
              <span>{receipt.customerEmail || '—'}</span>
            </div>
            <div className="kv-row">
              <span>Phone Number</span>
              <span>{receipt.customerPhoneNumber || '—'}</span>
            </div>
            <div className="kv-row">
              <span>Billing Address</span>
              <span>{receipt.customerBillingAddress || '—'}</span>
            </div>
          </div>
        </div>

        <div className="report-block">
          <h3>Related Invoice</h3>
          <div className="kv">
            <div className="kv-row">
              <span>Invoice Number</span>
              <span>{receipt.invoiceNumber}</span>
            </div>
            <div className="kv-row">
              <span>Invoice Date</span>
              <span>{formatUtcDate(receipt.invoiceDateUtc)}</span>
            </div>
            <div className="kv-row">
              <span>Invoice Description</span>
              <span>{receipt.invoiceDescription}</span>
            </div>
            <div className="kv-row">
              <span>Invoice Total</span>
              <span>{formatAmount(receipt.invoiceTotalAmount)}</span>
            </div>
            <div className="kv-row">
              <span>Total Paid</span>
              <span>{formatAmount(receipt.invoiceAmountPaid)}</span>
            </div>
            <div className="kv-row">
              <span>Outstanding Balance</span>
              <span>{formatAmount(receipt.invoiceBalanceAmount)}</span>
            </div>
          </div>
        </div>

        <div className="report-block">
          <h3>Invoice Line Items</h3>

          {receipt.invoiceLines.length === 0 ? (
            <div className="muted">No invoice line items are available.</div>
          ) : (
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
                  {receipt.invoiceLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.quantity)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.unitPrice)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Invoice Total</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(receipt.invoiceTotalAmount)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="report-totals">
          <div>Receipt Number: {receipt.receiptNumber}</div>
          <div>Amount Received: {formatAmount(receipt.amount)}</div>
          <div>Customer: {receipt.customerName}</div>
          <div>Invoice: {receipt.invoiceNumber}</div>
        </div>
      </section>
    </div>
  );
}