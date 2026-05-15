import { api, getTenantReadableError } from './api';

export { getTenantReadableError };

export type EamDashboardResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  totalRequests: number;
  drafts: number;
  submitted: number;
  approved: number;
  disbursed: number;
  outstandingCount: number;
  overdueCount: number;
  totalRequested: number;
  totalOutstanding: number;
  totalRetired: number;
};

export type ExpenseAdvanceRequestDto = {
  id: string;
  tenantId: string;
  advanceTypeId: string;
  employeeId: string;
  requestNumber: string;
  requestDateUtc: string;
  purpose: string;
  requestedAmount: number;
  retiredAmount: number;
  outstandingAmount: number;
  department?: string | null;
  branch?: string | null;
  costCenter?: string | null;
  destination?: string | null;
  expectedRetirementDateUtc?: string | null;
  notes?: string | null;
  status: number;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string;
  createdBy?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
};

export type ExpenseAdvanceRequestListResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: ExpenseAdvanceRequestDto[];
};

export type PayrollEmployeeDto = {
  id: string;
  tenantId: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName?: string | null;
  displayName?: string | null;
  department?: string | null;
  isActive: boolean;
};

export type PayrollEmployeesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollEmployeeDto[];
};

export type CreateExpenseAdvanceRequestRequest = {
  advanceTypeId: string;
  employeeId: string;
  requestDateUtc: string;
  purpose: string;
  requestedAmount: number;
  department?: string | null;
  branch?: string | null;
  costCenter?: string | null;
  destination?: string | null;
  expectedRetirementDateUtc?: string | null;
  notes?: string | null;
};

export type RejectWorkflowRequest = { reason: string };

export type EamPolicyDto = {
  id?: string;
  tenantId?: string;
  maxAmount: number;
  allowedOpenAdvancesPerStaff: number;
  retirementDueDays: number;
  attachmentRequired: boolean;
  blockSelfApproval: boolean;
  allowExcessReimbursement: boolean;
  allowSalaryRecovery: boolean;
  requireDepartmentScope: boolean;
  requireBranchScope: boolean;
  requireCostCenterScope: boolean;
  travelAdvanceRequiresDestination: boolean;
  imprestRequiresRetirement: boolean;
  isActive: boolean;
};

export type EamAdvanceTypeDto = {
  id: string;
  code: string;
  name: string;
  isSystemDefined: boolean;
  isActive: boolean;
  notes?: string | null;
};

export type EamExpenseCategoryDto = {
  id: string;
  code: string;
  name: string;
  defaultExpenseLedgerAccountId?: string | null;
  defaultExpenseLedgerAccountCode?: string | null;
  defaultExpenseLedgerAccountName?: string | null;
  isActive: boolean;
  notes?: string | null;
};

export type EamPostingSetupDto = {
  tenantId?: string;
  advanceControlLedgerAccountId?: string | null;
  refundLedgerAccountId?: string | null;
  salaryRecoveryLedgerAccountId?: string | null;
  reimbursementPayableLedgerAccountId?: string | null;
  recoveryClearingLedgerAccountId?: string | null;
  defaultCashBankLedgerAccountId?: string | null;
};

export type EamRetirementLineDto = {
  id?: string;
  expenseCategoryId: string;
  description: string;
  amount: number;
};

export type EamRetirementDto = {
  id: string;
  requestId: string;
  retirementNumber: string;
  retirementDateUtc: string;
  totalRetiredAmount: number;
  refundAmount: number;
  reimbursementAmount: number;
  status: number;
  notes?: string | null;
  rejectionReason?: string | null;
  lines: EamRetirementLineDto[];
};

export type EamRetirementListResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: EamRetirementDto[];
};

export type SaveEamRetirementRequest = {
  requestId: string;
  retirementDateUtc: string;
  notes?: string | null;
  lines: EamRetirementLineDto[];
};

export type DisburseExpenseAdvanceRequest = {
  cashOrBankLedgerAccountId: string;
  notes?: string | null;
};

export type RecordRefundRequest = {
  requestId: string;
  cashOrBankLedgerAccountId: string;
  amount: number;
  notes?: string | null;
};

export type RecordRecoveryRequest = {
  requestId: string;
  method: string;
  amount: number;
  notes?: string | null;
};

export async function getEamDashboard() {
  const { data } = await api.get<EamDashboardResponse>('/api/finance/eam/dashboard');
  return data;
}

export async function getExpenseAdvanceRequests() {
  const { data } = await api.get<ExpenseAdvanceRequestListResponse>('/api/finance/eam/requests');
  return data;
}

export async function getRejectedExpenseAdvanceRequests() {
  const { data } = await api.get<ExpenseAdvanceRequestListResponse>('/api/finance/eam/requests/rejected');
  return data;
}

export async function createExpenseAdvanceRequest(payload: CreateExpenseAdvanceRequestRequest) {
  const { data } = await api.post('/api/finance/eam/requests', payload);
  return data;
}

export async function updateExpenseAdvanceRequest(requestId: string, payload: CreateExpenseAdvanceRequestRequest) {
  const { data } = await api.put(`/api/finance/eam/requests/${requestId}`, payload);
  return data;
}

export async function submitExpenseAdvanceRequest(requestId: string) {
  const { data } = await api.post(`/api/finance/eam/requests/${requestId}/submit`);
  return data;
}

export async function approveExpenseAdvanceRequest(requestId: string) {
  const { data } = await api.post(`/api/finance/eam/requests/${requestId}/approve`);
  return data;
}

export async function rejectExpenseAdvanceRequest(requestId: string, payload: RejectWorkflowRequest) {
  const { data } = await api.post(`/api/finance/eam/requests/${requestId}/reject`, payload);
  return data;
}

export async function disburseExpenseAdvanceRequest(requestId: string, payload: DisburseExpenseAdvanceRequest) {
  const { data } = await api.post(`/api/finance/eam/requests/${requestId}/disburse`, payload);
  return data;
}

export async function getPayrollEmployees() {
  const { data } = await api.get<PayrollEmployeesResponse>('/api/payroll/employees');
  return data;
}

export async function getEamPolicy() {
  const { data } = await api.get<EamPolicyDto>('/api/finance/eam/policy');
  return data;
}

export async function saveEamPolicy(payload: EamPolicyDto) {
  const { data } = await api.put('/api/finance/eam/policy', payload);
  return data;
}

export async function getEamAdvanceTypes() {
  const { data } = await api.get<{ count: number; items: EamAdvanceTypeDto[] }>('/api/finance/eam/setup/advance-types');
  return data;
}

export async function saveEamAdvanceType(payload: Partial<EamAdvanceTypeDto>) {
  const { data } = payload.id
    ? await api.put(`/api/finance/eam/setup/advance-types/${payload.id}`, payload)
    : await api.post('/api/finance/eam/setup/advance-types', payload);
  return data;
}

export async function getEamExpenseCategories() {
  const { data } = await api.get<{ count: number; items: EamExpenseCategoryDto[] }>('/api/finance/eam/setup/expense-categories');
  return data;
}

export async function saveEamExpenseCategory(payload: Partial<EamExpenseCategoryDto>) {
  const { data } = payload.id
    ? await api.put(`/api/finance/eam/setup/expense-categories/${payload.id}`, payload)
    : await api.post('/api/finance/eam/setup/expense-categories', payload);
  return data;
}

export async function getEamPostingSetup() {
  const { data } = await api.get<EamPostingSetupDto>('/api/finance/eam/setup/posting');
  return data;
}

export async function saveEamPostingSetup(payload: EamPostingSetupDto) {
  const { data } = await api.put('/api/finance/eam/setup/posting', payload);
  return data;
}

export async function getEamRetirements() {
  const { data } = await api.get<EamRetirementListResponse>('/api/finance/eam/retirements');
  return data;
}

export async function getRejectedEamRetirements() {
  const { data } = await api.get<EamRetirementListResponse>('/api/finance/eam/retirements/rejected');
  return data;
}

export async function saveEamRetirement(payload: SaveEamRetirementRequest) {
  const { data } = await api.post('/api/finance/eam/retirements', payload);
  return data;
}

export async function updateEamRetirement(retirementId: string, payload: SaveEamRetirementRequest) {
  const { data } = await api.put(`/api/finance/eam/retirements/${retirementId}`, payload);
  return data;
}

export async function submitEamRetirement(retirementId: string) {
  const { data } = await api.post(`/api/finance/eam/retirements/${retirementId}/submit`);
  return data;
}

export async function approveEamRetirement(retirementId: string) {
  const { data } = await api.post(`/api/finance/eam/retirements/${retirementId}/approve`);
  return data;
}

export async function rejectEamRetirement(retirementId: string, payload: RejectWorkflowRequest) {
  const { data } = await api.post(`/api/finance/eam/retirements/${retirementId}/reject`, payload);
  return data;
}

export async function recordEamRefund(payload: RecordRefundRequest) {
  const { data } = await api.post('/api/finance/eam/refunds', payload);
  return data;
}

export async function recordEamRecovery(payload: RecordRecoveryRequest) {
  const { data } = await api.post('/api/finance/eam/recoveries', payload);
  return data;
}
