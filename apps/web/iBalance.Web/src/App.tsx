import { Route, Routes, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FiscalPeriodsPage } from './pages/FiscalPeriodsPage';
import { JournalsPage } from './pages/JournalsPage';
import { ReportsPage } from './pages/ReportsPage';

import { LandingPage } from './pages/LandingPage';
import { PricingPublicPage } from './pages/PricingPublicPage';
import { TenantOnboardingPage } from './pages/TenantOnboardingPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

import { RequireAuth } from './components/auth/RequireAuth';
import { PublicOnly } from './components/auth/PublicOnly';

import { AdminShell } from './components/layout/AdminShell';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPublicPage />} />
      <Route path="/onboarding" element={<TenantOnboardingPage />} />

      {/* Auth */}
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Finance (protected) */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/accounts"
        element={
          <RequireAuth>
            <AppShell>
              <AccountsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/journals"
        element={
          <RequireAuth>
            <AppShell>
              <JournalsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/fiscal-periods"
        element={
          <RequireAuth>
            <AppShell>
              <FiscalPeriodsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <AppShell>
              <ReportsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* Admin (protected) */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminShell>
              <AdminDashboardPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth>
            <AdminShell>
              <AdminSettingsPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminShell>
              <AdminUsersPage />
            </AdminShell>
          </RequireAuth>
        }
      />

      {/* Back-compat: if any old redirect exists */}
      <Route path="/home" element={<Navigate to="/" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}