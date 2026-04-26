import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInventoryItem,
  createWarehouse,
  getAccounts,
  getInventoryAuditTrace,
  getInventoryGlReconciliation,
  getInventoryItems,
  getInventoryValuationReport,
  getPurchaseInvoices,
  getSalesInvoices,
  getStockLedger,
  getTenantReadableError,
  getWarehouses,
  issueInventoryForSalesInvoice,
  receivePurchaseInvoiceIntoInventory,
  stockAdjust,
  stockIn,
  type CreateInventoryItemRequest,
  type CreateStockAdjustmentRequest,
  type CreateStockInRequest,
  type CreateWarehouseRequest,
  type InventoryAuditTraceResponse,
  type InventoryItemDto,
  type InventoryValuationRowDto,
  type LedgerAccountDto,
  type PurchaseInvoiceDto,
  type SalesInvoiceDto,
  type StockLedgerEntryDto,
  type WarehouseDto,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

const emptyItemForm: CreateInventoryItemRequest = {
  code: '',
  name: '',
  type: 1,
  unitOfMeasure: 'EA',
  valuationMethod: 2,
};

const emptyWarehouseForm: CreateWarehouseRequest = {
  name: '',
  location: '',
};

type StockLineForm = {
  itemId: string;
  warehouseId: string;
  quantity: string;
  unitCost: string;
};

type InvoiceInventoryLineForm = {
  inventoryItemId: string;
  quantity: string;
  unitCost: string;
  description: string;
};

const emptyStockLine: StockLineForm = {
  itemId: '',
  warehouseId: '',
  quantity: '',
  unitCost: '',
};

const emptyInvoiceInventoryLine: InvoiceInventoryLineForm = {
  inventoryItemId: '',
  quantity: '',
  unitCost: '',
  description: '',
};

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatQty(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function dateInputToUtc(value: string) {
  return value ? new Date(value + 'T00:00:00.000Z').toISOString() : new Date().toISOString();
}

function itemTypeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Stock Item';
    case 2:
      return 'Service';
    default:
      return 'Unknown';
  }
}

function valuationMethodLabel(value: number) {
  switch (value) {
    case 1:
      return 'FIFO';
    case 2:
      return 'Weighted Average';
    default:
      return 'Unknown';
  }
}

function movementTypeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Stock In';
    case 2:
      return 'Stock Out';
    case 3:
      return 'Adjustment';
    case 4:
      return 'Transfer';
    default:
      return 'Movement';
  }
}

function referenceTypeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Opening / Stock In';
    case 2:
      return 'Adjustment';
    case 3:
      return 'Transfer';
    case 4:
      return 'Purchase';
    case 5:
      return 'Sale';
    default:
      return 'Reference';
  }
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildInventoryPrintHtml(args: {
  title: string;
  subtitle: string;
  summaryHtml: string;
  tableHtml: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; background: #ffffff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 16px; }
    .brand { display: grid; gap: 4px; }
    .brand strong { font-size: 16px; }
    .brand span, .subtitle, .footer { color: #4b5563; font-size: 12px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
    .summary-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; display: grid; gap: 3px; }
    .summary-card span { color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .summary-card strong { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 700; }
    .right { text-align: right; }
    tr { break-inside: avoid; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; gap: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      <strong>Nikosoft Technologies</strong>
      <span>iBalance Accounting Cloud</span>
    </div>
    <div style="text-align:right">
      <h1>${escapeHtml(args.title)}</h1>
      <div class="subtitle">${escapeHtml(args.subtitle)}</div>
    </div>
  </header>
  <section class="summary">${args.summaryHtml}</section>
  ${args.tableHtml}
  <footer class="footer">
    <span>Generated from iBalance Inventory Management</span>
    <span>${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
  </footer>
</body>
</html>`;
}

function printHtmlDocument(html: string, onError: (message: string) => void) {
  const iframe = document.createElement('iframe');
  iframe.title = 'Inventory Print Frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument || frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    document.body.removeChild(iframe);
    onError('Unable to prepare the print report. Please try again.');
    return;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  iframe.onload = () => {
    frameWindow.focus();
    frameWindow.print();

    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 500);
  };
}

function itemLabel(item?: InventoryItemDto | null) {
  if (!item) return '—';
  return `${item.code} - ${item.name}`;
}

function warehouseLabel(warehouse?: WarehouseDto | null) {
  if (!warehouse) return '—';
  return warehouse.location ? `${warehouse.name} (${warehouse.location})` : warehouse.name;
}

export function InventoryPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'warehouses' | 'stock-in' | 'adjustments' | 'ap-receipt' | 'sales-issue' | 'ledger' | 'valuation' | 'reconciliation' | 'audit'>('overview');
  const [itemForm, setItemForm] = useState<CreateInventoryItemRequest>(emptyItemForm);
  const [warehouseForm, setWarehouseForm] = useState<CreateWarehouseRequest>(emptyWarehouseForm);
  const [stockInLines, setStockInLines] = useState<StockLineForm[]>([{ ...emptyStockLine }]);
  const [adjustmentLines, setAdjustmentLines] = useState<StockLineForm[]>([{ ...emptyStockLine }]);
  const [stockInInventoryLedgerAccountId, setStockInInventoryLedgerAccountId] = useState('');
  const [stockInCreditLedgerAccountId, setStockInCreditLedgerAccountId] = useState('');
  const [adjustmentInventoryLedgerAccountId, setAdjustmentInventoryLedgerAccountId] = useState('');
  const [adjustmentLedgerAccountId, setAdjustmentLedgerAccountId] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [apReceiptInvoiceId, setApReceiptInvoiceId] = useState('');
  const [apReceiptWarehouseId, setApReceiptWarehouseId] = useState('');
  const [apReceiptDateUtc, setApReceiptDateUtc] = useState(new Date().toISOString().slice(0, 10));
  const [apReceiptInventoryLedgerAccountId, setApReceiptInventoryLedgerAccountId] = useState('');
  const [apReceiptCreditLedgerAccountId, setApReceiptCreditLedgerAccountId] = useState('');
  const [apReceiptLines, setApReceiptLines] = useState<InvoiceInventoryLineForm[]>([{ ...emptyInvoiceInventoryLine }]);
  const [salesIssueInvoiceId, setSalesIssueInvoiceId] = useState('');
  const [salesIssueWarehouseId, setSalesIssueWarehouseId] = useState('');
  const [salesIssueDateUtc, setSalesIssueDateUtc] = useState(new Date().toISOString().slice(0, 10));
  const [salesIssueInventoryLedgerAccountId, setSalesIssueInventoryLedgerAccountId] = useState('');
  const [salesIssueCogsLedgerAccountId, setSalesIssueCogsLedgerAccountId] = useState('');
  const [salesIssueLines, setSalesIssueLines] = useState<InvoiceInventoryLineForm[]>([{ ...emptyInvoiceInventoryLine }]);
  const [valuationAsOfDate, setValuationAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [valuationItemId, setValuationItemId] = useState('');
  const [valuationWarehouseId, setValuationWarehouseId] = useState('');
  const [reconciliationAsOfDate, setReconciliationAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [reconciliationLedgerAccountId, setReconciliationLedgerAccountId] = useState('');
  const [auditReference, setAuditReference] = useState('');
  const [auditFromDate, setAuditFromDate] = useState('');
  const [auditToDate, setAuditToDate] = useState('');

  const itemsQ = useQuery({
    queryKey: ['inventory-items'],
    queryFn: getInventoryItems,
    enabled: canView,
  });

  const warehousesQ = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const ledgerQ = useQuery({
    queryKey: ['stock-ledger', itemFilter],
    queryFn: () => getStockLedger(itemFilter || undefined),
    enabled: canView,
  });

  const items = itemsQ.data?.items ?? [];
  const warehouses = warehousesQ.data?.items ?? [];
  const ledgerEntries = ledgerQ.data?.items ?? [];
  const ledgerAccounts = accountsQ.data?.items ?? [];

  const postingLedgerAccounts = useMemo(() => {
    return ledgerAccounts.filter((account: LedgerAccountDto) => account.isActive && account.isPostingAllowed && !account.isHeader);
  }, [ledgerAccounts]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

  const activeStockItems = useMemo(() => {
    return items.filter((item) => item.isActive && item.type === 1);
  }, [items]);

  const activeWarehouses = useMemo(() => {
    return warehouses.filter((warehouse) => warehouse.isActive);
  }, [warehouses]);

  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => !warehouseFilter || entry.warehouseId === warehouseFilter);
  }, [ledgerEntries, warehouseFilter]);

  const stockPositionRows = useMemo(() => {
    const map = new Map<string, {
      itemId: string;
      warehouseId: string;
      quantityOnHand: number;
      inventoryValue: number;
    }>();

    for (const entry of ledgerEntries) {
      if (warehouseFilter && entry.warehouseId !== warehouseFilter) continue;

      const key = `${entry.itemId}:${entry.warehouseId}`;
      const current = map.get(key) ?? {
        itemId: entry.itemId,
        warehouseId: entry.warehouseId,
        quantityOnHand: 0,
        inventoryValue: 0,
      };

      current.quantityOnHand += Number(entry.quantity || 0);
      current.inventoryValue += Number(entry.totalCost || 0);
      map.set(key, current);
    }

    return Array.from(map.values())
      .filter((row) => Math.abs(row.quantityOnHand) > 0.0001 || Math.abs(row.inventoryValue) > 0.0001)
      .sort((a, b) => {
        const itemA = itemLabel(itemMap.get(a.itemId));
        const itemB = itemLabel(itemMap.get(b.itemId));
        return itemA.localeCompare(itemB);
      });
  }, [ledgerEntries, itemMap, warehouseFilter]);

  const summary = useMemo(() => {
    const totalQuantity = stockPositionRows.reduce((sum, row) => sum + row.quantityOnHand, 0);
    const totalValue = stockPositionRows.reduce((sum, row) => sum + row.inventoryValue, 0);

    return {
      totalItems: items.length,
      activeItems: items.filter((item) => item.isActive).length,
      totalWarehouses: warehouses.length,
      activeWarehouses: warehouses.filter((warehouse) => warehouse.isActive).length,
      totalQuantity,
      totalValue,
      movementCount: ledgerEntries.length,
    };
  }, [items, warehouses, stockPositionRows, ledgerEntries]);

  const purchaseInvoicesQ = useQuery({
    queryKey: ['ap-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  const salesInvoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  const valuationQ = useQuery({
    queryKey: ['inventory-valuation-report', valuationAsOfDate, valuationItemId, valuationWarehouseId],
    queryFn: () => getInventoryValuationReport({
      asOfUtc: dateInputToUtc(valuationAsOfDate),
      inventoryItemId: valuationItemId || null,
      warehouseId: valuationWarehouseId || null,
    }),
    enabled: canView && activeTab === 'valuation',
  });

  const reconciliationQ = useQuery({
    queryKey: ['inventory-gl-reconciliation', reconciliationLedgerAccountId, reconciliationAsOfDate],
    queryFn: () => getInventoryGlReconciliation({
      inventoryLedgerAccountId: reconciliationLedgerAccountId,
      asOfUtc: dateInputToUtc(reconciliationAsOfDate),
    }),
    enabled: canView && activeTab === 'reconciliation' && !!reconciliationLedgerAccountId,
  });

  const auditTraceQ = useQuery({
    queryKey: ['inventory-audit-trace', auditReference, auditFromDate, auditToDate],
    queryFn: () => getInventoryAuditTrace({
      reference: auditReference.trim() || null,
      fromUtc: auditFromDate ? dateInputToUtc(auditFromDate) : null,
      toUtc: auditToDate ? dateInputToUtc(auditToDate) : null,
    }),
    enabled: canView && activeTab === 'audit',
  });

  const postedPurchaseInvoices = useMemo(() => {
    return (purchaseInvoicesQ.data?.items ?? []).filter((invoice: PurchaseInvoiceDto) =>
      invoice.status === 4 || invoice.status === 5 || invoice.status === 6
    );
  }, [purchaseInvoicesQ.data?.items]);

  const postedSalesInvoices = useMemo(() => {
    return (salesInvoicesQ.data?.items ?? []).filter((invoice: SalesInvoiceDto) =>
      invoice.status === 4 || invoice.status === 5 || invoice.status === 6
    );
  }, [salesInvoicesQ.data?.items]);

  const apReceiptMut = useMutation({
    mutationFn: receivePurchaseInvoiceIntoInventory,
  });
  
  const salesIssueMut = useMutation({
    mutationFn: issueInventoryForSalesInvoice,
  });


  function normalizeInvoiceInventoryLines(lines: InvoiceInventoryLineForm[]) {
    return lines
      .filter((line) => line.inventoryItemId && Number(line.quantity) > 0)
      .map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost || 0),
        description: line.description.trim() || null,
      }));
  }

  async function submitApReceipt() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to post inventory receipts.');
      return;
    }

    if (!apReceiptInvoiceId) {
      setErrorText('Posted purchase invoice is required.');
      return;
    }

    if (!apReceiptWarehouseId) {
      setErrorText('Warehouse is required.');
      return;
    }

    if (!apReceiptInventoryLedgerAccountId) {
      setErrorText('Inventory control ledger account is required.');
      return;
    }

    if (!apReceiptCreditLedgerAccountId) {
      setErrorText('Credit / clearing / payable ledger account is required.');
      return;
    }

    const lines = normalizeInvoiceInventoryLines(apReceiptLines);

    if (lines.length === 0) {
      setErrorText('At least one valid receipt line is required.');
      return;
    }

    if (lines.some((line) => line.unitCost < 0)) {
      setErrorText('Receipt unit cost cannot be negative.');
      return;
    }

    await apReceiptMut.mutateAsync({
      purchaseInvoiceId: apReceiptInvoiceId,
      warehouseId: apReceiptWarehouseId,
      inventoryLedgerAccountId: apReceiptInventoryLedgerAccountId,
      creditLedgerAccountId: apReceiptCreditLedgerAccountId,
      transactionDateUtc: dateInputToUtc(apReceiptDateUtc),
      lines,
    });
  }

  async function submitSalesIssue() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to post inventory issues.');
      return;
    }

    if (!salesIssueInvoiceId) {
      setErrorText('Posted sales invoice is required.');
      return;
    }

    if (!salesIssueWarehouseId) {
      setErrorText('Warehouse is required.');
      return;
    }

    if (!salesIssueInventoryLedgerAccountId) {
      setErrorText('Inventory control ledger account is required.');
      return;
    }

    if (!salesIssueCogsLedgerAccountId) {
      setErrorText('COGS ledger account is required.');
      return;
    }

    const lines = normalizeInvoiceInventoryLines(salesIssueLines);

    if (lines.length === 0) {
      setErrorText('At least one valid sales issue line is required.');
      return;
    }

    if (lines.some((line) => line.unitCost < 0)) {
      setErrorText('Issue unit cost cannot be negative.');
      return;
    }

    await salesIssueMut.mutateAsync({
      salesInvoiceId: salesIssueInvoiceId,
      warehouseId: salesIssueWarehouseId,
      inventoryLedgerAccountId: salesIssueInventoryLedgerAccountId,
      cogsLedgerAccountId: salesIssueCogsLedgerAccountId,
      transactionDateUtc: dateInputToUtc(salesIssueDateUtc),
      lines,
    });
  }

  function addInvoiceInventoryLine(setter: React.Dispatch<React.SetStateAction<InvoiceInventoryLineForm[]>>) {
    setter((prev) => [...prev, { ...emptyInvoiceInventoryLine }]);
  }

  function removeInvoiceInventoryLine(setter: React.Dispatch<React.SetStateAction<InvoiceInventoryLineForm[]>>, index: number) {
    setter((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }

  function updateInvoiceInventoryLine(
    setter: React.Dispatch<React.SetStateAction<InvoiceInventoryLineForm[]>>,
    index: number,
    key: keyof InvoiceInventoryLineForm,
    value: string
  ) {
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }



  async function refreshInventory() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['inventory-items'] }),
      qc.invalidateQueries({ queryKey: ['warehouses'] }),
      qc.invalidateQueries({ queryKey: ['stock-ledger'] }),
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] }),
    ]);
  }

  const createItemMut = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: async () => {
      await refreshInventory();
      setItemForm(emptyItemForm);
      setErrorText('');
      setInfoText('Inventory item created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create inventory item.'));
      setInfoText('');
    },
  });

  const createWarehouseMut = useMutation({
    mutationFn: createWarehouse,
    onSuccess: async () => {
      await refreshInventory();
      setWarehouseForm(emptyWarehouseForm);
      setErrorText('');
      setInfoText('Warehouse created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create warehouse.'));
      setInfoText('');
    },
  });

  const stockInMut = useMutation({
    mutationFn: stockIn,
    onSuccess: async () => {
      await refreshInventory();
      setStockInLines([{ ...emptyStockLine }]);
      setStockInInventoryLedgerAccountId('');
      setStockInCreditLedgerAccountId('');
      setErrorText('');
      setInfoText('Stock-in transaction posted successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to post stock-in transaction.'));
      setInfoText('');
    },
  });

  const adjustmentMut = useMutation({
    mutationFn: stockAdjust,
    onSuccess: async () => {
      await refreshInventory();
      setAdjustmentLines([{ ...emptyStockLine }]);
      setAdjustmentInventoryLedgerAccountId('');
      setAdjustmentLedgerAccountId('');
      setErrorText('');
      setInfoText('Stock adjustment posted successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to post stock adjustment.'));
      setInfoText('');
    },
  });

  function submitItem() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage inventory setup.');
      return;
    }

    if (!itemForm.code.trim()) {
      setErrorText('Item code is required.');
      return;
    }

    if (!itemForm.name.trim()) {
      setErrorText('Item name is required.');
      return;
    }

    if (!itemForm.unitOfMeasure.trim()) {
      setErrorText('Unit of measure is required.');
      return;
    }

    createItemMut.mutate({
      code: itemForm.code.trim().toUpperCase(),
      name: itemForm.name.trim(),
      type: Number(itemForm.type),
      unitOfMeasure: itemForm.unitOfMeasure.trim().toUpperCase(),
      valuationMethod: Number(itemForm.valuationMethod),
    });
  }

  function submitWarehouse() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage inventory setup.');
      return;
    }

    if (!warehouseForm.name.trim()) {
      setErrorText('Warehouse name is required.');
      return;
    }

    createWarehouseMut.mutate({
      name: warehouseForm.name.trim(),
      location: warehouseForm.location?.trim() || null,
    });
  }

  function normalizeStockLines(lines: StockLineForm[]) {
    return lines
      .filter((line) => line.itemId && line.warehouseId && Number(line.quantity) !== 0)
      .map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost || 0),
      }));
  }

  function submitStockIn() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to post inventory movements.');
      return;
    }

    const firstWarehouseId = stockInLines.find((line) => line.warehouseId)?.warehouseId || '';
    const hasMultipleWarehouses = stockInLines.some((line) => line.warehouseId && line.warehouseId !== firstWarehouseId);

    if (!firstWarehouseId) {
      setErrorText('Warehouse is required for stock-in.');
      return;
    }

    if (hasMultipleWarehouses) {
      setErrorText('Stock-in currently supports one warehouse per transaction.');
      return;
    }

    const lines = normalizeStockLines(stockInLines);

    if (lines.length === 0) {
      setErrorText('At least one valid stock-in line is required.');
      return;
    }

    if (lines.some((line) => line.quantity <= 0 || line.unitCost < 0)) {
      setErrorText('Stock-in quantities must be positive and unit costs cannot be negative.');
      return;
    }

    if (!stockInInventoryLedgerAccountId) {
      setErrorText('Inventory control ledger account is required.');
      return;
    }

    if (!stockInCreditLedgerAccountId) {
      setErrorText('Credit ledger account is required for stock-in GL posting.');
      return;
    }

    const payload: CreateStockInRequest = {
      warehouseId: firstWarehouseId,
      inventoryLedgerAccountId: stockInInventoryLedgerAccountId,
      creditLedgerAccountId: stockInCreditLedgerAccountId,
      lines,
    };

    stockInMut.mutate(payload);
  }

  function submitAdjustment() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to post inventory movements.');
      return;
    }

    const firstWarehouseId = adjustmentLines.find((line) => line.warehouseId)?.warehouseId || '';
    const hasMultipleWarehouses = adjustmentLines.some((line) => line.warehouseId && line.warehouseId !== firstWarehouseId);

    if (!firstWarehouseId) {
      setErrorText('Warehouse is required for adjustment.');
      return;
    }

    if (hasMultipleWarehouses) {
      setErrorText('Stock adjustment currently supports one warehouse per transaction.');
      return;
    }

    const lines = normalizeStockLines(adjustmentLines);

    if (lines.length === 0) {
      setErrorText('At least one valid adjustment line is required.');
      return;
    }

    if (lines.some((line) => line.unitCost < 0)) {
      setErrorText('Adjustment unit cost cannot be negative.');
      return;
    }

    if (!adjustmentInventoryLedgerAccountId) {
      setErrorText('Inventory control ledger account is required.');
      return;
    }

    if (!adjustmentLedgerAccountId) {
      setErrorText('Inventory adjustment gain/loss ledger account is required.');
      return;
    }

    const payload: CreateStockAdjustmentRequest = {
      warehouseId: firstWarehouseId,
      inventoryLedgerAccountId: adjustmentInventoryLedgerAccountId,
      adjustmentLedgerAccountId,
      lines,
    };

    adjustmentMut.mutate(payload);
  }

  function updateStockLine(
    setter: React.Dispatch<React.SetStateAction<StockLineForm[]>>,
    index: number,
    key: keyof StockLineForm,
    value: string
  ) {
    setter((state) => {
      const next = [...state];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addStockLine(setter: React.Dispatch<React.SetStateAction<StockLineForm[]>>) {
    setter((state) => [...state, { ...emptyStockLine }]);
  }

  function removeStockLine(setter: React.Dispatch<React.SetStateAction<StockLineForm[]>>, index: number) {
    setter((state) => state.length === 1 ? state : state.filter((_, i) => i !== index));
  }

  function renderInvoiceInventoryLines(
    lines: InvoiceInventoryLineForm[],
    setter: React.Dispatch<React.SetStateAction<InvoiceInventoryLineForm[]>>,
    quantityLabel: string
  ) {
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Inventory Item</th>
              <th style={{ textAlign: 'right' }}>{quantityLabel}</th>
              <th style={{ textAlign: 'right' }}>Unit Cost</th>
              <th style={{ textAlign: 'right' }}>Line Value</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select className="select" value={line.inventoryItemId} onChange={(e) => updateInvoiceInventoryLine(setter, index, 'inventoryItemId', e.target.value)}>
                    <option value="">— Select Item —</option>
                    {activeStockItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="input" type="number" value={line.quantity} onChange={(e) => updateInvoiceInventoryLine(setter, index, 'quantity', e.target.value)} />
                </td>
                <td>
                  <input className="input" type="number" value={line.unitCost} onChange={(e) => updateInvoiceInventoryLine(setter, index, 'unitCost', e.target.value)} />
                </td>
                <td style={{ textAlign: 'right' }}>{formatAmount(Number(line.quantity || 0) * Number(line.unitCost || 0))}</td>
                <td>
                  <input className="input" value={line.description} onChange={(e) => updateInvoiceInventoryLine(setter, index, 'description', e.target.value)} placeholder="Optional description" />
                </td>
                <td>
                  <button className="button" onClick={() => removeInvoiceInventoryLine(setter, index)} disabled={lines.length === 1}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderStockMovementLines(
    lines: StockLineForm[],
    setter: React.Dispatch<React.SetStateAction<StockLineForm[]>>,
    quantityLabel: string
  ) {
    return (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Warehouse</th>
              <th style={{ textAlign: 'right' }}>{quantityLabel}</th>
              <th style={{ textAlign: 'right' }}>Unit Cost</th>
              <th style={{ textAlign: 'right' }}>Line Value</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select className="select" value={line.itemId} onChange={(e) => updateStockLine(setter, index, 'itemId', e.target.value)}>
                    <option value="">— Select Item —</option>
                    {activeStockItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="select" value={line.warehouseId} onChange={(e) => updateStockLine(setter, index, 'warehouseId', e.target.value)}>
                    <option value="">— Select Warehouse —</option>
                    {activeWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="input" type="number" value={line.quantity} onChange={(e) => updateStockLine(setter, index, 'quantity', e.target.value)} />
                </td>
                <td>
                  <input className="input" type="number" value={line.unitCost} onChange={(e) => updateStockLine(setter, index, 'unitCost', e.target.value)} />
                </td>
                <td style={{ textAlign: 'right' }}>{formatAmount(Number(line.quantity || 0) * Number(line.unitCost || 0))}</td>
                <td>
                  <button className="button" onClick={() => removeStockLine(setter, index)} disabled={lines.length === 1}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function printStockPositionReport() {
    setErrorText('');

    if (stockPositionRows.length === 0) {
      setErrorText('There are no stock position rows to print under the current filter.');
      return;
    }

    const summaryHtml = [
      ['Total Items', summary.totalItems],
      ['Active Items', summary.activeItems],
      ['Warehouses', summary.totalWarehouses],
      ['Rows Printed', stockPositionRows.length],
      ['Quantity on Hand', formatQty(summary.totalQuantity)],
      ['Inventory Value', formatAmount(summary.totalValue)],
      ['Item Filter', itemFilter ? itemLabel(itemMap.get(itemFilter)) : 'All Items'],
      ['Warehouse Filter', warehouseFilter ? warehouseLabel(warehouseMap.get(warehouseFilter)) : 'All Warehouses'],
    ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');

    const rowsHtml = stockPositionRows.map((row) => {
      const averageCost = row.quantityOnHand === 0 ? 0 : row.inventoryValue / row.quantityOnHand;
      return `<tr>
        <td>${escapeHtml(itemLabel(itemMap.get(row.itemId)))}</td>
        <td>${escapeHtml(warehouseLabel(warehouseMap.get(row.warehouseId)))}</td>
        <td class="right">${escapeHtml(formatQty(row.quantityOnHand))}</td>
        <td class="right">${escapeHtml(formatAmount(averageCost))}</td>
        <td class="right">${escapeHtml(formatAmount(row.inventoryValue))}</td>
      </tr>`;
    }).join('');

    const tableHtml = `<table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Warehouse</th>
          <th class="right">Qty On Hand</th>
          <th class="right">Average Cost</th>
          <th class="right">Inventory Value</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

    const html = buildInventoryPrintHtml({
      title: 'Stock Position Report',
      subtitle: `Item: ${itemFilter ? itemLabel(itemMap.get(itemFilter)) : 'All Items'} | Warehouse: ${warehouseFilter ? warehouseLabel(warehouseMap.get(warehouseFilter)) : 'All Warehouses'}`,
      summaryHtml,
      tableHtml,
    });

    printHtmlDocument(html, setErrorText);
  }

  function printStockLedgerReport() {
    setErrorText('');

    if (filteredLedgerEntries.length === 0) {
      setErrorText('There are no stock ledger rows to print under the current filter.');
      return;
    }

    const totalQuantity = filteredLedgerEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const totalValue = filteredLedgerEntries.reduce((sum, entry) => sum + Number(entry.totalCost || 0), 0);

    const summaryHtml = [
      ['Ledger Rows', filteredLedgerEntries.length],
      ['Net Quantity', formatQty(totalQuantity)],
      ['Net Value', formatAmount(totalValue)],
      ['Item Filter', itemFilter ? itemLabel(itemMap.get(itemFilter)) : 'All Items'],
      ['Warehouse Filter', warehouseFilter ? warehouseLabel(warehouseMap.get(warehouseFilter)) : 'All Warehouses'],
      ['Movements Loaded', ledgerEntries.length],
      ['Printed On', formatDateTime(new Date().toISOString())],
      ['Report Type', 'Stock Ledger'],
    ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');

    const rowsHtml = filteredLedgerEntries.map((entry) => `<tr>
      <td>${escapeHtml(formatDateTime(entry.movementDateUtc))}</td>
      <td>${escapeHtml(itemLabel(itemMap.get(entry.itemId)))}</td>
      <td>${escapeHtml(warehouseLabel(warehouseMap.get(entry.warehouseId)))}</td>
      <td>${escapeHtml(movementTypeLabel(entry.movementType))}</td>
      <td class="right">${escapeHtml(formatQty(entry.quantity))}</td>
      <td class="right">${escapeHtml(formatAmount(entry.unitCost))}</td>
      <td class="right">${escapeHtml(formatAmount(entry.totalCost))}</td>
      <td>${escapeHtml(referenceTypeLabel(entry.referenceType))}<br /><span style="color:#4b5563">${escapeHtml(entry.referenceId || '—')}</span></td>
    </tr>`).join('');

    const tableHtml = `<table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Warehouse</th>
          <th>Movement</th>
          <th class="right">Quantity</th>
          <th class="right">Unit Cost</th>
          <th class="right">Total Cost</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

    const html = buildInventoryPrintHtml({
      title: 'Stock Ledger Report',
      subtitle: `Item: ${itemFilter ? itemLabel(itemMap.get(itemFilter)) : 'All Items'} | Warehouse: ${warehouseFilter ? warehouseLabel(warehouseMap.get(warehouseFilter)) : 'All Warehouses'}`,
      summaryHtml,
      tableHtml,
    });

    printHtmlDocument(html, setErrorText);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view inventory.</div>;
  }

  if (itemsQ.isLoading || warehousesQ.isLoading || accountsQ.isLoading || ledgerQ.isLoading || purchaseInvoicesQ.isLoading || salesInvoicesQ.isLoading) {
    return <div className="panel">Loading inventory...</div>;
  }

  if (itemsQ.isError || warehousesQ.isError || accountsQ.isError || ledgerQ.isError || purchaseInvoicesQ.isError || salesInvoicesQ.isError || !itemsQ.data || !warehousesQ.data || !accountsQ.data || !ledgerQ.data) {
    return <div className="panel error-panel">We could not load inventory data at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Inventory Management</h2>
            <div className="muted">Manage items, warehouses, stock-in, adjustments, and stock ledger movements.</div>
          </div>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Items</span><span>{summary.totalItems}</span></div>
          <div className="kv-row"><span>Active Items</span><span>{summary.activeItems}</span></div>
          <div className="kv-row"><span>Total Warehouses</span><span>{summary.totalWarehouses}</span></div>
          <div className="kv-row"><span>Active Warehouses</span><span>{summary.activeWarehouses}</span></div>
          <div className="kv-row"><span>Quantity on Hand</span><span>{formatQty(summary.totalQuantity)}</span></div>
          <div className="kv-row"><span>Inventory Value</span><span>{formatAmount(summary.totalValue)}</span></div>
          <div className="kv-row"><span>Stock Movements</span><span>{summary.movementCount}</span></div>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button" onClick={() => setActiveTab('overview')}>Overview</button>
          <button className="button" onClick={() => setActiveTab('items')}>Items</button>
          <button className="button" onClick={() => setActiveTab('warehouses')}>Warehouses</button>
          <button className="button" onClick={() => setActiveTab('stock-in')}>Stock In</button>
          <button className="button" onClick={() => setActiveTab('adjustments')}>Adjustments</button>
          <button className="button" onClick={() => setActiveTab('ap-receipt')}>AP Receipt</button>
          <button className="button" onClick={() => setActiveTab('sales-issue')}>Sales Issue / COGS</button>
          <button className="button" onClick={() => setActiveTab('ledger')}>Stock Ledger</button>
          <button className="button" onClick={() => setActiveTab('valuation')}>Valuation</button>
          <button className="button" onClick={() => setActiveTab('reconciliation')}>GL Reconciliation</button>
          <button className="button" onClick={() => setActiveTab('audit')}>Audit Trace</button>
        </div>

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      {activeTab === 'overview' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Stock Position</h2>
              <span className="muted">{stockPositionRows.length} item/warehouse balance(s)</span>
            </div>
            <button className="button" onClick={printStockPositionReport}>Print Stock Position</button>
          </div>

          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Item Filter</label>
              <select className="select" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
                <option value="">All Items</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <label>Warehouse Filter</label>
              <select className="select" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th style={{ textAlign: 'right' }}>Qty On Hand</th>
                  <th style={{ textAlign: 'right' }}>Average Cost</th>
                  <th style={{ textAlign: 'right' }}>Inventory Value</th>
                </tr>
              </thead>
              <tbody>
                {stockPositionRows.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No stock balances available yet.</td></tr>
                ) : (
                  stockPositionRows.map((row) => {
                    const averageCost = row.quantityOnHand === 0 ? 0 : row.inventoryValue / row.quantityOnHand;

                    return (
                      <tr key={`${row.itemId}-${row.warehouseId}`}>
                        <td>{itemLabel(itemMap.get(row.itemId))}</td>
                        <td>{warehouseLabel(warehouseMap.get(row.warehouseId))}</td>
                        <td style={{ textAlign: 'right' }}>{formatQty(row.quantityOnHand)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(averageCost)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(row.inventoryValue)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'items' ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Items</h2>
            <span className="muted">{items.length} item(s)</span>
          </div>

          {canManage ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="section-heading"><h2>Create Item</h2></div>
              <div className="form-grid two">
                <div className="form-row"><label>Code</label><input className="input" value={itemForm.code} onChange={(e) => setItemForm((state) => ({ ...state, code: e.target.value }))} /></div>
                <div className="form-row"><label>Name</label><input className="input" value={itemForm.name} onChange={(e) => setItemForm((state) => ({ ...state, name: e.target.value }))} /></div>
                <div className="form-row"><label>Type</label><select className="select" value={itemForm.type} onChange={(e) => setItemForm((state) => ({ ...state, type: Number(e.target.value) }))}><option value={1}>Stock Item</option><option value={2}>Service</option></select></div>
                <div className="form-row"><label>Valuation Method</label><select className="select" value={itemForm.valuationMethod} onChange={(e) => setItemForm((state) => ({ ...state, valuationMethod: Number(e.target.value) }))}><option value={1}>FIFO</option><option value={2}>Weighted Average</option></select></div>
                <div className="form-row"><label>Unit of Measure</label><input className="input" value={itemForm.unitOfMeasure} onChange={(e) => setItemForm((state) => ({ ...state, unitOfMeasure: e.target.value.toUpperCase() }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="button primary" onClick={submitItem} disabled={createItemMut.isPending}>{createItemMut.isPending ? 'Creating…' : 'Create Item'}</button>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>UOM</th><th>Valuation</th><th>Status</th></tr></thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No inventory items have been created yet.</td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{itemTypeLabel(item.type)}</td>
                      <td>{item.unitOfMeasure}</td>
                      <td>{valuationMethodLabel(item.valuationMethod)}</td>
                      <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'warehouses' ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Warehouses</h2>
            <span className="muted">{warehouses.length} warehouse(s)</span>
          </div>

          {canManage ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="section-heading"><h2>Create Warehouse</h2></div>
              <div className="form-grid two">
                <div className="form-row"><label>Name</label><input className="input" value={warehouseForm.name} onChange={(e) => setWarehouseForm((state) => ({ ...state, name: e.target.value }))} /></div>
                <div className="form-row"><label>Location</label><input className="input" value={warehouseForm.location || ''} onChange={(e) => setWarehouseForm((state) => ({ ...state, location: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="button primary" onClick={submitWarehouse} disabled={createWarehouseMut.isPending}>{createWarehouseMut.isPending ? 'Creating…' : 'Create Warehouse'}</button>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr><td colSpan={3} className="muted">No warehouses have been created yet.</td></tr>
                ) : (
                  warehouses.map((warehouse) => (
                    <tr key={warehouse.id}>
                      <td>{warehouse.name}</td>
                      <td>{warehouse.location || '—'}</td>
                      <td>{warehouse.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'stock-in' ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Stock In</h2>
            <span className="muted">Receive stock into inventory and post the related GL entry.</span>
          </div>

          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Inventory Control Ledger Account</label>
              <select className="select" value={stockInInventoryLedgerAccountId} onChange={(e) => setStockInInventoryLedgerAccountId(e.target.value)}>
                <option value="">— Select Inventory Account —</option>
                {postingLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Credit Ledger Account</label>
              <select className="select" value={stockInCreditLedgerAccountId} onChange={(e) => setStockInCreditLedgerAccountId(e.target.value)}>
                <option value="">— Select Credit Account —</option>
                {postingLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
          </div>

          {renderStockMovementLines(stockInLines, setStockInLines, 'Quantity In')}

          <div className="modal-footer">
            <button className="button" onClick={() => addStockLine(setStockInLines)}>Add Line</button>
            <button className="button primary" onClick={submitStockIn} disabled={stockInMut.isPending}>{stockInMut.isPending ? 'Posting…' : 'Post Stock In'}</button>
          </div>
        </section>
      ) : null}

      {activeTab === 'adjustments' ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Stock Adjustment</h2>
            <span className="muted">Use positive quantity for increase and negative quantity for decrease.</span>
          </div>

          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Inventory Control Ledger Account</label>
              <select className="select" value={adjustmentInventoryLedgerAccountId} onChange={(e) => setAdjustmentInventoryLedgerAccountId(e.target.value)}>
                <option value="">— Select Inventory Account —</option>
                {postingLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Adjustment Gain/Loss Ledger Account</label>
              <select className="select" value={adjustmentLedgerAccountId} onChange={(e) => setAdjustmentLedgerAccountId(e.target.value)}>
                <option value="">— Select Adjustment Account —</option>
                {postingLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
          </div>

          {renderStockMovementLines(adjustmentLines, setAdjustmentLines, 'Quantity Change')}

          <div className="modal-footer">
            <button className="button" onClick={() => addStockLine(setAdjustmentLines)}>Add Line</button>
            <button className="button primary" onClick={submitAdjustment} disabled={adjustmentMut.isPending}>{adjustmentMut.isPending ? 'Posting…' : 'Post Adjustment'}</button>
          </div>
        </section>
      ) : null}

      {activeTab === 'ap-receipt' ? (
        <section className="panel">
          <div className="section-heading"><div><h2>Receive Posted Purchase Invoice into Inventory</h2><span className="muted">Creates stock ledger entries and posts Dr Inventory / Cr selected clearing or payable account.</span></div></div>
          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row"><label>Posted Purchase Invoice</label><select className="select" value={apReceiptInvoiceId} onChange={(e) => setApReceiptInvoiceId(e.target.value)}><option value="">— Select Posted Purchase Invoice —</option>{postedPurchaseInvoices.map((invoice: PurchaseInvoiceDto) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {invoice.vendorName} - {formatAmount(invoice.netPayableAmount || invoice.totalAmount)}</option>)}</select></div>
            <div className="form-row"><label>Warehouse</label><select className="select" value={apReceiptWarehouseId} onChange={(e) => setApReceiptWarehouseId(e.target.value)}><option value="">— Select Warehouse —</option>{activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>)}</select></div>
            <div className="form-row"><label>Receipt Date</label><input className="input" type="date" value={apReceiptDateUtc} onChange={(e) => setApReceiptDateUtc(e.target.value)} /></div>
            <div className="form-row"><label>Inventory Control Ledger Account</label><select className="select" value={apReceiptInventoryLedgerAccountId} onChange={(e) => setApReceiptInventoryLedgerAccountId(e.target.value)}><option value="">— Select Inventory Account —</option>{postingLedgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
            <div className="form-row"><label>Credit / Clearing / Payable Ledger Account</label><select className="select" value={apReceiptCreditLedgerAccountId} onChange={(e) => setApReceiptCreditLedgerAccountId(e.target.value)}><option value="">— Select Credit Account —</option>{postingLedgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
          </div>
          {renderInvoiceInventoryLines(apReceiptLines, setApReceiptLines, 'Quantity Received')}
          <div className="modal-footer"><button className="button" onClick={() => addInvoiceInventoryLine(setApReceiptLines)}>Add Line</button><button className="button primary" onClick={submitApReceipt} disabled={apReceiptMut.isPending}>{apReceiptMut.isPending ? 'Posting…' : 'Receive into Inventory'}</button></div>
        </section>
      ) : null}

      {activeTab === 'sales-issue' ? (
        <section className="panel">
          <div className="section-heading"><div><h2>Issue Inventory for Posted Sales Invoice / Post COGS</h2><span className="muted">Creates stock issue entries and posts Dr COGS / Cr Inventory. Unit cost can be zero to let backend use weighted average.</span></div></div>
          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row"><label>Posted Sales Invoice</label><select className="select" value={salesIssueInvoiceId} onChange={(e) => setSalesIssueInvoiceId(e.target.value)}><option value="">— Select Posted Sales Invoice —</option>{postedSalesInvoices.map((invoice: SalesInvoiceDto) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {invoice.customerName} - {formatAmount(invoice.netReceivableAmount || invoice.totalAmount)}</option>)}</select></div>
            <div className="form-row"><label>Warehouse</label><select className="select" value={salesIssueWarehouseId} onChange={(e) => setSalesIssueWarehouseId(e.target.value)}><option value="">— Select Warehouse —</option>{activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>)}</select></div>
            <div className="form-row"><label>Issue Date</label><input className="input" type="date" value={salesIssueDateUtc} onChange={(e) => setSalesIssueDateUtc(e.target.value)} /></div>
            <div className="form-row"><label>Inventory Control Ledger Account</label><select className="select" value={salesIssueInventoryLedgerAccountId} onChange={(e) => setSalesIssueInventoryLedgerAccountId(e.target.value)}><option value="">— Select Inventory Account —</option>{postingLedgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
            <div className="form-row"><label>COGS Ledger Account</label><select className="select" value={salesIssueCogsLedgerAccountId} onChange={(e) => setSalesIssueCogsLedgerAccountId(e.target.value)}><option value="">— Select COGS Account —</option>{postingLedgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
          </div>
          {renderInvoiceInventoryLines(salesIssueLines, setSalesIssueLines, 'Quantity Issued')}
          <div className="modal-footer"><button className="button" onClick={() => addInvoiceInventoryLine(setSalesIssueLines)}>Add Line</button><button className="button primary" onClick={submitSalesIssue} disabled={salesIssueMut.isPending}>{salesIssueMut.isPending ? 'Posting…' : 'Post Issue / COGS'}</button></div>
        </section>
      ) : null}


      {activeTab === 'valuation' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Inventory Valuation Report</h2>
              <span className="muted">Inventory value by item and warehouse, based on stock ledger cost movements.</span>
            </div>
          </div>

          <div className="form-grid three" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>As Of Date</label>
              <input className="input" type="date" value={valuationAsOfDate} onChange={(e) => setValuationAsOfDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Item</label>
              <select className="select" value={valuationItemId} onChange={(e) => setValuationItemId(e.target.value)}>
                <option value="">All Items</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Warehouse</label>
              <select className="select" value={valuationWarehouseId} onChange={(e) => setValuationWarehouseId(e.target.value)}>
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>)}
              </select>
            </div>
          </div>

          {valuationQ.isLoading ? <div className="panel">Loading inventory valuation...</div> : null}
          {valuationQ.isError ? <div className="panel error-panel">Unable to load inventory valuation report.</div> : null}

          {valuationQ.data ? (
            <>
              <div className="kv">
                <div className="kv-row"><span>Rows</span><span>{valuationQ.data.count}</span></div>
                <div className="kv-row"><span>Total Quantity</span><span>{formatQty(valuationQ.data.totalQuantityOnHand)}</span></div>
                <div className="kv-row"><span>Total Inventory Value</span><span>{formatAmount(valuationQ.data.totalInventoryValue)}</span></div>
                <div className="kv-row"><span>As Of</span><span>{formatDateTime(valuationQ.data.asOfUtc)}</span></div>
              </div>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Warehouse</th>
                      <th>UOM</th>
                      <th style={{ textAlign: 'right' }}>Qty On Hand</th>
                      <th style={{ textAlign: 'right' }}>Average Cost</th>
                      <th style={{ textAlign: 'right' }}>Inventory Value</th>
                      <th style={{ textAlign: 'right' }}>Movements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuationQ.data.items.length === 0 ? (
                      <tr><td colSpan={7} className="muted">No valuation rows found.</td></tr>
                    ) : (
                      valuationQ.data.items.map((row: InventoryValuationRowDto) => (
                        <tr key={`${row.inventoryItemId}-${row.warehouseId}`}>
                          <td>{row.itemCode} - {row.itemName}</td>
                          <td>{row.warehouseCode} - {row.warehouseName}</td>
                          <td>{row.unitOfMeasure || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{formatQty(row.quantityOnHand)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(row.averageUnitCost)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(row.inventoryValue)}</td>
                          <td style={{ textAlign: 'right' }}>{row.movementCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'reconciliation' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Stock vs GL Reconciliation</h2>
              <span className="muted">Compare stock ledger valuation with the selected Inventory Control ledger account balance.</span>
            </div>
          </div>

          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Inventory Control Ledger Account</label>
              <select className="select" value={reconciliationLedgerAccountId} onChange={(e) => setReconciliationLedgerAccountId(e.target.value)}>
                <option value="">— Select Inventory Account —</option>
                {postingLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>As Of Date</label>
              <input className="input" type="date" value={reconciliationAsOfDate} onChange={(e) => setReconciliationAsOfDate(e.target.value)} />
            </div>
          </div>

          {!reconciliationLedgerAccountId ? <div className="panel">Select an Inventory Control ledger account to run reconciliation.</div> : null}
          {reconciliationQ.isLoading ? <div className="panel">Loading reconciliation...</div> : null}
          {reconciliationQ.isError ? <div className="panel error-panel">Unable to load stock vs GL reconciliation.</div> : null}

          {reconciliationQ.data ? (
            <>
              <div className="kv">
                <div className="kv-row"><span>Stock Value</span><span>{formatAmount(reconciliationQ.data.stockValue)}</span></div>
                <div className="kv-row"><span>GL Debit</span><span>{formatAmount(reconciliationQ.data.glDebit)}</span></div>
                <div className="kv-row"><span>GL Credit</span><span>{formatAmount(reconciliationQ.data.glCredit)}</span></div>
                <div className="kv-row"><span>GL Balance</span><span>{formatAmount(reconciliationQ.data.glBalance)}</span></div>
                <div className="kv-row"><span>Difference</span><span>{formatAmount(reconciliationQ.data.difference)}</span></div>
                <div className="kv-row"><span>Status</span><span>{reconciliationQ.data.isReconciled ? 'Reconciled' : 'Not Reconciled'}</span></div>
              </div>
              <div className={reconciliationQ.data.isReconciled ? 'panel' : 'panel error-panel'} style={{ marginTop: 16 }}>
                {reconciliationQ.data.isReconciled
                  ? 'Stock ledger valuation agrees with the selected GL inventory control account.'
                  : 'Stock ledger valuation does not agree with the selected GL inventory control account. Review audit trace and inventory journals.'}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Inventory Audit Trace</h2>
              <span className="muted">Trace inventory transaction → stock ledger → journal entry → ledger movements.</span>
            </div>
          </div>

          <div className="form-grid three" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Reference / Transaction Number</label>
              <input className="input" value={auditReference} onChange={(e) => setAuditReference(e.target.value)} placeholder="Search transaction or reference" />
            </div>
            <div className="form-row">
              <label>From Date</label>
              <input className="input" type="date" value={auditFromDate} onChange={(e) => setAuditFromDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>To Date</label>
              <input className="input" type="date" value={auditToDate} onChange={(e) => setAuditToDate(e.target.value)} />
            </div>
          </div>

          {auditTraceQ.isLoading ? <div className="panel">Loading audit trace...</div> : null}
          {auditTraceQ.isError ? <div className="panel error-panel">Unable to load inventory audit trace.</div> : null}

          {auditTraceQ.data ? (
            <div className="stack">
              {auditTraceQ.data.items.length === 0 ? (
                <div className="panel">No inventory audit trace rows found.</div>
              ) : (
                auditTraceQ.data.items.map((trace: InventoryAuditTraceResponse['items'][number]) => (
                  <div className="panel" key={trace.transaction.id}>
                    <div className="section-heading">
                      <div>
                        <h2>{trace.transaction.transactionNumber}</h2>
                        <div className="muted">{formatDateTime(trace.transaction.transactionDateUtc)} · {trace.transaction.description}</div>
                      </div>
                      <div className="muted">{trace.transaction.reference || 'No external reference'}</div>
                    </div>

                    <div className="kv">
                      <div className="kv-row"><span>Transaction Id</span><span>{trace.transaction.id}</span></div>
                      <div className="kv-row"><span>Journal Entry</span><span>{trace.journalEntry?.reference || '—'}</span></div>
                      <div className="kv-row"><span>Journal Debit</span><span>{formatAmount(trace.journalEntry?.totalDebit || 0)}</span></div>
                      <div className="kv-row"><span>Journal Credit</span><span>{formatAmount(trace.journalEntry?.totalCredit || 0)}</span></div>
                    </div>

                    <div className="table-wrap" style={{ marginTop: 16 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Warehouse</th>
                            <th>Movement</th>
                            <th style={{ textAlign: 'right' }}>Qty In</th>
                            <th style={{ textAlign: 'right' }}>Qty Out</th>
                            <th style={{ textAlign: 'right' }}>Unit Cost</th>
                            <th style={{ textAlign: 'right' }}>Total Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trace.stockLedgerEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td>{entry.itemCode} - {entry.itemName}</td>
                              <td>{entry.warehouseCode} - {entry.warehouseName}</td>
                              <td>{movementTypeLabel(entry.movementType)}</td>
                              <td style={{ textAlign: 'right' }}>{formatQty(entry.quantityIn)}</td>
                              <td style={{ textAlign: 'right' }}>{formatQty(entry.quantityOut)}</td>
                              <td style={{ textAlign: 'right' }}>{formatAmount(entry.unitCost)}</td>
                              <td style={{ textAlign: 'right' }}>{formatAmount(entry.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="table-wrap" style={{ marginTop: 16 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>GL Account</th>
                            <th>Description</th>
                            <th style={{ textAlign: 'right' }}>Debit</th>
                            <th style={{ textAlign: 'right' }}>Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trace.ledgerMovements.map((movement) => (
                            <tr key={movement.id}>
                              <td>{movement.ledgerAccountCode} - {movement.ledgerAccountName}</td>
                              <td>{movement.description}</td>
                              <td style={{ textAlign: 'right' }}>{formatAmount(movement.debitAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatAmount(movement.creditAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'ledger' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Stock Ledger</h2>
              <span className="muted">{filteredLedgerEntries.length} movement(s)</span>
            </div>
            <button className="button" onClick={printStockLedgerReport}>Print Stock Ledger</button>
          </div>

          <div className="form-grid two" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Item Filter</label>
              <select className="select" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
                <option value="">All Items</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </select>
            </div>

            <div className="form-row">
              <label>Warehouse Filter</label>
              <select className="select" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">All Warehouses</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouseLabel(warehouse)}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Movement</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedgerEntries.length === 0 ? (
                  <tr><td colSpan={8} className="muted">No stock ledger entries found.</td></tr>
                ) : (
                  filteredLedgerEntries.map((entry: StockLedgerEntryDto) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.movementDateUtc)}</td>
                      <td>{itemLabel(itemMap.get(entry.itemId))}</td>
                      <td>{warehouseLabel(warehouseMap.get(entry.warehouseId))}</td>
                      <td>{movementTypeLabel(entry.movementType)}</td>
                      <td style={{ textAlign: 'right' }}>{formatQty(entry.quantity)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(entry.unitCost)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(entry.totalCost)}</td>
                      <td>
                        <div>{referenceTypeLabel(entry.referenceType)}</div>
                        <div className="muted">{entry.referenceId || '—'}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
