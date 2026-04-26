import { Route, Routes, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FiscalPeriodsPage } from './pages/FiscalPeriodsPage';
import { JournalsPage } from './pages/JournalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AgeingAnalysisPage } from './pages/AgeingAnalysisPage';
import { BankAccountsPage } from './pages/BankAccountsPage';
import { InventoryPage } from './pages/InventoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { SalesInvoicesPage } from './pages/SalesInvoicesPage';
import { RejectedSalesInvoicesPage } from './pages/RejectedSalesInvoicesPage';
import { CustomerReceiptsPage } from './pages/CustomerReceiptsPage';
import { CustomerReceiptPrintPage } from './pages/CustomerReceiptPrintPage';
import { RejectedCustomerReceiptsPage } from './pages/RejectedCustomerReceiptsPage';
import { VendorsPage } from './pages/VendorsPage';
import { PurchaseInvoicesPage } from './pages/PurchaseInvoicesPage';
import { RejectedPurchaseInvoicesPage } from './pages/RejectedPurchaseInvoicesPage';
import { VendorPaymentsPage } from './pages/VendorPaymentsPage';
import { RejectedVendorPaymentsPage } from './pages/RejectedVendorPaymentsPage';
import { VendorPaymentVoucherPrintPage } from './pages/VendorPaymentVoucherPrintPage';
import { VendorStatementPage } from './pages/VendorStatementPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { RejectedBudgetsPage } from './pages/RejectedBudgetsPage';
import { BudgetVsActualPage } from './pages/BudgetVsActualPage';
import { BudgetVsActualPrintPage } from './pages/BudgetVsActualPrintPage';
import { LandingPage } from './pages/LandingPage';
import { PricingPublicPage } from './pages/PricingPublicPage';
import { TenantOnboardingPage } from './pages/TenantOnboardingPage';
import { SubscriptionRequestPage } from './pages/SubscriptionRequestPage';
import { LicenseStatusPage } from './pages/LicenseStatusPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RejectedJournalEntriesPage } from './pages/RejectedJournalEntriesPage';
import { FixedAssetsPage } from './pages/FixedAssetsPage';
import { FixedAssetDepreciationRunsPage } from './pages/FixedAssetDepreciationRunsPage';
import { FixedAssetRegisterPrintPage } from './pages/FixedAssetRegisterPrintPage';

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
import { AdminSubscriptionApplicationsPage } from './pages/admin/AdminSubscriptionApplicationsPage';

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
          path="/journals/rejected"
          element={
            <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
              <AppShell>
                <RejectedJournalEntriesPage />
              </AppShell>
            </RequireAuth>
          }
        />
      <Route
        path="/customers"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <CustomersPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-invoices"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <SalesInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-invoices/rejected"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <RejectedSalesInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/customer-receipts"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <CustomerReceiptsPage />
            </AppShell>
          </RequireAuth>
        }
      />
        <Route
          path="/customer-receipts/rejected"
          element={
            <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
              <AppShell>
                <RejectedCustomerReceiptsPage />
              </AppShell>
            </RequireAuth>
          }
        />

      <Route
        path="/customer-receipts/:customerReceiptId/print"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <CustomerReceiptPrintPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/vendors"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <VendorsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/vendors/:vendorId/statement"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <VendorStatementPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-invoices"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <PurchaseInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/purchase-invoices/rejected"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <RejectedPurchaseInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/vendor-payments"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <VendorPaymentsPage />
            </AppShell>
          </RequireAuth>
        }
      />

        <Route
        path="/vendor-payments/rejected"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <RejectedVendorPaymentsPage />
            </AppShell>
          </RequireAuth>
        }
      />


      <Route
        path="/vendor-payments/:vendorPaymentId/voucher"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <VendorPaymentVoucherPrintPage />
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
  path="/budgets"
  element={
    <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
      <AppShell>
        <BudgetsPage />
      </AppShell>
    </RequireAuth>
  }
/>

<Route
  path="/budgets/rejected"
  element={
    <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
      <AppShell>
        <RejectedBudgetsPage />
      </AppShell>
    </RequireAuth>
  }
/>

<Route
  path="/budget-vs-actual"
  element={
    <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
      <AppShell>
        <BudgetVsActualPage />
      </AppShell>
    </RequireAuth>
  }
/>

      <Route
          path="/budget-vs-actual/print"
          element={
            <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
              <BudgetVsActualPrintPage />
            </RequireAuth>
          }
        />


      <Route
        path="/fixed-assets"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <FixedAssetsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fixed-assets/depreciation-runs"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <FixedAssetDepreciationRunsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fixed-assets/register/print"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <FixedAssetRegisterPrintPage />
          </RequireAuth>
        }
      />
      <Route
        path="/bank-accounts"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <BankAccountsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/inventory"
        element={
          <RequireAuth allowedRoles={["PlatformAdmin", "TenantAdmin", "Accountant", "Approver", "Viewer"]}>
            <AppShell>
              <InventoryPage />
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
        path="/ageing-analysis"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin', 'TenantAdmin', 'Accountant', 'Approver', 'Viewer']}>
            <AppShell>
              <AgeingAnalysisPage />
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
        path="/admin/subscription-applications"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin']}>
            <AdminShell>
              <AdminSubscriptionApplicationsPage />
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


