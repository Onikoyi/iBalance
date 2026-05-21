import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getApprovalInboxItems,
  getBudgets,
  getCustomerReceipts,
  getJournalEntries,
  getPayrollRuns,
  getPurchaseInvoices,
  getPurchaseOrders,
  getPurchaseRequisitions,
  getRejectedBudgets,
  getRejectedCustomerReceipts,
  getRejectedJournalEntries,
  getRejectedPurchaseInvoices,
  getRejectedPurchaseOrders,
  getRejectedPurchaseRequisitions,
  getRejectedSalesInvoices,
  getRejectedVendorPayments,
  getSalesInvoices,
  getVendorPayments,
} from '../lib/api';
import {
  canViewAccountsPayable,
  canViewAccountsReceivable,
  canViewApprovalInbox,
  canViewBudget,
  canViewExpenseAdvances,
  canViewFinance,
  canViewFleet,
  canViewPayroll,
  canViewProcurement,
} from '../lib/auth';
import {
  getExpenseAdvanceRequests,
  getEamRetirements,
  getRejectedExpenseAdvanceRequests,
  getRejectedEamRetirements,
} from './eam/eamShared';
import {
  getFleetFuelLogs,
  getFleetMaintenanceWorkOrders,
  getFleetTrips,
} from '../lib/fleetApi';

type InboxState = 'all' | 'pending' | 'rejected';

type CentralApprovalItem = {
  id: string;
  module: string;
  itemType: string;
  reference: string;
  status: string;
  statusClass: 'pending' | 'rejected';
  requestedOnUtc?: string | null;
  amount?: number | null;
  description?: string | null;
  rejectionReason?: string | null;
  route: string;
  source: string;
};

const pendingStatusNames = new Set(['submitted', 'submitted for approval', 'submitted / approved', 'processed', 'pending approval']);
const rejectedStatusNames = new Set(['rejected']);

function asArray(data: unknown): any[] {
  const value = data as any;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatAmount(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

function moduleLabel(module: string) {
  switch (module) {
    case 'finance': return 'Finance / General Ledger';
    case 'budget': return 'Budgeting';
    case 'ar': return 'Accounts Receivable';
    case 'ap': return 'Accounts Payable';
    case 'procurement': return 'Procurement';
    case 'payroll': return 'Payroll';
    case 'eam': return 'Expense & Advance Management';
    case 'fleet': return 'Fleet Management';
    case 'hr': return 'Human Resources';
    case 'billing': return 'Billing & Invoicing';
    default: return titleCase(module);
  }
}

function statusPillClass(statusClass: CentralApprovalItem['statusClass']) {
  return statusClass === 'rejected' ? 'danger-pill' : 'warning-pill';
}

function statusNameFromNumber(module: string, itemType: string, value: unknown) {
  const status = Number(value);

  if (module === 'payroll') {
    if (status === 1) return 'Submitted / Approved';
    if (status === 4) return 'Rejected';
    if (status === 2) return 'Posted';
    return 'Draft';
  }

  if (module === 'billing') {
    if (status === 1) return 'Submitted';
    if (status === 2) return 'Approved';
    if (status === 3) return 'Rejected';
    if (status === 4) return 'Posted';
    return status === 0 ? 'Draft' : `Status ${status}`;
  }

  if (module === 'procurement') {
    if (status === 1) return 'Draft';
    if (status === 2) return 'Submitted';
    if (status === 3) return 'Approved';
    if (status === 4 && itemType === 'Purchase Order') return 'Issued';
    if (status === 7) return 'Rejected';
    if (status === 8) return 'Cancelled';
    return `Status ${status}`;
  }

  if (module === 'ar' && itemType === 'Sales Invoice') {
    if (status === 1) return 'Draft';
    if (status === 2) return 'Submitted for Approval';
    if (status === 3) return 'Approved';
    if (status === 4) return 'Posted';
    if (status === 5) return 'Part Paid';
    if (status === 6) return 'Paid';
    if (status === 7) return 'Rejected';
    if (status === 8) return 'Cancelled';
    return `Status ${status}`;
  }

  if (module === 'ap' && itemType === 'Purchase Invoice') {
    if (status === 1) return 'Draft';
    if (status === 2) return 'Submitted for Approval';
    if (status === 3) return 'Approved';
    if (status === 4) return 'Posted';
    if (status === 5) return 'Part Paid';
    if (status === 6) return 'Paid';
    if (status === 7) return 'Rejected';
    if (status === 8) return 'Cancelled';
    return `Status ${status}`;
  }

  if (status === 1) return 'Draft';
  if (status === 2) return 'Submitted for Approval';
  if (status === 3) return 'Approved';
  if (status === 4) return 'Rejected';
  if (status === 5) return 'Posted';
  if (status === 6) return 'Cancelled';
  if (status === 7) return 'Rejected';
  return `Status ${status}`;
}

function resolveStatusClass(module: string, itemType: string, value: unknown): CentralApprovalItem['statusClass'] | null {
  const statusName = typeof value === 'string' ? value : statusNameFromNumber(module, itemType, value);
  const normalized = statusName.toLowerCase();

  if (pendingStatusNames.has(normalized)) return 'pending';
  if (rejectedStatusNames.has(normalized)) return 'rejected';

  return null;
}

function shouldInclude(item: CentralApprovalItem, state: InboxState) {
  if (state === 'all') return true;
  return item.statusClass === state;
}

function pickAmount(item: any, keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function addWorkflowItems(args: {
  target: CentralApprovalItem[];
  source: string;
  list: any[];
  module: string;
  itemType: string;
  route: string;
  referenceKeys: string[];
  dateKeys: string[];
  amountKeys?: string[];
  descriptionKeys?: string[];
  statusValue?: (item: any) => unknown;
  rejectionReasonKeys?: string[];
}) {
  for (const item of args.list) {
    const statusValue = args.statusValue ? args.statusValue(item) : item.status;
    const statusClass = resolveStatusClass(args.module, args.itemType, statusValue);
    if (!statusClass) continue;

    const status = typeof statusValue === 'string'
      ? statusValue
      : statusNameFromNumber(args.module, args.itemType, statusValue);

    const reference =
      args.referenceKeys.map((key) => item?.[key]).find((value) => value !== null && value !== undefined && String(value).trim()) ??
      item?.id ??
      '—';

    const requestedOnUtc =
      args.dateKeys.map((key) => item?.[key]).find((value) => value !== null && value !== undefined && String(value).trim()) ??
      null;

    const description =
      (args.descriptionKeys ?? []).map((key) => item?.[key]).find((value) => value !== null && value !== undefined && String(value).trim()) ??
      null;

    const rejectionReason =
      (args.rejectionReasonKeys ?? ['rejectionReason']).map((key) => item?.[key]).find((value) => value !== null && value !== undefined && String(value).trim()) ??
      null;

    args.target.push({
      id: String(item?.id ?? `${args.module}-${args.itemType}-${reference}`),
      module: args.module,
      itemType: args.itemType,
      reference: String(reference),
      status,
      statusClass,
      requestedOnUtc: requestedOnUtc ? String(requestedOnUtc) : null,
      amount: pickAmount(item, args.amountKeys ?? []),
      description: description ? String(description) : null,
      rejectionReason: rejectionReason ? String(rejectionReason) : null,
      route: args.route,
      source: args.source,
    });
  }
}

export function ApprovalInboxPage() {
  const canView = canViewApprovalInbox();
  const canViewFinanceModule = canViewFinance();
  const canViewBudgetModule = canViewBudget();
  const canViewArModule = canViewAccountsReceivable();
  const canViewApModule = canViewAccountsPayable();
  const canViewProcurementModule = canViewProcurement();
  const canViewPayrollModule = canViewPayroll();
  const canViewEamModule = canViewExpenseAdvances();
  const canViewFleetModule = canViewFleet();

  const [state, setState] = useState<InboxState>('all');
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');

  const serverInboxQ = useQuery({
    queryKey: ['approval-inbox-server', state],
    queryFn: () => getApprovalInboxItems(state),
    enabled: canView,
    retry: false,
  });

  const journalsQ = useQuery({ queryKey: ['approval-inbox-journals'], queryFn: getJournalEntries, enabled: canView && canViewFinanceModule });
  const rejectedJournalsQ = useQuery({ queryKey: ['approval-inbox-rejected-journals'], queryFn: getRejectedJournalEntries, enabled: canView && canViewFinanceModule });

  const budgetsQ = useQuery({ queryKey: ['approval-inbox-budgets'], queryFn: getBudgets, enabled: canView && canViewBudgetModule });
  const rejectedBudgetsQ = useQuery({ queryKey: ['approval-inbox-rejected-budgets'], queryFn: getRejectedBudgets, enabled: canView && canViewBudgetModule });

  const salesInvoicesQ = useQuery({ queryKey: ['approval-inbox-sales-invoices'], queryFn: getSalesInvoices, enabled: canView && canViewArModule });
  const rejectedSalesInvoicesQ = useQuery({ queryKey: ['approval-inbox-rejected-sales-invoices'], queryFn: getRejectedSalesInvoices, enabled: canView && canViewArModule });
  const customerReceiptsQ = useQuery({ queryKey: ['approval-inbox-customer-receipts'], queryFn: getCustomerReceipts, enabled: canView && canViewArModule });
  const rejectedCustomerReceiptsQ = useQuery({ queryKey: ['approval-inbox-rejected-customer-receipts'], queryFn: getRejectedCustomerReceipts, enabled: canView && canViewArModule });

  const purchaseInvoicesQ = useQuery({ queryKey: ['approval-inbox-purchase-invoices'], queryFn: getPurchaseInvoices, enabled: canView && canViewApModule });
  const rejectedPurchaseInvoicesQ = useQuery({ queryKey: ['approval-inbox-rejected-purchase-invoices'], queryFn: getRejectedPurchaseInvoices, enabled: canView && canViewApModule });
  const vendorPaymentsQ = useQuery({ queryKey: ['approval-inbox-vendor-payments'], queryFn: getVendorPayments, enabled: canView && canViewApModule });
  const rejectedVendorPaymentsQ = useQuery({ queryKey: ['approval-inbox-rejected-vendor-payments'], queryFn: getRejectedVendorPayments, enabled: canView && canViewApModule });

  const purchaseRequisitionsQ = useQuery({ queryKey: ['approval-inbox-purchase-requisitions'], queryFn: getPurchaseRequisitions, enabled: canView && canViewProcurementModule });
  const rejectedPurchaseRequisitionsQ = useQuery({ queryKey: ['approval-inbox-rejected-purchase-requisitions'], queryFn: getRejectedPurchaseRequisitions, enabled: canView && canViewProcurementModule });
  const purchaseOrdersQ = useQuery({ queryKey: ['approval-inbox-purchase-orders'], queryFn: getPurchaseOrders, enabled: canView && canViewProcurementModule });
  const rejectedPurchaseOrdersQ = useQuery({ queryKey: ['approval-inbox-rejected-purchase-orders'], queryFn: getRejectedPurchaseOrders, enabled: canView && canViewProcurementModule });

  const payrollRunsQ = useQuery({ queryKey: ['approval-inbox-payroll-runs'], queryFn: getPayrollRuns, enabled: canView && canViewPayrollModule });

  const advanceRequestsQ = useQuery({ queryKey: ['approval-inbox-eam-requests'], queryFn: getExpenseAdvanceRequests, enabled: canView && canViewEamModule });
  const rejectedAdvanceRequestsQ = useQuery({ queryKey: ['approval-inbox-eam-rejected-requests'], queryFn: getRejectedExpenseAdvanceRequests, enabled: canView && canViewEamModule });
  const retirementsQ = useQuery({ queryKey: ['approval-inbox-eam-retirements'], queryFn: getEamRetirements, enabled: canView && canViewEamModule });
  const rejectedRetirementsQ = useQuery({ queryKey: ['approval-inbox-eam-rejected-retirements'], queryFn: getRejectedEamRetirements, enabled: canView && canViewEamModule });

  const fleetTripsQ = useQuery({ queryKey: ['approval-inbox-fleet-trips'], queryFn: getFleetTrips, enabled: canView && canViewFleetModule });
  const fleetFuelQ = useQuery({ queryKey: ['approval-inbox-fleet-fuel'], queryFn: getFleetFuelLogs, enabled: canView && canViewFleetModule });
  const fleetMaintenanceQ = useQuery({ queryKey: ['approval-inbox-fleet-maintenance'], queryFn: getFleetMaintenanceWorkOrders, enabled: canView && canViewFleetModule });

  const allItems = useMemo(() => {
    const items: CentralApprovalItem[] = [];

    for (const item of serverInboxQ.data?.items ?? []) {
      const statusClass = resolveStatusClass(item.module, item.itemType, item.status) ?? (String(item.status).toLowerCase().includes('reject') ? 'rejected' : 'pending');
      items.push({
        id: item.id,
        module: item.module,
        itemType: item.itemType,
        reference: item.reference,
        status: item.status,
        statusClass,
        requestedOnUtc: item.requestedOnUtc,
        amount: item.amount,
        description: item.description || item.actionHint || null,
        rejectionReason: item.rejectionReason,
        route: item.route,
        source: 'server',
      });
    }

    addWorkflowItems({ target: items, source: 'finance', list: asArray(journalsQ.data), module: 'finance', itemType: 'Journal Entry', route: '/journals', referenceKeys: ['reference'], dateKeys: ['submittedOnUtc', 'entryDateUtc', 'createdOnUtc'], amountKeys: ['totalDebitAmount', 'debitAmount', 'amount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'finance', list: asArray(rejectedJournalsQ.data), module: 'finance', itemType: 'Journal Entry', route: '/journals/rejected', referenceKeys: ['reference'], dateKeys: ['rejectedOnUtc', 'entryDateUtc', 'createdOnUtc'], amountKeys: ['totalDebitAmount', 'debitAmount', 'amount'], descriptionKeys: ['description'] });

    addWorkflowItems({ target: items, source: 'budget', list: asArray(budgetsQ.data), module: 'budget', itemType: 'Budget', route: '/budgets', referenceKeys: ['budgetNumber', 'name'], dateKeys: ['submittedOnUtc', 'periodStartUtc', 'createdOnUtc'], amountKeys: ['totalBudgetAmount', 'budgetAmount', 'amount'], descriptionKeys: ['name', 'description'] });
    addWorkflowItems({ target: items, source: 'budget', list: asArray(rejectedBudgetsQ.data), module: 'budget', itemType: 'Budget', route: '/budgets/rejected', referenceKeys: ['budgetNumber', 'name'], dateKeys: ['rejectedOnUtc', 'periodStartUtc', 'createdOnUtc'], amountKeys: ['totalBudgetAmount', 'budgetAmount', 'amount'], descriptionKeys: ['name', 'description'] });

    addWorkflowItems({ target: items, source: 'ar', list: asArray(salesInvoicesQ.data), module: 'ar', itemType: 'Sales Invoice', route: '/sales-invoices', referenceKeys: ['invoiceNumber'], dateKeys: ['submittedOnUtc', 'invoiceDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'invoiceAmount', 'amount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ar', list: asArray(rejectedSalesInvoicesQ.data), module: 'ar', itemType: 'Sales Invoice', route: '/sales-invoices/rejected', referenceKeys: ['invoiceNumber'], dateKeys: ['rejectedOnUtc', 'invoiceDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'invoiceAmount', 'amount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ar', list: asArray(customerReceiptsQ.data), module: 'ar', itemType: 'Customer Receipt', route: '/customer-receipts', referenceKeys: ['receiptNumber'], dateKeys: ['submittedOnUtc', 'receiptDateUtc', 'createdOnUtc'], amountKeys: ['amount', 'receiptAmount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ar', list: asArray(rejectedCustomerReceiptsQ.data), module: 'ar', itemType: 'Customer Receipt', route: '/customer-receipts/rejected', referenceKeys: ['receiptNumber'], dateKeys: ['rejectedOnUtc', 'receiptDateUtc', 'createdOnUtc'], amountKeys: ['amount', 'receiptAmount'], descriptionKeys: ['description'] });

    addWorkflowItems({ target: items, source: 'ap', list: asArray(purchaseInvoicesQ.data), module: 'ap', itemType: 'Purchase Invoice', route: '/purchase-invoices', referenceKeys: ['invoiceNumber'], dateKeys: ['submittedOnUtc', 'invoiceDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'invoiceAmount', 'amount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ap', list: asArray(rejectedPurchaseInvoicesQ.data), module: 'ap', itemType: 'Purchase Invoice', route: '/purchase-invoices/rejected', referenceKeys: ['invoiceNumber'], dateKeys: ['rejectedOnUtc', 'invoiceDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'invoiceAmount', 'amount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ap', list: asArray(vendorPaymentsQ.data), module: 'ap', itemType: 'Vendor Payment', route: '/vendor-payments', referenceKeys: ['paymentNumber'], dateKeys: ['submittedOnUtc', 'paymentDateUtc', 'createdOnUtc'], amountKeys: ['amount', 'paymentAmount'], descriptionKeys: ['description'] });
    addWorkflowItems({ target: items, source: 'ap', list: asArray(rejectedVendorPaymentsQ.data), module: 'ap', itemType: 'Vendor Payment', route: '/vendor-payments/rejected', referenceKeys: ['paymentNumber'], dateKeys: ['rejectedOnUtc', 'paymentDateUtc', 'createdOnUtc'], amountKeys: ['amount', 'paymentAmount'], descriptionKeys: ['description'] });

    addWorkflowItems({ target: items, source: 'procurement', list: asArray(purchaseRequisitionsQ.data), module: 'procurement', itemType: 'Purchase Requisition', route: '/purchase-requisitions', referenceKeys: ['requisitionNumber', 'requestNumber'], dateKeys: ['submittedOnUtc', 'requestDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'estimatedAmount', 'amount'], descriptionKeys: ['purpose', 'description'] });
    addWorkflowItems({ target: items, source: 'procurement', list: asArray(rejectedPurchaseRequisitionsQ.data), module: 'procurement', itemType: 'Purchase Requisition', route: '/purchase-requisitions/rejected', referenceKeys: ['requisitionNumber', 'requestNumber'], dateKeys: ['rejectedOnUtc', 'requestDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'estimatedAmount', 'amount'], descriptionKeys: ['purpose', 'description'] });
    addWorkflowItems({ target: items, source: 'procurement', list: asArray(purchaseOrdersQ.data), module: 'procurement', itemType: 'Purchase Order', route: '/purchase-orders', referenceKeys: ['purchaseOrderNumber', 'orderNumber'], dateKeys: ['submittedOnUtc', 'orderDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'orderAmount', 'amount'], descriptionKeys: ['notes', 'description'] });
    addWorkflowItems({ target: items, source: 'procurement', list: asArray(rejectedPurchaseOrdersQ.data), module: 'procurement', itemType: 'Purchase Order', route: '/purchase-orders/rejected', referenceKeys: ['purchaseOrderNumber', 'orderNumber'], dateKeys: ['rejectedOnUtc', 'orderDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'orderAmount', 'amount'], descriptionKeys: ['notes', 'description'] });

    addWorkflowItems({ target: items, source: 'payroll', list: asArray(payrollRunsQ.data), module: 'payroll', itemType: 'Payroll Run', route: '/payroll/runs', referenceKeys: ['payrollPeriod', 'runNumber'], dateKeys: ['submittedOnUtc', 'runDateUtc', 'createdOnUtc'], amountKeys: ['netPayAmount', 'grossPayAmount', 'totalAmount'], descriptionKeys: ['payrollPeriod'] });

    addWorkflowItems({ target: items, source: 'eam', list: asArray(advanceRequestsQ.data), module: 'eam', itemType: 'Advance Request', route: '/eam/approvals', referenceKeys: ['requestNumber'], dateKeys: ['submittedOnUtc', 'requestDateUtc', 'createdOnUtc'], amountKeys: ['requestedAmount', 'outstandingAmount'], descriptionKeys: ['purpose'] });
    addWorkflowItems({ target: items, source: 'eam', list: asArray(rejectedAdvanceRequestsQ.data), module: 'eam', itemType: 'Advance Request', route: '/eam/requests/rejected', referenceKeys: ['requestNumber'], dateKeys: ['rejectedOnUtc', 'requestDateUtc', 'createdOnUtc'], amountKeys: ['requestedAmount', 'outstandingAmount'], descriptionKeys: ['purpose'] });
    addWorkflowItems({ target: items, source: 'eam', list: asArray(retirementsQ.data), module: 'eam', itemType: 'Advance Retirement', route: '/eam/retirements', referenceKeys: ['retirementNumber'], dateKeys: ['submittedOnUtc', 'retirementDateUtc', 'createdOnUtc'], amountKeys: ['totalRetiredAmount', 'totalExpenseAmount', 'amount'], descriptionKeys: ['notes', 'reasonCode'] });
    addWorkflowItems({ target: items, source: 'eam', list: asArray(rejectedRetirementsQ.data), module: 'eam', itemType: 'Advance Retirement', route: '/eam/retirements/rejected', referenceKeys: ['retirementNumber'], dateKeys: ['rejectedOnUtc', 'retirementDateUtc', 'createdOnUtc'], amountKeys: ['totalRetiredAmount', 'totalExpenseAmount', 'amount'], descriptionKeys: ['notes', 'reasonCode'] });

    addWorkflowItems({ target: items, source: 'fleet', list: asArray(fleetTripsQ.data), module: 'fleet', itemType: 'Fleet Trip', route: '/fleet/trips', referenceKeys: ['tripNumber'], dateKeys: ['submittedOnUtc', 'tripDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'estimatedAmount'], descriptionKeys: ['purpose', 'origin', 'destination'] });
    addWorkflowItems({ target: items, source: 'fleet', list: asArray(fleetFuelQ.data), module: 'fleet', itemType: 'Fuel Log', route: '/fleet/fuel', referenceKeys: ['fuelLogNumber'], dateKeys: ['submittedOnUtc', 'fuelDateUtc', 'createdOnUtc'], amountKeys: ['totalAmount', 'amount'], descriptionKeys: ['vendorName', 'notes'] });
    addWorkflowItems({ target: items, source: 'fleet', list: asArray(fleetMaintenanceQ.data), module: 'fleet', itemType: 'Maintenance Work Order', route: '/fleet/maintenance', referenceKeys: ['workOrderNumber'], dateKeys: ['submittedOnUtc', 'workOrderDateUtc', 'createdOnUtc'], amountKeys: ['actualAmount', 'estimatedAmount'], descriptionKeys: ['issueDescription', 'workshopVendorName', 'notes'] });

    const deduped = new Map<string, CentralApprovalItem>();
    for (const item of items) {
      const key = `${item.module}|${item.itemType}|${item.id}`;
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => {
      const left = a.requestedOnUtc ? new Date(a.requestedOnUtc).getTime() : 0;
      const right = b.requestedOnUtc ? new Date(b.requestedOnUtc).getTime() : 0;
      return right - left;
    });
  }, [
    serverInboxQ.data,
    journalsQ.data,
    rejectedJournalsQ.data,
    budgetsQ.data,
    rejectedBudgetsQ.data,
    salesInvoicesQ.data,
    rejectedSalesInvoicesQ.data,
    customerReceiptsQ.data,
    rejectedCustomerReceiptsQ.data,
    purchaseInvoicesQ.data,
    rejectedPurchaseInvoicesQ.data,
    vendorPaymentsQ.data,
    rejectedVendorPaymentsQ.data,
    purchaseRequisitionsQ.data,
    rejectedPurchaseRequisitionsQ.data,
    purchaseOrdersQ.data,
    rejectedPurchaseOrdersQ.data,
    payrollRunsQ.data,
    advanceRequestsQ.data,
    rejectedAdvanceRequestsQ.data,
    retirementsQ.data,
    rejectedRetirementsQ.data,
    fleetTripsQ.data,
    fleetFuelQ.data,
    fleetMaintenanceQ.data,
  ]);

  const modules = useMemo(() => Array.from(new Set(allItems.map((item) => item.module))).sort(), [allItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return allItems
      .filter((item) => shouldInclude(item, state))
      .filter((item) => !moduleFilter || item.module === moduleFilter)
      .filter((item) => {
        if (!term) return true;

        return [
          item.module,
          item.itemType,
          item.reference,
          item.status,
          item.description,
          item.rejectionReason,
          item.route,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      });
  }, [allItems, moduleFilter, search, state]);

  const pendingCount = allItems.filter((item) => item.statusClass === 'pending').length;
  const rejectedCount = allItems.filter((item) => item.statusClass === 'rejected').length;

  const queryErrors = [
    ['Server inbox', serverInboxQ],
    ['Journals', journalsQ],
    ['Rejected Journals', rejectedJournalsQ],
    ['Budgets', budgetsQ],
    ['Rejected Budgets', rejectedBudgetsQ],
    ['Sales Invoices', salesInvoicesQ],
    ['Rejected Sales Invoices', rejectedSalesInvoicesQ],
    ['Customer Receipts', customerReceiptsQ],
    ['Rejected Customer Receipts', rejectedCustomerReceiptsQ],
    ['Purchase Invoices', purchaseInvoicesQ],
    ['Rejected Purchase Invoices', rejectedPurchaseInvoicesQ],
    ['Vendor Payments', vendorPaymentsQ],
    ['Rejected Vendor Payments', rejectedVendorPaymentsQ],
    ['Purchase Requisitions', purchaseRequisitionsQ],
    ['Rejected Purchase Requisitions', rejectedPurchaseRequisitionsQ],
    ['Purchase Orders', purchaseOrdersQ],
    ['Rejected Purchase Orders', rejectedPurchaseOrdersQ],
    ['Payroll Runs', payrollRunsQ],
    ['Advance Requests', advanceRequestsQ],
    ['Rejected Advance Requests', rejectedAdvanceRequestsQ],
    ['Advance Retirements', retirementsQ],
    ['Rejected Advance Retirements', rejectedRetirementsQ],
    ['Fleet Trips', fleetTripsQ],
    ['Fleet Fuel Logs', fleetFuelQ],
    ['Fleet Maintenance', fleetMaintenanceQ],
  ].filter(([, query]) => (query as any).isError);

  if (!canView) {
    return <div className="panel error-panel">You do not have access to the Central Approval Inbox.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Central Approval Inbox</h2>
        <div className="muted">
          Consolidated approval and rejected-workflow view across Finance, Budgeting, AR, AP, Procurement, Payroll, Expense Advances, Fleet, HR, and Billing where available.
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{allItems.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected / Correction</div>
          <div className="stat-value">{rejectedCount}</div>
        </div>
      </section>

      {queryErrors.length > 0 ? (
        <section className="panel error-panel">
          Some inbox sources could not be loaded: {queryErrors.map(([name]) => name).join(', ')}. Available sources are still displayed below.
        </section>
      ) : null}

      <section className="panel">
        <h3>Filters</h3>
        <div className="form-grid three">
          <div className="form-row">
            <label>Workflow State</label>
            <select className="input" value={state} onChange={(e) => setState(e.target.value as InboxState)}>
              <option value="all">Pending + Rejected</option>
              <option value="pending">Pending approval only</option>
              <option value="rejected">Rejected/correction only</option>
            </select>
          </div>
          <div className="form-row">
            <label>Module</label>
            <select className="input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>{moduleLabel(module)}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Reference, module, status, description, rejection reason"
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Approval Items</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Item Type</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Requested / Updated</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Description</th>
                <th>Rejection Reason</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No approval or rejected workflow items match the current filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={`${item.module}-${item.itemType}-${item.id}`}>
                    <td>{moduleLabel(item.module)}</td>
                    <td>{item.itemType}</td>
                    <td>{item.reference}</td>
                    <td>
                      <span className={statusPillClass(item.statusClass)}>
                        {item.status}
                      </span>
                    </td>
                    <td>{formatDate(item.requestedOnUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.rejectionReason || '—'}</td>
                    <td>
                      <Link className="button secondary" to={item.route}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
