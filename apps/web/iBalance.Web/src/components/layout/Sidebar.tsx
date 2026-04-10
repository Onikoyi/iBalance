import { BarChart3, BookOpen, CalendarRange, FileStack, LayoutDashboard } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  canManageFinanceSetup,
  canManageFiscalPeriods,
  canViewFinance,
  canViewReports,
  getCurrentRole,
} from '../../lib/auth';

const allLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: () => canViewFinance() },
  { to: '/accounts', label: 'Chart of Accounts', icon: BookOpen, show: () => canManageFinanceSetup() },
  { to: '/journals', label: 'Journal Entries', icon: FileStack, show: () => canViewFinance() },
  { to: '/fiscal-periods', label: 'Fiscal Periods', icon: CalendarRange, show: () => canManageFiscalPeriods() },
  { to: '/reports', label: 'Reports', icon: BarChart3, show: () => canViewReports() },
];

export function Sidebar() {
  const role = getCurrentRole();
  const links = allLinks.filter((link) => link.show());

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">iB</div>
        <div>
          <div className="brand-name">iBalance</div>
          <div className="brand-subtitle">Accounting Cloud</div>
        </div>
      </div>

      <div className="muted" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
        Role: <strong style={{ color: '#fff' }}>{role || 'Unknown'}</strong>
      </div>

      <nav className="nav-menu">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}