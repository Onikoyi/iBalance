import { StatCard } from '../../components/common/StatCard';
import { getTenantReadableError } from '../../lib/api';
import { getFleetDashboardSummary } from '../../lib/fleetApi';
import {
  canViewFleet,
  canManageFleetVehicles,
  canManageFleetDrivers,
  canCreateFleetTrips,
  canManageFleetFuel,
  canManageFleetMaintenance,
  useQuery,
} from './fleetShared';

export function FleetDashboardPage() {
  const canAccessFleet =
    canViewFleet() ||
    canManageFleetVehicles() ||
    canManageFleetDrivers() ||
    canCreateFleetTrips() ||
    canManageFleetFuel() ||
    canManageFleetMaintenance();

  const summaryQ = useQuery({
    queryKey: ['fleet-dashboard-summary'],
    queryFn: getFleetDashboardSummary,
    enabled: canAccessFleet,
  });

  if (!canAccessFleet) {
    return (
      <div className="panel error-panel">
        You do not have access to Fleet Management.
      </div>
    );
  }

  if (summaryQ.isLoading) {
    return <div className="panel">Loading fleet dashboard...</div>;
  }

  if (summaryQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(summaryQ.error, 'Failed to load fleet dashboard.')}
      </div>
    );
  }

  // SAFE fallback instead of blocking UI
  const data = summaryQ.data ?? {};

  return (
    <div className="page-grid">
      <section className="stats-grid">
        <StatCard label="Total Vehicles" value={data.totalVehicles ?? 0} />
        <StatCard label="Active Vehicles" value={data.totalActiveVehicles ?? 0} />
        <StatCard label="Drivers" value={data.totalDrivers ?? 0} />
        <StatCard label="Open Trips" value={data.openTrips ?? 0} />
        <StatCard label="Fuel Posted" value={data.totalFuelPostedAmount ?? 0} />
        <StatCard label="Maintenance Posted" value={data.totalMaintenancePostedAmount ?? 0} />
      </section>

      <section className="panel">
        <h2>Fleet Management</h2>
        <div className="muted">
          Fleet Management handles vehicles, drivers, trips, fuel, maintenance,
          utilization, compliance dates, and vehicle operating cost exposure
          in the same tenant-aware ERP foundation.
        </div>
      </section>
    </div>
  );
}