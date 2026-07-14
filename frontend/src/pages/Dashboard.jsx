import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  FileText, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, TrendingDown, MapPin, Users, ArrowRight, Brain
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { dashboardService, invoiceService, customerService, driverService } from '../api';
import { WEEKLY_STATS, getStatusBadgeClass, getPriorityBadgeClass, formatCurrency, formatDate } from '../data/mockData';

const COLORS = ['#ef4444', '#f59e0b', '#10b981'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem'
      }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    invoices: { total: 0, menunggu: 0, dalamPengiriman: 0, terkirim: 0, kembali: 0 },
    priority: { tinggi: 0, sedang: 0, rendah: 0 },
    model: { totalLogs: 0, correctLogs: 0, accuracy: 0 }
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [highPriorityInvoices, setHighPriorityInvoices] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsRes, recentInvRes, highInvRes, custRes, drvRes] = await Promise.all([
          dashboardService.getStats(),
          invoiceService.getAll({ limit: 5 }),
          invoiceService.getAll({ priority: 'Tinggi', limit: 5 }),
          customerService.getAll(),
          driverService.getAll()
        ]);
        
        setStats(statsRes);
        setRecentInvoices(recentInvRes.data || []);
        setHighPriorityInvoices(highInvRes.data || []);
        setCustomerCount(custRes.length || 0);
        setDriverCount(drvRes.length || 0);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalInvoices = stats.invoices.total;
  const terkirim = stats.invoices.terkirim;
  const dalamPengiriman = stats.invoices.dalamPengiriman;
  const kembali = stats.invoices.kembali;
  const menunggu = stats.invoices.menunggu;
  const tinggi = highPriorityInvoices;

  const PRIORITY_DISTRIBUTION = [
    { name: 'Tinggi', value: stats.priority.tinggi > 0 ? Math.round((stats.priority.tinggi / totalInvoices) * 100) : 0, color: '#ef4444' },
    { name: 'Sedang', value: stats.priority.sedang > 0 ? Math.round((stats.priority.sedang / totalInvoices) * 100) : 0, color: '#f59e0b' },
    { name: 'Rendah', value: stats.priority.rendah > 0 ? Math.round((stats.priority.rendah / totalInvoices) * 100) : 0, color: '#10b981' },
  ];

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data dashboard...</div>;
  }

  return (
    <div>
      <Topbar
        title="Dashboard Admin"
        subtitle="Ringkasan sistem pelacakan tanda terima invoice"
        actions={
          <NavLink to="/invoices" className="btn btn-primary btn-sm">
            <FileText size={15} /> Input Invoice Baru
          </NavLink>
        }
      />

      <div className="page-container">
        {/* ── Stat Cards ── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card default">
            <div className="stat-header">
              <div className="stat-icon-wrap" style={{ '--icon-bg': 'rgba(99,102,241,0.15)', '--icon-color': 'var(--primary-light)' }}>
                <FileText size={20} />
              </div>
              <span className="stat-change up">+12%</span>
            </div>
            <div className="stat-value">{totalInvoices}</div>
            <div className="stat-label">Total Invoice Aktif</div>
          </div>

          <div className="stat-card low">
            <div className="stat-header">
              <div className="stat-icon-wrap" style={{ '--icon-bg': 'rgba(16,185,129,0.15)', '--icon-color': '#10b981' }}>
                <CheckCircle2 size={20} />
              </div>
              <span className="stat-change up">+5%</span>
            </div>
            <div className="stat-value">{terkirim}</div>
            <div className="stat-label">Berhasil Terkirim</div>
          </div>

          <div className="stat-card medium">
            <div className="stat-header">
              <div className="stat-icon-wrap" style={{ '--icon-bg': 'rgba(245,158,11,0.15)', '--icon-color': '#f59e0b' }}>
                <Clock size={20} />
              </div>
              <span className="stat-change up">{dalamPengiriman} aktif</span>
            </div>
            <div className="stat-value">{menunggu}</div>
            <div className="stat-label">Menunggu Pengiriman</div>
          </div>

          <div className="stat-card high">
            <div className="stat-header">
              <div className="stat-icon-wrap" style={{ '--icon-bg': 'rgba(239,68,68,0.15)', '--icon-color': '#ef4444' }}>
                <AlertTriangle size={20} />
              </div>
              <span className="stat-change down">Perlu tindak lanjut</span>
            </div>
            <div className="stat-value">{kembali}</div>
            <div className="stat-label">Invoice Kembali</div>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* Weekly Chart */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div className="section-header">
              <div>
                <div className="section-title">Aktivitas Pengiriman Mingguan</div>
                <div className="section-subtitle">7 hari terakhir</div>
              </div>
              <span className="tag"><TrendingUp size={11} /> 23% vs minggu lalu</span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEKLY_STATS} barSize={10} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
                  <Bar dataKey="terkirim" name="Terkirim" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kembali" name="Kembali" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="menunggu" name="Menunggu" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Distribusi Prioritas C4.5</div>
                <div className="section-subtitle">Hasil klasifikasi model</div>
              </div>
              <NavLink to="/priority" className="btn btn-ghost btn-sm">
                <Brain size={13} /> Detail
              </NavLink>
            </div>
            <div className="chart-container" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PRIORITY_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {PRIORITY_DISTRIBUTION.map((entry, index) => (
                      <Cell key={index} fill={entry.color} opacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Proporsi']}
                    contentStyle={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 8, fontSize: '0.8rem'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              {PRIORITY_DISTRIBUTION.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, display: 'inline-block' }} />
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Grid ── */}
        <div className="grid-2">
          {/* Recent Invoices */}
          <div className="card col-span-2">
            <div className="section-header">
              <div>
                <div className="section-title">Invoice Terbaru</div>
                <div className="section-subtitle">5 invoice paling baru</div>
              </div>
              <NavLink to="/invoices" className="btn btn-ghost btn-sm">
                Lihat Semua <ArrowRight size={13} />
              </NavLink>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Invoice</th>
                    <th>Pelanggan</th>
                    <th>Area</th>
                    <th>Nominal</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                    <th>Prioritas</th>
                    <th>Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td><span className="invoice-no">{inv.invoiceNo || inv.invoice_no}</span></td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{inv.customer?.name || inv.customerName}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} color="var(--text-muted)" />
                          {inv.customer?.area || inv.area}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {formatCurrency(inv.amount)}
                      </td>
                      <td>{formatDate(inv.dueDate || inv.due_date)}</td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                          <span className="badge-dot" />
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getPriorityBadgeClass(inv.priority)}`}>
                          {inv.priority}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.driver?.name || inv.driverName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* High Priority Alert */}
          <div className="card" style={{ borderColor: 'var(--priority-high-border)', background: 'rgba(239,68,68,0.04)' }}>
            <div className="section-header">
              <div>
                <div className="section-title" style={{ color: 'var(--priority-high)' }}>
                  ⚠ Invoice Prioritas Tinggi
                </div>
                <div className="section-subtitle">Memerlukan pengiriman segera</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tinggi.map((inv, i) => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'var(--priority-high-bg)',
                  border: '1px solid var(--priority-high-border)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div className="priority-sequence-num priority-sequence-1">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {inv.customer?.name || inv.customerName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {inv.invoiceNo || inv.invoice_no} · Cut-off {inv.cutoff} · {inv.customer?.area || inv.area}
                    </div>
                  </div>
                  <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>Ringkasan Hari Ini</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Tingkat Pengiriman', value: `${totalInvoices > 0 ? Math.round((terkirim / totalInvoices) * 100) : 0}%`, color: 'var(--priority-low)', progress: totalInvoices > 0 ? (terkirim / totalInvoices) * 100 : 0 },
                { label: 'Dalam Pengiriman', value: `${dalamPengiriman} invoice`, color: 'var(--primary-light)', progress: totalInvoices > 0 ? (dalamPengiriman / totalInvoices) * 100 : 0 },
                { label: 'Akurasi Model C4.5', value: `${stats.model.accuracy}%`, color: 'var(--priority-medium)', progress: stats.model.accuracy },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${item.progress}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{customerCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  <Users size={11} /> Pelanggan
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{driverCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  <MapPin size={11} /> Driver
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
