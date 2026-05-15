import { useQuery } from '@tanstack/react-query';
import {
  canApproveExpenseAdvances,
  canCreateExpenseAdvances,
  canManageExpenseAdvancePolicies,
  canRejectExpenseAdvances,
  canSubmitExpenseAdvances,
  canViewExpenseAdvanceReports,
  canViewExpenseAdvances,
} from '../../lib/auth';
import {
  approveEamRetirement,
  approveExpenseAdvanceRequest,
  createExpenseAdvanceRequest,
  disburseExpenseAdvanceRequest,
  getEamAdvanceTypes,
  getEamDashboard,
  getEamExpenseCategories,
  getEamPolicy,
  getEamPostingSetup,
  getEamRetirements,
  getExpenseAdvanceRequests,
  getPayrollEmployees,
  getRejectedEamRetirements,
  getRejectedExpenseAdvanceRequests,
  getTenantReadableError,
  recordEamRecovery,
  recordEamRefund,
  rejectEamRetirement,
  rejectExpenseAdvanceRequest,
  saveEamAdvanceType,
  saveEamExpenseCategory,
  saveEamPolicy,
  saveEamPostingSetup,
  saveEamRetirement,
  submitEamRetirement,
  submitExpenseAdvanceRequest,
  updateEamRetirement,
  updateExpenseAdvanceRequest,
  type CreateExpenseAdvanceRequestRequest,
  type DisburseExpenseAdvanceRequest,
  type EamAdvanceTypeDto,
  type EamDashboardResponse,
  type EamExpenseCategoryDto,
  type EamPolicyDto,
  type EamPostingSetupDto,
  type EamRetirementDto,
  type EamRetirementLineDto,
  type EamRetirementListResponse,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  type PayrollEmployeeDto,
  type PayrollEmployeesResponse,
  type RecordRecoveryRequest,
  type RecordRefundRequest,
  type RejectWorkflowRequest,
  type SaveEamRetirementRequest,
} from '../../lib/eamApi';

export { useQuery };
export {
  approveEamRetirement,
  approveExpenseAdvanceRequest,
  canApproveExpenseAdvances,
  canCreateExpenseAdvances,
  canManageExpenseAdvancePolicies,
  canRejectExpenseAdvances,
  canSubmitExpenseAdvances,
  canViewExpenseAdvanceReports,
  canViewExpenseAdvances,
  createExpenseAdvanceRequest,
  disburseExpenseAdvanceRequest,
  getEamAdvanceTypes,
  getEamDashboard,
  getEamExpenseCategories,
  getEamPolicy,
  getEamPostingSetup,
  getEamRetirements,
  getExpenseAdvanceRequests,
  getPayrollEmployees,
  getRejectedEamRetirements,
  getRejectedExpenseAdvanceRequests,
  getTenantReadableError,
  recordEamRecovery,
  recordEamRefund,
  rejectEamRetirement,
  rejectExpenseAdvanceRequest,
  saveEamAdvanceType,
  saveEamExpenseCategory,
  saveEamPolicy,
  saveEamPostingSetup,
  saveEamRetirement,
  submitEamRetirement,
  submitExpenseAdvanceRequest,
  updateEamRetirement,
  updateExpenseAdvanceRequest,
};

export type {
  CreateExpenseAdvanceRequestRequest,
  DisburseExpenseAdvanceRequest,
  EamAdvanceTypeDto,
  EamDashboardResponse,
  EamExpenseCategoryDto,
  EamPolicyDto,
  EamPostingSetupDto,
  EamRetirementDto,
  EamRetirementLineDto,
  EamRetirementListResponse,
  ExpenseAdvanceRequestDto,
  ExpenseAdvanceRequestListResponse,
  PayrollEmployeeDto,
  PayrollEmployeesResponse,
  RecordRecoveryRequest,
  RecordRefundRequest,
  RejectWorkflowRequest,
  SaveEamRetirementRequest,
};

export type EamAdvanceTypeOption = {
  id: string;
  label: string;
};

export const eamAdvanceTypeOptions: EamAdvanceTypeOption[] = [
  { id: '11111111-1111-1111-1111-111111111111', label: 'Travel Advance' },
  { id: '22222222-2222-2222-2222-222222222222', label: 'Staff Advance' },
  { id: '33333333-3333-3333-3333-333333333333', label: 'Operational Float' },
  { id: '44444444-4444-4444-4444-444444444444', label: 'Imprest' },
  { id: '55555555-5555-5555-5555-555555555555', label: 'Project Advance' },
  { id: '66666666-6666-6666-6666-666666666666', label: 'Emergency Advance' },
];

export function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

export function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';
}

export function eamStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Disbursed';
    case 6: return 'Partially Retired';
    case 7: return 'Fully Retired';
    case 8: return 'Overdue';
    case 9: return 'Cancelled';
    case 10: return 'Closed';
    default: return 'Unknown';
  }
}

export function retirementStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Cancelled';
    default: return 'Unknown';
  }
}
