import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

type SidebarSectionProps = {
  title: string;
  sectionKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function SidebarSection({ title, sectionKey, defaultOpen, children }: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(!!defaultOpen);

  return (
    <div className="sidebar-section">
      <button
        type="button"
        className="sidebar-section-title"
        onClick={() => setIsOpen((value) => !value)}
        style={{
          border: 0,
          width: '100%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          padding: 0,
          textAlign: 'left',
        }}
        aria-expanded={isOpen}
        aria-controls={`sidebar-section-${sectionKey}`}
      >
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen ? <div id={`sidebar-section-${sectionKey}`} style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const canView = canViewFinance();
  const canManageSetup = canManageFinanceSetup();
  const canCreate = canCreateJournals();
  const canAdmin = canAccessAdmin();
  const canManageUsers = canManageTenantUsers();
  const canManageCommercials = canManagePlatformCommercials();
  const canViewTenantConsole = canViewPlatformTenantConsole();

  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/accounts') || path.startsWith('/journals') || path.startsWith('/fiscal-periods')) return 'gl';
    if (path.startsWith('/budgets') || path.startsWith('/budget-vs-actual')) return 'budget';
    if (path.startsWith('/fixed-assets')) return 'fixed-assets';
    if (path.startsWith('/bank-accounts')) return 'treasury';
    if (path.startsWith('/inventory')) return 'inventory';
    if (path.startsWith('/customers') || path.startsWith('/sales-invoices') || path.startsWith('/customer-receipts')) return 'ar';
    if (path.startsWith('/vendors') || path.startsWith('/purchase-invoices') || path.startsWith('/vendor-payments')) return 'ap';
    if (path.startsWith('/reports') || path.startsWith('/ageing-analysis') || path.startsWith('/dashboard')) return 'overview';
    if (path.startsWith('/admin')) return 'admin';
    return 'overview';
  }, [location.pathname]);

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
            <SidebarSection title="Overview" sectionKey="overview" defaultOpen={activeSection === 'overview'}>
              <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}>
                Dashboard
              </NavLink>

              <NavLink to="/reports" className={({ isActive }) => linkClassName(isActive)}>
                Reports
              </NavLink>

              <NavLink to="/ageing-analysis" className={({ isActive }) => linkClassName(isActive)}>
                Ageing Analysis
              </NavLink>
            </SidebarSection>

            <SidebarSection title="General Ledger" sectionKey="gl" defaultOpen={activeSection === 'gl'}>
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
            </SidebarSection>

            <SidebarSection title="Budget Control" sectionKey="budget" defaultOpen={activeSection === 'budget'}>
              <NavLink to="/budgets" className={({ isActive }) => linkClassName(isActive)}>
                Budgets
              </NavLink>

              <NavLink to="/budgets/rejected" className={({ isActive }) => linkClassName(isActive)}>
                Rejected Budgets
              </NavLink>

              <NavLink to="/budget-vs-actual" className={({ isActive }) => linkClassName(isActive)}>
                Budget vs Actual
              </NavLink>
            </SidebarSection>

            <SidebarSection title="Fixed Assets" sectionKey="fixed-assets" defaultOpen={activeSection === 'fixed-assets'}>
              <NavLink to="/fixed-assets" className={({ isActive }) => linkClassName(isActive)}>
                Fixed Assets
              </NavLink>

              <NavLink to="/fixed-assets/depreciation-runs" className={({ isActive }) => linkClassName(isActive)}>
                Depreciation Runs
              </NavLink>

              <NavLink to="/fixed-assets/register/print" className={({ isActive }) => linkClassName(isActive)}>
                Asset Register Print
              </NavLink>
            </SidebarSection>
            <SidebarSection title="Treasury & Banking" sectionKey="treasury" defaultOpen={activeSection === 'treasury'}>
              <NavLink to="/bank-accounts" className={({ isActive }) => linkClassName(isActive)}>
                Bank Accounts
              </NavLink>
            </SidebarSection>

            <SidebarSection title="Inventory" sectionKey="inventory" defaultOpen={activeSection === 'inventory'}>
              <NavLink to="/inventory" className={({ isActive }) => linkClassName(isActive)}>
                Inventory Management
              </NavLink>
            </SidebarSection>

            <SidebarSection title="Accounts Receivable" sectionKey="ar" defaultOpen={activeSection === 'ar'}>
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
            </SidebarSection>

            <SidebarSection title="Accounts Payable" sectionKey="ap" defaultOpen={activeSection === 'ap'}>
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
            </SidebarSection>

            <SidebarSection title="Workflow" sectionKey="workflow" defaultOpen={false}>
              <div className="sidebar-note">
                {canCreate
                  ? 'You can create and manage accounting transactions in this workspace.'
                  : 'You currently have read-only access to accounting information.'}
              </div>
            </SidebarSection>
          </>
        ) : null}

        {canAdmin ? (
          <SidebarSection title="Administration" sectionKey="admin" defaultOpen={activeSection === 'admin'}>
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
          </SidebarSection>
        ) : null}
      </nav>
    </aside>
  );
}


