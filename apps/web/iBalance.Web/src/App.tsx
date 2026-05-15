import { Route, Routes, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AccountsPage } from './pages/AccountsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FiscalPeriodsPage } from './pages/FiscalPeriodsPage';
import { JournalsPage } from './pages/JournalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { WorkingCapitalPage } from './pages/WorkingCapitalPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
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
import { RejectedPurchaseOrdersPage } from './pages/RejectedPurchaseOrdersPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { PurchaseOrderReceiptsPage } from './pages/PurchaseOrderReceiptsPage';
import { RejectedPurchaseRequisitionsPage } from './pages/RejectedPurchaseRequisitionsPage';
import { PurchaseRequisitionsPage } from './pages/PurchaseRequisitionsPage';
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
import { PayrollDashboardPage } from './pages/PayrollDashboardPage';
import { PayrollEmployeesPage } from './pages/PayrollEmployeesPage';
import { PayrollSetupPage } from './pages/PayrollSetupPage';
import { PayrollRunsPage } from './pages/PayrollRunsPage';
import { PayrollPayslipsPage } from './pages/PayrollPayslipsPage';
import { PayrollReportsPage } from './pages/PayrollReportsPage';
import { RejectPayrollRunsPage } from './pages/RejectPayrollRunsPage';
import { ExpenseAdvanceDashboardPage } from './pages/eam/ExpenseAdvanceDashboardPage';
import { AdvanceRequestsPage } from './pages/eam/AdvanceRequestsPage';
import { RejectedAdvanceRequestsPage } from './pages/eam/RejectedAdvanceRequestsPage';
import { AdvanceApprovalQueuePage } from './pages/eam/AdvanceApprovalQueuePage';
import { AdvanceDisbursementsPage } from './pages/eam/AdvanceDisbursementsPage';
import { AdvanceRetirementsPage } from './pages/eam/AdvanceRetirementsPage';
import { RejectedAdvanceRetirementsPage } from './pages/eam/RejectedAdvanceRetirementsPage';
import { AdvanceRefundsPage } from './pages/eam/AdvanceRefundsPage';
import { AdvanceRecoveriesPage } from './pages/eam/AdvanceRecoveriesPage';
import { ExpenseAdvanceSetupPage } from './pages/eam/ExpenseAdvanceSetupPage';
import { ExpenseAdvanceReportsPage } from './pages/eam/ExpenseAdvanceReportsPage';
import { OutstandingAdvancesPage } from './pages/eam/OutstandingAdvancesPage';
import { OverdueAdvancesPage } from './pages/eam/OverdueAdvancesPage';
import { TravelAdvancesPage } from './pages/eam/TravelAdvancesPage';
import { OperationalFloatPage } from './pages/eam/OperationalFloatPage';
import { ImprestRegisterPage } from './pages/eam/ImprestRegisterPage';
import { FleetDashboardPage } from './pages/fleet/FleetDashboardPage';
import { FleetVehiclesPage } from './pages/fleet/FleetVehiclesPage';
import { FleetDriversPage } from './pages/fleet/FleetDriversPage';
import { FleetTripsPage } from './pages/fleet/FleetTripsPage';
import { FleetFuelLogsPage } from './pages/fleet/FleetFuelLogsPage';
import { FleetMaintenancePage } from './pages/fleet/FleetMaintenancePage';
import { FleetPolicySetupPage } from './pages/fleet/FleetPolicySetupPage';
import { FleetReportsPage } from './pages/fleet/FleetReportsPage';

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
import { AdminAccessControlPage } from './pages/admin/AdminAccessControlPage';
import { AdminAuditTrailPage } from './pages/admin/AdminAuditTrailPage';
import { AdminTenantModuleActivationPage } from './pages/admin/AdminTenantModuleActivationPage';
import { WorkspaceResolverPage } from './pages/WorkspaceResolverPage';
import { NoActiveModulesPage } from './pages/NoActiveModulesPage';



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
        path="/workspace"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
          >
            <WorkspaceResolverPage />
          </RequireAuth>
        }
      />

      <Route
        path="/no-active-modules"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
          >
            <AppShell>
              <NoActiveModulesPage />
            </AppShell>
          </RequireAuth>
        }
      />


      <Route
        path="/dashboard"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
            requiredPermissions={['reports.view']}
          >
            <AppShell>
              <DashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/accounts"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
            ]}
            requiredPermissions={['finance.view']}
          >
            <AppShell>
              <AccountsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/journals"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
            ]}
            requiredPermissions={['finance.view']}
          >
            <AppShell>
              <JournalsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/journals/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
            ]}
            requiredPermissions={['finance.view']}
          >
            <AppShell>
              <RejectedJournalEntriesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/customers"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <CustomersPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-invoices"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <SalesInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/sales-invoices/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <RejectedSalesInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/customer-receipts"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <CustomerReceiptsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/customer-receipts/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <RejectedCustomerReceiptsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/customer-receipts/:customerReceiptId/print"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ArOfficer',
            ]}
            requiredPermissions={['ar.view']}
          >
            <AppShell>
              <CustomerReceiptPrintPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/vendors"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <VendorsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/vendors/:vendorId/statement"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <VendorStatementPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-requisitions"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ProcurementOfficer',
            ]}
            requiredPermissions={['procurement.view']}
          >
            <AppShell>
              <PurchaseRequisitionsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-requisitions/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ProcurementOfficer',
            ]}
            requiredPermissions={['procurement.view']}
          >
            <AppShell>
              <RejectedPurchaseRequisitionsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-orders"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ProcurementOfficer',
            ]}
            requiredPermissions={['procurement.view']}
          >
            <AppShell>
              <PurchaseOrdersPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/purchase-order-receipts"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ProcurementOfficer',
            ]}
            requiredPermissions={['procurement.view']}
          >
            <AppShell>
              <PurchaseOrderReceiptsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-orders/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ProcurementOfficer',
            ]}
            requiredPermissions={['procurement.view']}
          >
            <AppShell>
              <RejectedPurchaseOrdersPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/purchase-invoices"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <PurchaseInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/purchase-invoices/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <RejectedPurchaseInvoicesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/vendor-payments"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <VendorPaymentsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/vendor-payments/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <RejectedVendorPaymentsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/vendor-payments/:vendorPaymentId/voucher"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'ApOfficer',
            ]}
            requiredPermissions={['ap.view']}
          >
            <AppShell>
              <VendorPaymentVoucherPrintPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fiscal-periods"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
            ]}
            requiredPermissions={['finance.fiscal-periods.manage']}
          >
            <AppShell>
              <FiscalPeriodsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/budgets"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'BudgetOfficer',
              'BudgetOwner',
            ]}
            requiredPermissions={['budget.view']}
          >
            <AppShell>
              <BudgetsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/budgets/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'BudgetOfficer',
              'BudgetOwner',
            ]}
            requiredPermissions={['budget.view']}
          >
            <AppShell>
              <RejectedBudgetsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/budget-vs-actual"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'BudgetOfficer',
              'BudgetOwner',
            ]}
            requiredPermissions={['budget.view']}
          >
            <AppShell>
              <BudgetVsActualPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/budget-vs-actual/print"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'BudgetOfficer',
              'BudgetOwner',
            ]}
            requiredPermissions={['budget.view']}
          >
            <BudgetVsActualPrintPage />
          </RequireAuth>
        }
      />

      <Route
        path="/fixed-assets"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'FixedAssetOfficer',
            ]}
            requiredPermissions={['fixedassets.view']}
          >
            <AppShell>
              <FixedAssetsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fixed-assets/depreciation-runs"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'FixedAssetOfficer',
            ]}
            requiredPermissions={['fixedassets.view']}
          >
            <AppShell>
              <FixedAssetDepreciationRunsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fixed-assets/register/print"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'FixedAssetOfficer',
            ]}
            requiredPermissions={['fixedassets.view']}
          >
            <FixedAssetRegisterPrintPage />
          </RequireAuth>
        }
      />
      <Route
        path="/bank-accounts"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'TreasuryOfficer',
            ]}
            requiredPermissions={['treasury.view']}
          >
            <AppShell>
              <BankAccountsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/inventory"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'InventoryOfficer',
            ]}
            requiredPermissions={['inventory.view']}
          >
            <AppShell>
              <InventoryPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/reconciliation"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'TreasuryOfficer',
            ]}
            requiredPermissions={['treasury.view']}
          >
            <AppShell>
              <ReconciliationPage />
            </AppShell>
          </RequireAuth>
        }
      />


      <Route
        path="/eam"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin', 'FinanceController', 'Approver', 'Viewer', 'Auditor', 'ExpenseAdvanceOfficer', 'ExpenseAdvanceApprover', 'ExpenseAdvanceReviewer', 'ExpenseAdvanceViewer']}
            requiredPermissions={['eam.view']}
          >
            <AppShell><ExpenseAdvanceDashboardPage /></AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/eam/requests"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <AdvanceRequestsPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/requests/rejected"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <RejectedAdvanceRequestsPage />
          </AppShell>
        </RequireAuth>}
      />


      <Route
        path="/eam/approval-queue"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer']}
            requiredPermissions={['eam.view']}>
          <AppShell>
            <AdvanceApprovalQueuePage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/disbursements"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer']}
          requiredPermissions={['eam.view']}>
          <AppShell><AdvanceDisbursementsPage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/retirements"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <AdvanceRetirementsPage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/retirements/rejected"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <RejectedAdvanceRetirementsPage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/refunds"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver', 'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <AdvanceRefundsPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/recoveries"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <AdvanceRecoveriesPage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/imprest-register"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <ImprestRegisterPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/travel-advances"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <TravelAdvancesPage />
          </AppShell>
        </RequireAuth>}
      />
      <Route
        path="/eam/operational-float"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}
        ><AppShell>
            <OperationalFloatPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/outstanding"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <OutstandingAdvancesPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/overdue"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
          requiredPermissions={['eam.view']}>
          <AppShell>
            <OverdueAdvancesPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/setup"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer']}
            requiredPermissions={['eam.view']}>
          <AppShell>
            <ExpenseAdvanceSetupPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/eam/reports"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FinanceController',
            'Approver',
            'Viewer',
            'Auditor',
            'ExpenseAdvanceOfficer',
            'ExpenseAdvanceApprover',
            'ExpenseAdvanceReviewer',
            'ExpenseAdvanceViewer']}
            requiredPermissions={['eam.view']}>
          <AppShell>
            <ExpenseAdvanceReportsPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/reports"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
            requiredPermissions={['reports.view']}
          >
            <AppShell>
              <ReportsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/payroll"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <PayrollDashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payroll/employees"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <PayrollEmployeesPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payroll/setup"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['finance.view']}
          >
            <AppShell>
              <PayrollSetupPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payroll/runs"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <PayrollRunsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payroll/payslips"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <PayrollPayslipsPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fleet"
        element={
          <RequireAuth allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover',
            'FleetReviewer',
            'FleetViewer'
          ]}
            requiredPermissions={['fleet.view']}>
            <AppShell>
              <FleetDashboardPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/fleet/vehicles"
        element={
          <RequireAuth allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover',
            'FleetReviewer'
          ]}
            requiredPermissions={['fleet.vehicle.manage']}>
            <AppShell>
              <FleetVehiclesPage />
            </AppShell>
          </RequireAuth>}
      />

      <Route
        path="/fleet/drivers"
        element={<RequireAuth allowedRoles={[
          'PlatformAdmin',
          'TenantAdmin',
          'FleetOfficer',
          'FleetApprover',
          'FleetReviewer']}
          requiredPermissions={['fleet.driver.manage'
          ]}>
          <AppShell>
            <FleetDriversPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/fleet/trips"
        element={
          <RequireAuth allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover',
            'FleetReviewer'
          ]}
            requiredPermissions={['fleet.trip.create'
            ]}>
            <AppShell>
              <FleetTripsPage />
            </AppShell>
          </RequireAuth>}
      />

      <Route
        path="/fleet/fuel-logs"
        element={<RequireAuth allowedRoles={[
          'PlatformAdmin',
          'TenantAdmin',
          'FleetOfficer',
          'FleetApprover',
          'FleetReviewer']}
          requiredPermissions={['fleet.fuel.manage']}>
          <AppShell>
            <FleetFuelLogsPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/fleet/maintenance"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover',
            'FleetReviewer']}
          requiredPermissions={['fleet.maintenance.manage']}>
          <AppShell>
            <FleetMaintenancePage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/fleet/setup"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover']}
          requiredPermissions={['fleet.policy.manage']}>
          <AppShell>
            <FleetPolicySetupPage />
          </AppShell>
        </RequireAuth>}
      />

      <Route
        path="/fleet/reports"
        element={<RequireAuth
          allowedRoles={[
            'PlatformAdmin',
            'TenantAdmin',
            'FleetOfficer',
            'FleetApprover',
            'FleetReviewer',
            'FleetViewer']}
          requiredPermissions={['fleet.reports.view']}>
          <AppShell>
            <FleetReportsPage />
          </AppShell>
        </RequireAuth>}
      />


      <Route
        path="/payroll/reports"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <PayrollReportsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/payroll/runs/rejected"
        element={
          <RequireAuth
            allowedRoles={[
              'PlatformAdmin',
              'TenantAdmin',
              'FinanceController',
              'Accountant',
              'Approver',
              'Viewer',
              'Auditor',
              'PayrollOfficer',
              'HrOfficer',
            ]}
            requiredPermissions={['payroll.view']}
          >
            <AppShell>
              <RejectPayrollRunsPage />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/working-capital"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
            requiredPermissions={['workingcapital.view']}
          >
            <AppShell>
              <WorkingCapitalPage />
            </AppShell>
          </RequireAuth>
        }
      />


      <Route
        path="/ageing-analysis"
        element={
          <RequireAuth
            allowedRoles={[
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
            ]}
            requiredPermissions={['reports.view']}
          >
            <AppShell>
              <AgeingAnalysisPage />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin']}
            requiredPermissions={['admin.access']}
          >
            <AdminShell>
              <AdminDashboardPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin']}
            requiredPermissions={['admin.settings.manage']}
          >
            <AdminShell>
              <AdminSettingsPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin']}
            requiredPermissions={['admin.users.manage']}
          >
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

      <Route
        path="/admin/tenant-modules"
        element={
          <RequireAuth allowedRoles={['PlatformAdmin']}>
            <AdminShell>
              <AdminTenantModuleActivationPage />
            </AdminShell>
          </RequireAuth>
        }
      />

      <Route
        path="/admin/access-control"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin']}
            requiredPermissions={['admin.roles.manage', 'admin.permissions.manage', 'admin.scopes.manage']}
          >
            <AdminShell>
              <AdminAccessControlPage />
            </AdminShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/audit-trail"
        element={
          <RequireAuth
            allowedRoles={['PlatformAdmin', 'TenantAdmin']}
            requiredPermissions={['admin.access']}
          >
            <AdminShell>
              <AdminAuditTrailPage />
            </AdminShell>
          </RequireAuth>
        }
      />


      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}