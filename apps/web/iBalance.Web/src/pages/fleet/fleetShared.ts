import { useQuery } from '@tanstack/react-query';
import {
  canViewReports,
  hasPermission,
} from '../../lib/auth';

export { useQuery };

export function formatAmount(value: number | null | undefined) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function canViewFleet() {
  return hasPermission('fleet.view' as never);
}

export function canManageFleetVehicles() {
  return hasPermission('fleet.vehicle.manage' as never);
}

export function canManageFleetDrivers() {
  return hasPermission('fleet.driver.manage' as never);
}

export function canCreateFleetTrips() {
  return hasPermission('fleet.trip.create' as never);
}

export function canApproveFleetTrips() {
  return hasPermission('fleet.trip.approve' as never);
}

export function canManageFleetFuel() {
  return hasPermission('fleet.fuel.manage' as never);
}

export function canApproveFleetFuel() {
  return hasPermission('fleet.fuel.approve' as never);
}

export function canPostFleetFuel() {
  return hasPermission('fleet.fuel.post' as never);
}

export function canManageFleetMaintenance() {
  return hasPermission('fleet.maintenance.manage' as never);
}

export function canApproveFleetMaintenance() {
  return hasPermission('fleet.maintenance.approve' as never);
}

export function canPostFleetMaintenance() {
  return hasPermission('fleet.maintenance.post' as never);
}

export function canManageFleetPolicy() {
  return hasPermission('fleet.policy.manage' as never);
}

export function canViewFleetReports() {
  return hasPermission('fleet.reports.view' as never) || canViewReports();
}
