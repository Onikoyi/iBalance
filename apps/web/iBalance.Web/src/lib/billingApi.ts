import { getTenantKey } from './api';
import { getAccessToken } from './auth';

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.message || data?.Message || data?.title || 'Request failed.');
  }

  return data as T;
}

export type BillingPolicyDto = {
  id: string;
  tenantId: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  currencyCode: string;
  receivableControlAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
  taxLiabilityAccountId?: string | null;
  discountAccountId?: string | null;
  writeOffAccountId?: string | null;
  requireApprovalBeforePosting: boolean;
  enableMakerChecker: boolean;
  autoPostApprovedInvoices: boolean;
  defaultTaxRate: number;
  defaultDueDays: number;
  notes?: string | null;
};

export type SaveBillingPolicyRequest = Omit<BillingPolicyDto, 'id' | 'tenantId'>;

export type BillingPostingAccountDto = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  isPostingAllowed: boolean;
  isHeader: boolean;
};

export type BillingPostingAccountListResponse = {
  count: number;
  items: BillingPostingAccountDto[];
};

export type BillingCustomerDto = {
  id: string;
  customerCode: string;
  customerName: string;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
  createdOnUtc?: string | null;
};

export type BillingCustomerListResponse = {
  count: number;
  items: BillingCustomerDto[];
};

export type BillingInvoiceLineRequest = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  revenueAccountId?: string | null;
};

export type SaveBillingInvoiceRequest = {
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  invoiceNumber?: string | null;
  invoiceDateUtc?: string | null;
  dueDateUtc?: string | null;
  currencyCode?: string | null;
  receivableControlAccountId?: string | null;
  revenueAccountId?: string | null;
  taxLiabilityAccountId?: string | null;
  notes?: string | null;
  lines: BillingInvoiceLineRequest[];
};

export type BillingInvoiceDto = {
  id: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerCode?: string | null;
  customerName: string;
  customerEmail?: string | null;
  invoiceDateUtc: string;
  dueDateUtc?: string | null;
  currencyCode: string;
  status: number;
  statusName: string;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  grossAmount?: number;
  netReceivableAmount?: number;
  amountPaid: number;
  outstandingAmount: number;
  notes?: string | null;
  rejectionReason?: string | null;
  cancelReason?: string | null;
  createdAtUtc?: string | null;
  postedAtUtc?: string | null;
  journalEntryId?: string | null;
};

export type BillingInvoiceLineDto = {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  revenueAccountId?: string | null;
};

export type BillingInvoiceListResponse = {
  count: number;
  items: BillingInvoiceDto[];
};

export type BillingInvoiceDetailResponse = {
  item: BillingInvoiceDto;
  lines: BillingInvoiceLineDto[];
};

export type BillingCreditNoteDto = {
  id: string;
  tenantId?: string;
  customerId: string;
  customerCode?: string | null;
  customerName?: string | null;
  salesInvoiceId: string;
  billingInvoiceId: string;
  invoiceNumber?: string | null;
  creditNoteDateUtc: string;
  creditNoteNumber: string;
  description: string;
  amount: number;
  reason: string;
  status: number;
  statusName: string;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  createdOnUtc?: string | null;
};

export type BillingCreditNoteListResponse = {
  count: number;
  items: BillingCreditNoteDto[];
};

export type CreateBillingCreditNoteRequest = {
  billingInvoiceId: string;
  creditNoteDateUtc?: string | null;
  creditNoteNumber: string;
  amount: number;
  reason: string;
};

export type UpdateBillingCreditNoteRequest = {
  creditNoteDateUtc?: string | null;
  creditNoteNumber: string;
  amount: number;
  reason: string;
};

export type PostBillingCreditNoteRequest = {
  receivableLedgerAccountId: string;
  revenueLedgerAccountId: string;
  taxLedgerAccountId?: string | null;
  taxAmount?: number;
};

export type BillingDashboardResponse = {
  item: {
    invoiceCount: number;
    draftCount: number;
    submittedCount: number;
    approvedCount: number;
    postedCount: number;
    rejectedCount: number;
    totalBilled: number;
    totalOutstanding: number;
  };
};

type ArSalesInvoiceDto = {
  id: string;
  customerId: string;
  customerCode?: string | null;
  customerName?: string | null;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description?: string | null;
  status: number;
  totalAmount: number;
  taxAdditionAmount?: number | null;
  taxDeductionAmount?: number | null;
  grossAmount?: number | null;
  netReceivableAmount?: number | null;
  amountPaid?: number | null;
  balanceAmount?: number | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  lineCount?: number | null;
};

type ArSalesInvoiceListResponse = {
  count: number;
  items: ArSalesInvoiceDto[];
};

type ArSalesInvoiceActionResponse = {
  message: string;
  invoice?: ArSalesInvoiceDto;
  Invoice?: ArSalesInvoiceDto;
};

function statusName(status: number): string {
  switch (status) {
    case 0:
      return 'Draft';
    case 1:
      return 'Submitted';
    case 2:
      return 'Approved';
    case 3:
      return 'Posted';
    case 4:
      return 'Rejected';
    case 5:
      return 'Cancelled';
    case 6:
      return 'Part Paid';
    case 7:
      return 'Paid';
    default:
      return String(status);
  }
}

function mapArInvoiceToBillingInvoice(invoice: ArSalesInvoiceDto): BillingInvoiceDto {
  const taxAmount = Number(invoice.taxAdditionAmount || 0) - Number(invoice.taxDeductionAmount || 0);
  const netReceivable = Number(invoice.netReceivableAmount || invoice.grossAmount || invoice.totalAmount || 0);
  const balance = Number(invoice.balanceAmount ?? Math.max(netReceivable - Number(invoice.amountPaid || 0), 0));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerCode: invoice.customerCode ?? null,
    customerName: invoice.customerName || '',
    invoiceDateUtc: invoice.invoiceDateUtc,
    currencyCode: 'NGN',
    status: invoice.status,
    statusName: statusName(invoice.status),
    subtotalAmount: Number(invoice.totalAmount || 0),
    taxAmount,
    discountAmount: 0,
    totalAmount: netReceivable,
    grossAmount: Number(invoice.grossAmount || invoice.totalAmount || 0),
    netReceivableAmount: netReceivable,
    amountPaid: Number(invoice.amountPaid || 0),
    outstandingAmount: balance,
    notes: invoice.description || null,
    rejectionReason: invoice.rejectionReason || null,
    postedAtUtc: invoice.postedOnUtc || null,
    journalEntryId: invoice.journalEntryId || null,
  };
}

function extractActionInvoice(response: ArSalesInvoiceActionResponse, fallbackId: string): BillingInvoiceDto {
  const invoice = response.invoice || response.Invoice;
  if (invoice) {
    return mapArInvoiceToBillingInvoice(invoice);
  }

  return {
    id: fallbackId,
    invoiceNumber: '',
    customerName: '',
    invoiceDateUtc: new Date().toISOString(),
    currencyCode: 'NGN',
    status: -1,
    statusName: 'Updated',
    subtotalAmount: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    amountPaid: 0,
    outstandingAmount: 0,
  };
}

export function getBillingPolicy() {
  return request<{ item: BillingPolicyDto }>('/api/billing/setup');
}

export function saveBillingPolicy(payload: SaveBillingPolicyRequest) {
  return request<{ message: string; item: BillingPolicyDto }>('/api/billing/setup', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function getBillingPostingAccounts() {
  return request<BillingPostingAccountListResponse>('/api/billing/setup/posting-accounts');
}

export function getBillingCustomers() {
  return request<BillingCustomerListResponse>('/api/finance/ar/customers');
}

export async function getBillingInvoices(status?: number) {
  if (status === 4) {
    const rejected = await request<ArSalesInvoiceListResponse>('/api/finance/ar/sales-invoices/rejected');
    const items = rejected.items.map(mapArInvoiceToBillingInvoice);
    return { count: items.length, items };
  }

  const response = await request<ArSalesInvoiceListResponse>('/api/finance/ar/sales-invoices');
  let items = response.items.map(mapArInvoiceToBillingInvoice);

  if (status !== undefined) {
    items = items.filter((item) => item.status === status);
  }

  return { count: items.length, items };
}

export async function getBillingInvoice(invoiceId: string) {
  const response = await getBillingInvoices();
  const item = response.items.find((invoice) => invoice.id === invoiceId);

  if (!item) {
    throw new Error('Invoice was not found in AR sales invoices.');
  }

  return { item, lines: [] as BillingInvoiceLineDto[] };
}

export async function createBillingInvoice(payload: SaveBillingInvoiceRequest) {
  if (!payload.customerId) {
    throw new Error('Customer is required. Create/select the customer from AR customer master before Billing invoice creation.');
  }

  const normalizedLines = (payload.lines || [])
    .filter((line) => line.description.trim().length > 0 && Number(line.quantity) > 0)
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
    }));

  if (normalizedLines.length === 0) {
    throw new Error('At least one invoice line is required.');
  }

  const invoiceNumber =
    payload.invoiceNumber?.trim().toUpperCase() ||
    `BILL-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;

  const response = await request<ArSalesInvoiceActionResponse>('/api/finance/ar/sales-invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: payload.customerId,
      invoiceDateUtc: payload.invoiceDateUtc || new Date().toISOString(),
      invoiceNumber,
      description: payload.notes?.trim() || 'Billing & Invoicing invoice',
      lines: normalizedLines,
      taxCodeIds: [],
    }),
  });

  return {
    message: response.message || 'Billing invoice created as AR sales invoice.',
    item: extractActionInvoice(response, ''),
  };
}

export async function updateBillingInvoice(invoiceId: string, payload: SaveBillingInvoiceRequest) {
  if (!payload.customerId) {
    throw new Error('Customer is required.');
  }

  const normalizedLines = (payload.lines || [])
    .filter((line) => line.description.trim().length > 0 && Number(line.quantity) > 0)
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
    }));

  const response = await request<ArSalesInvoiceActionResponse>(`/api/finance/ar/sales-invoices/${invoiceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      customerId: payload.customerId,
      invoiceDateUtc: payload.invoiceDateUtc || new Date().toISOString(),
      invoiceNumber: payload.invoiceNumber?.trim().toUpperCase(),
      description: payload.notes?.trim() || 'Billing & Invoicing invoice',
      lines: normalizedLines,
      taxCodeIds: [],
    }),
  });

  return {
    message: response.message || 'Billing invoice updated through AR sales invoice.',
    item: extractActionInvoice(response, invoiceId),
  };
}

export async function submitBillingInvoice(invoiceId: string) {
  const response = await request<ArSalesInvoiceActionResponse>(`/api/finance/ar/sales-invoices/${invoiceId}/submit`, {
    method: 'POST',
  });

  return {
    message: response.message || 'Invoice submitted.',
    item: extractActionInvoice(response, invoiceId),
  };
}

export async function approveBillingInvoice(invoiceId: string) {
  const response = await request<ArSalesInvoiceActionResponse>(`/api/finance/ar/sales-invoices/${invoiceId}/approve`, {
    method: 'POST',
  });

  return {
    message: response.message || 'Invoice approved.',
    item: extractActionInvoice(response, invoiceId),
  };
}

export async function rejectBillingInvoice(invoiceId: string, reason: string) {
  const response = await request<ArSalesInvoiceActionResponse>(`/api/finance/ar/sales-invoices/${invoiceId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

  return {
    message: response.message || 'Invoice rejected.',
    item: extractActionInvoice(response, invoiceId),
  };
}

export async function postBillingInvoice(invoiceId: string) {
  const policy = await getBillingPolicy();
  const receivableLedgerAccountId = policy.item.receivableControlAccountId;
  const revenueLedgerAccountId = policy.item.defaultRevenueAccountId;

  if (!receivableLedgerAccountId || !revenueLedgerAccountId) {
    throw new Error('Billing setup must have Receivable Control and Default Revenue accounts before posting.');
  }

  const response = await request<ArSalesInvoiceActionResponse>(`/api/finance/ar/sales-invoices/${invoiceId}/post`, {
    method: 'POST',
    body: JSON.stringify({
      receivableLedgerAccountId,
      revenueLedgerAccountId,
    }),
  });

  return {
    message: response.message || 'Invoice posted to GL through AR.',
    item: extractActionInvoice(response, invoiceId),
  };
}

export async function cancelBillingInvoice(invoiceId: string, reason: string) {
  await request<{ message: string }>(`/api/finance/ar/sales-invoices/${invoiceId}`, {
    method: 'DELETE',
  });

  return {
    message: reason ? `Invoice cancelled. Reason: ${reason}` : 'Invoice cancelled.',
    item: extractActionInvoice({ message: 'Invoice cancelled.' }, invoiceId),
  };
}

function mapArCreditNote(raw: any): BillingCreditNoteDto {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    customerId: raw.customerId,
    customerCode: raw.customerCode,
    customerName: raw.customerName,
    salesInvoiceId: raw.salesInvoiceId,
    billingInvoiceId: raw.salesInvoiceId,
    invoiceNumber: raw.invoiceNumber,
    creditNoteDateUtc: raw.creditNoteDateUtc,
    creditNoteNumber: raw.creditNoteNumber,
    description: raw.description,
    amount: Number(raw.amount || 0),
    reason: raw.description || raw.rejectionReason || '',
    status: Number(raw.status || 0),
    statusName: raw.statusName || String(raw.status ?? ''),
    submittedBy: raw.submittedBy,
    submittedOnUtc: raw.submittedOnUtc,
    approvedBy: raw.approvedBy,
    approvedOnUtc: raw.approvedOnUtc,
    rejectedBy: raw.rejectedBy,
    rejectedOnUtc: raw.rejectedOnUtc,
    rejectionReason: raw.rejectionReason,
    journalEntryId: raw.journalEntryId,
    postedOnUtc: raw.postedOnUtc,
    createdOnUtc: raw.createdOnUtc,
  };
}

export async function getBillingCreditNotes(): Promise<BillingCreditNoteListResponse> {
  const response = await request<{ count?: number; Count?: number; items?: any[]; Items?: any[] }>('/api/finance/ar/sales-credit-notes');
  const rawItems = response.items ?? response.Items ?? [];
  const items = rawItems.map(mapArCreditNote);
  return { count: Number(response.count ?? response.Count ?? items.length), items };
}

export async function getRejectedBillingCreditNotes(): Promise<BillingCreditNoteListResponse> {
  const response = await request<{ count?: number; Count?: number; items?: any[]; Items?: any[] }>('/api/finance/ar/sales-credit-notes/rejected');
  const rawItems = response.items ?? response.Items ?? [];
  const items = rawItems.map(mapArCreditNote);
  return { count: Number(response.count ?? response.Count ?? items.length), items };
}

export async function createBillingCreditNote(payload: CreateBillingCreditNoteRequest) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>('/api/finance/ar/sales-credit-notes', {
    method: 'POST',
    body: JSON.stringify({
      salesInvoiceId: payload.billingInvoiceId,
      creditNoteDateUtc: payload.creditNoteDateUtc || new Date().toISOString(),
      creditNoteNumber: payload.creditNoteNumber,
      description: payload.reason,
      amount: payload.amount,
    }),
  });

  return {
    message: response.message || response.Message || 'Credit note created.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
  };
}

export async function updateBillingCreditNote(creditNoteId: string, payload: UpdateBillingCreditNoteRequest) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}`, {
    method: 'PUT',
    body: JSON.stringify({
      creditNoteDateUtc: payload.creditNoteDateUtc || new Date().toISOString(),
      creditNoteNumber: payload.creditNoteNumber,
      description: payload.reason,
      amount: payload.amount,
    }),
  });

  return {
    message: response.message || response.Message || 'Credit note corrected.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
  };
}

export async function deleteBillingCreditNote(creditNoteId: string) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}`, {
    method: 'DELETE',
  });

  return {
    message: response.message || response.Message || 'Credit note cancelled.',
    item: response.creditNote || response.CreditNote ? mapArCreditNote(response.creditNote ?? response.CreditNote) : null,
  };
}

export async function submitBillingCreditNote(creditNoteId: string) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}/submit`, {
    method: 'POST',
  });

  return {
    message: response.message || response.Message || 'Credit note submitted.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
  };
}

export async function approveBillingCreditNote(creditNoteId: string) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}/approve`, {
    method: 'POST',
  });

  return {
    message: response.message || response.Message || 'Credit note approved.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
  };
}

export async function rejectBillingCreditNote(creditNoteId: string, reason: string) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

  return {
    message: response.message || response.Message || 'Credit note rejected.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
  };
}

export async function postBillingCreditNote(creditNoteId: string, payload: PostBillingCreditNoteRequest) {
  const response = await request<{ message?: string; Message?: string; creditNote?: any; CreditNote?: any; invoice?: any; Invoice?: any }>(`/api/finance/ar/sales-credit-notes/${creditNoteId}/post`, {
    method: 'POST',
    body: JSON.stringify({
      receivableLedgerAccountId: payload.receivableLedgerAccountId,
      revenueLedgerAccountId: payload.revenueLedgerAccountId,
      taxLedgerAccountId: payload.taxLedgerAccountId || null,
      taxAmount: payload.taxAmount || 0,
    }),
  });

  return {
    message: response.message || response.Message || 'Credit note posted.',
    item: mapArCreditNote(response.creditNote ?? response.CreditNote ?? response),
    invoice: response.invoice ?? response.Invoice,
  };
}

export async function allocateBillingPayment(payload: {
  billingInvoiceId: string;
  paymentReference: string;
  amount: number;
  paymentDateUtc?: string | null;
  notes?: string | null;
}) {
  const invoice = await getBillingInvoice(payload.billingInvoiceId);

  if (!invoice.item.customerId) {
    throw new Error('The selected invoice has no customer reference.');
  }

  const response = await request<{ message: string; receipt?: unknown; Receipt?: unknown }>('/api/finance/ar/customer-receipts', {
    method: 'POST',
    body: JSON.stringify({
      customerId: invoice.item.customerId,
      salesInvoiceId: payload.billingInvoiceId,
      receiptDateUtc: payload.paymentDateUtc || new Date().toISOString(),
      receiptNumber: payload.paymentReference,
      description: payload.notes || `Billing payment allocation for ${invoice.item.invoiceNumber}`,
      amount: payload.amount,
    }),
  });

  return {
    message: response.message || 'Customer receipt created in AR. Submit/approve/post it from AR receipts workflow.',
    item: response.receipt || response.Receipt || response,
  };
}

export async function getBillingDashboard() {
  const invoices = await getBillingInvoices();
  const items = invoices.items;

  return {
    item: {
      invoiceCount: items.length,
      draftCount: items.filter((x) => x.status === 0).length,
      submittedCount: items.filter((x) => x.status === 1).length,
      approvedCount: items.filter((x) => x.status === 2).length,
      postedCount: items.filter((x) => x.status === 3 || x.status === 6 || x.status === 7).length,
      rejectedCount: items.filter((x) => x.status === 4).length,
      totalBilled: items.reduce((sum, x) => sum + Number(x.totalAmount || 0), 0),
      totalOutstanding: items.reduce((sum, x) => sum + Number(x.outstandingAmount || 0), 0),
    },
  };
}

export function getBillingRegisterReport() {
  return getBillingInvoices();
}

export async function getBillingOutstandingReport() {
  const invoices = await getBillingInvoices();
  const today = new Date().getTime();

  const items = invoices.items
    .filter((invoice) => Number(invoice.outstandingAmount || 0) > 0)
    .map((invoice) => {
      const dueTime = invoice.dueDateUtc ? new Date(invoice.dueDateUtc).getTime() : new Date(invoice.invoiceDateUtc).getTime();
      const daysOverdue = Number.isFinite(dueTime) ? Math.max(Math.floor((today - dueTime) / 86_400_000), 0) : 0;
      return { ...invoice, daysOverdue };
    });

  return { count: items.length, items };
}

export async function getBillingAgeingReport() {
  const outstanding = await getBillingOutstandingReport();
  const buckets = [
    { bucket: 'Current', min: 0, max: 0 },
    { bucket: '1-30 Days', min: 1, max: 30 },
    { bucket: '31-60 Days', min: 31, max: 60 },
    { bucket: '61-90 Days', min: 61, max: 90 },
    { bucket: '90+ Days', min: 91, max: Number.MAX_SAFE_INTEGER },
  ];

  const items = buckets.map((bucket) => {
    const rows = outstanding.items.filter((invoice) => invoice.daysOverdue >= bucket.min && invoice.daysOverdue <= bucket.max);
    return {
      bucket: bucket.bucket,
      count: rows.length,
      amount: rows.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount || 0), 0),
    };
  });

  return { count: items.length, items };
}
