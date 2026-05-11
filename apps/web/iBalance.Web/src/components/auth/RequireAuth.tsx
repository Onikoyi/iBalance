import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCurrentTenantLicense } from '../../lib/api';
import {
  hasAnyRole,
  hasPermission,
  isAuthenticated,
  shouldBypassLicenseEnforcement,
  type UserRole,
} from '../../lib/auth';

type RequireAuthProps = PropsWithChildren<{
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
}>;

export function RequireAuth({
  children,
  allowedRoles,
  requiredPermissions,
}: RequireAuthProps) {
  const location = useLocation();
  const bypassLicense = shouldBypassLicenseEnforcement();

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    enabled: isAuthenticated() && !bypassLicense,
    staleTime: 60_000,
  });

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    const granted = requiredPermissions.some((permission) => hasPermission(permission as any));
    if (!granted) {
      return <Navigate to="/dashboard" replace state={{ deniedFrom: location.pathname }} />;
    }
  } else if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace state={{ deniedFrom: location.pathname }} />;
  }

  if (bypassLicense) {
    return <>{children}</>;
  }

  if (licenseQ.isLoading) {
    return <div className="panel">Checking access status...</div>;
  }

  if (licenseQ.isError || !licenseQ.data) {
    return <Navigate to="/license-status" replace state={{ from: location.pathname }} />;
  }

  const status = Number(licenseQ.data.licenseStatus || 0);
  const blocked = !licenseQ.data.isConfigured || status === 3 || status === 4;

  if (blocked) {
    return <Navigate to="/license-status" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}