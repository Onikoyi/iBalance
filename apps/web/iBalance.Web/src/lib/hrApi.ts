import { getTenantKey } from './api';
import { getAccessToken } from './auth';

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.message || data?.Message || data?.title || 'Request failed.');
  }

  return data as T;
}

export type HrListResponse<T> = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: T[];
};

export type HrSetupItemDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdOnUtc?: string | null;
};

export type SaveHrSetupItemRequest = {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type UpdateHrSetupItemRequest = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type HrEmployeeDto = {
  id: string;
  tenantId: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationCode?: string | null;
  designationName?: string | null;
  gradeId?: string | null;
  gradeCode?: string | null;
  gradeName?: string | null;
  gender: number;
  genderName: string;
  employmentType: number;
  employmentTypeName: string;
  status: number;
  statusName: string;
  hireDateUtc: string;
  dateOfBirthUtc?: string | null;
  terminatedOnUtc?: string | null;
  terminationReason?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  createdOnUtc?: string | null;
};

export type SaveHrEmployeeRequest = {
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  gradeId?: string | null;
  gender: number;
  employmentType: number;
  status: number;
  hireDateUtc: string;
  dateOfBirthUtc?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
};


export type ImportHrEmployeeRow = SaveHrEmployeeRequest & {
  departmentCode?: string | null;
  designationCode?: string | null;
  gradeCode?: string | null;
};

export type ImportHrEmployeesRequest = {
  items: ImportHrEmployeeRow[];
};

export type HrDashboardSummaryResponse = {
  totalEmployees: number;
  activeEmployees: number;
  terminatedEmployees: number;
  pendingLeaveRequests: number;
  approvedLeaveRequests: number;
  trainingRecordCount: number;
  disciplinaryRecordCount: number;
};

export type HrLeaveRequestDto = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  startDateUtc: string;
  endDateUtc: string;
  leaveType: string;
  reason: string;
  status: number;
  statusName: string;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  cancelledOnUtc?: string | null;
  createdOnUtc?: string | null;
};

export type SaveLeaveRequest = {
  employeeId: string;
  startDateUtc: string;
  endDateUtc: string;
  leaveType: string;
  reason: string;
};

export type HrTrainingRecordDto = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  trainingTitle: string;
  provider: string;
  trainingDateUtc: string;
  costAmount: number;
  notes?: string | null;
};

export type SaveTrainingRecordRequest = {
  employeeId: string;
  trainingTitle: string;
  provider: string;
  trainingDateUtc: string;
  costAmount: number;
  notes?: string | null;
};

export type HrDisciplinaryRecordDto = {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  incidentDateUtc: string;
  category: string;
  description: string;
  actionTaken: string;
  notes?: string | null;
};

export type SaveDisciplinaryRecordRequest = {
  employeeId: string;
  incidentDateUtc: string;
  category: string;
  description: string;
  actionTaken: string;
  notes?: string | null;
};

export function getHrDashboardSummary() {
  return request<HrDashboardSummaryResponse>('/api/hr/dashboard-summary');
}

export function getHrDepartments() {
  return request<HrListResponse<HrSetupItemDto>>('/api/hr/departments');
}

export function createHrDepartment(payload: SaveHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>('/api/hr/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHrDepartment(id: string, payload: UpdateHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>(`/api/hr/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function getHrDesignations() {
  return request<HrListResponse<HrSetupItemDto>>('/api/hr/designations');
}

export function createHrDesignation(payload: SaveHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>('/api/hr/designations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHrDesignation(id: string, payload: UpdateHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>(`/api/hr/designations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function getHrGrades() {
  return request<HrListResponse<HrSetupItemDto>>('/api/hr/grades');
}

export function createHrGrade(payload: SaveHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>('/api/hr/grades', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHrGrade(id: string, payload: UpdateHrSetupItemRequest) {
  return request<{ message?: string; item?: HrSetupItemDto; Item?: HrSetupItemDto }>(`/api/hr/grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function getHrEmployees() {
  return request<HrListResponse<HrEmployeeDto>>('/api/hr/employees');
}

export function createHrEmployee(payload: SaveHrEmployeeRequest) {
  return request<{ message?: string; item?: HrEmployeeDto; Item?: HrEmployeeDto }>('/api/hr/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


export function importHrEmployees(payload: ImportHrEmployeesRequest) {
  return request<{ message?: string; count?: number; items?: HrEmployeeDto[]; Items?: HrEmployeeDto[] }>('/api/hr/employees/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateHrEmployee(id: string, payload: SaveHrEmployeeRequest) {
  return request<{ message?: string; item?: HrEmployeeDto; Item?: HrEmployeeDto }>(`/api/hr/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function terminateHrEmployee(id: string, reason: string, terminatedOnUtc: string) {
  return request<{ message?: string; item?: HrEmployeeDto; Item?: HrEmployeeDto }>(`/api/hr/employees/${id}/terminate`, {
    method: 'POST',
    body: JSON.stringify({ reason, terminatedOnUtc }),
  });
}

export function getHrLeaveRequests() {
  return request<HrListResponse<HrLeaveRequestDto>>('/api/hr/leave-requests');
}

export function createHrLeaveRequest(payload: SaveLeaveRequest) {
  return request<{ message?: string }>('/api/hr/leave-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function submitHrLeaveRequest(id: string) {
  return request<{ message?: string }>(`/api/hr/leave-requests/${id}/submit`, { method: 'POST' });
}

export function approveHrLeaveRequest(id: string) {
  return request<{ message?: string }>(`/api/hr/leave-requests/${id}/approve`, { method: 'POST' });
}

export function rejectHrLeaveRequest(id: string, reason: string) {
  return request<{ message?: string }>(`/api/hr/leave-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function getHrTrainingRecords() {
  return request<HrListResponse<HrTrainingRecordDto>>('/api/hr/training-records');
}

export function createHrTrainingRecord(payload: SaveTrainingRecordRequest) {
  return request<{ message?: string }>('/api/hr/training-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getHrDisciplinaryRecords() {
  return request<HrListResponse<HrDisciplinaryRecordDto>>('/api/hr/disciplinary-records');
}

export function createHrDisciplinaryRecord(payload: SaveDisciplinaryRecordRequest) {
  return request<{ message?: string }>('/api/hr/disciplinary-records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
