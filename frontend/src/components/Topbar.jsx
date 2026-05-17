import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Truck } from 'lucide-react';
import { invoiceService } from '../api';

export default function Topbar({ title, subtitle, actions }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const loadNotifications = async () => {
    try {
      const res = await invoiceService.getAll({ limit: 100 });
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = invoices.filter(inv => {
      const due = new Date(inv.dueDate || inv.due_date);
      return inv.status !== 'Terkirim' && !Number.isNaN(due.getTime()) && due < today;
    });
    const returned = invoices.filter(inv => inv.status === 'Kembali');
    const highPriority = invoices.filter(inv => inv.priority === 'Tinggi' && inv.status !== 'Terkirim');
    const inDelivery = invoices.filter(inv => inv.status === 'Dalam Pengiriman');

    return [
      overdue.length > 0 && {
        icon: AlertTriangle,
        tone: 'danger',
        title: `${overdue.length} invoice melewati jatuh tempo`,
        desc: 'Perlu dicek dan ditindaklanjuti oleh admin.',
      },
      returned.length > 0 && {
        icon: AlertTriangle,
        tone: 'danger',
        title: `${returned.length} invoice kembali`,
        desc: 'Butuh jadwal ulang atau konfirmasi pelanggan.',
      },
      highPriority.length > 0 && {
        icon: AlertTriangle,
        tone: 'warning',
        title: `${highPriority.length} invoice prioritas tinggi`,
        desc: 'Masih menunggu penyelesaian pengiriman.',
      },
      inDelivery.length > 0 && {
        icon: Truck,
        tone: 'info',
        title: `${inDelivery.length} invoice dalam pengiriman`,
        desc: 'Pantau progres kurir di Status Tracker.',
      },
    ].filter(Boolean);
  }, [invoices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    window.location.reload();
  };

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
        <div className="notification-wrap">
          <button
            className="btn btn-ghost btn-icon"
            data-tooltip="Notifikasi"
            onClick={() => setShowNotifications(prev => !prev)}
            aria-label="Buka notifikasi"
          >
            <Bell size={18} />
            {notifications.length > 0 && <span className="notification-dot" />}
          </button>

          {showNotifications && (
            <div className="notification-popover">
              <div className="notification-head">
                <strong>Notifikasi</strong>
                <span>{notifications.length} aktif</span>
              </div>

              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <CheckCircle2 size={18} />
                  Semua pengiriman dalam kondisi aman.
                </div>
              ) : (
                notifications.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div className={`notification-item ${item.tone}`} key={index}>
                      <Icon size={16} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.desc}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <button
          className="btn btn-ghost btn-icon"
          data-tooltip="Refresh data"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh data"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {actions}
      </div>
    </header>
  );
}
