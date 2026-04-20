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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  marginBottom: 8,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const linkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
};

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
        <div style={{ fontWeight: 700, fontSize: 20 }}>iBalance</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Accounting Cloud
        </div>
      </div>

      <nav className="sidebar-nav" style={navStyle}>
        {canView ? (
          <>
            <div className="sidebar-section" style={sectionStyle}>
              <div className="muted" style={sectionTitleStyle}>
                Overview
              </div>

              <NavLink
                to="/dashboard"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/reports"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Reports
              </NavLink>
            </div>

            <div className="sidebar-section" style={sectionStyle}>
              <div className="muted" style={sectionTitleStyle}>
                General Ledger
              </div>

              <NavLink
                to="/accounts"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Chart of Accounts
              </NavLink>

              <NavLink
                to="/journals"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Journals
              </NavLink>

              {canManageSetup ? (
                <NavLink
                  to="/fiscal-periods"
                  className={({ isActive }) => linkClassName(isActive)}
                  style={linkStyle}
                >
                  Fiscal Periods
                </NavLink>
              ) : null}
            </div>

            <div className="sidebar-section" style={sectionStyle}>
              <div className="muted" style={sectionTitleStyle}>
                Accounts Receivable
              </div>

              <NavLink
                to="/customers"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Customers
              </NavLink>

              <NavLink
                to="/sales-invoices"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Sales Invoices
              </NavLink>

              <NavLink
                to="/sales-invoices/rejected"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Rejected Sales Invoices
              </NavLink>

              <NavLink
                to="/customer-receipts"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Customer Receipts
              </NavLink>

              <NavLink
                  to="/customer-receipts/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                  style={linkStyle}
                >
                  Rejected Customer Receipts
                </NavLink>
            </div>

            <div className="sidebar-section" style={sectionStyle}>
              <div className="muted" style={sectionTitleStyle}>
                Accounts Payable
              </div>

              <NavLink
                to="/vendors"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Vendors
              </NavLink>

              <NavLink
                to="/purchase-invoices"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Purchase Invoices
              </NavLink>

              <NavLink
                  to="/purchase-invoices/rejected"
                  className={({ isActive }) => linkClassName(isActive)}
                  style={linkStyle}
                >
                  Rejected Purchase Invoices
              </NavLink>

              <NavLink
                to="/vendor-payments"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Vendor Payments
              </NavLink>
            </div>
            <NavLink
                to="/vendor-payments/rejected"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Rejected Vendor Payments
              </NavLink>

            <div className="sidebar-section" style={sectionStyle}>
              <div className="muted" style={sectionTitleStyle}>
                Workflow
              </div>

              <div className="panel" style={{ margin: 0, padding: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {canCreate
                    ? 'You can create and manage accounting transactions in this workspace.'
                    : 'You currently have read-only access to accounting information.'}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {canAdmin ? (
          <div className="sidebar-section" style={sectionStyle}>
            <div className="muted" style={sectionTitleStyle}>
              Administration
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) => linkClassName(isActive)}
              style={linkStyle}
            >
              Administration
            </NavLink>

            {canManageUsers ? (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                User Management
              </NavLink>
            ) : null}

            {canManageCommercials ? (
              <NavLink
                to="/admin/settings"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
              >
                Commercial Settings
              </NavLink>
            ) : null}

            {canViewTenantConsole ? (
              <NavLink
                to="/admin/tenants/00000000-0000-0000-0000-000000000000"
                className={({ isActive }) => linkClassName(isActive)}
                style={linkStyle}
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