import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveHrLeaveRequest,
  createHrDepartment,
  createHrDesignation,
  createHrDisciplinaryRecord,
  createHrEmployee,
  createHrGrade,
  createHrLeaveRequest,
  createHrTrainingRecord,
  getHrDashboardSummary,
  getHrDepartments,
  getHrDesignations,
  getHrDisciplinaryRecords,
  getHrEmployees,
  getHrGrades,
  getHrLeaveRequests,
  getHrTrainingRecords,
  importHrEmployees,
  rejectHrLeaveRequest,
  submitHrLeaveRequest,
  terminateHrEmployee,
  updateHrDepartment,
  updateHrDesignation,
  updateHrEmployee,
  updateHrGrade,
  type HrDashboardSummaryResponse,
  type HrDisciplinaryRecordDto,
  type HrEmployeeDto,
  type HrLeaveRequestDto,
  type HrSetupItemDto,
  type HrTrainingRecordDto,
  type ImportHrEmployeeRow,
  type ImportHrEmployeesRequest,
  type SaveDisciplinaryRecordRequest,
  type SaveHrEmployeeRequest,
  type SaveHrSetupItemRequest,
  type SaveLeaveRequest,
  type SaveTrainingRecordRequest,
  type UpdateHrSetupItemRequest,
} from '../../lib/hrApi';
import {
  canApproveHrLeave,
  canCreateHrEmployees,
  canCreateHrLeave,
  canManageHrDepartments,
  canManageHrDesignations,
  canManageHrDisciplinary,
  canManageHrGrades,
  canManageHrTraining,
  canManageHumanResourcesSetup,
  canRejectHrLeave,
  canTerminateHrEmployees,
  canUpdateHrEmployees,
  canViewHrLeave,
  canViewHrReports,
  canViewHumanResources,
  canViewSensitiveHrEmployeeData,
} from '../../lib/auth';

export function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function dateInputToUtc(value: string): string {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : new Date().toISOString();
}

export function formatHrAmount(value?: number | null): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}


export const hrEmployeeTemplateHeader = [
  'employeeNumber',
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phoneNumber',
  'departmentCode',
  'designationCode',
  'gradeCode',
  'gender',
  'employmentType',
  'status',
  'hireDateUtc',
  'dateOfBirthUtc',
  'bankName',
  'bankAccountNumber',
  'pensionNumber',
  'taxIdentificationNumber',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'notes',
];

export const hrEmployeeTemplateRows = [
  [
    'EMP-001',
    'Amina',
    '',
    'Okafor',
    'amina@example.com',
    '08000000001',
    'FIN',
    'ACCOUNTANT',
    'G5',
    '2',
    '1',
    '2',
    '2026-01-01',
    '1995-01-01',
    'Demo Bank',
    '0123456789',
    'PEN-001',
    'TIN-001',
    'Sample address',
    'Emergency Contact',
    '08000000099',
    'Sample HR employee',
  ],
];

export function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => csvEscape(String(value ?? ''))).join(',')).join('\n');
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

export function mapHrEmployeeRows(rows: string[][]): ImportHrEmployeeRow[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((x) => x.trim());
  const indexOf = (name: string) => header.findIndex((x) => x === name);
  const valueAt = (row: string[], name: string) => {
    const index = indexOf(name);
    return index >= 0 ? row[index]?.trim() || '' : '';
  };

  return rows.slice(1).map((row) => ({
    employeeNumber: valueAt(row, 'employeeNumber'),
    firstName: valueAt(row, 'firstName'),
    middleName: valueAt(row, 'middleName') || null,
    lastName: valueAt(row, 'lastName'),
    email: valueAt(row, 'email') || null,
    phoneNumber: valueAt(row, 'phoneNumber') || null,
    departmentId: null,
    designationId: null,
    gradeId: null,
    departmentCode: valueAt(row, 'departmentCode') || null,
    designationCode: valueAt(row, 'designationCode') || null,
    gradeCode: valueAt(row, 'gradeCode') || null,
    gender: Number(valueAt(row, 'gender') || 0),
    employmentType: Number(valueAt(row, 'employmentType') || 1),
    status: Number(valueAt(row, 'status') || 2),
    hireDateUtc: dateInputToUtc(valueAt(row, 'hireDateUtc')),
    dateOfBirthUtc: valueAt(row, 'dateOfBirthUtc') ? dateInputToUtc(valueAt(row, 'dateOfBirthUtc')) : null,
    bankName: valueAt(row, 'bankName') || null,
    bankAccountNumber: valueAt(row, 'bankAccountNumber') || null,
    pensionNumber: valueAt(row, 'pensionNumber') || null,
    taxIdentificationNumber: valueAt(row, 'taxIdentificationNumber') || null,
    address: valueAt(row, 'address') || null,
    emergencyContactName: valueAt(row, 'emergencyContactName') || null,
    emergencyContactPhone: valueAt(row, 'emergencyContactPhone') || null,
    notes: valueAt(row, 'notes') || null,
  }));
}

export function printCurrentPage() {
  window.print();
}


export function getHrReadableError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function employeeStatusLabel(value?: number | null): string {
  if (value === 1) return 'Draft';
  if (value === 2) return 'Active';
  if (value === 3) return 'Suspended';
  if (value === 4) return 'On Leave';
  if (value === 5) return 'Terminated';
  if (value === 6) return 'Resigned';
  if (value === 7) return 'Retired';
  return 'Unknown';
}

export function leaveStatusLabel(value?: number | null): string {
  if (value === 1) return 'Draft';
  if (value === 2) return 'Submitted';
  if (value === 3) return 'Approved';
  if (value === 4) return 'Rejected';
  if (value === 5) return 'Cancelled';
  return 'Unknown';
}

export {
  useMemo,
  useState,
  useMutation,
  useQuery,
  useQueryClient,
  approveHrLeaveRequest,
  canApproveHrLeave,
  canCreateHrEmployees,
  canCreateHrLeave,
  canManageHrDepartments,
  canManageHrDesignations,
  canManageHrDisciplinary,
  canManageHrGrades,
  canManageHrTraining,
  canManageHumanResourcesSetup,
  canRejectHrLeave,
  canTerminateHrEmployees,
  canUpdateHrEmployees,
  canViewHrLeave,
  canViewHrReports,
  canViewHumanResources,
  canViewSensitiveHrEmployeeData,
  createHrDepartment,
  createHrDesignation,
  createHrDisciplinaryRecord,
  createHrEmployee,
  createHrGrade,
  createHrLeaveRequest,
  createHrTrainingRecord,
  getHrDashboardSummary,
  getHrDepartments,
  getHrDesignations,
  getHrDisciplinaryRecords,
  getHrEmployees,
  getHrGrades,
  getHrLeaveRequests,
  getHrTrainingRecords,
  importHrEmployees,
  rejectHrLeaveRequest,
  submitHrLeaveRequest,
  terminateHrEmployee,
  updateHrDepartment,
  updateHrDesignation,
  updateHrEmployee,
  updateHrGrade,
};

export type {
  ChangeEvent,
  HrDashboardSummaryResponse,
  HrDisciplinaryRecordDto,
  HrEmployeeDto,
  HrLeaveRequestDto,
  HrSetupItemDto,
  HrTrainingRecordDto,
  ImportHrEmployeeRow,
  ImportHrEmployeesRequest,
  SaveDisciplinaryRecordRequest,
  SaveHrEmployeeRequest,
  SaveHrSetupItemRequest,
  SaveLeaveRequest,
  SaveTrainingRecordRequest,
  UpdateHrSetupItemRequest,
};
