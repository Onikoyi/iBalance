import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPayrollEmployee,
  updatePayrollEmployee,
  deletePayrollEmployee,
  createPayrollPayElement,
  updatePayrollPayElement,
  deletePayrollPayElement,
  createPayrollPayGroup,
  updatePayrollPayGroup,
  deletePayrollPayGroup,
  createPayrollSalaryStructure,
  updatePayrollSalaryStructure,
  deletePayrollSalaryStructure,
  createPayrollSalaryStructureOverride,
  updatePayrollSalaryStructureOverride,
  deletePayrollSalaryStructureOverride,
  createPayrollPayGroupElement,
  updatePayrollPayGroupElement,
  deletePayrollPayGroupElement,
  generatePayrollRun,
  postPayrollRun,
  submitPayrollRun,
  approvePayrollRun,
  rejectPayrollRun,
  getAccounts,
  getEmployeePayrollHistory,
  getPayrollEmployees,
  getPayrollPayElements,
  getPayrollPayGroups,
  getPayrollPayGroupElements,
  getPayrollPayslips,
  getPayrollRunDetail,
  getPayrollRuns,
  getPayrollSalaryStructures,
  getPayrollSalaryStructureOverrides,
  getPayrollPolicySetting,
  upsertPayrollPolicySetting,
  getPayrollStatutoryReport,
  getTenantReadableError,
  importPayrollEmployees,
  type CreatePayrollEmployeeRequest,
  type UpdatePayrollEmployeeRequest,
  type PayrollEmployeeDto,
  type PayrollPayElementDto,
  type UpdatePayrollPayElementRequest,
  type PayrollPayGroupDto,
  type PayrollPayGroupElementDto,
  type CreatePayrollPayGroupElementRequest,
  type UpdatePayrollPayGroupElementRequest,
  type PayrollPayslipDto,
  type PayrollRunSummaryDto,
  type PayrollSalaryStructureDto,
  type UpdatePayrollSalaryStructureRequest,
  type PayrollSalaryStructureOverrideDto,
  type CreatePayrollSalaryStructureOverrideRequest,
  type UpdatePayrollSalaryStructureOverrideRequest,
  type PayrollPolicySettingDto,
  type UpdatePayrollPolicySettingRequest,
  type PayrollStatutoryReportRowDto,
  type UpdatePayrollPayGroupRequest,
  type PayrollRunLineItemDto,
  type PayrollRunLineDetailDto,
  type PayrollRunDetailDto,
} from '../lib/api';
import {
  canApprovePayrollRuns,
  canManagePayroll,
  canPostPayrollRuns,
  canRejectPayrollRuns,
  canSubmitPayrollRuns,
  canViewPayroll,
} from '../lib/auth';

export function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : new Date().toISOString();
}

export function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function payrollStatusLabel(status?: number | null) {
  if (status === 4) return 'Rejected';
  if (status === 2) return 'Posted';
  if (status === 1) return 'Submitted / Approved';
  return 'Draft';
}

export function printCurrentPage() {
  window.print();
}

/**
 * Backward-compatible exports expected by existing payroll pages.
 * Internally they now resolve to payroll-specific permissions.
 */
export function canViewFinance() {
  return canViewPayroll();
}

export function canManageFinanceSetup() {
  return canManagePayroll();
}

export function canPostJournals() {
  return canPostPayrollRuns();
}

/**
 * New payroll-specific helpers for future payroll-page cleanup.
 */
export function canManagePayrollSetup() {
  return canManagePayroll();
}

export function canCreatePayrollRuns() {
  return canManagePayroll();
}

export function canSubmitPayrollRunAction() {
  return canSubmitPayrollRuns();
}

export function canApprovePayrollRunAction() {
  return canApprovePayrollRuns();
}

export function canRejectPayrollRunAction() {
  return canRejectPayrollRuns();
}

export function canPostPayrollRunAction() {
  return canPostPayrollRuns();
}

export const employeeTemplateHeader = [
  'employeeNumber',
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phoneNumber',
  'department',
  'jobTitle',
  'hireDateUtc',
  'bankName',
  'bankAccountNumber',
  'pensionNumber',
  'taxIdentificationNumber',
  'isActive',
  'notes',
];

export const employeeTemplateRows = [
  ['EMP-001', 'Amina', 'Kehinde', 'Okafor', 'amina@example.com', '08000000001', 'Finance', 'Accountant', '2026-01-01', 'Demo Bank', '0123456789', 'PEN-001', 'TIN-001', 'true', 'Sample employee'],
  ['EMP-002', 'Tunde', 'Ade', 'Bello', 'tunde@example.com', '08000000002', 'Operations', 'Supervisor', '2026-01-01', 'Demo Bank', '9876543210', 'PEN-002', 'TIN-002', 'true', 'Sample employee'],
];

export function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => csvEscape(value)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

export function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

export function mapEmployeeRows(rows: string[][]): CreatePayrollEmployeeRequest[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((x) => x.trim());
  const indexOf = (name: string) => header.findIndex((x) => x === name);

  return rows.slice(1).map((row) => ({
    employeeNumber: row[indexOf('employeeNumber')]?.trim() || '',
    firstName: row[indexOf('firstName')]?.trim() || '',
    middleName: row[indexOf('middleName')]?.trim() || null,
    lastName: row[indexOf('lastName')]?.trim() || '',
    email: row[indexOf('email')]?.trim() || null,
    phoneNumber: row[indexOf('phoneNumber')]?.trim() || null,
    department: row[indexOf('department')]?.trim() || null,
    jobTitle: row[indexOf('jobTitle')]?.trim() || null,
    hireDateUtc: dateInputToUtc(row[indexOf('hireDateUtc')]?.trim() || ''),
    bankName: row[indexOf('bankName')]?.trim() || null,
    bankAccountNumber: row[indexOf('bankAccountNumber')]?.trim() || null,
    pensionNumber: row[indexOf('pensionNumber')]?.trim() || null,
    taxIdentificationNumber: row[indexOf('taxIdentificationNumber')]?.trim() || null,
    isActive: parseBoolean(row[indexOf('isActive')] || 'true'),
    notes: row[indexOf('notes')]?.trim() || null,
  }));
}

export {
  useMemo,
  useState,
  useMutation,
  useQuery,
  useQueryClient,
  createPayrollEmployee,
  updatePayrollEmployee,
  deletePayrollEmployee,
  createPayrollPayElement,
  updatePayrollPayElement,
  deletePayrollPayElement,
  createPayrollPayGroup,
  updatePayrollPayGroup,
  deletePayrollPayGroup,
  createPayrollSalaryStructure,
  updatePayrollSalaryStructure,
  deletePayrollSalaryStructure,
  createPayrollSalaryStructureOverride,
  updatePayrollSalaryStructureOverride,
  deletePayrollSalaryStructureOverride,
  createPayrollPayGroupElement,
  updatePayrollPayGroupElement,
  deletePayrollPayGroupElement,
  generatePayrollRun,
  postPayrollRun,
  submitPayrollRun,
  approvePayrollRun,
  rejectPayrollRun,
  getAccounts,
  getEmployeePayrollHistory,
  getPayrollEmployees,
  getPayrollPayElements,
  getPayrollPayGroups,
  getPayrollPayGroupElements,
  getPayrollPayslips,
  getPayrollRunDetail,
  getPayrollRuns,
  getPayrollSalaryStructures,
  getPayrollSalaryStructureOverrides,
  getPayrollPolicySetting,
  upsertPayrollPolicySetting,
  getPayrollStatutoryReport,
  getTenantReadableError,
  importPayrollEmployees,
  canViewPayroll,
};

export type {
  ChangeEvent,
  CreatePayrollEmployeeRequest,
  UpdatePayrollEmployeeRequest,
  PayrollEmployeeDto,
  PayrollPayElementDto,
  UpdatePayrollPayElementRequest,
  PayrollPayGroupDto,
  PayrollPayGroupElementDto,
  CreatePayrollPayGroupElementRequest,
  UpdatePayrollPayGroupElementRequest,
  PayrollPayslipDto,
  PayrollRunSummaryDto,
  PayrollSalaryStructureDto,
  UpdatePayrollSalaryStructureRequest,
  PayrollSalaryStructureOverrideDto,
  CreatePayrollSalaryStructureOverrideRequest,
  UpdatePayrollSalaryStructureOverrideRequest,
  PayrollPolicySettingDto,
  UpdatePayrollPolicySettingRequest,
  PayrollStatutoryReportRowDto,
  UpdatePayrollPayGroupRequest,
  PayrollRunLineItemDto,
  PayrollRunLineDetailDto,
  PayrollRunDetailDto,
};