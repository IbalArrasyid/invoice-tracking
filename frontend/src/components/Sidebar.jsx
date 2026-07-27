import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, LogOut, Activity,
  Lightbulb, TrendingUp, BookOpen
} from 'lucide-react';
import { DRIVER_ALLOWED_PATHS, getStoredUser, isDriverUser } from '../utils/auth';

const navItems = [
  {
    section: 'Defense Demo',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { to: '/invoices', icon: FileText, label: 'Invoice List' },
      { to: '/recommendation', icon: Lightbulb, label: 'Priority Classification' },
      { to: '/research-showcase', icon: BookOpen, label: 'Comparative Analysis' },
      { to: '/analytics', icon: TrendingUp, label: 'Research Results' },
      { to: '/tracker', icon: MapPin, label: 'Invoice Tracking' },
      { to: '/courier', icon: Activity, label: 'Proof of Delivery' },
    ]
  }
];

export default function Sidebar({ onLogout }) {
  const location = useLocation();
  const user = getStoredUser() || { name: 'Admin', role: 'Administrator' };
  const isDriver = isDriverUser(user);
  const visibleNavItems = navItems
    .map(section => ({
      ...section,
      section: isDriver ? 'Driver Access' : section.section,
      items: isDriver
        ? section.items.filter(item => DRIVER_ALLOWED_PATHS.has(item.to))
        : section.items,
    }))
    .filter(section => section.items.length > 0);

  // Initials logic
  const initials = user.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'AD';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Activity size={18} color="white" />
        </div>
        <div className="logo-text">
          Invoice Tracking
          <span>Invoice Tracking System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {visibleNavItems.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  end={item.exact}
                >
                  <Icon className="nav-icon" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <LogOut size={15} color="var(--priority-high)" />
          </button>
        </div>
      </div>
    </aside>
  );
}
