import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  approveFleetTrip,
  createFleetTrip,
  getFleetDrivers,
  getFleetTrips,
  getFleetVehicles,
  rejectFleetTrip,
  submitFleetTrip,
  type FleetDriverDto,
  type FleetTripDto,
  type FleetVehicleDto,
} from '../../lib/fleetApi';
import { getTenantReadableError } from '../../lib/api';
import { canApproveFleetTrips, canCreateFleetTrips, canViewFleet, useQuery } from './fleetShared';

const emptyForm = {
  tripNumber: '',
  vehicleId: '',
  driverId: '',
  tripDateUtc: new Date().toISOString(),
  origin: '',
  destination: '',
  startOdometerKm: 0,
  endOdometerKm: '',
  purpose: '',
  notes: '',
};

export function FleetTripsPage() {
  const canView = canViewFleet();
  const canCreate = canCreateFleetTrips();
  const canApprove = canApproveFleetTrips();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const tripsQ = useQuery({ queryKey: ['fleet-trips'], queryFn: getFleetTrips, enabled: canView });
  const vehiclesQ = useQuery({ queryKey: ['fleet-vehicles'], queryFn: getFleetVehicles, enabled: canView });
  const driversQ = useQuery({ queryKey: ['fleet-drivers'], queryFn: getFleetDrivers, enabled: canView });

  const actionSuccess = async (text: string) => {
    await qc.invalidateQueries({ queryKey: ['fleet-trips'] });
    setMessage(text);
    setErrorText('');
  };

  const createMut = useMutation({
    mutationFn: createFleetTrip,
    onSuccess: async () => { await actionSuccess('Fleet trip created successfully.'); setForm(emptyForm); },
    onError: (error) => { setMessage(''); setErrorText(getTenantReadableError(error, 'Unable to create fleet trip.')); },
  });

  const submitMut = useMutation({ mutationFn: submitFleetTrip, onSuccess: async () => actionSuccess('Fleet trip submitted successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit fleet trip.')) });
  const approveMut = useMutation({ mutationFn: approveFleetTrip, onSuccess: async () => actionSuccess('Fleet trip approved successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve fleet trip.')) });
  const rejectMut = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectFleetTrip(id, reason), onSuccess: async () => actionSuccess('Fleet trip rejected successfully.'), onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject fleet trip.')) });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet trips.</div>;
  if (tripsQ.isLoading || vehiclesQ.isLoading || driversQ.isLoading) return <div className="panel">Loading fleet trips...</div>;
  if (tripsQ.isError || !tripsQ.data || vehiclesQ.isError || !vehiclesQ.data || driversQ.isError || !driversQ.data) return <div className="panel error-panel">Unable to load fleet trips.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Fleet Trips</h2><span className="muted">Trip request, maker-checker approval, and mileage capture</span></div>
        {message ? <div className="success-panel" style={{ marginBottom: 16 }}>{message}</div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
        {canCreate ? (
          <div className="form-grid two">
            <div className="form-row"><label>Trip Number</label><input className="input" value={form.tripNumber} onChange={(e) => setForm((s: any) => ({ ...s, tripNumber: e.target.value }))} /></div>
            <div className="form-row"><label>Vehicle</label><select className="select" value={form.vehicleId} onChange={(e) => setForm((s: any) => ({ ...s, vehicleId: e.target.value }))}><option value="">Select vehicle</option>{vehiclesQ.data.items.map((item: FleetVehicleDto) => <option key={item.id} value={item.id}>{item.vehicleCode} - {item.registrationNumber}</option>)}</select></div>
            <div className="form-row"><label>Driver</label><select className="select" value={form.driverId} onChange={(e) => setForm((s: any) => ({ ...s, driverId: e.target.value }))}><option value="">Select driver</option>{driversQ.data.items.map((item: FleetDriverDto) => <option key={item.id} value={item.id}>{item.driverCode} - {item.fullName}</option>)}</select></div>
            <div className="form-row"><label>Trip Date</label><input className="input" type="datetime-local" value={form.tripDateUtc.slice(0,16)} onChange={(e) => setForm((s: any) => ({ ...s, tripDateUtc: new Date(e.target.value).toISOString() }))} /></div>
            <div className="form-row"><label>Origin</label><input className="input" value={form.origin} onChange={(e) => setForm((s: any) => ({ ...s, origin: e.target.value }))} /></div>
            <div className="form-row"><label>Destination</label><input className="input" value={form.destination} onChange={(e) => setForm((s: any) => ({ ...s, destination: e.target.value }))} /></div>
            <div className="form-row"><label>Start Odometer</label><input className="input" type="number" value={form.startOdometerKm} onChange={(e) => setForm((s: any) => ({ ...s, startOdometerKm: Number(e.target.value) }))} /></div>
            <div className="form-row"><label>End Odometer</label><input className="input" type="number" value={form.endOdometerKm} onChange={(e) => setForm((s: any) => ({ ...s, endOdometerKm: e.target.value }))} /></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => setForm((s: any) => ({ ...s, purpose: e.target.value }))} /></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s: any) => ({ ...s, notes: e.target.value }))} /></div>
            <div className="inline-actions" style={{ gridColumn: '1 / -1' }}><button className="button primary" onClick={() => createMut.mutate({ ...form, endOdometerKm: form.endOdometerKm === '' ? null : Number(form.endOdometerKm) })} disabled={createMut.isPending}>{createMut.isPending ? 'Saving…' : 'Create Trip'}</button></div>
          </div>
        ) : <div className="muted">You have read-only access to fleet trips.</div>}
      </section>
      <section className="panel">
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Trip No</th><th>Date</th><th>Route</th><th>Distance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {tripsQ.data.items.length === 0 ? <tr><td colSpan={6} className="muted">No fleet trips found.</td></tr> : tripsQ.data.items.map((item: FleetTripDto) => (
            <tr key={item.id}><td>{item.tripNumber}</td><td>{new Date(item.tripDateUtc).toLocaleString()}</td><td>{item.origin} → {item.destination}</td><td>{item.distanceKm}</td><td>{item.status}</td><td><div className="inline-actions">{canCreate && (item.status === 1 || item.status === 4) ? <button className="button" onClick={() => submitMut.mutate(item.id)}>Submit</button> : null}{canApprove && item.status === 2 ? <button className="button" onClick={() => approveMut.mutate(item.id)}>Approve</button> : null}{canApprove && item.status === 2 ? <button className="button danger" onClick={() => rejectMut.mutate({ id: item.id, reason: 'Rejected during fleet trip review.' })}>Reject</button> : null}</div></td></tr>
          ))}
        </tbody></table></div>
      </section>
    </div>
  );
}
