import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createFleetDriver, getFleetDrivers } from '../../lib/fleetApi';
import { getTenantReadableError } from '../../lib/api';
import { canManageFleetDrivers, canViewFleet, useQuery } from './fleetShared';

const emptyForm = { driverCode: '', fullName: '', licenseNumber: '', phoneNumber: '', notes: '' };

export function FleetDriversPage() {
  const canView = canViewFleet();
  const canManage = canManageFleetDrivers();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const driversQ = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers, enabled: canView });

  const createMut = useMutation({
    mutationFn: createFleetDriver,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fleet-drivers'] });
      setMessage('Fleet driver created successfully.');
      setErrorText('');
      setForm(emptyForm);
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create fleet driver.'));
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet drivers.</div>;
  if (driversQ.isLoading) return <div className="panel">Loading fleet drivers...</div>;
  if (driversQ.isError || !driversQ.data) return <div className="panel error-panel">Unable to load fleet drivers.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Fleet Drivers</h2><span className="muted">Driver register and assignment readiness</span></div>
        {message ? <div className="success-panel" style={{ marginBottom: 16 }}>{message}</div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
        {canManage ? (
          <div className="form-grid two">
            <div className="form-row"><label>Driver Code</label><input className="input" value={form.driverCode} onChange={(e) => setForm((s) => ({ ...s, driverCode: e.target.value }))} /></div>
            <div className="form-row"><label>Full Name</label><input className="input" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} /></div>
            <div className="form-row"><label>License Number</label><input className="input" value={form.licenseNumber} onChange={(e) => setForm((s) => ({ ...s, licenseNumber: e.target.value }))} /></div>
            <div className="form-row"><label>Phone Number</label><input className="input" value={form.phoneNumber} onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))} /></div>
            <div className="form-row"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
            <div className="inline-actions" style={{ gridColumn: '1 / -1' }}>
              <button className="button primary" onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>{createMut.isPending ? 'Saving…' : 'Create Driver'}</button>
            </div>
          </div>
        ) : <div className="muted">You have read-only access to fleet drivers.</div>}
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Driver Code</th><th>Full Name</th><th>License Number</th><th>Phone</th><th>Status</th></tr></thead>
            <tbody>
              {driversQ.data.items.length === 0 ? <tr><td colSpan={5} className="muted">No fleet drivers found.</td></tr> : driversQ.data.items.map((item) => (
                <tr key={item.id}><td>{item.driverCode}</td><td>{item.fullName}</td><td>{item.licenseNumber}</td><td>{item.phoneNumber}</td><td>{item.isActive ? 'Active' : 'Inactive'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}