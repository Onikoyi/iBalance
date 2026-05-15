import type { UserRole } from './auth';

export type AppPermission =
  | 'admin.access'
  | 'admin.settings.manage'
  | 'admin.users.manage'
  | 'admin.roles.manage'
  | 'admin.permissions.manage'
  | 'admin.scopes.manage'
  | 'license.recovery.bypass'
  | 'finance.view'
  | 'finance.setup.manage'
  | 'finance.transactions.create'
  | 'finance.transactions.submit'
  | 'finance.transactions.approve'
  | 'finance.transactions.reject'
  | 'finance.transactions.post'
  | 'finance.transactions.delete'
  | 'finance.reports.view'
  | 'finance.journals.create'
  | 'finance.journals.post'
  | 'finance.journals.reverse'
  | 'finance.fiscal-periods.manage'
  | 'budget.view'
  | 'budget.manage'
  | 'budget.create'
  | 'budget.submit'
  | 'budget.approve'
  | 'budget.reject'
  | 'budget.lock'
  | 'budget.close'
  | 'budget.transfer'
  | 'budget.reports.view'
  | 'payroll.view'
  | 'payroll.manage'
  | 'payroll.run.submit'
  | 'payroll.run.approve'
  | 'payroll.run.reject'
  | 'payroll.run.post'
  | 'procurement.view'
  | 'procurement.requisition.create'
  | 'procurement.requisition.submit'
  | 'procurement.requisition.approve'
  | 'procurement.requisition.reject'
  | 'procurement.po.create'
  | 'procurement.po.approve'
  | 'procurement.receipt.create'
  | 'ap.view'
  | 'ap.invoice.create'
  | 'ap.invoice.submit'
  | 'ap.invoice.approve'
  | 'ap.invoice.reject'
  | 'ap.invoice.post'
  | 'ap.payment.create'
  | 'ap.payment.submit'
  | 'ap.payment.approve'
  | 'ap.payment.reject'
  | 'ap.payment.post'
  | 'ar.view'
  | 'ar.invoice.create'
  | 'ar.invoice.submit'
  | 'ar.invoice.approve'
  | 'ar.invoice.reject'
  | 'ar.invoice.post'
  | 'ar.receipt.create'
  | 'ar.receipt.submit'
  | 'ar.receipt.approve'
  | 'ar.receipt.reject'
  | 'ar.receipt.post'
  | 'treasury.view'
  | 'treasury.manage'
  | 'treasury.bankaccounts.manage'
  | 'treasury.reconciliation.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'fixedassets.view'
  | 'fixedassets.manage'
  | 'fixedassets.depreciation.run'
  | 'fixedassets.disposal.post'
  | 'eam.view'
  | 'eam.request.create'
  | 'eam.request.update'
  | 'eam.request.delete'
  | 'eam.request.submit'
  | 'eam.request.approve'
  | 'eam.request.reject'
  | 'eam.disburse'
  | 'eam.retirement.create'
  | 'eam.retirement.update'
  | 'eam.retirement.submit'
  | 'eam.retirement.approve'
  | 'eam.retirement.reject'
  | 'eam.refund.record'
  | 'eam.recovery.manage'
  | 'eam.policy.manage'
  | 'eam.reports.view'
  | 'workflow.approve'
  | 'workflow.reject'
  | 'workflow.reopen'
  | 'reports.view'
  | 'reports.export'
  | 'fleet.view' 
  | 'fleet.vehicle.manage' 
  | 'fleet.driver.manage'
  | 'fleet.trip.create'
  | 'fleet.trip.submit'
  | 'fleet.trip.approve' 
  | 'fleet.trip.reject' 
  | 'fleet.trip.post' 
  | 'fleet.fuel.manage' 
  | 'fleet.fuel.approve'
  | 'fleet.fuel.post' 
  | 'fleet.maintenance.manage'
  | 'fleet.maintenance.submit'
  | 'fleet.maintenance.approve'
  | 'fleet.maintenance.reject'
  | 'fleet.maintenance.post'
  | 'fleet.policy.manage'
  | 'fleet.reports.view';


const rolePermissions: Record<UserRole, AppPermission[]> = {
  PlatformAdmin: [
    'admin.access',
    'admin.settings.manage',
    'admin.users.manage',
    'admin.roles.manage',
    'admin.permissions.manage',
    'admin.scopes.manage',
    'license.recovery.bypass',
    'finance.view',
    'finance.setup.manage',
    'finance.transactions.create',
    'finance.transactions.submit',
    'finance.transactions.approve',
    'finance.transactions.reject',
    'finance.transactions.post',
    'finance.transactions.delete',
    'finance.reports.view',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'budget.view',
    'budget.manage',
    'budget.create',
    'budget.submit',
    'budget.approve',
    'budget.reject',
    'budget.lock',
    'budget.close',
    'budget.transfer',
    'budget.reports.view',
    'payroll.view',
    'payroll.manage',
    'payroll.run.submit',
    'payroll.run.approve',
    'payroll.run.reject',
    'payroll.run.post',
    'procurement.view',
    'procurement.requisition.create',
    'procurement.requisition.submit',
    'procurement.requisition.approve',
    'procurement.requisition.reject',
    'procurement.po.create',
    'procurement.po.approve',
    'procurement.receipt.create',
    'ap.view',
    'ap.invoice.create',
    'ap.invoice.submit',
    'ap.invoice.approve',
    'ap.invoice.reject',
    'ap.invoice.post',
    'ap.payment.create',
    'ap.payment.submit',
    'ap.payment.approve',
    'ap.payment.reject',
    'ap.payment.post',
    'ar.view',
    'ar.invoice.create',
    'ar.invoice.submit',
    'ar.invoice.approve',
    'ar.invoice.reject',
    'ar.invoice.post',
    'ar.receipt.create',
    'ar.receipt.submit',
    'ar.receipt.approve',
    'ar.receipt.reject',
    'ar.receipt.post',
    'treasury.view',
    'treasury.manage',
    'treasury.bankaccounts.manage',
    'treasury.reconciliation.manage',
    'inventory.view',
    'inventory.manage',
    'fixedassets.view',
    'fixedassets.manage',
    'fixedassets.depreciation.run',
    'fixedassets.disposal.post',
    'eam.view',
    'eam.request.create',
    'eam.request.update',
    'eam.request.delete',
    'eam.request.submit',
    'eam.request.approve',
    'eam.request.reject',
    'eam.disburse',
    'eam.retirement.create',
    'eam.retirement.update',
    'eam.retirement.submit',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.refund.record',
    'eam.recovery.manage',
    'eam.policy.manage',
    'eam.reports.view',
    'workflow.approve',
    'workflow.reject',
    'workflow.reopen',
    'reports.view',
    'reports.export',
    'fleet.view',
    'fleet.vehicle.manage',
    'fleet.driver.manage',
    'fleet.trip.create',
    'fleet.trip.submit',
    'fleet.trip.approve',
    'fleet.trip.reject',
    'fleet.trip.post',
    'fleet.fuel.manage',
    'fleet.fuel.approve',
    'fleet.fuel.post',
    'fleet.maintenance.manage',
    'fleet.maintenance.submit',
    'fleet.maintenance.approve',
    'fleet.maintenance.reject',
    'fleet.maintenance.post',
    'fleet.policy.manage',
    'fleet.reports.view',

  ],
  TenantAdmin: [
    'admin.access',
    'admin.settings.manage',
    'admin.users.manage',
    'admin.roles.manage',
    'admin.permissions.manage',
    'admin.scopes.manage',
    'finance.view',
    'finance.setup.manage',
    'finance.transactions.create',
    'finance.transactions.submit',
    'finance.transactions.approve',
    'finance.transactions.reject',
    'finance.transactions.post',
    'finance.transactions.delete',
    'finance.reports.view',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'budget.view',
    'budget.manage',
    'budget.create',
    'budget.submit',
    'budget.approve',
    'budget.reject',
    'budget.lock',
    'budget.close',
    'budget.transfer',
    'budget.reports.view',
    'payroll.view',
    'payroll.manage',
    'payroll.run.submit',
    'payroll.run.approve',
    'payroll.run.reject',
    'payroll.run.post',
    'procurement.view',
    'procurement.requisition.create',
    'procurement.requisition.submit',
    'procurement.requisition.approve',
    'procurement.requisition.reject',
    'procurement.po.create',
    'procurement.po.approve',
    'procurement.receipt.create',
    'ap.view',
    'ap.invoice.create',
    'ap.invoice.submit',
    'ap.invoice.approve',
    'ap.invoice.reject',
    'ap.invoice.post',
    'ap.payment.create',
    'ap.payment.submit',
    'ap.payment.approve',
    'ap.payment.reject',
    'ap.payment.post',
    'ar.view',
    'ar.invoice.create',
    'ar.invoice.submit',
    'ar.invoice.approve',
    'ar.invoice.reject',
    'ar.invoice.post',
    'ar.receipt.create',
    'ar.receipt.submit',
    'ar.receipt.approve',
    'ar.receipt.reject',
    'ar.receipt.post',
    'treasury.view',
    'treasury.manage',
    'treasury.bankaccounts.manage',
    'treasury.reconciliation.manage',
    'inventory.view',
    'inventory.manage',
    'fixedassets.view',
    'fixedassets.manage',
    'fixedassets.depreciation.run',
    'fixedassets.disposal.post',
    'eam.view',
    'eam.request.create',
    'eam.request.update',
    'eam.request.delete',
    'eam.request.submit',
    'eam.request.approve',
    'eam.request.reject',
    'eam.disburse',
    'eam.retirement.create',
    'eam.retirement.update',
    'eam.retirement.submit',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.refund.record',
    'eam.recovery.manage',
    'eam.policy.manage',
    'eam.reports.view',
    'workflow.approve',
    'workflow.reject',
    'workflow.reopen',
    'reports.view',
    'reports.export',
    'fleet.view',
    'fleet.vehicle.manage',
    'fleet.driver.manage',
    'fleet.trip.create',
    'fleet.trip.submit',
    'fleet.trip.approve',
    'fleet.trip.reject',
    'fleet.trip.post',
    'fleet.fuel.manage',
    'fleet.fuel.approve',
    'fleet.fuel.post',
    'fleet.maintenance.manage',
    'fleet.maintenance.submit',
    'fleet.maintenance.approve',
    'fleet.maintenance.reject',
    'fleet.maintenance.post',
    'fleet.policy.manage',
    'fleet.reports.view',

  ],
  FinanceController: [
    'finance.view',
    'finance.setup.manage',
    'finance.transactions.create',
    'finance.transactions.submit',
    'finance.transactions.approve',
    'finance.transactions.reject',
    'finance.transactions.post',
    'finance.reports.view',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'budget.view',
    'budget.manage',
    'budget.create',
    'budget.submit',
    'budget.approve',
    'budget.reject',
    'budget.lock',
    'budget.close',
    'budget.transfer',
    'budget.reports.view',
    'ap.view',
    'ap.invoice.create',
    'ap.invoice.submit',
    'ap.invoice.approve',
    'ap.invoice.reject',
    'ap.invoice.post',
    'ap.payment.create',
    'ap.payment.submit',
    'ap.payment.approve',
    'ap.payment.reject',
    'ap.payment.post',
    'ar.view',
    'ar.invoice.create',
    'ar.invoice.submit',
    'ar.invoice.approve',
    'ar.invoice.reject',
    'ar.invoice.post',
    'ar.receipt.create',
    'ar.receipt.submit',
    'ar.receipt.approve',
    'ar.receipt.reject',
    'ar.receipt.post',
    'treasury.view',
    'treasury.manage',
    'treasury.bankaccounts.manage',
    'treasury.reconciliation.manage',
    'fixedassets.view',
    'fixedassets.manage',
    'fixedassets.depreciation.run',
    'fixedassets.disposal.post',
    'eam.view',
    'eam.request.create',
    'eam.request.update',
    'eam.request.submit',
    'eam.request.approve',
    'eam.request.reject',
    'eam.disburse',
    'eam.retirement.create',
    'eam.retirement.update',
    'eam.retirement.submit',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.refund.record',
    'eam.recovery.manage',
    'eam.policy.manage',
    'eam.reports.view',
    'workflow.approve',
    'workflow.reject',
    'workflow.reopen',
    'reports.view',
    'reports.export',
  ],
  Accountant: [
    'finance.view',
    'finance.setup.manage',
    'finance.transactions.create',
    'finance.transactions.submit',
    'finance.transactions.post',
    'finance.reports.view',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'budget.view',
    'budget.create',
    'budget.submit',
    'budget.reports.view',
    'ap.view',
    'ap.invoice.create',
    'ap.invoice.submit',
    'ap.invoice.post',
    'ap.payment.create',
    'ap.payment.submit',
    'ap.payment.post',
    'ar.view',
    'ar.invoice.create',
    'ar.invoice.submit',
    'ar.invoice.post',
    'ar.receipt.create',
    'ar.receipt.submit',
    'ar.receipt.post',
    'fixedassets.view',
    'fixedassets.manage',
    'fixedassets.depreciation.run',
    'eam.view',
    'eam.request.create',
    'eam.request.update',
    'eam.request.submit',
    'eam.disburse',
    'eam.retirement.create',
    'eam.retirement.update',
    'eam.retirement.submit',
    'eam.refund.record',
    'eam.recovery.manage',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],
  Approver: [
    'finance.view',
    'finance.transactions.approve',
    'finance.transactions.reject',
    'finance.reports.view',
    'budget.view',
    'budget.approve',
    'budget.reject',
    'budget.lock',
    'budget.close',
    'budget.reports.view',
    'payroll.view',
    'payroll.run.approve',
    'payroll.run.reject',
    'procurement.view',
    'procurement.requisition.approve',
    'procurement.requisition.reject',
    'procurement.po.approve',
    'ap.view',
    'ap.invoice.approve',
    'ap.invoice.reject',
    'ap.payment.approve',
    'ap.payment.reject',
    'ar.view',
    'ar.invoice.approve',
    'ar.invoice.reject',
    'ar.receipt.approve',
    'ar.receipt.reject',
    'eam.view',
    'eam.request.approve',
    'eam.request.reject',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.reports.view',
    'workflow.approve',
    'workflow.reject',
    'reports.view',
    'reports.export',
  ],
  Viewer: [
    'finance.view',
    'finance.reports.view',
    'budget.view',
    'budget.reports.view',
    'payroll.view',
    'procurement.view',
    'ap.view',
    'ar.view',
    'treasury.view',
    'inventory.view',
    'fixedassets.view',
    'eam.view',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],
  Auditor: [
    'finance.view',
    'finance.reports.view',
    'budget.view',
    'budget.reports.view',
    'payroll.view',
    'procurement.view',
    'ap.view',
    'ar.view',
    'treasury.view',
    'inventory.view',
    'fixedassets.view',
    'eam.view',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],
  BudgetOfficer: [
    'finance.view',
    'budget.view',
    'budget.manage',
    'budget.create',
    'budget.submit',
    'budget.transfer',
    'budget.reports.view',
    'reports.view',
    'reports.export',
  ],
  BudgetOwner: [
    'finance.view',
    'budget.view',
    'budget.approve',
    'budget.reject',
    'budget.lock',
    'budget.close',
    'budget.reports.view',
    'reports.view',
    'reports.export',
  ],
  PayrollOfficer: [
    'payroll.view',
    'payroll.manage',
    'payroll.run.submit',
    'reports.view',
    'reports.export',
  ],
  HrOfficer: [
    'payroll.view',
    'payroll.manage',
    'reports.view',
    'reports.export',
  ],
  ProcurementOfficer: [
    'procurement.view',
    'procurement.requisition.create',
    'procurement.requisition.submit',
    'procurement.po.create',
    'procurement.receipt.create',
    'reports.view',
    'reports.export',
  ],
  TreasuryOfficer: [
    'treasury.view',
    'treasury.manage',
    'treasury.bankaccounts.manage',
    'treasury.reconciliation.manage',
    'reports.view',
    'reports.export',
  ],
  InventoryOfficer: [
    'inventory.view',
    'inventory.manage',
    'reports.view',
    'reports.export',
  ],
  ApOfficer: [
    'ap.view',
    'ap.invoice.create',
    'ap.invoice.submit',
    'ap.invoice.post',
    'ap.payment.create',
    'ap.payment.submit',
    'ap.payment.post',
    'reports.view',
    'reports.export',
  ],
  ArOfficer: [
    'ar.view',
    'ar.invoice.create',
    'ar.invoice.submit',
    'ar.invoice.post',
    'ar.receipt.create',
    'ar.receipt.submit',
    'ar.receipt.post',
    'reports.view',
    'reports.export',
  ],
  FixedAssetOfficer: [
    'fixedassets.view',
    'fixedassets.manage',
    'fixedassets.depreciation.run',
    'fixedassets.disposal.post',
    'reports.view',
    'reports.export',
  ],
  ExpenseAdvanceOfficer: [
    'eam.view',
    'eam.request.create',
    'eam.request.update',
    'eam.request.delete',
    'eam.request.submit',
    'eam.disburse',
    'eam.retirement.create',
    'eam.retirement.update',
    'eam.retirement.submit',
    'eam.refund.record',
    'eam.recovery.manage',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],
  ExpenseAdvanceApprover: [
    'eam.view',
    'eam.request.approve',
    'eam.request.reject',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.disburse',
    'eam.recovery.manage',
    'eam.reports.view',
    'workflow.approve',
    'workflow.reject',
    'reports.view',
    'reports.export',
  ],
  ExpenseAdvanceReviewer: [
    'eam.view',
    'eam.request.approve',
    'eam.request.reject',
    'eam.retirement.approve',
    'eam.retirement.reject',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],
  ExpenseAdvanceViewer: [
    'eam.view',
    'eam.reports.view',
    'reports.view',
    'reports.export',
  ],

  FleetOfficer: [
    'fleet.view',
    'fleet.vehicle.manage',
    'fleet.driver.manage',
    'fleet.trip.create',
    'fleet.trip.submit',
    'fleet.fuel.manage',
    'fleet.maintenance.manage',
    'fleet.maintenance.submit',
    'fleet.policy.manage',
    'fleet.reports.view',
  ],
  FleetApprover: [
    'fleet.view',
    'fleet.trip.approve',
    'fleet.trip.reject',
    'fleet.trip.post',
    'fleet.fuel.approve',
    'fleet.fuel.post',
    'fleet.maintenance.approve',
    'fleet.maintenance.reject',
    'fleet.maintenance.post',
    'fleet.reports.view',
    'workflow.approve',
    'workflow.reject',
  ],
  FleetReviewer: [
    'fleet.view',
    'fleet.reports.view',
  ],
  FleetViewer: [
    'fleet.view',
    'fleet.reports.view',
  ],
};

export function getRolePermissions(role: UserRole | null | undefined): AppPermission[] {
  if (!role) {
    return [];
  }

  return rolePermissions[role] || [];
}

export function roleHasPermission(
  role: UserRole | null | undefined,
  permission: AppPermission
): boolean {
  return getRolePermissions(role).includes(permission);
}

export function getAssignableRolesForRole(role: UserRole | null | undefined): UserRole[] {
  if (role === 'PlatformAdmin') {
    return [
      'PlatformAdmin',
      'TenantAdmin',
      'FinanceController',
      'Accountant',
      'Approver',
      'Viewer',
      'Auditor',
      'BudgetOfficer',
      'BudgetOwner',
      'PayrollOfficer',
      'HrOfficer',
      'ProcurementOfficer',
      'TreasuryOfficer',
      'InventoryOfficer',
      'ApOfficer',
      'ArOfficer',
      'FixedAssetOfficer',
      'ExpenseAdvanceOfficer',
      'ExpenseAdvanceApprover',
      'ExpenseAdvanceReviewer',
      'ExpenseAdvanceViewer',
      'FleetOfficer',
      'FleetApprover',
      'FleetReviewer',
      'FleetViewer',
    ];
  }

  if (role === 'TenantAdmin') {
    return [
      'TenantAdmin',
      'FinanceController',
      'Accountant',
      'Approver',
      'Viewer',
      'Auditor',
      'BudgetOfficer',
      'BudgetOwner',
      'PayrollOfficer',
      'HrOfficer',
      'ProcurementOfficer',
      'TreasuryOfficer',
      'InventoryOfficer',
      'ApOfficer',
      'ArOfficer',
      'FixedAssetOfficer',
      'ExpenseAdvanceOfficer',
      'ExpenseAdvanceApprover',
      'ExpenseAdvanceReviewer',
      'ExpenseAdvanceViewer',
      'FleetOfficer',
      'FleetApprover',
      'FleetReviewer',
      'FleetViewer',
    ];
  }

  return [];
}