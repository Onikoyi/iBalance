import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePurchaseRequisition,
  createPurchaseRequisition,
  getInventoryItems,
  getPurchaseRequisitions,
  getTenantReadableError,
  rejectPurchaseRequisition,
  submitPurchaseRequisition,
  type CreatePurchaseRequisitionRequest,
  type InventoryItemDto,
  type PurchaseRequisitionDto,
} from '../lib/api';
import {
  canApprovePurchaseRequisitions,
  canCreatePurchaseRequisitions,
  canRejectPurchaseRequisitions,
  canSubmitPurchaseRequisitions,
  canViewProcurement,
} from '../lib/auth';

const emptyLine = {
  inventoryItemId: '',
  description: '',
  quantity: 1,
  estimatedUnitPrice: 0,
  notes: '',
};

const emptyForm: CreatePurchaseRequisitionRequest = {
  requestDateUtc: new Date().toISOString(),
  requestedByName: '',
  department: '',
  neededByUtc: '',
  purpose: '',
  notes: '',
  lines: [{ ...emptyLine }],
};

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
}

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted';
    case 3: return 'Approved';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
}

export function PurchaseRequisitionsPage() {
  const qc = useQueryClient();
  const canView = canViewProcurement();
  const canManage = canCreatePurchaseRequisitions();
  const canSubmitApproval = canSubmitPurchaseRequisitions();
  const canApprove = canApprovePurchaseRequisitions();
  const canReject = canRejectPurchaseRequisitions();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreatePurchaseRequisitionRequest>(emptyForm);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const requisitionsQ = useQuery({
    queryKey: ['procurement-requisitions'],
    queryFn: getPurchaseRequisitions,
    enabled: canView,
  });

  const itemsQ = useQuery({
    queryKey: ['inventory-items'],
    queryFn: getInventoryItems,
    enabled: canView,
  });

  const createMut = useMutation({
    mutationFn: createPurchaseRequisition,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
      setMessage(response?.message || response?.Message || 'Purchase requisition created successfully.');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create purchase requisition.')),
  });

  const submitMut = useMutation({
    mutationFn: submitPurchaseRequisition,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setMessage(response?.message || response?.Message || 'Purchase requisition submitted successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit purchase requisition.')),
  });

  const approveMut = useMutation({
    mutationFn: approvePurchaseRequisition,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      setMessage(response?.message || response?.Message || 'Purchase requisition approved successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve purchase requisition.')),
  });

  const rejectMut = useMutation({
    mutationFn: ({ requisitionId, reason }: { requisitionId: string; reason: string }) => rejectPurchaseRequisition(requisitionId, reason),
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions'] });
      await qc.invalidateQueries({ queryKey: ['procurement-requisitions-rejected'] });
      setMessage(response?.message || response?.Message || 'Purchase requisition rejected successfully.');
      setErrorText('');
      setRejectReason('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject purchase requisition.')),
  });

  const requisitions = ((requisitionsQ.data?.items ?? []) as PurchaseRequisitionDto[]);
  const inventoryItems = ((itemsQ.data?.items ?? []) as InventoryItemDto[]);
  const selectedRequisition = requisitions.find((item) => item.id === selectedRequisitionId) ?? null;

  const summary = useMemo(() => ({
    total: requisitions.length,
    draft: requisitions.filter((item) => item.status === 1).length,
    submitted: requisitions.filter((item) => item.status === 2).length,
    approved: requisitions.filter((item) => item.status === 3).length,
  }), [requisitions]);

  function updateLine(index: number, patch: Partial<typeof emptyLine>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  function addLine() {
    setForm((current) => ({ ...current, lines: [...current.lines, { ...emptyLine }] }));
  }

  function removeLine(index: number) {
    setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) || [{ ...emptyLine }] }));
  }

  async function submitCreate() {
    setMessage('');
    setErrorText('');
    await createMut.mutateAsync({
      ...form,
      requestDateUtc: form.requestDateUtc,
      neededByUtc: form.neededByUtc || null,
      department: form.department || null,
      notes: form.notes || null,
      lines: form.lines.map((line) => ({
        inventoryItemId: line.inventoryItemId || null,
        description: line.description,
        quantity: Number(line.quantity),
        estimatedUnitPrice: Number(line.estimatedUnitPrice),
        notes: line.notes || null,
      })),
    });
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Purchase Requisitions.</div>;
  if (requisitionsQ.isLoading) return <div className="panel">Loading purchase requisitions...</div>;
  if (requisitionsQ.isError) return <div className="panel error-panel">Unable to load purchase requisitions.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Purchase Requisitions</h2>
            <div className="muted">Raise, submit, approve, and control purchase requests before vendor commitment.</div>
          </div>
          {canManage ? <button className="button" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Close' : 'New Requisition'}</button> : null}
        </div>

        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        <div className="kpi-grid">
          <div className="kpi-card"><span>Total</span><strong>{summary.total}</strong></div>
          <div className="kpi-card"><span>Draft</span><strong>{summary.draft}</strong></div>
          <div className="kpi-card"><span>Submitted</span><strong>{summary.submitted}</strong></div>
          <div className="kpi-card"><span>Approved</span><strong>{summary.approved}</strong></div>
        </div>

        {showCreate ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Create Purchase Requisition</h3>
            <div className="form-grid three">
              <div className="form-row"><label>Request Date</label><input className="input" type="date" value={form.requestDateUtc.slice(0, 10)} onChange={(e) => setForm({ ...form, requestDateUtc: dateInputToUtc(e.target.value) })} /></div>
              <div className="form-row"><label>Requested By</label><input className="input" value={form.requestedByName} onChange={(e) => setForm({ ...form, requestedByName: e.target.value })} /></div>
              <div className="form-row"><label>Department</label><input className="input" value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div className="form-row"><label>Needed By</label><input className="input" type="date" value={(form.neededByUtc ?? '').slice(0, 10)} onChange={(e) => setForm({ ...form, neededByUtc: dateInputToUtc(e.target.value) })} /></div>
              <div className="form-row" style={{ gridColumn: 'span 2' }}><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            </div>
            <div className="form-row"><label>Notes</label><textarea className="input" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <h3>Request Lines</h3>
            {form.lines.map((line, index) => (
              <div key={index} className="panel" style={{ marginTop: 10 }}>
                <div className="form-grid four">
                  <div className="form-row">
                    <label>Inventory Item</label>
                    <select className="input" value={line.inventoryItemId ?? ""} onChange={(e) => {
                      const item = inventoryItems.find((entry) => entry.id === e.target.value);
                      updateLine(index, { inventoryItemId: e.target.value, description: line.description || item?.name || '' });
                    }}>
                      <option value="">Service / non-stock</option>
                      {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label>Description</label><input className="input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} /></div>
                  <div className="form-row"><label>Quantity</label><input className="input" type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /></div>
                  <div className="form-row"><label>Estimated Unit Price</label><input className="input" type="number" value={line.estimatedUnitPrice} onChange={(e) => updateLine(index, { estimatedUnitPrice: Number(e.target.value) })} /></div>
                </div>
                <div className="form-row"><label>Line Notes</label><input className="input" value={line.notes ?? ""} onChange={(e) => updateLine(index, { notes: e.target.value })} /></div>
                <div className="inline-actions">
                  <button className="button secondary" type="button" onClick={addLine}>Add Line</button>
                  {form.lines.length > 1 ? <button className="button danger" type="button" onClick={() => removeLine(index)}>Remove Line</button> : null}
                </div>
              </div>
            ))}

            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button className="button primary" type="button" onClick={submitCreate} disabled={createMut.isPending}>Save Requisition</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h3>Requisition Queue</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Requisition No.</th>
                <th>Date</th>
                <th>Requested By</th>
                <th>Department</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Est. Amount</th>
                <th style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr><td colSpan={7} className="muted">No purchase requisitions found.</td></tr>
              ) : requisitions.map((item) => (
                <tr key={item.id}>
                  <td>{item.requisitionNumber}</td>
                  <td>{formatDate(item.requestDateUtc)}</td>
                  <td>{item.requestedByName}</td>
                  <td>{item.department || '—'}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(Number(item.estimatedTotalAmount || 0))}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => setSelectedRequisitionId(item.id)}>View</button>
                      <button className="button secondary" type="button" disabled={!canSubmitApproval || item.status !== 1 || submitMut.isPending} onClick={() => submitMut.mutate(item.id)}>Submit</button>
                      <button className="button secondary" type="button" disabled={!canApprove || item.status !== 2 || approveMut.isPending} onClick={() => approveMut.mutate(item.id)}>Approve</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRequisition ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Requisition Detail</h3>
              <div className="muted">{selectedRequisition.requisitionNumber} · {statusLabel(selectedRequisition.status)}</div>
            </div>
          </div>
          <div className="kv">
            <div className="kv-row"><span>Requested By</span><span>{selectedRequisition.requestedByName}</span></div>
            <div className="kv-row"><span>Department</span><span>{selectedRequisition.department || '—'}</span></div>
            <div className="kv-row"><span>Purpose</span><span>{selectedRequisition.purpose}</span></div>
            <div className="kv-row"><span>Needed By</span><span>{formatDate(selectedRequisition.neededByUtc)}</span></div>
            <div className="kv-row"><span>Notes</span><span>{selectedRequisition.notes || '—'}</span></div>
          </div>

          <div className="form-grid two" style={{ marginTop: 12 }}>
            <div className="form-row"><label>Reject Reason</label><input className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div>
            <div className="form-row"><label>Reject</label><button className="button danger" type="button" disabled={!canReject || selectedRequisition.status !== 2 || !rejectReason.trim()} onClick={() => rejectMut.mutate({ requisitionId: selectedRequisition.id, reason: rejectReason })}>Reject Requisition</button></div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
