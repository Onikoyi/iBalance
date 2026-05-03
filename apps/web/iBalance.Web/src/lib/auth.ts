import { getTenantKey } from './api';
import {
  getAssignableRolesForRole,
  roleHasPermission,
  type AppPermission,
} from './permissions';

export type UserRole =
  | 'PlatformAdmin'
  | 'TenantAdmin'
  | 'Accountant'
  | 'Approver'
  | 'Viewer';

export type AuthSession = {
  accessToken: string;
  userId: string;
  userEmail: string;
  displayName: string;
  role: UserRole;
  tenantKey: string;
  issuedAtUtc: string;
  expiresAtUtc: string;
  roles?: string[];
  permissions?: string[];
  scopes?: {
    scopeType: string;
    scopeEntityId: string;
    scopeCode?: string | null;
    scopeName?: string | null;
  }[];
};

type AuthSuccessResponse = {
  message: string;
  accessToken: string;
  tokenType: string;
  expiresAtUtc: string;
  licenseBypassApplied?: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    role: UserRole;
    tenantId: string;
    tenantKey: string;
    roles?: string[];
    permissions?: string[];
    scopes?: {
      scopeType: string;
      scopeEntityId: string;
      scopeCode?: string | null;
      scopeName?: string | null;
    }[];
  };
};

type ForgotPasswordResponse = {
  message: string;
  resetTokenPreview?: string | null;
  expiresAtUtc?: string | null;
};

const authKey = 'ibalance.auth.session';

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071';
}

function getStoredRawSession(): string | null {
  return localStorage.getItem(authKey) || sessionStorage.getItem(authKey);
}

function clearStoredSession() {
  localStorage.removeItem(authKey);
  sessionStorage.removeItem(authKey);
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      data?.Message ||
      data?.message ||
      data?.title ||
      'Request failed.'
    );
  }

  return data;
}

function setSessionFromResponse(data: AuthSuccessResponse, rememberMe: boolean): AuthSession {
  const session: AuthSession = {
    accessToken: data.accessToken,
    userId: data.user.id,
    userEmail: data.user.email,
    displayName: data.user.displayName,
    role: data.user.role,
    tenantKey: data.user.tenantKey,
    issuedAtUtc: new Date().toISOString(),
    expiresAtUtc: data.expiresAtUtc,
    roles: data.user.roles ?? [],
    permissions: data.user.permissions ?? [],
    scopes: data.user.scopes ?? [],
  };

  clearStoredSession();

  const serialized = JSON.stringify(session);
  if (rememberMe) {
    localStorage.setItem(authKey, serialized);
  } else {
    sessionStorage.setItem(authKey, serialized);
  }

  return session;
}

export function getSession(): AuthSession | null {
  const raw = getStoredRawSession();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.expiresAtUtc || !parsed.role) {
      clearStoredSession();
      return null;
    }

    const expiresAt = new Date(parsed.expiresAtUtc).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      clearStoredSession();
      return null;
    }

    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}

export function getCurrentRole(): UserRole | null {
  return getSession()?.role ?? null;
}

export function getCurrentRoles(): string[] {
  const session = getSession();
  if (!session) return [];
  const expanded = session.roles ?? [];
  return Array.from(new Set([session.role, ...expanded].filter(Boolean)));
}

export function hasAnyAssignedRole(allowedRoles: string[]): boolean {
  const roles = getCurrentRoles().map((value) => value.toLowerCase());
  return allowedRoles.some((role) => roles.includes(role.toLowerCase()));
}

export function getAssignedScopes(scopeType: string) {
  const session = getSession();
  return (session?.scopes ?? []).filter(
    (scope) => scope.scopeType.toLowerCase() === scopeType.toLowerCase()
  );
}

export function hasScope(scopeType: string, scopeEntityId: string): boolean {
  return getAssignedScopes(scopeType).some((scope) => scope.scopeEntityId === scopeEntityId);
}

export function isPlatformAdmin(): boolean {
  return getCurrentRole() === 'PlatformAdmin';
}

export function isTenantAdmin(): boolean {
  return getCurrentRole() === 'TenantAdmin';
}

export function canManagePlatformAdministration(): boolean {
  return isPlatformAdmin();
}

export function canManagePlatformCommercials(): boolean {
  return hasPermission('admin.settings.manage') && isPlatformAdmin();
}

export function canViewPlatformTenantConsole(): boolean {
  return isPlatformAdmin();
}

export function canManageOwnTenantAdministration(): boolean {
  return isTenantAdmin();
}

export function canManageTenantUsers(): boolean {
  return hasPermission('admin.users.manage');
}

export function canManageEnterpriseAccessControl(): boolean {
  return (
    hasPermission('admin.roles.manage') ||
    hasPermission('admin.permissions.manage') ||
    hasPermission('admin.scopes.manage')
  );
}

export function hasPermission(permission: AppPermission): boolean {
  const session = getSession();
  if (!session) return false;

  const explicitPermissions = session.permissions ?? [];
  if (explicitPermissions.includes(permission)) {
    return true;
  }

  return roleHasPermission(getCurrentRole(), permission);
}

export function shouldBypassLicenseEnforcement(): boolean {
  return hasPermission('license.recovery.bypass');
}

export function hasAnyRole(allowedRoles: UserRole[]): boolean {
  const role = getCurrentRole();
  return !!role && allowedRoles.includes(role);
}

export function canAccessAdmin(): boolean {
  return isPlatformAdmin() || isTenantAdmin() || hasPermission('admin.access');
}

export function canManageAdminSettings(): boolean {
  return canManagePlatformCommercials();
}

export function canManageUsers(): boolean {
  return hasPermission('admin.users.manage');
}

export function canManageFinanceSetup(): boolean {
  return hasPermission('finance.setup.manage');
}

export function canCreateJournals(): boolean {
  return hasPermission('finance.journals.create');
}

export function canPostOrReverseJournals(): boolean {
  return hasPermission('finance.journals.post') || hasPermission('finance.journals.reverse');
}

export function canApproveWorkflows(): boolean {
  return hasAnyRole(['PlatformAdmin', 'TenantAdmin', 'Approver']);
}

export function canManageFiscalPeriods(): boolean {
  return hasPermission('finance.fiscal-periods.manage');
}

export function canViewFinance(): boolean {
  return hasPermission('finance.view');
}

export function canViewReports(): boolean {
  return hasPermission('finance.reports.view');
}

export function canViewPayroll(): boolean {
  return hasPermission('payroll.view');
}

export function canManagePayroll(): boolean {
  return hasPermission('payroll.manage');
}

export function canSubmitPayrollRuns(): boolean {
  return hasPermission('payroll.run.submit');
}

export function canApprovePayrollRuns(): boolean {
  return hasPermission('payroll.run.approve');
}

export function canRejectPayrollRuns(): boolean {
  return hasPermission('payroll.run.reject');
}

export function canPostPayrollRuns(): boolean {
  return hasPermission('payroll.run.post');
}

export function canEditUserRole(targetRole: UserRole): boolean {
  const currentRole = getCurrentRole();

  if (!currentRole) {
    return false;
  }

  if (currentRole === 'PlatformAdmin') {
    return true;
  }

  if (currentRole === 'TenantAdmin') {
    return targetRole !== 'PlatformAdmin';
  }

  return false;
}

export function getAssignableRoles(): UserRole[] {
  return getAssignableRolesForRole(getCurrentRole());
}

export async function register(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSession> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
    },
    body: JSON.stringify({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      password: input.password,
    }),
  });

  const data = (await parseApiResponse(response)) as AuthSuccessResponse;
  return setSessionFromResponse(data, input.rememberMe ?? true);
}

export async function login(
  email: string,
  password: string,
  rememberMe: boolean
): Promise<AuthSession> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = (await parseApiResponse(response)) as AuthSuccessResponse;
  return setSessionFromResponse(data, rememberMe);
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
    },
    body: JSON.stringify({
      email,
    }),
  });

  return (await parseApiResponse(response)) as ForgotPasswordResponse;
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': getTenantKey(),
    },
    body: JSON.stringify({
      email,
      token,
      newPassword,
    }),
  });

  return (await parseApiResponse(response)) as { message: string };
}

export function logout(): void {
  clearStoredSession();
}