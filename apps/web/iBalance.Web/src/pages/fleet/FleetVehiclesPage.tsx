import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createFleetVehicle, getFleetVehicles, type FleetVehicleDto } from '../../lib/fleetApi';
import { getTenantReadableError } from '../../lib/api';
import { canManageFleetVehicles, canViewFleet, useQuery } from './fleetShared';

const emptyForm = {
  vehicleCode: '',
  registrationNumber: '',
  vehicleName: '',
  vehicleType: 'Saloon',
  make: '',
  model: '',
  yearOfManufacture: new Date().getUTCFullYear(),
  notes: '',
};

export function FleetVehiclesPage() {
  const canView = canViewFleet();
  const canManage = canManageFleetVehicles();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const vehiclesQ = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: getFleetVehicles,
    enabled: canView,
  });

  const createMut = useMutation({
    mutationFn: createFleetVehicle,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setMessage('Fleet vehicle created successfully.');
      setErrorText('');
      setForm(emptyForm);
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create fleet vehicle.'));
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet vehicles.</div>;
  if (vehiclesQ.isLoading) return <div className="panel">Loading fleet vehicles...</div>;
  if (vehiclesQ.isError || !vehiclesQ.data) return <div className="panel error-panel">Unable to load fleet vehicles.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Fleet Vehicles</h2>
          <span className="muted">Vehicle register and tenant-scoped asset operations</span>
        </div>

        {message ? <div className="success-panel" style={{ marginBottom: 16 }}>{message}</div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}

        {canManage ? (
          <div className="form-grid two">
            <div className="form-row"><label>Vehicle Code</label><input className="input" value={form.vehicleCode} onChange={(e) => setForm((s) => ({ ...s, vehicleCode: e.target.value }))} /></div>
            <div className="form-row"><label>Registration Number</label><input className="input" value={form.registrationNumber} onChange={(e) => setForm((s) => ({ ...s, registrationNumber: e.target.value }))} /></div>
            <div className="form-row"><label>Vehicle Name</label><input className="input" value={form.vehicleName} onChange={(e) => setForm((s) => ({ ...s, vehicleName: e.target.value }))} /></div>
            <div className="form-row"><label>Vehicle Type</label><input className="input" value={form.vehicleType} onChange={(e) => setForm((s) => ({ ...s, vehicleType: e.target.value }))} /></div>
            <div className="form-row"><label>Make</label><input className="input" value={form.make} onChange={(e) => setForm((s) => ({ ...s, make: e.target.value }))} /></div>
            <div className="form-row"><label>Model</label><input className="input" value={form.model} onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))} /></div>
            <div className="form-row"><label>Year</label><input className="input" type="number" value={form.yearOfManufacture} onChange={(e) => setForm((s) => ({ ...s, yearOfManufacture: Number(e.target.value) }))} /></div>
            <div className="form-row"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
            <div className="inline-actions" style={{ gridColumn: '1 / -1' }}>
              <button className="button primary" onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
                {createMut.isPending ? 'Saving…' : 'Create Vehicle'}
              </button>
            </div>
          </div>
        ) : <div className="muted">You have read-only access to fleet vehicles.</div>}
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Vehicle Code</th><th>Registration</th><th>Name</th><th>Type</th><th>Current Odometer</th><th>Status</th></tr></thead>
            <tbody>
              {vehiclesQ.data.items.length === 0 ? (
                <tr><td colSpan={6} className="muted">No fleet vehicles found.</td></tr>
              ) : vehiclesQ.data.items.map((item: FleetVehicleDto) => (
                <tr key={item.id}>
                  <td>{item.vehicleCode}</td>
                  <td>{item.registrationNumber}</td>
                  <td>{item.vehicleName}</td>
                  <td>{item.vehicleType}</td>
                  <td>{item.currentOdometerKm}</td>
                  <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
