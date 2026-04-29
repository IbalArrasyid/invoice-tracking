import { Bell, Search, RefreshCw } from 'lucide-react';

export default function Topbar({ title, subtitle, actions }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 8 }}>
        {dateStr}
      </div>

      <div className="topbar-actions">
        <button
          className="btn btn-ghost btn-icon"
          data-tooltip="Notifikasi"
          style={{ position: 'relative' }}
        >
          <Bell size={18} />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--priority-high)',
            border: '2px solid var(--bg-base)'
          }} />
        </button>

        <button className="btn btn-ghost btn-icon" data-tooltip="Refresh data">
          <RefreshCw size={18} />
        </button>

        {actions}
      </div>
    </header>
  );
}
