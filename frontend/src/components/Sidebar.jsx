import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, Brain, Settings,
  ChevronRight, Bell, LogOut, Users, BarChart2, Activity,
  Lightbulb, TrendingUp, BookOpen
} from 'lucide-react';

const navItems = [
  {
    section: 'Utama',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { to: '/invoices', icon: FileText, label: 'Input Invoice' },
      { to: '/tracker', icon: MapPin, label: 'Status Tracker' },
      { to: '/courier', icon: Activity, label: 'Mode Kurir' },
      { to: '/priority', icon: Brain, label: 'Prioritas C4.5', badge: 3 },
      { to: '/recommendation', icon: Lightbulb, label: 'Priority Recommendation' },
    ]
  },
  {
    section: 'Analitik',
    items: [
      { to: '/research-showcase', icon: BookOpen, label: 'Research Showcase' },
      { to: '/analytics', icon: TrendingUp, label: 'Operational Analytics' },
    ]
  },
  {
    section: 'Laporan',
    items: [
      { to: '/reports', icon: BarChart2, label: 'Laporan' },
      { to: '/customers', icon: Users, label: 'Pelanggan' },
    ]
  }
];

export default function Sidebar({ onLogout }) {
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Admin', role: 'Administrator' };

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
          InvoiceTrack
          <span>Operational Knowledge System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((section) => (
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
        <div className="nav-item" style={{ marginBottom: 4 }}>
          <Settings className="nav-icon" />
          <span>Pengaturan</span>
        </div>
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
