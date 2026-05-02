import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deletePurchaseOrder,
  getInventoryItems,
  getRejectedPurchaseOrders,
  getTenantReadableError,
  getVendors,
  submitPurchaseOrder,
  updatePurchaseOrder,
  type InventoryItemDto,
  type PurchaseOrderDto,
  type UpdatePurchaseOrderRequest,
  type VendorDto,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
}

export function RejectedPurchaseOrdersPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const [selected, setSelected] = useState<PurchaseOrderDto | null>(null);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const rejectedQ = useQuery({ queryKey: ['procurement-purchase-orders-rejected'], queryFn: getRejectedPurchaseOrders, enabled: canView });
  const itemsQ = useQuery({ queryKey: ['inventory-items'], queryFn: getInventoryItems, enabled: canView });
  const vendorsQ = useQuery({ queryKey: ['ap-vendors'], queryFn: getVendors, enabled: canView });

  const updateMut = useMutation({
    mutationFn: ({ purchaseOrderId, request }: { purchaseOrderId: string; request: UpdatePurchaseOrderRequest }) => updatePurchaseOrder(purchaseOrderId, request),
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders-rejected'] });
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      setMessage(response?.message || response?.Message || 'Rejected purchase order updated successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to update rejected purchase order.')),
  });

  const resubmitMut = useMutation({
    mutationFn: submitPurchaseOrder,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders-rejected'] });
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      setMessage(response?.message || response?.Message || 'Rejected purchase order resubmitted successfully.');
      setErrorText('');
      setSelected(null);
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to resubmit purchase order.')),
  });

  const deleteMut = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders-rejected'] });
      setMessage(response?.message || response?.Message || 'Rejected purchase order deleted successfully.');
      setErrorText('');
      setSelected(null);
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete purchase order.')),
  });

  const purchaseOrders = ((rejectedQ.data?.items ?? []) as PurchaseOrderDto[]);
  const inventoryItems = ((itemsQ.data?.items ?? []) as InventoryItemDto[]);
  const vendors = ((vendorsQ.data?.items ?? []) as VendorDto[]);

  function patchLine(index: number, patch: any) {
    if (!selected?.lines) return;
    setSelected({
      ...selected,
      lines: selected.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    });
  }

  function addLine() {
    if (!selected) return;
    setSelected({
      ...selected,
      lines: [...(selected.lines ?? []), { id: '', purchaseRequisitionLineId: '', inventoryItemId: '', description: '', quantity: 1, unitPrice: 0, notes: '' }],
    });
  }

  function removeLine(index: number) {
    if (!selected) return;
    setSelected({
      ...selected,
      lines: (selected.lines ?? []).filter((_, lineIndex) => lineIndex !== index),
    });
  }

  async function save() {
    if (!selected) return;
    await updateMut.mutateAsync({
      purchaseOrderId: selected.id,
      request: {
        vendorId: selected.vendorId,
        orderDateUtc: selected.orderDateUtc,
        expectedDeliveryUtc: selected.expectedDeliveryUtc || null,
        currencyCode: selected.currencyCode,
        notes: selected.notes || null,
        lines: (selected.lines ?? []).map((line) => ({
          purchaseRequisitionLineId: line.purchaseRequisitionLineId || null,
          inventoryItemId: line.inventoryItemId || null,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          notes: line.notes || null,
        })),
      },
    });
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Rejected Purchase Orders.</div>;
  if (rejectedQ.isLoading || itemsQ.isLoading || vendorsQ.isLoading) return <div className="panel">Loading rejected purchase orders...</div>;
  if (rejectedQ.isError || itemsQ.isError || vendorsQ.isError) return <div className="panel error-panel">Unable to load rejected purchase orders.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Rejected Purchase Orders</h2>
        <div className="muted">Correct, resubmit, or delete rejected purchase orders.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>PO No.</th><th>Vendor</th><th>Currency</th><th>Status</th><th style={{ width: 220 }}>Actions</th></tr></thead>
            <tbody>
              {purchaseOrders.length === 0 ? <tr><td colSpan={5} className="muted">No rejected purchase orders found.</td></tr> : purchaseOrders.map((item) => (
                <tr key={item.id}>
                  <td>{item.purchaseOrderNumber}</td>
                  <td>{item.vendorName || '—'}</td>
                  <td>{item.currencyCode}</td>
                  <td>Rejected</td>
                  <td><div className="inline-actions"><button className="button" type="button" onClick={() => setSelected(item)}>Edit</button><button className="button danger" type="button" onClick={() => deleteMut.mutate(item.id)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="panel">
          <h3>Edit Rejected Purchase Order</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Vendor</label><select className="input" value={selected.vendorId} onChange={(e) => setSelected({ ...selected, vendorId: e.target.value, vendorName: vendors.find((v) => v.id === e.target.value)?.vendorName || null })}><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorCode} - {vendor.vendorName}</option>)}</select></div>
            <div className="form-row"><label>Order Date</label><input className="input" type="date" value={selected.orderDateUtc.slice(0, 10)} onChange={(e) => setSelected({ ...selected, orderDateUtc: dateInputToUtc(e.target.value) })} /></div>
            <div className="form-row"><label>Expected Delivery</label><input className="input" type="date" value={(selected.expectedDeliveryUtc || '').slice(0, 10)} onChange={(e) => setSelected({ ...selected, expectedDeliveryUtc: dateInputToUtc(e.target.value) })} /></div>
            <div className="form-row"><label>Currency</label><input className="input" value={selected.currencyCode} onChange={(e) => setSelected({ ...selected, currencyCode: e.target.value.toUpperCase() })} /></div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={selected.notes || ''} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></div>
          {(selected.lines ?? []).map((line, index) => (
            <div key={index} className="panel" style={{ marginTop: 10 }}>
              <div className="form-grid four">
                <div className="form-row"><label>Inventory Item</label><select className="input" value={line.inventoryItemId || ''} onChange={(e) => patchLine(index, { inventoryItemId: e.target.value })}><option value="">Service / non-stock</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
                <div className="form-row"><label>Description</label><input className="input" value={line.description} onChange={(e) => patchLine(index, { description: e.target.value })} /></div>
                <div className="form-row"><label>Quantity</label><input className="input" type="number" value={line.quantity} onChange={(e) => patchLine(index, { quantity: Number(e.target.value) })} /></div>
                <div className="form-row"><label>Unit Price</label><input className="input" type="number" value={line.unitPrice} onChange={(e) => patchLine(index, { unitPrice: Number(e.target.value) })} /></div>
              </div>
              <div className="inline-actions"><button className="button secondary" type="button" onClick={addLine}>Add Line</button>{(selected.lines ?? []).length > 1 ? <button className="button danger" type="button" onClick={() => removeLine(index)}>Remove Line</button> : null}</div>
            </div>
          ))}
          <div className="inline-actions" style={{ marginTop: 12 }}>
            <button className="button primary" type="button" onClick={save} disabled={updateMut.isPending}>Save Changes</button>
            <button className="button secondary" type="button" onClick={() => resubmitMut.mutate(selected.id)} disabled={resubmitMut.isPending}>Resubmit</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
