import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePurchaseOrder,
  createPurchaseOrderFromRequisition,
  getPurchaseOrders,
  getPurchaseRequisitions,
  getTenantReadableError,
  getVendors,
  rejectPurchaseOrder,
  submitPurchaseOrder,
  type PurchaseOrderDto,
  type PurchaseRequisitionDto,
  type VendorDto,
} from '../lib/api';
import { canApproveWorkflows, canManageFinanceSetup, canViewFinance } from '../lib/auth';

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
    case 4: return 'Issued';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
}

export function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();
  const canApprove = canApproveWorkflows();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [orderDateUtc, setOrderDateUtc] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryUtc, setExpectedDeliveryUtc] = useState('');
  const [currencyCode, setCurrencyCode] = useState('NGN');
  const [notes, setNotes] = useState('');
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const purchaseOrdersQ = useQuery({ queryKey: ['procurement-purchase-orders'], queryFn: getPurchaseOrders, enabled: canView });
  const requisitionsQ = useQuery({ queryKey: ['procurement-requisitions'], queryFn: getPurchaseRequisitions, enabled: canView });
  const vendorsQ = useQuery({ queryKey: ['ap-vendors'], queryFn: getVendors, enabled: canView });

  const createFromReqMut = useMutation({
    mutationFn: ({ requisitionId, payload }: { requisitionId: string; payload: any }) => createPurchaseOrderFromRequisition(requisitionId, payload),
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      setMessage(response?.message || response?.Message || 'Purchase order created successfully.');
      setErrorText('');
      setShowCreate(false);
      setSelectedRequisitionId('');
      setVendorId('');
      setExpectedDeliveryUtc('');
      setNotes('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create purchase order from requisition.')),
  });

  const submitMut = useMutation({
    mutationFn: submitPurchaseOrder,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      setMessage(response?.message || response?.Message || 'Purchase order submitted successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit purchase order.')),
  });

  const approveMut = useMutation({
    mutationFn: approvePurchaseOrder,
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      setMessage(response?.message || response?.Message || 'Purchase order approved successfully.');
      setErrorText('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve purchase order.')),
  });

  const rejectMut = useMutation({
    mutationFn: ({ purchaseOrderId, reason }: { purchaseOrderId: string; reason: string }) => rejectPurchaseOrder(purchaseOrderId, reason),
    onSuccess: async (response: any) => {
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders'] });
      await qc.invalidateQueries({ queryKey: ['procurement-purchase-orders-rejected'] });
      setMessage(response?.message || response?.Message || 'Purchase order rejected successfully.');
      setErrorText('');
      setRejectReason('');
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject purchase order.')),
  });

  const purchaseOrders = ((purchaseOrdersQ.data?.items ?? []) as PurchaseOrderDto[]);
  const approvedRequisitions = ((requisitionsQ.data?.items ?? []) as PurchaseRequisitionDto[]).filter((item) => item.status === 3);
  const vendors = ((vendorsQ.data?.items ?? []) as VendorDto[]);
  const selectedPurchaseOrder = purchaseOrders.find((item) => item.id === selectedPurchaseOrderId) ?? null;

  const summary = useMemo(() => ({
    total: purchaseOrders.length,
    draft: purchaseOrders.filter((item) => item.status === 1).length,
    submitted: purchaseOrders.filter((item) => item.status === 2).length,
    approved: purchaseOrders.filter((item) => item.status === 3 || item.status === 4).length,
  }), [purchaseOrders]);

  async function createFromApprovedRequisition() {
    setMessage('');
    setErrorText('');
    await createFromReqMut.mutateAsync({
      requisitionId: selectedRequisitionId,
      payload: {
        vendorId,
        orderDateUtc: dateInputToUtc(orderDateUtc),
        expectedDeliveryUtc: expectedDeliveryUtc ? dateInputToUtc(expectedDeliveryUtc) : null,
        currencyCode,
        notes: notes || null,
      },
    });
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Purchase Orders.</div>;
  if (purchaseOrdersQ.isLoading || requisitionsQ.isLoading || vendorsQ.isLoading) return <div className="panel">Loading purchase orders...</div>;
  if (purchaseOrdersQ.isError || requisitionsQ.isError || vendorsQ.isError) return <div className="panel error-panel">Unable to load purchase orders.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Purchase Orders</h2>
            <div className="muted">Create, approve, issue, and monitor vendor purchase orders from approved requisitions.</div>
          </div>
          {canManage ? <button className="button" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Close' : 'New PO from Requisition'}</button> : null}
        </div>

        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        <div className="kpi-grid">
          <div className="kpi-card"><span>Total</span><strong>{summary.total}</strong></div>
          <div className="kpi-card"><span>Draft</span><strong>{summary.draft}</strong></div>
          <div className="kpi-card"><span>Submitted</span><strong>{summary.submitted}</strong></div>
          <div className="kpi-card"><span>Approved / Issued</span><strong>{summary.approved}</strong></div>
        </div>

        {showCreate ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Create Purchase Order From Approved Requisition</h3>
            <div className="form-grid three">
              <div className="form-row">
                <label>Approved Requisition</label>
                <select className="input" value={selectedRequisitionId} onChange={(e) => setSelectedRequisitionId(e.target.value)}>
                  <option value="">Select approved requisition</option>
                  {approvedRequisitions.map((item) => <option key={item.id} value={item.id}>{item.requisitionNumber} - {item.purpose}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Vendor</label>
                <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendorCode} - {vendor.vendorName}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Currency</label><input className="input" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} /></div>
              <div className="form-row"><label>Order Date</label><input className="input" type="date" value={orderDateUtc} onChange={(e) => setOrderDateUtc(e.target.value)} /></div>
              <div className="form-row"><label>Expected Delivery</label><input className="input" type="date" value={expectedDeliveryUtc} onChange={(e) => setExpectedDeliveryUtc(e.target.value)} /></div>
            </div>
            <div className="form-row"><label>Notes</label><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="inline-actions"><button className="button primary" type="button" onClick={createFromApprovedRequisition} disabled={createFromReqMut.isPending || !selectedRequisitionId || !vendorId}>Create Purchase Order</button></div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h3>Purchase Order Queue</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO No.</th>
                <th>Vendor</th>
                <th>Requisition</th>
                <th>Order Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? <tr><td colSpan={7} className="muted">No purchase orders found.</td></tr> : purchaseOrders.map((item) => (
                <tr key={item.id}>
                  <td>{item.purchaseOrderNumber}</td>
                  <td>{item.vendorName || '—'}</td>
                  <td>{item.purchaseRequisitionNumber || '—'}</td>
                  <td>{formatDate(item.orderDateUtc)}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(Number(item.totalAmount || 0))}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => setSelectedPurchaseOrderId(item.id)}>View</button>
                      <button className="button secondary" type="button" disabled={!canManage || item.status !== 1 || submitMut.isPending} onClick={() => submitMut.mutate(item.id)}>Submit</button>
                      <button className="button secondary" type="button" disabled={!canApprove || item.status !== 2 || approveMut.isPending} onClick={() => approveMut.mutate(item.id)}>Approve</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPurchaseOrder ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Purchase Order Detail</h3>
              <div className="muted">{selectedPurchaseOrder.purchaseOrderNumber} · {statusLabel(selectedPurchaseOrder.status)}</div>
            </div>
          </div>
          <div className="kv">
            <div className="kv-row"><span>Vendor</span><span>{selectedPurchaseOrder.vendorName || '—'}</span></div>
            <div className="kv-row"><span>Requisition</span><span>{selectedPurchaseOrder.purchaseRequisitionNumber || '—'}</span></div>
            <div className="kv-row"><span>Expected Delivery</span><span>{formatDate(selectedPurchaseOrder.expectedDeliveryUtc)}</span></div>
            <div className="kv-row"><span>Currency</span><span>{selectedPurchaseOrder.currencyCode}</span></div>
            <div className="kv-row"><span>Notes</span><span>{selectedPurchaseOrder.notes || '—'}</span></div>
          </div>

          <div className="form-grid two" style={{ marginTop: 12 }}>
            <div className="form-row"><label>Reject Reason</label><input className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div>
            <div className="form-row"><label>Reject</label><button className="button danger" type="button" disabled={!canApprove || selectedPurchaseOrder.status !== 2 || !rejectReason.trim()} onClick={() => rejectMut.mutate({ purchaseOrderId: selectedPurchaseOrder.id, reason: rejectReason })}>Reject Purchase Order</button></div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
