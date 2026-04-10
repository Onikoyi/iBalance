import type { UserRole } from './auth';

export type AppPermission =
  | 'admin.access'
  | 'admin.settings.manage'
  | 'admin.users.manage'
  | 'finance.view'
  | 'finance.setup.manage'
  | 'finance.journals.create'
  | 'finance.journals.post'
  | 'finance.journals.reverse'
  | 'finance.fiscal-periods.manage'
  | 'finance.reports.view'
  | 'license.recovery.bypass';

const rolePermissions: Record<UserRole, AppPermission[]> = {
  PlatformAdmin: [
    'admin.access',
    'admin.settings.manage',
    'admin.users.manage',
    'finance.view',
    'finance.setup.manage',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'finance.reports.view',
    'license.recovery.bypass',
  ],
  TenantAdmin: [
    'admin.access',
    'admin.settings.manage',
    'admin.users.manage',
    'finance.view',
    'finance.setup.manage',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'finance.reports.view',
  ],
  Accountant: [
    'finance.view',
    'finance.setup.manage',
    'finance.journals.create',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.fiscal-periods.manage',
    'finance.reports.view',
  ],
  Approver: [
    'finance.view',
    'finance.journals.post',
    'finance.journals.reverse',
    'finance.reports.view',
  ],
  Viewer: [
    'finance.view',
    'finance.reports.view',
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