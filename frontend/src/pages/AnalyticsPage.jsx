import { useState, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Users, Target, CheckCircle2,
  Award, MapPin, Clock, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import Topbar from '../components/Topbar';
import { analyticsService } from '../api';

/* ─── Warna chart ──────────────────────────────────────────── */
const DELIVERY_COLORS = { 'Kirim Hari Ini': '#10b981', 'Kirim Besok': '#f59e0b', 'Jadwalkan Ulang': '#ef4444' };
const CONFIDENCE_COLORS = { 'High': '#10b981', 'Medium': '#f59e0b', 'Low': '#ef4444' };

/* ─── Custom Tooltip ───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px',
      fontSize: '0.8rem', boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text-secondary)' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value % 1 !== 0 ? p.value.toFixed(2) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [recStats, setRecStats] = useState(null);
  const [driverStats, setDriverStats] = useState([]);
  const [areaStats, setAreaStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rec, drv, area] = await Promise.all([
        analyticsService.getRecommendationStats().catch(() => null),
        analyticsService.getDriverStats().catch(() => []),
        analyticsService.getAreaStats().catch(() => []),
      ]);
      setRecStats(rec);
      setDriverStats(drv || []);
      setAreaStats(area || []);
    } catch (err) {
      setError('Gagal memuat data analytics.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Prepare chart data ─────────────────────────────────── */
  const evidenceDistributionData = recStats?.scoreDistribution
    ? Object.entries(recStats.scoreDistribution).map(([name, value]) => ({
        name, value, fill: DELIVERY_COLORS[name] || '#6366f1',
      }))
    : [];

  const confidenceData = recStats?.confidenceDistribution
    ? Object.entries(recStats.confidenceDistribution).map(([name, value]) => ({
        name: name === 'High' ? 'Tinggi' : name === 'Medium' ? 'Sedang' : 'Rendah',
        value,
        fill: CONFIDENCE_COLORS[name] || '#6366f1',
      }))
    : [];

  if (loading) {
    return (
      <>
        <Topbar title="Operational Analytics" subtitle="Analisis performa Operational Knowledge dan POD" />
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-light)' }} />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Operational Analytics" subtitle="Analisis performa priority recommendation, delivery context, dan POD" />

      <div className="page-container">
        {error && <div style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</div>}

        {/* ─── Stat Cards ────────────────────────────────────── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard
            icon={Target} label="Total Rekomendasi"
            value={recStats?.totalRecommendations ?? 0}
            accent="default"
          />
          <StatCard
            icon={TrendingUp} label="Rata-rata Evidence"
            value={recStats?.avgScore != null ? recStats.avgScore.toFixed(2) : '—'}
            accent="default"
          />
          <StatCard
            icon={CheckCircle2} label="Tingkat Penerimaan"
            value={recStats?.acceptanceRate != null ? `${(recStats.acceptanceRate * 100).toFixed(0)}%` : '—'}
            accent="low"
          />
          <StatCard
            icon={Award} label="Tingkat Keberhasilan"
            value={recStats?.successRate != null ? `${(recStats.successRate * 100).toFixed(0)}%` : '—'}
            accent="low"
          />
        </div>

        {/* ─── Charts Row ────────────────────────────────────── */}
        <div className="analytics-grid">
          {/* Bar Chart - Distribusi Priority Recommendation */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={18} style={{ color: 'var(--primary-light)' }} />
              Distribusi Priority Recommendation
            </h3>
            <div className="chart-container">
              {evidenceDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evidenceDistributionData} barSize={48}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Jumlah" radius={[6, 6, 0, 0]}>
                      {evidenceDistributionData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Belum ada data distribusi" />
              )}
            </div>
          </div>

          {/* Pie Chart — Distribusi Confidence */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} style={{ color: 'var(--primary-light)' }} />
              Distribusi Decision Confidence
            </h3>
            <div className="chart-container">
              {confidenceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={confidenceData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={100}
                      paddingAngle={4} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {confidenceData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom" height={36}
                      formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{value}</span>}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="Belum ada data confidence" />
              )}
            </div>
          </div>
        </div>

        {/* ─── Driver Performance Table ──────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--primary-light)' }} />
            Delivery Context Performance
          </h3>
          {driverStats.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Total Priority Decisions</th>
                    <th>Avg Evidence</th>
                    <th style={{ minWidth: 160 }}>Evidence Visual</th>
                    <th>Dipilih Sebagai Driver</th>
                    <th>Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStats.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.driver || d.nama_driver || '—'}</td>
                      <td>{d.totalRecommendations ?? d.total ?? 0}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-light)' }}>
                          {(d.avgScore ?? d.avg_score ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              width: `${((d.avgScore ?? d.avg_score ?? 0) * 100)}%`, height: '100%',
                              borderRadius: 99,
                              background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td>{d.recommendedCount ?? d.recommended_count ?? 0}</td>
                      <td>
                        {d.successRate != null || d.success_rate != null
                          ? `${(((d.successRate ?? d.success_rate) || 0) * 100).toFixed(0)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Belum ada data delivery context" />
          )}
        </div>

        {/* ─── Area Analytics Table ──────────────────────────── */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} style={{ color: 'var(--primary-light)' }} />
            Analisis Area Pengiriman
          </h3>
          {areaStats.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Total Rekomendasi</th>
                    <th>Avg Evidence</th>
                    <th>Avg Estimasi Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {areaStats.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.area || a.area_pengantaran || '—'}</td>
                      <td>{a.totalRecommendations ?? a.total ?? 0}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-light)' }}>
                          {(a.avgScore ?? a.avg_score ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        {a.avgEstimatedMinutes ?? a.avg_estimated_minutes
                          ? `${Math.round(a.avgEstimatedMinutes ?? a.avg_estimated_minutes)} menit`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Belum ada data analisis area" />
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Stat Card Component ──────────────────────────────────── */
function StatCard({ icon: Icon, label, value, accent = 'default' }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-header">
        <div className="stat-icon-wrap" style={{
          background: accent === 'low' ? 'var(--priority-low-bg)' : 'rgba(99,102,241,0.15)',
          color: accent === 'low' ? 'var(--priority-low)' : 'var(--primary-light)',
        }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ─── Empty State Component ────────────────────────────────── */
function EmptyState({ text }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: 200, color: 'var(--text-muted)',
      fontSize: '0.875rem', gap: 8,
    }}>
      <BarChart2 size={24} />
      {text}
    </div>
  );
}
