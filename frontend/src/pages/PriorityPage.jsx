import { useState } from 'react';
import {
  Brain, Zap, BarChart2, CheckCircle2, XCircle, Info,
  RefreshCw, ChevronRight, GitBranch
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import Topbar from '../components/Topbar';
import { invoiceService, predictService, dashboardService, priorityLogService } from '../api';
import { AREAS, SCHEDULES, getPriorityBadgeClass, formatDate } from '../data/mockData';

// Accuracy data for the radar chart
const performanceData = [
  { metric: 'Akurasi', value: 87 },
  { metric: 'Presisi', value: 84 },
  { metric: 'Recall', value: 89 },
  { metric: 'F1-Score', value: 86 },
  { metric: 'Spesifisitas', value: 82 },
];

const confusionMatrix = [
  { actual: 'Tinggi', predTinggi: 18, predSedang: 2, predRendah: 0 },
  { actual: 'Sedang', predTinggi: 1, predSedang: 14, predRendah: 2 },
  { actual: 'Rendah', predTinggi: 0, predSedang: 1, predRendah: 10 },
];

// Simplified C4.5 decision tree visualization nodes
const TREE_NODES = [
  {
    id: 'root', label: 'Cut-off', level: 0, type: 'decision',
    children: ['node1', 'node2', 'node3']
  },
  {
    id: 'node1', label: '≤ 10:00', level: 1, type: 'decision',
    note: 'Jadwal?', children: ['leaf1', 'leaf2']
  },
  {
    id: 'node2', label: '10:01–12:00', level: 1, type: 'decision',
    note: 'Jadwal?', children: ['leaf3', 'leaf4']
  },
  {
    id: 'node3', label: '> 12:00', level: 1, type: 'decision',
    note: 'Jadwal?', children: ['leaf5', 'leaf6']
  },
  { id: 'leaf1', label: 'TINGGI', level: 2, type: 'leaf-high', note: 'Jadwal terbatas', children: [] },
  { id: 'leaf2', label: 'TINGGI', level: 2, type: 'leaf-high', note: 'Cutoff ketat', children: [] },
  { id: 'leaf3', label: 'TINGGI', level: 2, type: 'leaf-high', note: 'Jadwal terbatas', children: [] },
  { id: 'leaf4', label: 'SEDANG', level: 2, type: 'leaf-medium', note: 'Jadwal reguler', children: [] },
  { id: 'leaf5', label: 'SEDANG', level: 2, type: 'leaf-medium', note: 'Jadwal khusus', children: [] },
  { id: 'leaf6', label: 'RENDAH', level: 2, type: 'leaf-low', note: 'Jadwal fleksibel', children: [] },
];

export default function PriorityPage() {
  const [tab, setTab] = useState('predict');
  const [form, setForm] = useState({ area: '', jadwal: '', cutoff: '' });
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const [stats, setStats] = useState({
    totalInvoices: 0,
    tinggi: 0,
    sedang: 0,
    rendah: 0,
    totalLogs: 0,
    correctLogs: 0
  });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashStats, logRes] = await Promise.all([
          dashboardService.getStats(),
          priorityLogService.getAll()
        ]);

        setStats({
          totalInvoices: dashStats.invoices.total,
          tinggi: dashStats.priority.tinggi,
          sedang: dashStats.priority.sedang,
          rendah: dashStats.priority.rendah,
          totalLogs: dashStats.model.totalLogs,
          correctLogs: dashStats.model.correctLogs
        });

        setLogs(logRes || []);
      } catch (err) {
        console.error('Error fetching priority data:', err);
      }
    };

    fetchData();
  }, []);

  const handlePredict = async () => {
    if (!form.jadwal || !form.cutoff) return;
    setIsLoading(true);
    try {
      const r = await predictService.predict({ area: form.area, jadwal: form.jadwal, cutoff: form.cutoff });
      setResult(r);
      setHistory(prev => [{ ...form, ...r, time: new Date().toLocaleTimeString('id-ID') }, ...prev.slice(0, 4)]);
    } catch (err) {
      console.error('Prediction error:', err);
      alert('Gagal memprediksi prioritas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Topbar
        title="Rekomendasi Prioritas C4.5"
        subtitle="Klasifikasi prioritas invoice menggunakan algoritma Decision Tree C4.5"
        actions={
          <button className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Retrain Model
          </button>
        }
      />

      <div className="page-container">
        {/* Info Banner */}
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <Brain size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Tentang Model C4.5:</strong> Algoritma Decision Tree C4.5 mengklasifikasikan prioritas invoice berdasarkan
            fitur <em>jadwal penerimaan</em> dan <em>batas waktu cut-off</em> pelanggan.
            Model dilatih dari data historis pengiriman dan diperbarui secara berkala.
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          {[
            { label: 'Total Prediksi', value: stats.totalInvoices, icon: Brain, color: 'var(--primary-light)', bg: 'rgba(99,102,241,0.15)' },
            { label: 'Prioritas Tinggi', value: stats.tinggi, icon: Zap, color: 'var(--priority-high)', bg: 'var(--priority-high-bg)' },
            { label: 'Prioritas Sedang', value: stats.sedang, icon: BarChart2, color: 'var(--priority-medium)', bg: 'var(--priority-medium-bg)' },
            { label: 'Prioritas Rendah', value: stats.rendah, icon: CheckCircle2, color: 'var(--priority-low)', bg: 'var(--priority-low-bg)' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div className="stat-card" key={item.label}>
                <div className="stat-header">
                  <div className="stat-icon-wrap" style={{ '--icon-bg': item.bg, '--icon-color': item.color }}>
                    <Icon size={20} />
                  </div>
                </div>
                <div className="stat-value">{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            );
          })}
        </div>

        {/* Tab Bar */}
        <div className="tab-bar" style={{ marginBottom: 24 }}>
          {[
            { key: 'predict', label: '🔮 Prediksi' },
            { key: 'model', label: '📊 Performa Model' },
            { key: 'tree', label: '🌳 Decision Tree' },
            { key: 'log', label: '📋 Log Klasifikasi' },
          ].map(t => (
            <button key={t.key} className={`tab-item ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Predict ── */}
        {tab === 'predict' && (
          <div className="grid-2">
            <div className="card">
              <div className="section-title" style={{ marginBottom: 4 }}>Input Parameter Prediksi</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                Masukkan data jadwal pelanggan untuk mendapatkan rekomendasi prioritas
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Area / Wilayah Pengiriman</label>
                  <select className="form-select" value={form.area}
                    onChange={e => setForm(p => ({ ...p, area: e.target.value }))}>
                    <option value="">-- Opsional --</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Jadwal Penerimaan <span style={{ color: 'var(--priority-high)' }}>*</span></label>
                  <select className="form-select" value={form.jadwal}
                    onChange={e => { setForm(p => ({ ...p, jadwal: e.target.value })); setResult(null); }} required>
                    <option value="">-- Pilih jadwal --</option>
                    {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Batas Waktu Cut-off <span style={{ color: 'var(--priority-high)' }}>*</span></label>
                  <input type="time" className="form-input" value={form.cutoff}
                    onChange={e => { setForm(p => ({ ...p, cutoff: e.target.value })); setResult(null); }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Jam cut-off ini merupakan salah satu fitur utama model C4.5
                  </div>
                </div>

                <button className="btn btn-primary"
                  onClick={handlePredict}
                  disabled={!form.jadwal || !form.cutoff || isLoading}
                  style={{ marginTop: 4 }}>
                  {isLoading ? (
                    <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Memproses Model...</>
                  ) : <><Brain size={16} /> Jalankan Prediksi C4.5</>}
                </button>
              </div>
            </div>

            {/* Result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!result ? (
                <div className="card" style={{ flex: 1 }}>
                  <div className="empty-state">
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
                    <div className="empty-title">Siap Memproses</div>
                    <div className="empty-desc">
                      Isi parameter jadwal dan cut-off, lalu klik prediksi untuk mendapatkan rekomendasi prioritas dari model C4.5
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="prediction-result" style={{
                    background: result.priority === 'Tinggi' ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))' :
                      result.priority === 'Sedang' ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))' :
                        'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))',
                    border: result.priority === 'Tinggi' ? '1px solid var(--priority-high-border)' :
                      result.priority === 'Sedang' ? '1px solid var(--priority-medium-border)' : '1px solid var(--priority-low-border)',
                  }}>
                    <div className="prediction-label">Hasil Klasifikasi C4.5</div>
                    <div className="prediction-value" style={{
                      color: result.priority === 'Tinggi' ? 'var(--priority-high)' :
                        result.priority === 'Sedang' ? 'var(--priority-medium)' : 'var(--priority-low)',
                      fontSize: '2rem'
                    }}>
                      {result.priority === 'Tinggi' ? '🔴' : result.priority === 'Sedang' ? '🟡' : '🟢'} Prioritas {result.priority}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {Math.round(result.confidence * 100)}%
                        </div>
                      </div>
                      <div style={{ width: 1, background: 'var(--border)', height: 36 }} />
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alasan</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{result.reason}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Confidence Bar</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width: `${result.confidence * 100}%`,
                          background: result.priority === 'Tinggi' ? 'var(--priority-high)' :
                            result.priority === 'Sedang' ? 'var(--priority-medium)' : 'var(--priority-low)'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Rekomendasi aksi */}
                  <div className="card">
                    <div className="section-title" style={{ marginBottom: 12 }}>Rekomendasi Tindakan</div>
                    {result.priority === 'Tinggi' ? (
                      <div className="alert alert-danger">
                        <Zap size={16} />
                        <div>
                          <strong>Kirimkan HARI INI</strong> — Invoice ini memiliki prioritas tinggi karena jadwal atau cut-off yang sangat ketat. Koordinasikan dengan driver untuk pengiriman segera.
                        </div>
                      </div>
                    ) : result.priority === 'Sedang' ? (
                      <div className="alert alert-warning">
                        <Info size={16} />
                        <div>
                          <strong>Kirimkan Besok Pagi</strong> — Prioritas sedang. Pastikan invoice disiapkan dan masuk antrian pengiriman untuk esok hari sesuai jadwal pelanggan.
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-success">
                        <CheckCircle2 size={16} />
                        <div>
                          <strong>Antrian Normal</strong> — Prioritas rendah. Invoice dapat dikirim sesuai jadwal reguler tanpa perlu percepatan khusus.
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Prediction History */}
              {history.length > 0 && (
                <div className="card">
                  <div className="section-title" style={{ marginBottom: 12 }}>Riwayat Prediksi Sesi Ini</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{h.jadwal}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>cut-off {h.cutoff}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge ${getPriorityBadgeClass(h.priority)}`}>{h.priority}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{h.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Model Performance ── */}
        {tab === 'model' && (
          <div className="grid-2">
            <div className="card">
              <div className="section-title" style={{ marginBottom: 16 }}>Metrik Kinerja Model</div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={performanceData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                    <Radar name="Model C4.5" dataKey="value" stroke="var(--primary-light)" fill="var(--primary)" fillOpacity={0.2} />
                    <Tooltip
                      formatter={(val) => [`${val}%`, 'Nilai']}
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {performanceData.map(p => (
                  <div key={p.metric} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.metric}</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary-light)' }}>{p.value}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {/* Confusion Matrix */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 16 }}>Confusion Matrix</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Aktual \ Prediksi</th>
                        {['Tinggi', 'Sedang', 'Rendah'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {confusionMatrix.map((row, i) => (
                        <tr key={row.actual}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left' }}>
                            {row.actual}
                          </td>
                          {[row.predTinggi, row.predSedang, row.predRendah].map((val, j) => (
                            <td key={j} style={{
                              padding: '10px 16px',
                              background: i === j ? 'rgba(99,102,241,0.15)' : val > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              fontWeight: i === j ? 700 : 400,
                              color: i === j ? 'var(--primary-light)' : val > 0 ? 'var(--priority-high)' : 'var(--text-muted)',
                              fontSize: '1rem'
                            }}>
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>
                    <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid var(--border)', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />
                    Prediksi benar (diagonal)
                  </span>
                  <span>
                    <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--border)', borderRadius: 2, verticalAlign: 'middle', marginRight: 4 }} />
                    Kesalahan klasifikasi
                  </span>
                </div>
              </div>

              {/* Training Info */}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 14 }}>Informasi Training</div>
                {[
                  ['Algoritma', 'C4.5 (Decision Tree)'],
                  ['Library', 'scikit-learn / Python'],
                  ['Format Model', '.pkl (joblib)'],
                  ['Jumlah Data Latih', '200 record historis'],
                  ['Fitur Utama', 'Jadwal + Cut-off Penerimaan'],
                  ['Akurasi Terakhir', '87.5%'],
                  ['Terakhir Retrain', '15 April 2024'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Decision Tree Visualization ── */}
        {tab === 'tree' && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 6 }}>Visualisasi Pohon Keputusan C4.5</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24 }}>
              Representasi sederhana dari decision tree yang digunakan untuk klasifikasi prioritas
            </div>

            {/* SVG-like tree using divs */}
            <div style={{ overflowX: 'auto', padding: '20px 0' }}>
              {/* Root */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {/* Root node */}
                <div style={{
                  padding: '12px 24px', background: 'rgba(99,102,241,0.15)', border: '2px solid var(--primary)',
                  borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 700, color: 'var(--primary-light)',
                  fontSize: '0.9rem', marginBottom: 0
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Node Akar</div>
                  <GitBranch size={18} style={{ marginBottom: 4 }} />
                  <div>Cut-off Penerimaan</div>
                  <div style={{ fontSize: '0.7rem', marginTop: 2, color: 'var(--text-secondary)' }}>Info Gain: 0.847</div>
                </div>

                {/* Connector */}
                <div style={{ width: '70%', height: 2, background: 'var(--border)', position: 'relative', margin: '20px 0 0 0' }}>
                  <div style={{ position: 'absolute', left: '15%', top: -8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>≤ 10:00</div>
                  <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>10:01–12:00</div>
                  <div style={{ position: 'absolute', right: '15%', top: -8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>&gt; 12:00</div>
                </div>

                {/* Level 1 nodes */}
                <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
                  {[
                    { label: 'Jadwal Penerimaan', note: 'Cabang cutoff ketat', color: 'rgba(239,68,68,0.15)', border: 'var(--priority-high)', text: 'var(--priority-high)' },
                    { label: 'Jadwal Penerimaan', note: 'Cabang cutoff sedang', color: 'rgba(245,158,11,0.15)', border: 'var(--priority-medium)', text: 'var(--priority-medium)' },
                    { label: 'Jadwal Penerimaan', note: 'Cabang cutoff longgar', color: 'rgba(16,185,129,0.15)', border: 'var(--priority-low)', text: 'var(--priority-low)' },
                  ].map((node, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        padding: '10px 18px', background: node.color, border: `2px solid ${node.border}`,
                        borderRadius: 'var(--radius-md)', textAlign: 'center', color: node.text, fontWeight: 600, fontSize: '0.8rem',
                        minWidth: 150
                      }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>Node Keputusan</div>
                        <div>{node.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>{node.note}</div>
                      </div>

                      {/* Leaf nodes */}
                      <div style={{ display: 'flex', gap: 10 }}>
                        {i === 0 && [
                          { p: 'TINGGI', n: 'Jadwal terbatas', bg: 'var(--priority-high-bg)', bc: 'var(--priority-high-border)', c: 'var(--priority-high)' },
                          { p: 'TINGGI', n: 'Cutoff sangat ketat', bg: 'var(--priority-high-bg)', bc: 'var(--priority-high-border)', c: 'var(--priority-high)' },
                        ].map((leaf, j) => (
                          <div key={j} style={{ padding: '8px 12px', background: leaf.bg, border: `1px solid ${leaf.bc}`, borderRadius: 'var(--radius-sm)', textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: leaf.c }}>{leaf.p}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{leaf.n}</div>
                          </div>
                        ))}
                        {i === 1 && [
                          { p: 'TINGGI', n: 'Jadwal terbatas', bg: 'var(--priority-high-bg)', bc: 'var(--priority-high-border)', c: 'var(--priority-high)' },
                          { p: 'SEDANG', n: 'Jadwal reguler', bg: 'var(--priority-medium-bg)', bc: 'var(--priority-medium-border)', c: 'var(--priority-medium)' },
                        ].map((leaf, j) => (
                          <div key={j} style={{ padding: '8px 12px', background: leaf.bg, border: `1px solid ${leaf.bc}`, borderRadius: 'var(--radius-sm)', textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: leaf.c }}>{leaf.p}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{leaf.n}</div>
                          </div>
                        ))}
                        {i === 2 && [
                          { p: 'SEDANG', n: 'Jadwal khusus', bg: 'var(--priority-medium-bg)', bc: 'var(--priority-medium-border)', c: 'var(--priority-medium)' },
                          { p: 'RENDAH', n: 'Jadwal fleksibel', bg: 'var(--priority-low-bg)', bc: 'var(--priority-low-border)', c: 'var(--priority-low)' },
                        ].map((leaf, j) => (
                          <div key={j} style={{ padding: '8px 12px', background: leaf.bg, border: `1px solid ${leaf.bc}`, borderRadius: 'var(--radius-sm)', textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: leaf.c }}>{leaf.p}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{leaf.n}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attribute importance */}
            <div className="divider" />
            <div className="section-title" style={{ marginBottom: 14 }}>Importance Atribut</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Cut-off Penerimaan', value: 85, color: 'var(--primary-light)' },
                { label: 'Jadwal Penerimaan', value: 72, color: 'var(--priority-medium)' },
                { label: 'Area / Wilayah', value: 41, color: 'var(--priority-low)' },
              ].map(attr => (
                <div key={attr.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{attr.label}</span>
                    <span style={{ color: attr.color, fontWeight: 700 }}>{attr.value}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${attr.value}%`, background: attr.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Log ── */}
        {tab === 'log' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 20px 0' }}>
              <div className="section-header">
                <div>
                  <div className="section-title">Log Klasifikasi</div>
                  <div className="section-subtitle">
                    Akurasi sesi: {stats.correctLogs}/{stats.totalLogs} ({stats.totalLogs > 0 ? Math.round(stats.correctLogs / stats.totalLogs * 100) : 0}%)
                  </div>
                </div>
              </div>
            </div>
            <div className="table-wrapper" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. Invoice</th>
                    <th>Area</th>
                    <th>Jadwal</th>
                    <th>Cut-off</th>
                    <th>Prediksi C4.5</th>
                    <th>Label Aktual</th>
                    <th>Akurasi</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i}>
                      <td><span className="invoice-no">{log.invoiceNo || log.invoice_id}</span></td>
                      <td>{log.area || '-'}</td>
                      <td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.schedule || '-'}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{log.cutoff || '-'}</td>
                      <td><span className={`badge ${getPriorityBadgeClass(log.predicted)}`}>{log.predicted}</span></td>
                      <td><span className={`badge ${getPriorityBadgeClass(log.actual || log.predicted)}`}>{log.actual || log.predicted}</span></td>
                      <td>
                        {log.accuracy ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--priority-low)', fontSize: '0.8rem', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Benar
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--priority-high)', fontSize: '0.8rem', fontWeight: 600 }}>
                            <XCircle size={14} /> Salah
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
