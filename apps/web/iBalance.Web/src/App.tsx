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
import { SubscriptionRequestPage } from './pages/SubscriptionRequestPage';
import { LicenseStatusPage } from './pages/LicenseStatusPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { LoginPage } from './pages/auth/LoginPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

import { RequireAuth } from './components/auth/RequireAuth';
import { PublicOnly } from './components/auth/PublicOnly';

import { AdminShell } from './components/layout/AdminShell';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminTenantDetailPage } from './pages/admin/AdminTenantDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPublicPage />} />
      <Route path="/onboarding" element={<TenantOnboardingPage />} />
      <Route path="/subscribe" element={<SubscriptionRequestPage />} />
      <Route path="/license-status" element={<LicenseStatusPage />} />

      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <SignUpPage />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnly>
            <ResetPasswordPage />
          </PublicOnly>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/accounts"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <AccountsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/journals"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <JournalsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/fiscal-periods"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant']}>
            <AppShell>
              <FiscalPeriodsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <ReportsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin']}>
            <AdminShell>
              <AdminDashboardPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin']}>
            <AdminShell>
              <AdminSettingsPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin']}>
            <AdminShell>
              <AdminUsersPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/tenants/:tenantId"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin']}>
            <AdminShell>
              <AdminTenantDetailPage />
            </AdminShell>
          </RequireAuth>
        }
      />

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}