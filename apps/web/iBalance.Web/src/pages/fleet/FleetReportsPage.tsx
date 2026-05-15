import { getFleetVehicleCostingReport } from '../../lib/fleetApi';
import { canViewFleetReports, formatAmount, useQuery } from './fleetShared';

export function FleetReportsPage() {
  const canView = canViewFleetReports();
  const reportQ = useQuery({ queryKey: ['fleet-vehicle-costing-report'], queryFn: getFleetVehicleCostingReport, enabled: canView });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet reports.</div>;
  if (reportQ.isLoading) return <div className="panel">Loading fleet reports...</div>;
  if (reportQ.isError || !reportQ.data) return <div className="panel error-panel">Unable to load fleet reports.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Fleet Vehicle Costing Report</h2>
        <div className="muted">Vehicle-wise fuel, maintenance, utilization, and mileage exposure.</div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead><tr><th>Vehicle Code</th><th>Name</th><th style={{ textAlign: 'right' }}>Fuel Amount</th><th style={{ textAlign: 'right' }}>Maintenance Amount</th><th style={{ textAlign: 'right' }}>Trips</th><th style={{ textAlign: 'right' }}>Distance Km</th></tr></thead>
            <tbody>
              {reportQ.data.items.length === 0 ? <tr><td colSpan={6} className="muted">No fleet costing records available.</td></tr> : reportQ.data.items.map((item: any) => (
                <tr key={item.id}><td>{item.vehicleCode}</td><td>{item.vehicleName}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.fuelAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.maintenanceAmount)}</td><td style={{ textAlign: 'right' }}>{item.tripCount}</td><td style={{ textAlign: 'right' }}>{item.distanceKm}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}