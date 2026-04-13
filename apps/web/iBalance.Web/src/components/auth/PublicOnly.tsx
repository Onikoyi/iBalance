import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../../lib/auth';

export function PublicOnly({ children }: PropsWithChildren) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}