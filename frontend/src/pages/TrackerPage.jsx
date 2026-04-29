import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, CheckCircle2, Truck, Package, AlertCircle, RotateCcw } from 'lucide-react';
import Topbar from '../components/Topbar';
import { trackingService } from '../api';
import { getStatusBadgeClass, getPriorityBadgeClass, formatCurrency, formatDate, formatDateTime } from '../data/mockData';

const STATUS_STEPS = {
  'Menunggu': 1,
  'Dalam Pengiriman': 2,
  'Terkirim': 3,
  'Kembali': 3,
};

const TIMELINE_MAPS = {
  'Menunggu': [
    { label: 'Invoice Dibuat', time: null, done: true, active: false, desc: 'Data invoice telah diinput ke sistem' },
    { label: 'Menunggu Penjadwalan', time: null, done: false, active: true, desc: 'Menunggu giliran dalam antrian pengiriman' },
    { label: 'Dalam Pengiriman', time: null, done: false, active: false, desc: '' },
    { label: 'Terkirim', time: null, done: false, active: false, desc: '' },
  ],
  'Dalam Pengiriman': [
    { label: 'Invoice Dibuat', time: 'Sudah selesai', done: true, active: false, desc: 'Data invoice berhasil diinput' },
    { label: 'Dijemput Driver', time: 'Pagi ini', done: true, active: false, desc: 'Invoice diambil oleh driver dan siap kirim' },
    { label: 'Dalam Pengiriman', time: 'Sekarang', done: false, active: true, desc: 'Driver sedang dalam perjalanan ke tujuan' },
    { label: 'Terkirim', time: null, done: false, active: false, desc: '' },
  ],
  'Terkirim': [
    { label: 'Invoice Dibuat', time: 'Selesai', done: true, active: false, desc: 'Data invoice berhasil diinput' },
    { label: 'Dijemput Driver', time: 'Selesai', done: true, active: false, desc: 'Invoice diambil oleh driver' },
    { label: 'Dalam Pengiriman', time: 'Selesai', done: true, active: false, desc: 'Driver sudah sampai di tujuan' },
    { label: 'Terkirim ✓', time: 'Selesai', done: true, active: true, desc: 'Invoice berhasil diterima oleh pelanggan' },
  ],
  'Kembali': [
    { label: 'Invoice Dibuat', time: 'Selesai', done: true, active: false, desc: '' },
    { label: 'Dijemput Driver', time: 'Selesai', done: true, active: false, desc: '' },
    { label: 'Gagal Kirim', time: 'Gagal', done: false, active: true, desc: 'Invoice tidak berhasil dikirim ke pelanggan' },
    { label: 'Dikembalikan ke Kantor', time: 'Proses', done: false, active: false, desc: 'Invoice kembali ke kantor untuk tindak lanjut' },
  ],
};

function StatusIcon({ status }) {
  switch (status) {
    case 'Terkirim': return <CheckCircle2 size={16} color="var(--priority-low)" />;
    case 'Dalam Pengiriman': return <Truck size={16} color="var(--primary-light)" />;
    case 'Menunggu': return <Package size={16} color="var(--priority-medium)" />;
    case 'Kembali': return <RotateCcw size={16} color="var(--priority-high)" />;
    default: return <Clock size={16} />;
  }
}

export default function TrackerPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      const data = await trackingService.getAll();
      setInvoices(data || []);
      if (data && data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (err) {
      console.error('Error fetching tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, []);

  const filtered = invoices.filter(inv => {
    const invNo = inv.invoiceNo || inv.invoice_no || '';
    const custName = inv.customer?.name || inv.customerName || '';
    
    const matchSearch = search === '' ||
      invNo.toLowerCase().includes(search.toLowerCase()) ||
      custName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const timeline = TIMELINE_MAPS[selected?.status] || TIMELINE_MAPS['Menunggu'];

  const [updateStatus, setUpdateStatus] = useState('');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleUpdateStatus = async () => {
    if (!updateStatus || !selected) return;
    try {
      setUpdating(true);
      await trackingService.updateStatus(selected.id, updateStatus, { notes: 'Updated by admin via tracker' });
      await fetchTracking(); // Refresh list
      setShowUpdateForm(false);
      setUpdateStatus('');
      
      // Update local selected state to reflect the new status
      setSelected(prev => ({...prev, status: updateStatus}));
      
    } catch (err) {
      console.error('Update status error:', err);
      alert('Gagal mengupdate status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading && invoices.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data tracker...</div>;
  }

  return (
    <div>
      <Topbar
        title="Status Tracker"
        subtitle="Pantau status pengiriman invoice secara real-time"
      />

      <div className="page-container">
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* ── Left: Invoice List ── */}
          <div>
            {/* Search */}
            <div style={{ marginBottom: 12 }}>
              <div className="search-wrap">
                <Search className="search-icon" />
                <input
                  className="search-input"
                  placeholder="Cari invoice atau pelanggan..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              {['Semua', 'Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'].map(s => (
                <button
                  key={s}
                  className={`tab-item ${statusFilter === s ? 'active' : ''}`}
                  style={{ flex: 'none', padding: '5px 10px', fontSize: '0.75rem' }}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '70vh', overflowY: 'auto' }}>
              {filtered.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => setSelected(inv)}
                  style={{
                    padding: '14px 16px',
                    background: selected?.id === inv.id ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${selected?.id === inv.id ? 'var(--border-accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span className="invoice-no" style={{ fontSize: '0.8rem' }}>{inv.invoiceNo || inv.invoice_no}</span>
                    <span className={`badge ${getStatusBadgeClass(inv.status)}`} style={{ fontSize: '0.65rem' }}>
                      <StatusIcon status={inv.status} />
                      {inv.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: 4 }}>
                    {inv.customer?.name || inv.customerName}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {inv.customer?.area || inv.area}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {inv.cutoff}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Driver: {inv.driver?.name || inv.driverName || '-'}
                    </span>
                    <span className={`badge ${getPriorityBadgeClass(inv.priority)}`} style={{ fontSize: '0.65rem' }}>
                      {inv.priority}
                    </span>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-icon"><Package size={22} /></div>
                  <div className="empty-title">Tidak ada invoice</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Detail & Timeline ── */}
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header */}
              <div className="card" style={{ background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {selected.invoiceNo || selected.invoice_no}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`badge ${getStatusBadgeClass(selected.status)}`}>
                        <StatusIcon status={selected.status} /> {selected.status}
                      </span>
                      <span className={`badge ${getPriorityBadgeClass(selected.priority)}`}>
                        Prioritas {selected.priority}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowUpdateForm(!showUpdateForm)}>
                    Update Status
                  </button>
                </div>

                {/* Update form */}
                {showUpdateForm && (
                  <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Update Status Pengiriman
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select className="form-select" value={updateStatus} onChange={e => setUpdateStatus(e.target.value)}>
                        <option value="">-- Pilih status baru --</option>
                        <option>Dalam Pengiriman</option>
                        <option>Terkirim</option>
                        <option>Kembali</option>
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={handleUpdateStatus} disabled={updating || !updateStatus}>
                        {updating ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px' }}>
                  {[
                    ['Pelanggan', selected.customer?.name || selected.customerName],
                    ['Area', selected.customer?.area || selected.area],
                    ['Nominal', formatCurrency(selected.amount)],
                    ['Jadwal', selected.schedule],
                    ['Cut-off', selected.cutoff],
                    ['Jatuh Tempo', formatDate(selected.dueDate || selected.due_date)],
                    ['Driver', selected.driver?.name || selected.driverName || '-'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 3, fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {selected.notes && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--priority-medium-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--priority-medium-border)', fontSize: '0.8125rem', color: 'var(--priority-medium)' }}>
                    ⚠ {selected.notes}
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 14 }}>Progress Pengiriman</div>
                <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
                  {['Dibuat', 'Diambil Driver', 'Dalam Perjalanan', selected.status === 'Kembali' ? 'Dikembalikan' : 'Terkirim'].map((step, i) => {
                    const stepNum = STATUS_STEPS[selected.status] || 1;
                    const done = i < stepNum;
                    const active = i === stepNum - 1;
                    return (
                      <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          {i > 0 && (
                           <div style={{ flex: 1, height: 2, background: done ? 'var(--priority-low)' : 'var(--border)' }} />
                          )}
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: done ? 'var(--priority-low)' : active ? 'var(--primary)' : 'var(--bg-elevated)',
                            border: `2px solid ${done ? 'var(--priority-low)' : active ? 'var(--primary)' : 'var(--border)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                            boxShadow: active ? '0 0 12px var(--primary-glow)' : 'none'
                          }}>
                            {done ? '✓' : i + 1}
                          </div>
                          {i < 3 && (
                            <div style={{ flex: 1, height: 2, background: done && i < stepNum - 1 ? 'var(--priority-low)' : 'var(--border)' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: done || active ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', fontWeight: done || active ? 600 : 400 }}>
                          {step}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 16 }}>Riwayat Pengiriman</div>
                <div className="timeline">
                  {timeline.map((item, i) => (
                    <div key={i} className="timeline-item" style={{ paddingBottom: i < timeline.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className={`timeline-dot ${item.done ? 'done' : item.active ? 'active' : ''}`}>
                          {item.done ? <CheckCircle2 size={14} /> : item.active ? <Clock size={14} /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />}
                        </div>
                        {i < timeline.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: item.done ? 'var(--priority-low)' : 'var(--border)', marginTop: 4, minHeight: 24 }} />
                        )}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-title" style={{ color: item.active ? 'var(--primary-light)' : item.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {item.label}
                        </div>
                        {item.time && <div className="timeline-time">{item.time}</div>}
                        {item.desc && <div className="timeline-desc">{item.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon"><MapPin size={22} /></div>
                <div className="empty-title">Pilih Invoice</div>
                <div className="empty-desc">Pilih invoice dari daftar untuk melihat detail tracking</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
