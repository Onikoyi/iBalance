import { BarChart3, BookOpen, CalendarRange, FileStack, LayoutDashboard } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/journals', label: 'Journal Entries', icon: FileStack },
  { to: '/fiscal-periods', label: 'Fiscal Periods', icon: CalendarRange },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">iB</div>
        <div>
          <div className="brand-name">iBalance</div>
          <div className="brand-subtitle">Accounting Cloud</div>
        </div>
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