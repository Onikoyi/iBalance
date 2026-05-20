import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canAllocateBillingPayments,
  canApproveBillingCreditNotes,
  canApproveBillingInvoices,
  canCancelBillingInvoices,
  canCreateBillingCreditNotes,
  canCreateBillingInvoices,
  canExportBillingReports,
  canManageBillingSetup,
  canPostBillingInvoices,
  canRejectBillingInvoices,
  canSubmitBillingInvoices,
  canUpdateBillingInvoices,
  canViewBilling,
  canViewBillingReports,
} from '../../lib/auth';
import {
  allocateBillingPayment,
  approveBillingCreditNote,
  approveBillingInvoice,
  cancelBillingInvoice,
  createBillingCreditNote,
  createBillingInvoice,
  deleteBillingCreditNote,
  getBillingAgeingReport,
  getBillingCreditNotes,
  getBillingCustomers,
  getBillingDashboard,
  getBillingInvoice,
  getBillingInvoices,
  getBillingOutstandingReport,
  getBillingPolicy,
  getBillingPostingAccounts,
  getBillingRegisterReport,
  getRejectedBillingCreditNotes,
  postBillingCreditNote,
  postBillingInvoice,
  rejectBillingCreditNote,
  rejectBillingInvoice,
  saveBillingPolicy,
  submitBillingCreditNote,
  submitBillingInvoice,
  updateBillingInvoice,
  updateBillingCreditNote,
  type BillingCreditNoteDto,
  type BillingCustomerDto,
  type BillingCustomerListResponse,
  type BillingDashboardResponse,
  type BillingInvoiceDto,
  type BillingInvoiceLineDto,
  type BillingPolicyDto,
  type BillingPostingAccountDto,
  type CreateBillingCreditNoteRequest,
  type PostBillingCreditNoteRequest,
  type BillingPostingAccountListResponse,
  type SaveBillingInvoiceRequest,
  type SaveBillingPolicyRequest,
  type UpdateBillingCreditNoteRequest,
} from '../../lib/billingApi';

export function formatBillingAmount(value?: number | null): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function dateInputToUtc(value: string): string {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : new Date().toISOString();
}

export function getBillingReadableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export {
  useMutation,
  useQuery,
  useQueryClient,
  allocateBillingPayment,
  approveBillingCreditNote,
  approveBillingInvoice,
  canAllocateBillingPayments,
  canApproveBillingCreditNotes,
  canApproveBillingInvoices,
  canCancelBillingInvoices,
  canCreateBillingCreditNotes,
  canCreateBillingInvoices,
  canExportBillingReports,
  canManageBillingSetup,
  canPostBillingInvoices,
  canRejectBillingInvoices,
  canSubmitBillingInvoices,
  canUpdateBillingInvoices,
  canViewBilling,
  canViewBillingReports,
  cancelBillingInvoice,
  createBillingCreditNote,
  createBillingInvoice,
  deleteBillingCreditNote,
  getBillingAgeingReport,
  getBillingCreditNotes,
  getBillingCustomers,
  getBillingDashboard,
  getBillingInvoice,
  getBillingInvoices,
  getBillingOutstandingReport,
  getBillingPolicy,
  getBillingPostingAccounts,
  getBillingRegisterReport,
  getRejectedBillingCreditNotes,
  postBillingCreditNote,
  postBillingInvoice,
  rejectBillingCreditNote,
  rejectBillingInvoice,
  saveBillingPolicy,
  submitBillingCreditNote,
  submitBillingInvoice,
  updateBillingInvoice,
  updateBillingCreditNote,
};

export type {
  BillingCreditNoteDto,
  BillingCustomerDto,
  BillingCustomerListResponse,
  BillingDashboardResponse,
  BillingInvoiceDto,
  BillingInvoiceLineDto,
  BillingPolicyDto,
  BillingPostingAccountDto,
  CreateBillingCreditNoteRequest,
  PostBillingCreditNoteRequest,
  BillingPostingAccountListResponse,
  SaveBillingInvoiceRequest,
  SaveBillingPolicyRequest,
  UpdateBillingCreditNoteRequest,
};
