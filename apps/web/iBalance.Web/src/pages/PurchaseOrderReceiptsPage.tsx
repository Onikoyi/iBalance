import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPurchaseOrderReceipt,
  getAccounts,
  getInventoryItems,
  getPurchaseOrderReceipts,
  getPurchaseOrders,
  getTenantReadableError,
  getWarehouses,
  type CreatePurchaseOrderReceiptLineRequest,
  type InventoryItemDto,
  type LedgerAccountDto,
  type PurchaseOrderDto,
  type PurchaseOrderReceiptDto,
  type WarehouseDto,
} from '../lib/api';
import { canCreatePurchaseOrderReceipts, canViewProcurement } from '../lib/auth';

type ReceiptLineForm = {
  purchaseOrderLineId: string;
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitCost: string;
  notes: string;
};

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function statusLabel(value: number) {
  switch (value) {
    case 4:
      return 'Posted';
    default:
      return 'Unknown';
  }
}

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : new Date().toISOString();
}

export function PurchaseOrderReceiptsPage() {
  const qc = useQueryClient();
  const canView = canViewProcurement();
  const canManage = canCreatePurchaseOrderReceipts();

  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [inventoryLedgerAccountId, setInventoryLedgerAccountId] = useState('');
  const [receiptClearingLedgerAccountId, setReceiptClearingLedgerAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineForms, setLineForms] = useState<ReceiptLineForm[]>([]);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const purchaseOrdersQ = useQuery({
    queryKey: ['procurement-purchase-orders'],
    queryFn: getPurchaseOrders,
    enabled: canView,
  });

  const receiptsQ = useQuery({
    queryKey: ['procurement-purchase-order-receipts'],
    queryFn: getPurchaseOrderReceipts,
    enabled: canView,
  });

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

  const createMut = useMutation({
    mutationFn: createPurchaseOrderReceipt,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-order-receipts'] });
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      await qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setMessage(response?.message || response?.Message || 'Purchase order receipt created successfully.');
      setErrorText('');
      setSelectedPurchaseOrderId('');
      setWarehouseId('');
      setInventoryLedgerAccountId('');
      setReceiptClearingLedgerAccountId('');
      setNotes('');
      setLineForms([]);
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create purchase order receipt.')),
  });

  const purchaseOrders = ((purchaseOrdersQ.data?.items ?? []) as PurchaseOrderDto[]).filter(
    (po) => po.status === 3 || po.status === 4
  );
  const receipts = (receiptsQ.data?.items ?? []) as PurchaseOrderReceiptDto[];
  const itemMap = new Map(
    ((itemsQ.data?.items ?? []) as InventoryItemDto[]).map((item) => [item.id, item])
  );
  const warehouses = ((warehousesQ.data?.items ?? []) as WarehouseDto[]).filter(
    (warehouse) => warehouse.isActive
  );
  const postingAccounts = ((accountsQ.data?.items ?? []) as LedgerAccountDto[]).filter(
    (account) => account.isPostingAllowed && account.isActive && !account.isHeader
  );

  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((po) => po.id === selectedPurchaseOrderId) || null,
    [purchaseOrders, selectedPurchaseOrderId]
  );

  const outstandingLines = useMemo(() => {
    if (!selectedPurchaseOrder?.lines) return [];
    return selectedPurchaseOrder.lines
      .map((line) => ({
        ...line,
        outstandingQuantity: Number(line.quantity || 0) - Number((line as any).receivedQuantity || 0),
      }))
      .filter((line) => line.outstandingQuantity > 0);
  }, [selectedPurchaseOrder]);

  function mapOutstandingLinesToForms() {
    return outstandingLines.map((line) => ({
      purchaseOrderLineId: line.id,
      inventoryItemId: line.inventoryItemId || '',
      description: line.description || '',
      quantity: String(line.outstandingQuantity),
      unitCost: String(line.unitPrice || 0),
      notes: line.notes || '',
    }));
  }

  function loadOutstandingLines() {
    if (!selectedPurchaseOrder) return;
    setLineForms(mapOutstandingLinesToForms());
  }

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setLineForms([]);
      return;
    }

    setLineForms(mapOutstandingLinesToForms());
  }, [selectedPurchaseOrderId, outstandingLines.length]);

  function updateLine(index: number, patch: Partial<ReceiptLineForm>) {
    setLineForms((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLineForms((current) => [
      ...current,
      {
        purchaseOrderLineId: '',
        inventoryItemId: '',
        description: '',
        quantity: '',
        unitCost: '',
        notes: '',
      },
    ]);
  }

  function removeLine(index: number) {
    setLineForms((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function submit() {
    setErrorText('');
    setMessage('');

    if (!canManage) {
      setErrorText('You do not have permission to post purchase order receipts.');
      return;
    }

    if (!selectedPurchaseOrderId) {
      setErrorText('Purchase order is required.');
      return;
    }

    const lines = lineForms
      .filter((line) => line.purchaseOrderLineId && Number(line.quantity) > 0)
      .map(
        (line): CreatePurchaseOrderReceiptLineRequest => ({
          purchaseOrderLineId: line.purchaseOrderLineId,
          inventoryItemId: line.inventoryItemId || null,
          description: line.description.trim() || null,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost || 0),
          notes: line.notes.trim() || null,
        })
      );

    if (lines.length === 0) {
      setErrorText('At least one valid receipt line is required.');
      return;
    }

    const hasStockLines = lines.some((line) => {
      if (!line.inventoryItemId) return false;
      const item = itemMap.get(line.inventoryItemId);
      return item?.itemType === 1;
    });

    if (hasStockLines && !warehouseId) {
      setErrorText('Warehouse is required when receiving stock items.');
      return;
    }

    if (hasStockLines && (!inventoryLedgerAccountId || !receiptClearingLedgerAccountId)) {
      setErrorText('Inventory control and receipt clearing accounts are required when receiving stock items.');
      return;
    }

    await createMut.mutateAsync({
      purchaseOrderId: selectedPurchaseOrderId,
      warehouseId: warehouseId || null,
      inventoryLedgerAccountId: inventoryLedgerAccountId || null,
      receiptClearingLedgerAccountId: receiptClearingLedgerAccountId || null,
      receiptDateUtc: dateInputToUtc(receiptDate),
      notes: notes.trim() || null,
      lines,
    });
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to Purchase Order Receipts.</div>;
  }

  if (purchaseOrdersQ.isLoading || receiptsQ.isLoading) {
    return <div className="panel">Loading purchase order receipts...</div>;
  }

  if (purchaseOrdersQ.isError || receiptsQ.isError || !purchaseOrdersQ.data || !receiptsQ.data) {
    return <div className="panel error-panel">Unable to load purchase order receipt workspace.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Purchase Order Receipts</h2>
            <div className="muted">
              Record goods receipt notes and service receipts against approved purchase orders. Stock item receipts update inventory and post Dr Inventory / Cr receipt clearing.
            </div>
          </div>
        </div>

        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        {itemsQ.isError ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="muted">
              Inventory items could not be loaded. Receipt entry remains available, but item-assisted selection is temporarily limited.
            </div>
          </div>
        ) : null}

        {warehousesQ.isError ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="muted">
              Warehouses could not be loaded. Receipt workspace remains available, but warehouse-backed stock receipts are temporarily unavailable.
            </div>
          </div>
        ) : null}

        {accountsQ.isError ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="muted">
              Ledger accounts could not be loaded. You can still review the receipt workspace, but receipt posting for stock items is unavailable until ledger accounts load successfully.
            </div>
          </div>
        ) : null}

        <div className="form-grid two">
          <div className="form-row">
            <label>Purchase Order</label>
            <select className="input" value={selectedPurchaseOrderId} onChange={(e) => setSelectedPurchaseOrderId(e.target.value)}>
              <option value="">Select purchase order</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.purchaseOrderNumber} - {po.vendorName || 'Vendor'} - {formatAmount(po.totalAmount || 0)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Receipt Date</label>
            <input className="input" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Warehouse</label>
            <select
              className="input"
              value={warehouseId}
              disabled={warehousesQ.isLoading || warehousesQ.isError}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Select warehouse when stock items are involved</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouseCode} - {warehouse.warehouseName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Inventory Control Ledger</label>
            <select
              className="input"
              value={inventoryLedgerAccountId}
              disabled={accountsQ.isLoading || accountsQ.isError}
              onChange={(e) => setInventoryLedgerAccountId(e.target.value)}
            >
              <option value="">Select inventory control ledger</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Receipt Clearing Ledger</label>
            <select
              className="input"
              value={receiptClearingLedgerAccountId}
              disabled={accountsQ.isLoading || accountsQ.isError}
              onChange={(e) => setReceiptClearingLedgerAccountId(e.target.value)}
            >
              <option value="">Select receipt clearing / GRNI ledger</option>
              {postingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="button" type="button" onClick={loadOutstandingLines} disabled={!selectedPurchaseOrder}>
            Load Outstanding PO Lines
          </button>
          <button className="button" type="button" onClick={addLine} disabled={!selectedPurchaseOrder}>
            Add Receipt Line
          </button>
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          Select a purchase order first. Once selected, outstanding lines will auto-load below and you can reload them here at any time.
        </div>

        {selectedPurchaseOrder ? (
          <>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO Line</th>
                    <th>Item</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th style={{ textAlign: 'right' }}>Receive Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Cost</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lineForms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="muted">
                        No receipt lines loaded yet.
                      </td>
                    </tr>
                  ) : (
                    lineForms.map((line, index) => {
                      const poLine =
                        outstandingLines.find((po) => po.id === line.purchaseOrderLineId) ||
                        selectedPurchaseOrder.lines?.find((po) => po.id === line.purchaseOrderLineId);

                      const item = line.inventoryItemId ? itemMap.get(line.inventoryItemId) : undefined;
                      const outstanding = poLine
                        ? Number(poLine.quantity || 0) - Number((poLine as any).receivedQuantity || 0)
                        : 0;

                      return (
                        <tr key={`${line.purchaseOrderLineId}-${index}`}>
                          <td>
                            <select
                              className="input"
                              value={line.purchaseOrderLineId}
                              onChange={(e) => {
                                const selectedLine = selectedPurchaseOrder.lines?.find(
                                  (po) => po.id === e.target.value
                                );
                                updateLine(index, {
                                  purchaseOrderLineId: e.target.value,
                                  inventoryItemId: selectedLine?.inventoryItemId || '',
                                  description: selectedLine?.description || '',
                                  unitCost: String(selectedLine?.unitPrice || 0),
                                });
                              }}
                            >
                              <option value="">Select PO line</option>
                              {outstandingLines.map((poLine) => (
                                <option key={poLine.id} value={poLine.id}>
                                  {poLine.description}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{item ? `${item.itemCode} - ${item.itemName}` : 'Service / non-stock'}</td>
                          <td>
                            <input
                              className="input"
                              value={line.description}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(outstanding)}</td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              value={line.unitCost}
                              onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={line.notes}
                              onChange={(e) => updateLine(index, { notes: e.target.value })}
                            />
                          </td>
                          <td>
                            <button className="button danger" type="button" onClick={() => removeLine(index)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button className="button primary" type="button" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Posting…' : 'Post Receipt'}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <h3>Receipt Register</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Purchase Order</th>
                <th>Warehouse</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Lines</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No purchase order receipts yet.
                  </td>
                </tr>
              ) : (
                receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{receipt.receiptNumber}</td>
                    <td>{receipt.purchaseOrderNumber || '—'}</td>
                    <td>{receipt.warehouseName || '—'}</td>
                    <td>{formatDateTime(receipt.receiptDateUtc)}</td>
                    <td>{statusLabel(receipt.status)}</td>
                    <td style={{ textAlign: 'right' }}>{receipt.lineCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(receipt.totalAmount)}</td>
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
