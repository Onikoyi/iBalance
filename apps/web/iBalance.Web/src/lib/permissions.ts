import type { UserRole } from './auth';

export type AppPermission =
  | 'admin.access'
  | 'admin.settings.manage'
  | 'admin.users.manage'
  | 'admin.roles.manage'
  | 'admin.permissions.manage'
  | 'admin.scopes.manage'
  | 'finance.view'
  | 'finance.setup.manage'
  | 'finance.journals.create'
  | 'finance.journals.post'
  | 'finance.journals.reverse'
  | 'finance.fiscal-periods.manage'
  | 'finance.reports.view'
  | 'license.recovery.bypass'
  | 'payroll.view'
  | 'payroll.manage'
  | 'payroll.run.submit'
  | 'payroll.run.approve'
  | 'payroll.run.reject'
  | 'payroll.run.post';

  const rolePermissions: Record<UserRole, AppPermission[]> = {
    PlatformAdmin: [
      'admin.access',
      'admin.settings.manage',
      'admin.users.manage',
      'admin.roles.manage',
      'admin.permissions.manage',
      'admin.scopes.manage',
      'finance.view',
      'finance.setup.manage',
      'finance.journals.create',
      'finance.journals.post',
      'finance.journals.reverse',
      'finance.fiscal-periods.manage',
      'finance.reports.view',
      'payroll.view',
      'payroll.manage',
      'payroll.run.submit',
      'payroll.run.approve',
      'payroll.run.reject',
      'payroll.run.post',
      'license.recovery.bypass',
    ],
    TenantAdmin: [
      'admin.access',
      'admin.users.manage',
      'admin.roles.manage',
      'admin.permissions.manage',
      'admin.scopes.manage',
      'finance.view',
      'finance.setup.manage',
      'finance.journals.create',
      'finance.journals.post',
      'finance.journals.reverse',
      'finance.fiscal-periods.manage',
      'finance.reports.view',
      'payroll.view',
      'payroll.manage',
      'payroll.run.submit',
      'payroll.run.approve',
      'payroll.run.reject',
      'payroll.run.post',
    ],
    Accountant: [
      'finance.view',
      'finance.setup.manage',
      'finance.journals.create',
      'finance.journals.post',
      'finance.journals.reverse',
      'finance.fiscal-periods.manage',
      'finance.reports.view',
      'payroll.view',
      'payroll.manage',
      'payroll.run.submit',
      'payroll.run.post',
    ],
    Approver: [
      'finance.view',
      'finance.journals.post',
      'finance.journals.reverse',
      'finance.reports.view',
      'payroll.view',
      'payroll.run.approve',
      'payroll.run.reject',
    ],
    Viewer: [
      'finance.view',
      'finance.reports.view',
      'payroll.view',
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
    return ['TenantAdmin', 'Accountant', 'Approver', 'Viewer'];
  }

  if (role === 'TenantAdmin') {
    return ['TenantAdmin', 'Accountant', 'Approver', 'Viewer'];
  }

  return [];
}

