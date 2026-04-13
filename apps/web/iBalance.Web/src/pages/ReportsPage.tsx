import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBalanceSheet,
  getCompanyLogoDataUrl,
  getCustomerReceipts,
  getIncomeStatement,
  getPurchaseInvoices,
  getSalesInvoices,
  getTenantKey,
  getTenantLogoDataUrl,
  getTrialBalance,
  getVendorPayments,
} from '../lib/api';
import { canViewReports } from '../lib/auth';

function toUtcStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toUtcEnd(date: string) {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatDisplayDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildReportingPeriodText(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) {
    return 'Reporting Period: Select From Date and To Date';
  }

  return `Reporting Period: ${formatDisplayDate(`${fromDate}T00:00:00`)} to ${formatDisplayDate(`${toDate}T00:00:00`)}`;
}

function buildAsAtText(asAtDate: string) {
  return `As At: ${formatDisplayDate(`${asAtDate}T00:00:00`)}`;
}

function invoiceStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Part Paid';
    case 4: return 'Paid';
    case 5: return 'Cancelled';
    default: return 'Unknown';
  }
}

function receiptStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Cancelled';
    default: return 'Unknown';
  }
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

function LogoSlot({
  dataUrl,
  fallbackText,
}: {
  dataUrl: string;
  fallbackText: string;
}) {
  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={fallbackText}
        style={{ height: 42, maxWidth: 180, objectFit: 'contain' }}
      />
    );
  }

  return (
    <div className="print-logo-fallback">
      {fallbackText}
    </div>
  );
}

type ReportHeaderProps = {
  title: string;
  subtitle: string;
};

function ReportPrintHeader({ title, subtitle }: ReportHeaderProps) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  return (
    <div className="print-report-header">
      <div className="print-report-brand-row">
        <div className="print-brand-block">
          <LogoSlot dataUrl={companyLogo} fallbackText="iBalance" />
          <div className="print-brand-meta">
            <strong>Nikosoft Technologies</strong>
            <span>iBalance Accounting Cloud</span>
          </div>
        </div>

        <div className="print-brand-block">
          <LogoSlot dataUrl={tenantLogo} fallbackText="Organization" />
          <div className="print-brand-meta">
            <strong>{tenantKey || 'Organization'}</strong>
            <span>Client Workspace</span>
          </div>
        </div>
      </div>

      <div className="print-report-title-block">
        <h2>{title}</h2>
        <div className="muted">{subtitle}</div>
      </div>
    </div>
  );
}

function buildStandaloneHtml(args: {
  title: string;
  subtitle: string;
  bodyHtml: string;
}) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:42px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${args.title}</title>
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

    .print-report-brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .print-brand-block {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .print-brand-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .print-brand-meta strong {
      font-size: 15px;
    }

    .print-brand-meta span {
      font-size: 12px;
      color: #6b7280;
    }

    .print-report-title-block {
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }

    .print-report-title-block h2 {
      margin: 0 0 8px 0;
      font-size: 26px;
    }

    .muted {
      color: #6b7280;
      font-size: 14px;
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

    .report-block {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .report-block h3 {
      margin: 0 0 12px 0;
    }

    .report-line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .report-line:last-child {
      border-bottom: none;
    }

    .report-totals {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-weight: 600;
    }

    .table-wrap {
      overflow: visible;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    .data-table th,
    .data-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      vertical-align: top;
    }

    .data-table tfoot th,
    .data-table tfoot td {
      border-top: 1px solid #d1d5db;
      border-bottom: none;
      font-weight: 700;
    }

    .right {
      text-align: right;
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
    <div class="print-report-brand-row">
      <div class="print-brand-block">
        ${logoOrFallback(companyLogo, 'iBalance')}
        <div class="print-brand-meta">
          <strong>Nikosoft Technologies</strong>
          <span>iBalance Accounting Cloud</span>
        </div>
      </div>

      <div class="print-brand-block">
        ${logoOrFallback(tenantLogo, 'Org')}
        <div class="print-brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="print-report-title-block">
      <h2>${args.title}</h2>
      <div class="muted">${args.subtitle}</div>
    </div>

    ${args.bodyHtml}
  </div>
</body>
</html>`;
}

export function ReportsPage() {
  const today = new Date();
  const defaultToDate = today.toISOString().slice(0, 10);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultFromDate = new Date(
    Date.UTC(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate())
  ).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [balanceSheetAsAtDate, setBalanceSheetAsAtDate] = useState(defaultToDate);

  const canView = canViewReports();

  const isPeriodRangeValid = !!fromDate && !!toDate;
  const periodText = buildReportingPeriodText(fromDate, toDate);
  const asAtText = buildAsAtText(balanceSheetAsAtDate);

  const fromUtc = isPeriodRangeValid ? toUtcStart(fromDate) : undefined;
  const toUtc = isPeriodRangeValid ? toUtcEnd(toDate) : undefined;

  const trialBalance = useQuery({
    queryKey: ['trial-balance', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getTrialBalance(fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });

  const balanceSheet = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: () => getBalanceSheet(),
    enabled: canView,
  });

  const incomeStatement = useQuery({
    queryKey: ['income-statement', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getIncomeStatement(fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });

  const salesInvoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  const customerReceiptsQ = useQuery({
    queryKey: ['ar-customer-receipts'],
    queryFn: getCustomerReceipts,
    enabled: canView,
  });

  const purchaseInvoicesQ = useQuery({
    queryKey: ['ap-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  const vendorPaymentsQ = useQuery({
    queryKey: ['ap-vendor-payments'],
    queryFn: getVendorPayments,
    enabled: canView,
  });

  const filteredSalesInvoices = useMemo(() => {
    const items = salesInvoicesQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const invoiceDate = new Date(item.invoiceDateUtc).getTime();
      return invoiceDate >= from && invoiceDate <= to;
    });
  }, [salesInvoicesQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredCustomerReceipts = useMemo(() => {
    const items = customerReceiptsQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const receiptDate = new Date(item.receiptDateUtc).getTime();
      return receiptDate >= from && receiptDate <= to;
    });
  }, [customerReceiptsQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredPurchaseInvoices = useMemo(() => {
    const items = purchaseInvoicesQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const invoiceDate = new Date(item.invoiceDateUtc).getTime();
      return invoiceDate >= from && invoiceDate <= to;
    });
  }, [purchaseInvoicesQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredVendorPayments = useMemo(() => {
    const items = vendorPaymentsQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const paymentDate = new Date(item.paymentDateUtc).getTime();
      return paymentDate >= from && paymentDate <= to;
    });
  }, [vendorPaymentsQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const arSummary = useMemo(() => {
    const invoices = filteredSalesInvoices;
    const receipts = filteredCustomerReceipts;

    return {
      totalInvoices: invoices.length,
      totalInvoiced: invoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      totalCollected: invoices.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0),
      totalOutstanding: invoices.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0),
      draftInvoiceCount: invoices.filter((item) => item.status === 1).length,
      postedInvoiceCount: invoices.filter((item) => item.status === 2).length,
      partPaidInvoiceCount: invoices.filter((item) => item.status === 3).length,
      paidInvoiceCount: invoices.filter((item) => item.status === 4).length,
      cancelledInvoiceCount: invoices.filter((item) => item.status === 5).length,
      totalReceipts: receipts.length,
      totalReceiptAmount: receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      draftReceiptCount: receipts.filter((item) => item.status === 1).length,
      postedReceiptCount: receipts.filter((item) => item.status === 2).length,
      cancelledReceiptCount: receipts.filter((item) => item.status === 3).length,
    };
  }, [filteredSalesInvoices, filteredCustomerReceipts]);

  const apSummary = useMemo(() => {
    const invoices = filteredPurchaseInvoices;
    const payments = filteredVendorPayments;

    return {
      totalInvoices: invoices.length,
      totalInvoiced: invoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      totalPaid: invoices.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0),
      totalOutstanding: invoices.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0),
      draftInvoiceCount: invoices.filter((item) => item.status === 1).length,
      postedInvoiceCount: invoices.filter((item) => item.status === 2).length,
      partPaidInvoiceCount: invoices.filter((item) => item.status === 3).length,
      paidInvoiceCount: invoices.filter((item) => item.status === 4).length,
      cancelledInvoiceCount: invoices.filter((item) => item.status === 5).length,
      totalPayments: payments.length,
      totalPaymentAmount: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      draftPaymentCount: payments.filter((item) => item.status === 1).length,
      submittedPaymentCount: payments.filter((item) => item.status === 2).length,
      approvedPaymentCount: payments.filter((item) => item.status === 3).length,
      rejectedPaymentCount: payments.filter((item) => item.status === 4).length,
      postedPaymentCount: payments.filter((item) => item.status === 5).length,
      cancelledPaymentCount: payments.filter((item) => item.status === 6).length,
    };
  }, [filteredPurchaseInvoices, filteredVendorPayments]);

  function openStandalonePrint(html: string) {
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

  function printTrialBalanceStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Accounts Included</span><span>${trialBalance.data?.count ?? 0}</span></div>
        <div class="kv-row"><span>Total Debit</span><span>${formatAmount(trialBalance.data?.totalDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Credit</span><span>${formatAmount(trialBalance.data?.totalCredit ?? 0)}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th class="right">Total Debit</th>
              <th class="right">Total Credit</th>
              <th class="right">Balance Debit</th>
              <th class="right">Balance Credit</th>
            </tr>
          </thead>
          <tbody>
            ${(trialBalance.data?.items ?? []).map((item) => `
              <tr>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td class="right">${formatAmount(item.totalDebit)}</td>
                <td class="right">${formatAmount(item.totalCredit)}</td>
                <td class="right">${formatAmount(item.balanceDebit)}</td>
                <td class="right">${formatAmount(item.balanceCredit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2">Total</th>
              <th class="right">${formatAmount(trialBalance.data?.totalDebit ?? 0)}</th>
              <th class="right">${formatAmount(trialBalance.data?.totalCredit ?? 0)}</th>
              <th></th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Trial Balance',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printBalanceSheetStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>As At</span><span>${asAtText.replace('As At: ', '')}</span></div>
        <div class="kv-row"><span>Total Assets</span><span>${formatAmount(balanceSheet.data?.totalAssets ?? 0)}</span></div>
        <div class="kv-row"><span>Total Liabilities</span><span>${formatAmount(balanceSheet.data?.totalLiabilities ?? 0)}</span></div>
        <div class="kv-row"><span>Total Equity</span><span>${formatAmount(balanceSheet.data?.totalEquity ?? 0)}</span></div>
        <div class="kv-row"><span>Total Liabilities and Equity</span><span>${formatAmount(balanceSheet.data?.totalLiabilitiesAndEquity ?? 0)}</span></div>
      </div>

      <div class="report-block">
        <h3>Assets</h3>
        ${(balanceSheet.data?.assets ?? []).length === 0
          ? '<div class="muted">No asset balances available.</div>'
          : (balanceSheet.data?.assets ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Liabilities</h3>
        ${(balanceSheet.data?.liabilities ?? []).length === 0
          ? '<div class="muted">No liability balances available.</div>'
          : (balanceSheet.data?.liabilities ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Equity</h3>
        ${(balanceSheet.data?.equity ?? []).length === 0
          ? '<div class="muted">No equity balances available.</div>'
          : (balanceSheet.data?.equity ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-totals">
        <div>${asAtText}</div>
        <div>Total Assets: ${formatAmount(balanceSheet.data?.totalAssets ?? 0)}</div>
        <div>Total Liabilities: ${formatAmount(balanceSheet.data?.totalLiabilities ?? 0)}</div>
        <div>Total Equity: ${formatAmount(balanceSheet.data?.totalEquity ?? 0)}</div>
        <div>Total Liabilities and Equity: ${formatAmount(balanceSheet.data?.totalLiabilitiesAndEquity ?? 0)}</div>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Balance Sheet',
      subtitle: asAtText,
      bodyHtml,
    }));
  }

  function printIncomeStatementStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Income</span><span>${formatAmount(incomeStatement.data?.totalIncome ?? 0)}</span></div>
        <div class="kv-row"><span>Total Expenses</span><span>${formatAmount(incomeStatement.data?.totalExpenses ?? 0)}</span></div>
        <div class="kv-row"><span>Net Income</span><span>${formatAmount(incomeStatement.data?.netIncome ?? 0)}</span></div>
      </div>

      <div class="report-block">
        <h3>Income</h3>
        ${(incomeStatement.data?.income ?? []).length === 0
          ? '<div class="muted">No income balances available.</div>'
          : (incomeStatement.data?.income ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.amount ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Expenses</h3>
        ${(incomeStatement.data?.expenses ?? []).length === 0
          ? '<div class="muted">No expense balances available.</div>'
          : (incomeStatement.data?.expenses ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.amount ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-totals">
        <div>${periodText}</div>
        <div>Total Income: ${formatAmount(incomeStatement.data?.totalIncome ?? 0)}</div>
        <div>Total Expenses: ${formatAmount(incomeStatement.data?.totalExpenses ?? 0)}</div>
        <div>Net Income: ${formatAmount(incomeStatement.data?.netIncome ?? 0)}</div>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Income Statement',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printReceivablesSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Invoices</span><span>${arSummary.totalInvoices}</span></div>
        <div class="kv-row"><span>Total Invoiced</span><span>${formatAmount(arSummary.totalInvoiced)}</span></div>
        <div class="kv-row"><span>Total Collected</span><span>${formatAmount(arSummary.totalCollected)}</span></div>
        <div class="kv-row"><span>Total Outstanding</span><span>${formatAmount(arSummary.totalOutstanding)}</span></div>
        <div class="kv-row"><span>Draft Invoices</span><span>${arSummary.draftInvoiceCount}</span></div>
        <div class="kv-row"><span>Posted Invoices</span><span>${arSummary.postedInvoiceCount}</span></div>
        <div class="kv-row"><span>Part Paid Invoices</span><span>${arSummary.partPaidInvoiceCount}</span></div>
        <div class="kv-row"><span>Paid Invoices</span><span>${arSummary.paidInvoiceCount}</span></div>
        <div class="kv-row"><span>Cancelled Invoices</span><span>${arSummary.cancelledInvoiceCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Customer</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Total Amount</th>
              <th class="right">Amount Paid</th>
              <th class="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSalesInvoices.map((item) => `
              <tr>
                <td>${item.invoiceNumber}</td>
                <td>${item.customerCode} - ${item.customerName}</td>
                <td>${item.description}</td>
                <td>${invoiceStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.totalAmount)}</td>
                <td class="right">${formatAmount(item.amountPaid)}</td>
                <td class="right">${formatAmount(item.balanceAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4">Total</th>
              <th class="right">${formatAmount(arSummary.totalInvoiced)}</th>
              <th class="right">${formatAmount(arSummary.totalCollected)}</th>
              <th class="right">${formatAmount(arSummary.totalOutstanding)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Accounts Receivable Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printCustomerReceiptsSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Receipts</span><span>${arSummary.totalReceipts}</span></div>
        <div class="kv-row"><span>Total Receipt Amount</span><span>${formatAmount(arSummary.totalReceiptAmount)}</span></div>
        <div class="kv-row"><span>Draft Receipts</span><span>${arSummary.draftReceiptCount}</span></div>
        <div class="kv-row"><span>Posted Receipts</span><span>${arSummary.postedReceiptCount}</span></div>
        <div class="kv-row"><span>Cancelled Receipts</span><span>${arSummary.cancelledReceiptCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt Number</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Amount</th>
              <th>Receipt Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCustomerReceipts.map((item) => `
              <tr>
                <td>${item.receiptNumber}</td>
                <td>${item.customerCode} - ${item.customerName}</td>
                <td>${item.invoiceNumber}</td>
                <td>${item.description}</td>
                <td>${receiptStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.amount)}</td>
                <td>${formatDateTime(item.receiptDateUtc)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Total</th>
              <th class="right">${formatAmount(arSummary.totalReceiptAmount)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Customer Receipts Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printPayablesSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Purchase Invoices</span><span>${apSummary.totalInvoices}</span></div>
        <div class="kv-row"><span>Total Invoiced</span><span>${formatAmount(apSummary.totalInvoiced)}</span></div>
        <div class="kv-row"><span>Total Paid</span><span>${formatAmount(apSummary.totalPaid)}</span></div>
        <div class="kv-row"><span>Total Outstanding</span><span>${formatAmount(apSummary.totalOutstanding)}</span></div>
        <div class="kv-row"><span>Draft Invoices</span><span>${apSummary.draftInvoiceCount}</span></div>
        <div class="kv-row"><span>Posted Invoices</span><span>${apSummary.postedInvoiceCount}</span></div>
        <div class="kv-row"><span>Part Paid Invoices</span><span>${apSummary.partPaidInvoiceCount}</span></div>
        <div class="kv-row"><span>Paid Invoices</span><span>${apSummary.paidInvoiceCount}</span></div>
        <div class="kv-row"><span>Cancelled Invoices</span><span>${apSummary.cancelledInvoiceCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Total Amount</th>
              <th class="right">Amount Paid</th>
              <th class="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPurchaseInvoices.map((item) => `
              <tr>
                <td>${item.invoiceNumber}</td>
                <td>${item.vendorCode} - ${item.vendorName}</td>
                <td>${item.description}</td>
                <td>${purchaseInvoiceStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.totalAmount)}</td>
                <td class="right">${formatAmount(item.amountPaid)}</td>
                <td class="right">${formatAmount(item.balanceAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4">Total</th>
              <th class="right">${formatAmount(apSummary.totalInvoiced)}</th>
              <th class="right">${formatAmount(apSummary.totalPaid)}</th>
              <th class="right">${formatAmount(apSummary.totalOutstanding)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Accounts Payable Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printVendorPaymentsSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Payments</span><span>${apSummary.totalPayments}</span></div>
        <div class="kv-row"><span>Total Payment Amount</span><span>${formatAmount(apSummary.totalPaymentAmount)}</span></div>
        <div class="kv-row"><span>Draft Payments</span><span>${apSummary.draftPaymentCount}</span></div>
        <div class="kv-row"><span>Submitted for Approval</span><span>${apSummary.submittedPaymentCount}</span></div>
        <div class="kv-row"><span>Approved Payments</span><span>${apSummary.approvedPaymentCount}</span></div>
        <div class="kv-row"><span>Rejected Payments</span><span>${apSummary.rejectedPaymentCount}</span></div>
        <div class="kv-row"><span>Posted Payments</span><span>${apSummary.postedPaymentCount}</span></div>
        <div class="kv-row"><span>Cancelled Payments</span><span>${apSummary.cancelledPaymentCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Payment Number</th>
              <th>Vendor</th>
              <th>Invoice</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Amount</th>
              <th>Payment Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredVendorPayments.map((item) => `
              <tr>
                <td>${item.paymentNumber}</td>
                <td>${item.vendorCode} - ${item.vendorName}</td>
                <td>${item.invoiceNumber}</td>
                <td>${item.description}</td>
                <td>${vendorPaymentStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.amount)}</td>
                <td>${formatDateTime(item.paymentDateUtc)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Total</th>
              <th class="right">${formatAmount(apSummary.totalPaymentAmount)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Vendor Payments Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view financial reports.</div>;
  }

  if (
    trialBalance.isLoading ||
    balanceSheet.isLoading ||
    incomeStatement.isLoading ||
    salesInvoicesQ.isLoading ||
    customerReceiptsQ.isLoading ||
    purchaseInvoicesQ.isLoading ||
    vendorPaymentsQ.isLoading
  ) {
    return <div className="panel">Loading financial reports...</div>;
  }

  if (
    trialBalance.error ||
    balanceSheet.error ||
    incomeStatement.error ||
    salesInvoicesQ.error ||
    customerReceiptsQ.error ||
    purchaseInvoicesQ.error ||
    vendorPaymentsQ.error ||
    !trialBalance.data ||
    !balanceSheet.data ||
    !incomeStatement.data ||
    !salesInvoicesQ.data ||
    !customerReceiptsQ.data ||
    !purchaseInvoicesQ.data ||
    !vendorPaymentsQ.data
  ) {
    return <div className="panel error-panel">We could not load the financial reports at this time.</div>;
  }

  return (
    <div className="reports-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Report filters</h2>
            <div className="muted">
              All period-sensitive reports are driven by the selected From Date and To Date. Point-in-time reports carry an As At date.
            </div>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>From Date</label>
            <input
              type="date"
              className="input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input
              type="date"
              className="input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Balance Sheet As At Date</label>
            <input
              type="date"
              className="input"
              value={balanceSheetAsAtDate}
              onChange={(e) => setBalanceSheetAsAtDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Current Period In Focus</label>
            <div className="panel" style={{ margin: 0, padding: 12 }}>
              <div className="muted">{periodText}</div>
              <div className="muted" style={{ marginTop: 8 }}>{asAtText}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="print-trial-balance" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Trial Balance</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printTrialBalanceStandalone}>
            Print Trial Balance
          </button>
        </div>

        <ReportPrintHeader title="Trial Balance" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Accounts Included</span>
            <span>{trialBalance.data.count}</span>
          </div>
          <div className="kv-row">
            <span>Total Debit</span>
            <span>{formatAmount(trialBalance.data.totalDebit)}</span>
          </div>
          <div className="kv-row">
            <span>Total Credit</span>
            <span>{formatAmount(trialBalance.data.totalCredit)}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th style={{ textAlign: 'right' }}>Total Debit</th>
                <th style={{ textAlign: 'right' }}>Total Credit</th>
                <th style={{ textAlign: 'right' }}>Balance Debit</th>
                <th style={{ textAlign: 'right' }}>Balance Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.data.items.map((item) => (
                <tr key={item.ledgerAccountId}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalCredit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceCredit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(trialBalance.data.totalDebit)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(trialBalance.data.totalCredit)}</th>
                <th />
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section id="print-balance-sheet" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Balance Sheet</h2>
            <span className="muted">{asAtText}</span>
          </div>
          <button className="button" onClick={printBalanceSheetStandalone}>
            Print Balance Sheet
          </button>
        </div>

        <ReportPrintHeader title="Balance Sheet" subtitle={asAtText} />

        <div className="panel no-print" style={{ marginBottom: 16 }}>
          <div className="muted">{asAtText}</div>
        </div>

        <div className="report-block">
          <h3>Assets</h3>
          {balanceSheet.data.assets.length === 0 ? (
            <div className="muted">No asset balances available.</div>
          ) : (
            balanceSheet.data.assets.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Liabilities</h3>
          {balanceSheet.data.liabilities.length === 0 ? (
            <div className="muted">No liability balances available.</div>
          ) : (
            balanceSheet.data.liabilities.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Equity</h3>
          {balanceSheet.data.equity.length === 0 ? (
            <div className="muted">No equity balances available.</div>
          ) : (
            balanceSheet.data.equity.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-totals">
          <div>{asAtText}</div>
          <div>Total Assets: {formatAmount(balanceSheet.data.totalAssets)}</div>
          <div>Total Liabilities: {formatAmount(balanceSheet.data.totalLiabilities)}</div>
          <div>Total Equity: {formatAmount(balanceSheet.data.totalEquity)}</div>
          <div>Total Liabilities and Equity: {formatAmount(balanceSheet.data.totalLiabilitiesAndEquity)}</div>
        </div>
      </section>

      <section id="print-income-statement" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Income Statement</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printIncomeStatementStandalone}>
            Print Income Statement
          </button>
        </div>

        <ReportPrintHeader title="Income Statement" subtitle={periodText} />

        <div className="panel no-print" style={{ marginBottom: 16 }}>
          <div className="muted">{periodText}</div>
        </div>

        <div className="report-block">
          <h3>Income</h3>
          {incomeStatement.data.income.length === 0 ? (
            <div className="muted">No income balances available.</div>
          ) : (
            incomeStatement.data.income.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.amount ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Expenses</h3>
          {incomeStatement.data.expenses.length === 0 ? (
            <div className="muted">No expense balances available.</div>
          ) : (
            incomeStatement.data.expenses.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.amount ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-totals">
          <div>{periodText}</div>
          <div>Total Income: {formatAmount(incomeStatement.data.totalIncome)}</div>
          <div>Total Expenses: {formatAmount(incomeStatement.data.totalExpenses)}</div>
          <div>Net Income: {formatAmount(incomeStatement.data.netIncome)}</div>
        </div>
      </section>

      <section id="print-accounts-receivable-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Receivable Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printReceivablesSummaryStandalone}>
            Print Receivables Summary
          </button>
        </div>

        <ReportPrintHeader title="Accounts Receivable Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoices</span>
            <span>{arSummary.totalInvoices}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoiced</span>
            <span>{formatAmount(arSummary.totalInvoiced)}</span>
          </div>
          <div className="kv-row">
            <span>Total Collected</span>
            <span>{formatAmount(arSummary.totalCollected)}</span>
          </div>
          <div className="kv-row">
            <span>Total Outstanding</span>
            <span>{formatAmount(arSummary.totalOutstanding)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Invoices</span>
            <span>{arSummary.draftInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Invoices</span>
            <span>{arSummary.postedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Part Paid Invoices</span>
            <span>{arSummary.partPaidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Paid Invoices</span>
            <span>{arSummary.paidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Invoices</span>
            <span>{arSummary.cancelledInvoiceCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredSalesInvoices.map((item) => (
                <tr key={item.id}>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.customerCode} - {item.customerName}</td>
                  <td>{item.description}</td>
                  <td>{invoiceStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amountPaid)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalInvoiced)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalCollected)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalOutstanding)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section id="print-customer-receipts-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Customer Receipts Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printCustomerReceiptsSummaryStandalone}>
            Print Receipts Summary
          </button>
        </div>

        <ReportPrintHeader title="Customer Receipts Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Receipts</span>
            <span>{arSummary.totalReceipts}</span>
          </div>
          <div className="kv-row">
            <span>Total Receipt Amount</span>
            <span>{formatAmount(arSummary.totalReceiptAmount)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Receipts</span>
            <span>{arSummary.draftReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Receipts</span>
            <span>{arSummary.postedReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Receipts</span>
            <span>{arSummary.cancelledReceiptCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Receipt Number</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Receipt Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomerReceipts.map((item) => (
                <tr key={item.id}>
                  <td>{item.receiptNumber}</td>
                  <td>{item.customerCode} - {item.customerName}</td>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.description}</td>
                  <td>{receiptStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                  <td>{formatDateTime(item.receiptDateUtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalReceiptAmount)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section id="print-accounts-payable-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Payable Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printPayablesSummaryStandalone}>
            Print Payables Summary
          </button>
        </div>

        <ReportPrintHeader title="Accounts Payable Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Purchase Invoices</span>
            <span>{apSummary.totalInvoices}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoiced</span>
            <span>{formatAmount(apSummary.totalInvoiced)}</span>
          </div>
          <div className="kv-row">
            <span>Total Paid</span>
            <span>{formatAmount(apSummary.totalPaid)}</span>
          </div>
          <div className="kv-row">
            <span>Total Outstanding</span>
            <span>{formatAmount(apSummary.totalOutstanding)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Invoices</span>
            <span>{apSummary.draftInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Invoices</span>
            <span>{apSummary.postedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Part Paid Invoices</span>
            <span>{apSummary.partPaidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Paid Invoices</span>
            <span>{apSummary.paidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Invoices</span>
            <span>{apSummary.cancelledInvoiceCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseInvoices.map((item) => (
                <tr key={item.id}>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.vendorCode} - {item.vendorName}</td>
                  <td>{item.description}</td>
                  <td>{purchaseInvoiceStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amountPaid)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalInvoiced)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalPaid)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalOutstanding)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section id="print-vendor-payments-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Vendor Payments Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printVendorPaymentsSummaryStandalone}>
            Print Vendor Payments Summary
          </button>
        </div>

        <ReportPrintHeader title="Vendor Payments Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Payments</span>
            <span>{apSummary.totalPayments}</span>
          </div>
          <div className="kv-row">
            <span>Total Payment Amount</span>
            <span>{formatAmount(apSummary.totalPaymentAmount)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Payments</span>
            <span>{apSummary.draftPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Submitted for Approval</span>
            <span>{apSummary.submittedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Approved Payments</span>
            <span>{apSummary.approvedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Rejected Payments</span>
            <span>{apSummary.rejectedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Payments</span>
            <span>{apSummary.postedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Payments</span>
            <span>{apSummary.cancelledPaymentCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Payment Number</th>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendorPayments.map((item) => (
                <tr key={item.id}>
                  <td>{item.paymentNumber}</td>
                  <td>{item.vendorCode} - {item.vendorName}</td>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.description}</td>
                  <td>{vendorPaymentStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                  <td>{formatDateTime(item.paymentDateUtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalPaymentAmount)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}