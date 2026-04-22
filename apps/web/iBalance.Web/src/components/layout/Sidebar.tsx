import { NavLink } from 'react-router-dom';
import {
  canAccessAdmin,
  canCreateJournals,
  canManageFinanceSetup,
  canManagePlatformCommercials,
  canManageTenantUsers,
  canViewFinance,
  canViewPlatformTenantConsole,
} from '../../lib/auth';

function linkClassName(isActive: boolean) {
  return isActive ? 'sidebar-link active' : 'sidebar-link';
}

export function Sidebar() {
  const canView = canViewFinance();
  const canManageSetup = canManageFinanceSetup();
  const canCreate = canCreateJournals();
  const canAdmin = canAccessAdmin();
  const canManageUsers = canManageTenantUsers();
  const canManageCommercials = canManagePlatformCommercials();
  const canViewTenantConsole = canViewPlatformTenantConsole();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-title">iBalance</div>
        <div className="muted sidebar-brand-subtitle">
          Accounting Cloud
        </div>
      </div>

      <nav className="sidebar-nav">
        {canView ? (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-title">Overview</div>

              <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}>
                Dashboard
              </NavLink>

              <NavLink to="/reports" className={({ isActive }) => linkClassName(isActive)}>
                Reports
              </NavLink>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title">General Ledger</div>

              <NavLink to="/accounts" className={({ isActive }) => linkClassName(isActive)}>
                Chart of Accounts
              </NavLink>

              <NavLink to="/journals" className={({ isActive }) => linkClassName(isActive)}>
                Journals
              </NavLink>

              <NavLink to="/journals/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Journals
              </NavLink>

              {canManageSetup ? (
                <NavLink to="/fiscal-periods" className={({ isActive }) => linkClassName(isActive)}>
                  Fiscal Periods
                </NavLink>
                
              ) : null}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title">Budget Control</div>

              <NavLink to="/budgets" className={({ isActive }) => linkClassName(isActive)}>
                Budgets
              </NavLink>

              <NavLink to="/budgets/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Budgets
              </NavLink>

              <NavLink to="/budget-vs-actual" className={({ isActive }) => linkClassName(isActive)}>
                Budget vs Actual
              </NavLink>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title">Accounts Receivable</div>

              <NavLink to="/customers" className={({ isActive }) => linkClassName(isActive)}>
                Customers
              </NavLink>

              <NavLink to="/sales-invoices" className={({ isActive }) => linkClassName(isActive)}>
                Sales Invoices
              </NavLink>

              <NavLink to="/sales-invoices/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Sales Invoices
              </NavLink>

              <NavLink to="/customer-receipts" className={({ isActive }) => linkClassName(isActive)}>
                Customer Receipts
              </NavLink>

              <NavLink to="/customer-receipts/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Customer Receipts
              </NavLink>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title">Accounts Payable</div>

              <NavLink to="/vendors" className={({ isActive }) => linkClassName(isActive)}>
                Vendors
              </NavLink>

              <NavLink to="/purchase-invoices" className={({ isActive }) => linkClassName(isActive)}>
                Purchase Invoices
              </NavLink>

              <NavLink to="/purchase-invoices/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Purchase Invoices
              </NavLink>

              <NavLink to="/vendor-payments" className={({ isActive }) => linkClassName(isActive)}>
                Vendor Payments
              </NavLink>

              <NavLink to="/vendor-payments/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Vendor Payments
              </NavLink>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-title">Workflow</div>

              <div className="sidebar-note">
                {canCreate
                  ? 'You can create and manage accounting transactions in this workspace.'
                  : 'You currently have read-only access to accounting information.'}
              </div>
            </div>
          </>
        ) : null}

        {canAdmin ? (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Administration</div>

            <NavLink to="/admin" className={({ isActive }) => linkClassName(isActive)}>
              Administration
            </NavLink>

            {canManageUsers ? (
              <NavLink to="/admin/users" className={({ isActive }) => linkClassName(isActive)}>
                User Management
              </NavLink>
            ) : null}

            {canManageCommercials ? (
              <NavLink to="/admin/settings" className={({ isActive }) => linkClassName(isActive)}>
                Commercial Settings
              </NavLink>
            ) : null}

            {canViewTenantConsole ? (
              <NavLink
                to="/admin/tenants/00000000-0000-0000-0000-000000000000"
                className={({ isActive }) => linkClassName(isActive)}
              >
                Platform Tenant Console
              </NavLink>
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}