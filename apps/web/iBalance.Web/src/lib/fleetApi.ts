import { api } from './api';

export type FleetVehicleDto = {
  id: string;
  tenantId: string;
  vehicleCode: string;
  registrationNumber: string;
  vehicleName: string;
  vehicleType: string;
  make: string;
  model: string;
  yearOfManufacture: number;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  fuelType?: string | null;
  currentOdometerKm: number;
  defaultDriverId?: string | null;
  organizationDepartmentId?: string | null;
  organizationBranchId?: string | null;
  organizationCostCenterId?: string | null;
  status: number;
  isActive: boolean;
  createdOnUtc: string;
  lastModifiedOnUtc?: string | null;
};

export type FleetDriverDto = {
  id: string;
  driverCode: string;
  fullName: string;
  licenseNumber: string;
  phoneNumber: string;
  licenseExpiryUtc?: string | null;
  userAccountId?: string | null;
  organizationDepartmentId?: string | null;
  organizationBranchId?: string | null;
  organizationCostCenterId?: string | null;
  isActive: boolean;
  createdOnUtc: string;
};

export type FleetTripDto = {
  id: string;
  tripNumber: string;
  vehicleId: string;
  driverId: string;
  tripDateUtc: string;
  origin: string;
  destination: string;
  startOdometerKm: number;
  endOdometerKm?: number | null;
  distanceKm: number;
  purpose: string;
  status: number;
  submittedBy?: string | null;
  approvedBy?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
};

export type FleetFuelLogDto = {
  id: string;
  fuelLogNumber: string;
  vehicleId: string;
  fuelDateUtc: string;
  quantityLitres: number;
  unitPrice: number;
  totalAmount: number;
  odometerKm: number;
  status: number;
  journalEntryId?: string | null;
  vendorName?: string | null;
};

export type FleetMaintenanceWorkOrderDto = {
  id: string;
  workOrderNumber: string;
  vehicleId: string;
  workOrderDateUtc: string;
  issueDescription: string;
  estimatedAmount: number;
  actualAmount?: number | null;
  status: number;
  journalEntryId?: string | null;
  workshopVendorName?: string | null;
};

export type FleetPolicyDto = {
  id: string;
  tenantId: string;
  fuelExpenseLedgerAccountId: string;
  maintenanceExpenseLedgerAccountId: string;
  tripExpenseLedgerAccountId: string;
  payableOrCashLedgerAccountId: string;
  requiresMakerCheckerForFuel: boolean;
  requiresMakerCheckerForMaintenance: boolean;
  requiresTripApproval: boolean;
  maxFuelAmountPerEntry: number;
  notes?: string | null;
};

export type LedgerAccountLookupDto = {
  id: string;
  code: string;
  name: string;
};

export async function getFleetDashboardSummary() {
  const response = await api.get('/api/finance/fleet/dashboard-summary');
  return response.data;
}

export async function getFleetVehicles() {
  const response = await api.get<{ items: FleetVehicleDto[]; count: number }>('/api/finance/fleet/vehicles');
  return response.data;
}

export async function createFleetVehicle(payload: unknown) {
  const response = await api.post('/api/finance/fleet/vehicles', payload);
  return response.data;
}

export async function getFleetDrivers() {
  const response = await api.get<{ items: FleetDriverDto[]; count: number }>('/api/finance/fleet/drivers');
  return response.data;
}

export async function createFleetDriver(payload: unknown) {
  const response = await api.post('/api/finance/fleet/drivers', payload);
  return response.data;
}

export async function getFleetPolicy() {
  const response = await api.get<{ item?: FleetPolicyDto | null }>('/api/finance/fleet/policy');
  return response.data;
}

export async function saveFleetPolicy(payload: unknown) {
  const response = await api.post('/api/finance/fleet/policy', payload);
  return response.data;
}

export async function getFleetTrips() {
  const response = await api.get<{ items: FleetTripDto[]; count: number }>('/api/finance/fleet/trips');
  return response.data;
}

export async function createFleetTrip(payload: unknown) {
  const response = await api.post('/api/finance/fleet/trips', payload);
  return response.data;
}

export async function submitFleetTrip(id: string) {
  const response = await api.post(`/api/finance/fleet/trips/${encodeURIComponent(id)}/submit`);
  return response.data;
}

export async function approveFleetTrip(id: string) {
  const response = await api.post(`/api/finance/fleet/trips/${encodeURIComponent(id)}/approve`);
  return response.data;
}

export async function rejectFleetTrip(id: string, reason: string) {
  const response = await api.post(`/api/finance/fleet/trips/${encodeURIComponent(id)}/reject`, { reason });
  return response.data;
}

export async function getFleetFuelLogs() {
  const response = await api.get<{ items: FleetFuelLogDto[]; count: number }>('/api/finance/fleet/fuel-logs');
  return response.data;
}

export async function createFleetFuelLog(payload: unknown) {
  const response = await api.post('/api/finance/fleet/fuel-logs', payload);
  return response.data;
}

export async function submitFleetFuelLog(id: string) {
  const response = await api.post(`/api/finance/fleet/fuel-logs/${encodeURIComponent(id)}/submit`);
  return response.data;
}

export async function approveFleetFuelLog(id: string) {
  const response = await api.post(`/api/finance/fleet/fuel-logs/${encodeURIComponent(id)}/approve`);
  return response.data;
}

export async function rejectFleetFuelLog(id: string, reason: string) {
  const response = await api.post(`/api/finance/fleet/fuel-logs/${encodeURIComponent(id)}/reject`, { reason });
  return response.data;
}

export async function postFleetFuelLog(id: string) {
  const response = await api.post(`/api/finance/fleet/fuel-logs/${encodeURIComponent(id)}/post`);
  return response.data;
}

export async function getFleetMaintenanceWorkOrders() {
  const response = await api.get<{ items: FleetMaintenanceWorkOrderDto[]; count: number }>('/api/finance/fleet/maintenance-work-orders');
  return response.data;
}

export async function createFleetMaintenanceWorkOrder(payload: unknown) {
  const response = await api.post('/api/finance/fleet/maintenance-work-orders', payload);
  return response.data;
}

export async function submitFleetMaintenanceWorkOrder(id: string) {
  const response = await api.post(`/api/finance/fleet/maintenance-work-orders/${encodeURIComponent(id)}/submit`);
  return response.data;
}

export async function approveFleetMaintenanceWorkOrder(id: string) {
  const response = await api.post(`/api/finance/fleet/maintenance-work-orders/${encodeURIComponent(id)}/approve`);
  return response.data;
}

export async function rejectFleetMaintenanceWorkOrder(id: string, reason: string) {
  const response = await api.post(`/api/finance/fleet/maintenance-work-orders/${encodeURIComponent(id)}/reject`, { reason });
  return response.data;
}

export async function postFleetMaintenanceWorkOrder(id: string) {
  const response = await api.post(`/api/finance/fleet/maintenance-work-orders/${encodeURIComponent(id)}/post`);
  return response.data;
}

export async function getFleetVehicleCostingReport() {
  const response = await api.get('/api/finance/fleet/reports/vehicle-costing');
  return response.data;
}

export async function getFleetLedgerAccounts() {
  const response = await api.get<{ items: LedgerAccountLookupDto[]; count: number }>('/api/finance/accounts');
  return response.data;
}
