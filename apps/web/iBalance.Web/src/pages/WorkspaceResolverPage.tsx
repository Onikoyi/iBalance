import { Navigate } from 'react-router-dom';
import { getFirstAccessibleWorkspaceRoute, hasAnyWorkspaceAccess } from '../lib/auth';

export function WorkspaceResolverPage() {
  if (!hasAnyWorkspaceAccess()) {
    return <Navigate to="/no-active-modules" replace />;
  }

  return <Navigate to={getFirstAccessibleWorkspaceRoute()} replace />;
}