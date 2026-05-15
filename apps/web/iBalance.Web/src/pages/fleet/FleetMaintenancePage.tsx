import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  approveFleetMaintenanceWorkOrder,
  createFleetMaintenanceWorkOrder,
  getFleetLedgerAccounts,
  getFleetMaintenanceWorkOrders,
  getFleetVehicles,
  postFleetMaintenanceWorkOrder,
  rejectFleetMaintenanceWorkOrder,
  submitFleetMaintenanceWorkOrder,
  type FleetMaintenanceWorkOrderDto,
  type FleetVehicleDto,
  type LedgerAccountLookupDto,
} from '../../lib/fleetApi';
import { getTenantReadableError } from '../../lib/api';
import { canApproveFleetMaintenance, canManageFleetMaintenance, canPostFleetMaintenance, formatAmount, useQuery } from './fleetShared';

const emptyForm = {
  workOrderNumber: '',
  vehicleId: '',
  workOrderDateUtc: new Date().toISOString(),
  issueDescription: '',
  estimatedAmount: 0,
  actualAmount: '',
  expenseLedgerAccountId: '',
  offsetLedgerAccountId: '',
  workshopVendorName: '',
  notes: '',
};

export function FleetMaintenancePage() {
    const canView = canManageFleetMaintenance() || canApproveFleetMaintenance() || canPostFleetMaintenance();
  const canManage = canManageFleetMaintenance();
  const canApprove = canApproveFleetMaintenance();
  const canPost = canPostFleetMaintenance();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const workOrdersQ = useQuery({ queryKey: ['fleet-maintenance-work-orders'], queryFn: getFleetMaintenanceWorkOrders, enabled: canView });
  const vehiclesQ = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['fleet-ledger-accounts'], queryFn: getFleetLedgerAccounts, enabled: canView });

  const success = async (text: string) => {
    await qc.invalidateQueries({ queryKey: ['fleet-maintenance-work-orders'] });
    setMessage(text);
    setErrorText('');
  };

  const createMut = useMutation({ mutationFn: createFleetMaintenanceWorkOrder, onSuccess: async () => { await success('Fleet maintenance work order created successfully.'); setForm(emptyForm); }, onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create fleet maintenance work order.')) });
  const submitMut = useMutation({ mutationFn: submitFleetMaintenanceWorkOrder, onSuccess: async () => success('Fleet maintenance work order submitted successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit fleet maintenance work order.')) });
  const approveMut = useMutation({ mutationFn: approveFleetMaintenanceWorkOrder, onSuccess: async () => success('Fleet maintenance work order approved successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve fleet maintenance work order.')) });
  const rejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectFleetMaintenanceWorkOrder(id, reason), onSuccess: async () => success('Fleet maintenance work order rejected successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject fleet maintenance work order.')) });
  const postMut = useMutation({ mutationFn: postFleetMaintenanceWorkOrder, onSuccess: async () => success('Fleet maintenance work order posted successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to post fleet maintenance work order.')) });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet maintenance.</div>;
  if (workOrdersQ.isLoading || vehiclesQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading fleet maintenance...</div>;
  if (workOrdersQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          workOrdersQ.error,
          'Unable to load fleet maintenance work orders.',
        )}
      </div>
    );
  }
  
  if (vehiclesQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          vehiclesQ.error,
          'Unable to load fleet vehicles.',
        )}
      </div>
    );
  }
  
  if (accountsQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          accountsQ.error,
          'Unable to load ledger accounts.',
        )}
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Fleet Maintenance</h2><span className="muted">Workshop control, maker-checker, and ERP posting</span></div>
        {message ? <div className="success-panel" style={{ marginBottom: 16 }}>{message}</div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
        {canManage ? (
          <div className="form-grid two">
            <div className="form-row"><label>Work Order No</label><input className="input" value={form.workOrderNumber} onChange={(e) => setForm((s: any) => ({ ...s, workOrderNumber: e.target.value }))} /></div>
            <div className="form-row"><label>Vehicle</label><select className="select" value={form.vehicleId} onChange={(e) => setForm((s: any) => ({ ...s, vehicleId: e.target.value }))}><option value="">Select vehicle</option>{(vehiclesQ.data?.items ?? []).map((item: FleetVehicleDto) => <option key={item.id} value={item.id}>{item.vehicleCode} - {item.registrationNumber}</option>)}</select></div>
            <div className="form-row"><label>Date</label><input className="input" type="datetime-local" value={form.workOrderDateUtc.slice(0,16)} onChange={(e) => setForm((s: any) => ({ ...s, workOrderDateUtc: new Date(e.target.value).toISOString() }))} /></div>
            <div className="form-row"><label>Estimated Amount</label><input className="input" type="number" value={form.estimatedAmount} onChange={(e) => setForm((s: any) => ({ ...s, estimatedAmount: Number(e.target.value) }))} /></div>
            <div className="form-row"><label>Actual Amount</label><input className="input" type="number" value={form.actualAmount} onChange={(e) => setForm((s: any) => ({ ...s, actualAmount: e.target.value }))} /></div>
            <div className="form-row"><label>Workshop Vendor</label><input className="input" value={form.workshopVendorName} onChange={(e) => setForm((s: any) => ({ ...s, workshopVendorName: e.target.value }))} /></div>
            <div className="form-row"><label>Expense Ledger</label><select className="select" value={form.expenseLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, expenseLedgerAccountId: e.target.value }))}><option value="">Select expense ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
            <div className="form-row"><label>Offset Ledger</label><select className="select" value={form.offsetLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, offsetLedgerAccountId: e.target.value }))}><option value="">Select offset ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Issue Description</label><input className="input" value={form.issueDescription} onChange={(e) => setForm((s: any) => ({ ...s, issueDescription: e.target.value }))} /></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s: any) => ({ ...s, notes: e.target.value }))} /></div>
            <div className="inline-actions" style={{ gridColumn: '1 / -1' }}><button className="button primary" onClick={() => createMut.mutate({ ...form, actualAmount: form.actualAmount === '' ? null : Number(form.actualAmount) })} disabled={createMut.isPending}>{createMut.isPending ? 'Saving…' : 'Create Work Order'}</button></div>
          </div>
        ) : <div className="muted">You have read-only access to fleet maintenance.</div>}
      </section>
      <section className="panel">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Work Order</th><th>Date</th><th>Vehicle</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {(workOrdersQ.data?.items ?? []).length === 0 ? <tr><td colSpan={6} className="muted">No fleet maintenance work orders found.</td></tr> : (workOrdersQ.data?.items ?? []).map((item: FleetMaintenanceWorkOrderDto) => (
            <tr key={item.id}><td>{item.workOrderNumber}</td><td>{new Date(item.workOrderDateUtc).toLocaleString()}</td><td>{item.vehicleId}</td><td>{formatAmount(item.actualAmount ?? item.estimatedAmount)}</td><td>{item.status}</td><td><div className="inline-actions">{canManage && (item.status === 1 || item.status === 4) ? <button className="button" onClick={() => submitMut.mutate(item.id)}>Submit</button> : null}{canApprove && item.status === 2 ? <button className="button" onClick={() => approveMut.mutate(item.id)}>Approve</button> : null}{canApprove && item.status === 2 ? <button className="button danger" onClick={() => rejectMut.mutate({ id: item.id, reason: 'Rejected during maintenance review.' })}>Reject</button> : null}{canPost && item.status === 3 ? <button className="button primary" onClick={() => postMut.mutate(item.id)}>Post</button> : null}</div></td></tr>
          ))}
        </tbody></table></div>
      </section>
    </div>
  );
}
