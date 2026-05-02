import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deletePurchaseRequisition,
  getInventoryItems,
  getRejectedPurchaseRequisitions,
  getTenantReadableError,
  submitPurchaseRequisition,
  updatePurchaseRequisition,
  type InventoryItemDto,
  type PurchaseRequisitionDto,
  type UpdatePurchaseRequisitionRequest,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
}

export function RejectedPurchaseRequisitionsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const [selected, setSelected] = useState<PurchaseRequisitionDto | null>(null);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const rejectedQ = useQuery({ queryKey: ['procurement-requisitions-rejected'], queryFn: getRejectedPurchaseRequisitions, enabled: canView });
  const itemsQ = useQuery({ queryKey: ['inventory-items'], queryFn: getInventoryItems, enabled: canView });

  const updateMut = useMutation({
    mutationFn: ({ requisitionId, request }: { requisitionId: string; request: UpdatePurchaseRequisitionRequest }) => updatePurchaseRequisition(requisitionId, request),
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions-rejected'] });
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setMessage(response?.message || response?.Message || 'Rejected requisition updated successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to update rejected requisition.')),
  });

  const resubmitMut = useMutation({
    mutationFn: submitPurchaseRequisition,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions-rejected'] });
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setMessage(response?.message || response?.Message || 'Rejected requisition resubmitted successfully.');
      setErrorText('');
      setSelected(null);
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to resubmit requisition.')),
  });

  const deleteMut = useMutation({
    mutationFn: deletePurchaseRequisition,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions-rejected'] });
      setMessage(response?.message || response?.Message || 'Rejected requisition deleted successfully.');
      setErrorText('');
      setSelected(null);
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete requisition.')),
  });

  const requisitions = ((rejectedQ.data?.items ?? []) as PurchaseRequisitionDto[]);
  const inventoryItems = ((itemsQ.data?.items ?? []) as InventoryItemDto[]);

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
      lines: [...(selected.lines ?? []), { id: '', inventoryItemId: '', description: '', quantity: 1, estimatedUnitPrice: 0, notes: '' }],
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
      requisitionId: selected.id,
      request: {
        requestDateUtc: selected.requestDateUtc,
        requestedByName: selected.requestedByName,
        department: selected.department || null,
        neededByUtc: selected.neededByUtc || null,
        purpose: selected.purpose,
        notes: selected.notes || null,
        lines: (selected.lines ?? []).map((line) => ({
          inventoryItemId: line.inventoryItemId || null,
          description: line.description,
          quantity: Number(line.quantity),
          estimatedUnitPrice: Number(line.estimatedUnitPrice),
          notes: line.notes || null,
        })),
      },
    });
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Rejected Purchase Requisitions.</div>;
  if (rejectedQ.isLoading) return <div className="panel">Loading rejected purchase requisitions...</div>;
  if (rejectedQ.isError) return <div className="panel error-panel">Unable to load rejected purchase requisitions.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Rejected Purchase Requisitions</h2>
        <div className="muted">Correct, resubmit, or delete rejected requisitions.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Requisition No.</th><th>Requested By</th><th>Department</th><th>Purpose</th><th style={{ width: 220 }}>Actions</th></tr></thead>
            <tbody>
              {requisitions.length === 0 ? <tr><td colSpan={5} className="muted">No rejected purchase requisitions found.</td></tr> : requisitions.map((item) => (
                <tr key={item.id}>
                  <td>{item.requisitionNumber}</td>
                  <td>{item.requestedByName}</td>
                  <td>{item.department || '—'}</td>
                  <td>{item.purpose}</td>
                  <td><div className="inline-actions"><button className="button" type="button" onClick={() => setSelected(item)}>Edit</button><button className="button danger" type="button" onClick={() => deleteMut.mutate(item.id)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <section className="panel">
          <h3>Edit Rejected Requisition</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Request Date</label><input className="input" type="date" value={selected.requestDateUtc.slice(0, 10)} onChange={(e) => setSelected({ ...selected, requestDateUtc: dateInputToUtc(e.target.value) })} /></div>
            <div className="form-row"><label>Requested By</label><input className="input" value={selected.requestedByName} onChange={(e) => setSelected({ ...selected, requestedByName: e.target.value })} /></div>
            <div className="form-row"><label>Department</label><input className="input" value={selected.department || ''} onChange={(e) => setSelected({ ...selected, department: e.target.value })} /></div>
            <div className="form-row"><label>Needed By</label><input className="input" type="date" value={(selected.neededByUtc || '').slice(0, 10)} onChange={(e) => setSelected({ ...selected, neededByUtc: dateInputToUtc(e.target.value) })} /></div>
            <div className="form-row" style={{ gridColumn: 'span 2' }}><label>Purpose</label><input className="input" value={selected.purpose} onChange={(e) => setSelected({ ...selected, purpose: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={selected.notes || ''} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></div>
          {(selected.lines ?? []).map((line, index) => (
            <div key={index} className="panel" style={{ marginTop: 10 }}>
              <div className="form-grid four">
                <div className="form-row"><label>Inventory Item</label><select className="input" value={line.inventoryItemId || ''} onChange={(e) => patchLine(index, { inventoryItemId: e.target.value })}><option value="">Service / non-stock</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
                <div className="form-row"><label>Description</label><input className="input" value={line.description} onChange={(e) => patchLine(index, { description: e.target.value })} /></div>
                <div className="form-row"><label>Quantity</label><input className="input" type="number" value={line.quantity} onChange={(e) => patchLine(index, { quantity: Number(e.target.value) })} /></div>
                <div className="form-row"><label>Estimated Unit Price</label><input className="input" type="number" value={line.estimatedUnitPrice} onChange={(e) => patchLine(index, { estimatedUnitPrice: Number(e.target.value) })} /></div>
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
