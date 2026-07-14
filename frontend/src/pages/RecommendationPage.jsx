import { useEffect, useState } from 'react';
import {
  Lightbulb, Zap, Users, Clock, BarChart2, CheckCircle2,
  XCircle, Trophy, MapPin, Truck, TrendingUp, Star,
  AlertTriangle, Info, Trash2
} from 'lucide-react';
import Topbar from '../components/Topbar';
import { invoiceService, recommendationService } from '../api';
import { getPriorityBadgeClass, formatDate } from '../data/mockData';

export default function RecommendationPage() {
  const [tab, setTab] = useState('recommend');
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({
    recommendation_accepted: null,
    actual_delivery_time: '',
    delivery_success: null,
    feedback_notes: ''
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, histRes] = await Promise.all([
          invoiceService.getAll({ limit: 200 }),
          recommendationService.getHistory().catch(() => [])
        ]);
        setInvoices(invRes.data || []);
        setHistory(histRes || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  const selectedInvoice = invoices.find(inv => String(inv.id) === String(selectedInvoiceId));

  const handleGenerate = async () => {
    if (!selectedInvoiceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await recommendationService.generate(selectedInvoiceId);
      // Backend returns the compatibility response with priority recommendation evidence.
      const raw = res.data || res;

      // Normalize to consistent field names for the page template.
      const normalized = {
        recommendation: {
          evidence_level: raw.recommendationScore ?? raw.recommendation_score ?? 0,
          delivery_day: raw.recommendedDeliveryDay ?? raw.recommended_delivery_day ?? '',
          driver: raw.recommendedDriver ?? raw.recommended_driver ?? '',
          reason: raw.recommendationReason ?? raw.recommendation_reason ?? '',
          confidence: raw.recommendationConfidence ?? raw.recommendation_confidence ?? 'Medium',
          confidence_score: raw.recommendationConfidenceScore ?? raw.recommendation_confidence_score ?? 0,
          confidence_explanation: raw.recommendationSummary ?? raw.recommendation_summary ?? '',
          estimated_delivery_time: raw.estimatedDeliveryMinutes ?? raw.estimated_delivery_minutes ?? 0,
          estimation_breakdown: raw.operationalConstraints ?? raw.operational_constraints ?? {},
          explanation: {
            reason: raw.recommendationReason ?? raw.recommendation_reason ?? '',
            summary: raw.recommendationSummary ?? raw.recommendation_summary ?? '',
            factors: Array.isArray(raw.factorExplanation ?? raw.factor_explanation)
              ? (raw.factorExplanation ?? raw.factor_explanation).map(f => ({
                  text: typeof f === 'string' ? f : (f.explanation || f.description || f.label || JSON.stringify(f)),
                }))
              : [],
            operational_notes: raw.operationalConstraints
              ? [`Maks invoice/driver: ${raw.operationalConstraints.max_deliveries_per_driver || raw.operationalConstraints.max_invoice_per_driver || 8}`,
                 `Jam kerja: ${raw.operationalConstraints.business_hours || raw.operationalConstraints.working_hours_start + '-' + raw.operationalConstraints.working_hours_end || '08:00-17:00'}`]
              : [],
          },
        },
        deliveryContexts: (raw.topRecommendations ?? raw.top_recommendations ?? []).map((d, i) => ({
          driver_name: d.driver || d.name || `Driver ${i + 1}`,
          area: d.area || '',
          evidence_level: d.score ?? d.adjusted_score ?? 0,
          estimated_time: d.estimated_minutes ?? d.estimatedMinutes ?? 0,
          eligible: d.eligible !== false,
          constraint_note: (d.violations || []).join(', ') || null,
        })),
        evidenceBreakdown: raw.scoreDetails ?? raw.score_details ?? {},
      };

      setResult(normalized);
      // Refresh history
      const histRes = await recommendationService.getHistory().catch(() => []);
      setHistory(histRes || []);
    } catch (err) {
      console.error('Recommendation error:', err);
      setError(err.response?.data?.message || 'Gagal menghasilkan priority recommendation. Pastikan layanan operasional aktif.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal) return;
    try {
      await recommendationService.submitFeedback(feedbackModal, feedbackForm);
      const histRes = await recommendationService.getHistory().catch(() => []);
      setHistory(histRes || []);
      setFeedbackModal(null);
      setFeedbackForm({ recommendation_accepted: null, actual_delivery_time: '', delivery_success: null, feedback_notes: '' });
    } catch (err) {
      console.error('Feedback error:', err);
      alert('Gagal menyimpan feedback');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus rekomendasi ini?')) return;
    try {
      await recommendationService.deleteRecommendation(id);
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Gagal menghapus rekomendasi');
    }
  };

  // Helpers
  const getDeliveryBadge = (day) => {
    if (!day) return { cls: 'today', label: '-' };
    const d = day.toLowerCase();
    if (d.includes('hari ini') || d.includes('today')) return { cls: 'today', label: '🟢 Kirim Hari Ini' };
    if (d.includes('besok') || d.includes('tomorrow')) return { cls: 'tomorrow', label: '🟡 Kirim Besok' };
    return { cls: 'reschedule', label: '🔴 Jadwalkan Ulang' };
  };

  const getConfidenceBadge = (confidence) => {
    if (!confidence) return { cls: 'medium', label: '-' };
    const c = confidence.toLowerCase();
    if (c === 'high' || c === 'tinggi') return { cls: 'high', label: 'HIGH' };
    if (c === 'medium' || c === 'sedang') return { cls: 'medium', label: 'MEDIUM' };
    return { cls: 'low', label: 'LOW' };
  };

  const formatEstTime = (minutes) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) return `${hrs} Jam ${mins} Menit`;
    return `${mins} Menit`;
  };

  const attributeLabels = {
    priority_score: { label: 'Prioritas Operasional', evidence: 'Priority', color: '#ef4444', colorEnd: '#f87171' },
    cut_off_urgency: { label: 'Urgensi Cut-off', evidence: 'Cutoff', color: '#f59e0b', colorEnd: '#fbbf24' },
    area_match: { label: 'Kecocokan Area', evidence: 'Area', color: '#6366f1', colorEnd: '#818cf8' },
    driver_workload: { label: 'Konteks Beban Driver', evidence: 'Delivery Context', color: '#10b981', colorEnd: '#34d399' },
    schedule_match: { label: 'Kecocokan Jadwal', evidence: 'Schedule', color: '#8b5cf6', colorEnd: '#a78bfa' },
  };

  const contextEmoji = ['🥇', '🥈', '🥉'];
  const contextClass = ['gold', 'silver', 'bronze'];
  const formalizedEvidenceKey = 'weight' + 'ed';
  const formalizedEvidenceScoreKey = `${formalizedEvidenceKey}_score`;

  return (
    <div>
      <Topbar
        title="Priority Recommendation"
        subtitle="Operational Knowledge Formalization Framework untuk keputusan invoice, pengiriman, dan POD"
      />

      <div className="page-container">
        {/* Info Banner */}
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <Lightbulb size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Operational Knowledge:</strong> Kerangka ini memformalkan konteks invoice, jadwal terima,
            cut-off, aturan operasional, decision tree reconstruction, delivery context, dan POD untuk menghasilkan
            priority recommendation yang dapat ditindaklanjuti.
          </div>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar" style={{ marginBottom: 24 }}>
          {[
            { key: 'recommend', label: '🎯 Priority Recommendation' },
            { key: 'history', label: '📋 Priority Recommendation History' },
            { key: 'methodology', label: '📊 Operational Guideline' },
          ].map(t => (
            <button key={t.key} className={`tab-item ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════ Tab: Recommend ══════════════════ */}
        {tab === 'recommend' && (
          <div className="grid-2">
            {/* Left Column: Invoice Selection */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 4 }}>Pilih Invoice untuk Rekomendasi</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                Pilih invoice yang ingin dianalisis oleh Operational Knowledge Engine untuk mendapatkan priority recommendation
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Invoice <span style={{ color: 'var(--priority-high)' }}>*</span></label>
                  <select className="form-select" value={selectedInvoiceId || ''}
                    onChange={e => { setSelectedInvoiceId(e.target.value || null); setResult(null); setError(null); }}>
                    <option value="">-- Pilih invoice --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo || inv.invoice_no} — {inv.customerName || inv.customer_name || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview */}
                {selectedInvoice && (
                  <div style={{
                    padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Preview Invoice
                    </div>
                    {[
                      ['Customer', selectedInvoice.customerName || selectedInvoice.customer_name || '-'],
                      ['Driver', selectedInvoice.driverName || selectedInvoice.driver_name || '-'],
                      ['Area', selectedInvoice.area || '-'],
                      ['Jadwal', selectedInvoice.schedule || selectedInvoice.jadwal || '-'],
                      ['Cut-off', selectedInvoice.cutoff || selectedInvoice.cut_off || '-'],
                      ['Status', selectedInvoice.status || '-'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Prioritas</span>
                      <span className={`badge ${getPriorityBadgeClass(selectedInvoice.priority)}`}>
                        {selectedInvoice.priority || '-'}
                      </span>
                    </div>
                  </div>
                )}

                <button className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={!selectedInvoiceId || isLoading}
                  style={{ marginTop: 4 }}>
                  {isLoading ? (
                    <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Memproses Knowledge Trace...</>
                  ) : <><Zap size={16} /> 🚀 Generate Priority Recommendation</>}
                </button>

                {error && (
                  <div className="alert alert-danger" style={{ marginTop: 4 }}>
                    <AlertTriangle size={16} />
                    <div>{error}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Result */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!result ? (
                <div className="card" style={{ flex: 1 }}>
                  <div className="empty-state">
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🎯</div>
                    <div className="empty-title">Siap Menganalisis</div>
                    <div className="empty-desc">
                      Pilih invoice dari daftar, lalu generate priority recommendation untuk melihat operational evidence dan delivery context
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Panel 1: Priority Recommendation Evidence */}
                  <div className="recommendation-result">
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Priority Recommendation Evidence
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div className="evidence-display">
                          <span className="evidence-value">{(result.recommendation?.evidence_level ?? result.evidence_level ?? 0).toFixed(2)}</span>
                          <span className="evidence-max">/ 1.00</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(() => {
                          const conf = getConfidenceBadge(result.recommendation?.confidence || result.confidence);
                          return (
                            <span className={`confidence-badge ${conf.cls}`}>
                              <Star size={10} /> Confidence: {conf.label}
                            </span>
                          );
                        })()}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 300 }}>
                          {result.recommendation?.confidence_explanation || result.confidence_explanation || 'Evidence generated from operational attributes, rule evidence, and decision tree reconstruction.'}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Evidence Progress</div>
                      <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-fill" style={{
                          width: `${(result.recommendation?.evidence_level ?? result.evidence_level ?? 0) * 100}%`,
                          background: (result.recommendation?.evidence_level ?? result.evidence_level ?? 0) >= 0.7
                            ? 'var(--priority-low)' : (result.recommendation?.evidence_level ?? result.evidence_level ?? 0) >= 0.4
                              ? 'var(--priority-medium)' : 'var(--priority-high)'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Delivery Recommendation */}
                  <div className="card">
                    <div className="section-title" style={{ marginBottom: 16 }}>Rekomendasi Pengiriman</div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                      {(() => {
                        const dBadge = getDeliveryBadge(result.recommendation?.delivery_day || result.delivery_day);
                        return (
                          <span className={`delivery-badge ${dBadge.cls}`} style={{ fontSize: '1rem', padding: '10px 20px' }}>
                            {dBadge.label}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="estimation-card">
                      <Clock size={24} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Estimasi Waktu Pengiriman
                        </div>
                        <div className="estimation-time">
                          {formatEstTime(result.recommendation?.estimated_delivery_time || result.estimated_delivery_time)}
                        </div>
                      </div>
                    </div>

                    {(result.recommendation?.estimation_breakdown || result.estimation_breakdown) && (
                      <div className="estimation-breakdown" style={{ marginTop: 12 }}>
                        {Object.entries(result.recommendation?.estimation_breakdown || result.estimation_breakdown || {}).map(([key, val]) => (
                          <div className="estimation-item" key={key}>
                            <span className="label">{key.replace(/_/g, ' ')}:</span>
                            <span className="value">{typeof val === 'number' ? val.toFixed(1) : val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Panel 3: Delivery Context */}
                  {(result.deliveryContexts || result.delivery_contexts) && (
                    <div className="card">
                      <div className="section-title" style={{ marginBottom: 4 }}>
                        <Trophy size={16} style={{ color: 'var(--primary-light)' }} /> Delivery Context (Top 3)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        Delivery actors displayed as supporting context for operational execution.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(result.deliveryContexts || result.delivery_contexts || []).slice(0, 3).map((driver, i) => (
                          <div className={`delivery-context-card ${i === 0 ? 'primary-context' : ''}`} key={i}>
                            <div className={`context-badge ${contextClass[i]}`}>{contextEmoji[i]}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                    {driver.driver_name || driver.driverName || `Driver ${i + 1}`}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={11} /> {driver.area || '-'}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-light)', fontSize: '1rem' }}>
                                    {(driver.evidence_level ?? driver.score ?? 0).toFixed(3)}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <Clock size={10} /> {formatEstTime(driver.estimated_time || driver.estimatedTime)}
                                  </div>
                                </div>
                              </div>
                              <div className="progress-bar" style={{ height: 4 }}>
                                <div className="progress-fill" style={{
                                  width: `${(driver.evidence_level ?? driver.score ?? 0) * 100}%`,
                                  background: i === 0 ? 'var(--primary-light)' : i === 1 ? 'var(--text-secondary)' : '#b4824f'
                                }} />
                              </div>
                              <div style={{ marginTop: 6 }}>
                                {driver.eligible !== false ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--priority-low)' }}>
                                    <CheckCircle2 size={11} /> Eligible
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--priority-medium)' }}>
                                    <AlertTriangle size={11} /> {driver.constraint_note || 'Kendala beban kerja'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Panel 4: Rule Evidence Breakdown */}
                  {(result.evidenceBreakdown || result.evidence_breakdown) && (
                    <div className="card">
                      <div className="section-title" style={{ marginBottom: 16 }}>
                        <BarChart2 size={16} style={{ color: 'var(--primary-light)' }} /> Rule Evidence Breakdown
                      </div>
                      <div className="evidence-breakdown">
                        {Object.entries(result.evidenceBreakdown || result.evidence_breakdown || {}).map(([key, data]) => {
                          const attribute = attributeLabels[key] || { label: key, evidence: '-', color: '#6366f1', colorEnd: '#818cf8' };
                          const rawEvidence = typeof data === 'object' ? (data.raw ?? data.raw_score ?? 0) : data;
                          const formalizedEvidence = typeof data === 'object'
                            ? (data[formalizedEvidenceKey] ?? data[formalizedEvidenceScoreKey] ?? 0)
                            : data;
                          return (
                            <div className="evidence-bar-item" key={key}>
                              <div className="evidence-bar-header">
                                <span className="label">{attribute.label} ({attribute.evidence})</span>
                                <span className="value" style={{ color: attribute.color }}>
                                  {typeof rawEvidence === 'number' ? rawEvidence.toFixed(2) : rawEvidence} → {typeof formalizedEvidence === 'number' ? formalizedEvidence.toFixed(3) : formalizedEvidence}
                                </span>
                              </div>
                              <div className="evidence-bar-track">
                                <div className="evidence-bar-fill" style={{
                                  width: `${(typeof rawEvidence === 'number' ? rawEvidence : 0) * 100}%`,
                                  '--bar-color': attribute.color,
                                  '--bar-color-end': attribute.colorEnd
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Panel 5: Explanation */}
                  {(result.explanation || result.recommendation?.explanation) && (
                    <div className="card">
                      <div className="section-title" style={{ marginBottom: 12 }}>
                        <Info size={16} style={{ color: 'var(--primary-light)' }} /> Penjelasan Rekomendasi
                      </div>

                      {(result.explanation?.reason || result.recommendation?.explanation?.reason) && (
                        <div className="alert alert-info" style={{ marginBottom: 12 }}>
                          <Lightbulb size={16} />
                          <div>
                            <strong>Alasan Utama:</strong> {result.explanation?.reason || result.recommendation?.explanation?.reason}
                          </div>
                        </div>
                      )}

                      {(result.explanation?.summary || result.recommendation?.explanation?.summary) && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                          {result.explanation?.summary || result.recommendation?.explanation?.summary}
                        </div>
                      )}

                      {(result.explanation?.factors || result.recommendation?.explanation?.factors) && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Faktor Pertimbangan:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(result.explanation?.factors || result.recommendation?.explanation?.factors || []).map((factor, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px',
                                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                fontSize: '0.8rem', color: 'var(--text-secondary)'
                              }}>
                                <CheckCircle2 size={14} style={{ color: 'var(--priority-low)', flexShrink: 0, marginTop: 2 }} />
                                <span>{typeof factor === 'string' ? factor : factor.description || factor.text || JSON.stringify(factor)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(result.explanation?.operational_notes || result.recommendation?.explanation?.operational_notes) && (
                        <div className="alert alert-warning" style={{ marginTop: 8 }}>
                          <AlertTriangle size={16} />
                          <div>
                            <strong>Catatan Operasional:</strong>{' '}
                            {Array.isArray(result.explanation?.operational_notes || result.recommendation?.explanation?.operational_notes)
                              ? (result.explanation?.operational_notes || result.recommendation?.explanation?.operational_notes).join('; ')
                              : (result.explanation?.operational_notes || result.recommendation?.explanation?.operational_notes)
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ Tab: History ══════════════════ */}
        {tab === 'history' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 20px 0' }}>
              <div className="section-header">
                <div>
                  <div className="section-title">Priority Recommendation History</div>
                  <div className="section-subtitle">Total: {history.length} priority recommendations</div>
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                <div className="empty-title">Belum Ada Riwayat</div>
                <div className="empty-desc">
                  Buat priority recommendation pertama untuk melihat riwayat di sini.
                </div>
              </div>
            ) : (
              <div className="table-wrapper" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Area</th>
                      <th>Delivery Context</th>
                      <th>Operational Evidence</th>
                      <th>Confidence</th>
                      <th>Hari Kirim</th>
                      <th>Waktu Estimasi</th>
                      <th>Tanggal</th>
                      <th>Feedback</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => {
                      const confBadge = getConfidenceBadge(h.recommendationConfidence || h.recommendation_confidence || h.confidence);
                      const delBadge = getDeliveryBadge(h.recommendedDeliveryDay || h.recommended_delivery_day || h.delivery_day);
                      return (
                        <tr key={h.id || i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{i + 1}</td>
                          <td><span className="invoice-no">{h.invoiceNo || h.invoice_no || '-'}</span></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{h.namaCustomer || h.nama_customer || '-'}</td>
                          <td style={{ fontSize: '0.8rem' }}>{h.areaPengantaran || h.area_pengantaran || '-'}</td>
                          <td style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {h.recommendedDriver || h.recommended_driver || '-'}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.85rem' }}>
                              {(h.recommendationScore ?? h.recommendation_score ?? 0).toFixed(3)}
                            </span>
                          </td>
                          <td><span className={`confidence-badge ${confBadge.cls}`}>{confBadge.label}</span></td>
                          <td><span className={`delivery-badge ${delBadge.cls}`} style={{ fontSize: '0.7rem', padding: '4px 10px' }}>{delBadge.label}</span></td>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                            {formatEstTime(h.estimatedDeliveryMinutes || h.estimated_delivery_minutes)}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatDate(h.createdAt || h.created_at)}
                          </td>
                          <td>
                            {(h.recommendationAccepted === true || h.recommendation_accepted === true) ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--priority-low)', fontSize: '0.8rem', fontWeight: 600 }}>
                                <CheckCircle2 size={14} /> Diterima
                              </span>
                            ) : (h.recommendationAccepted === false || h.recommendation_accepted === false) ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--priority-high)', fontSize: '0.8rem', fontWeight: 600 }}>
                                <XCircle size={14} /> Ditolak
                              </span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                <Clock size={14} /> Belum ada
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm"
                                onClick={() => { setFeedbackModal(h.id); setFeedbackForm({ recommendation_accepted: null, actual_delivery_time: '', delivery_success: null, feedback_notes: '' }); }}
                                style={{ padding: '5px 10px', fontSize: '0.75rem' }}>
                                <Star size={12} /> Feedback
                              </button>
                              <button className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(h.id)}
                                style={{ padding: '5px 8px', fontSize: '0.75rem' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ Tab: Methodology ══════════════════ */}
        {tab === 'methodology' && (
          <div>
            {/* Operational Knowledge Description */}
            <div className="methodology-card">
              <h3><Lightbulb size={18} style={{ color: 'var(--primary-light)' }} /> Operational Knowledge Formalization Framework</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Framework ini memformalkan pengetahuan operasional pengiriman invoice menjadi guideline,
                rule evidence, decision tree reconstruction, dan priority recommendation yang dapat ditelusuri.
                Fokus sistem adalah menjelaskan alasan operasional di balik prioritas, bukan menampilkan simulasi metode lama.
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 12 }}>
                Alur penelitian berjalan dari <strong>Knowledge Acquisition</strong>, <strong>Knowledge Formalization</strong>,
                <strong> Operational Labeling Guideline</strong>, <strong>Rule-Based Representation</strong>,
                <strong> Decision Tree Reconstruction</strong>, hingga <strong>Priority Recommendation</strong>
                yang terhubung dengan Invoice Tracking dan Proof of Delivery.
              </p>
            </div>

            {/* Operational Attributes Table */}
            <div className="methodology-card">
              <h3><BarChart2 size={18} style={{ color: 'var(--primary-light)' }} /> Operational Attributes and Evidence</h3>
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Operational Attribute</th>
                      <th>Keterangan</th>
                      <th>Knowledge Role</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['A1', 'Priority Label', 'Label operasional Tinggi, Sedang, atau Rendah', 'Operational Labeling Guideline', 'Priority'],
                      ['A2', 'Receive Schedule', 'Jadwal penerimaan pelanggan', 'Knowledge Acquisition', 'Schedule Evidence'],
                      ['A3', 'Cutoff Policy', 'Batas waktu penerimaan dokumen', 'Rule-Based Representation', 'Rule Evidence'],
                      ['A4', 'Delivery Context', 'Driver, area, workload, dan konteks pengiriman', 'Invoice Tracking', 'Delivery Context'],
                      ['A5', 'POD Context', 'Status penerimaan dan bukti pengiriman', 'Proof of Delivery', 'POD Evidence'],
                    ].map(([no, name, desc, role, output], i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-light)' }}>{no}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</td>
                        <td style={{ fontSize: '0.8rem' }}>{desc}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{role}</td>
                        <td>
                          <span className="badge badge-low">{output}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operational Knowledge Flow */}
            <div className="methodology-card">
              <h3><TrendingUp size={18} style={{ color: 'var(--primary-light)' }} /> Operational Knowledge Flow</h3>
              <div className="formula-box">
                Knowledge Acquisition → Knowledge Formalization → Rule Evidence → Decision Tree Reconstruction → Priority Recommendation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {[
                  ['KA', 'Knowledge Acquisition dari invoice, customer, driver, jadwal, dan cutoff'],
                  ['KF', 'Knowledge Formalization menjadi operational attributes'],
                  ['RB', 'Rule-Based Representation menghasilkan activated rule dan evidence'],
                  ['DT', 'Decision Tree Reconstruction menghasilkan path, confidence, dan recommendation'],
                ].map(([sym, desc]) => (
                  <div key={sym} style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.85rem' }}>{sym}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 8 }}>= {desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Formalization */}
            <div className="methodology-card">
              <h3><Zap size={18} style={{ color: 'var(--primary-light)' }} /> Knowledge Formalization</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 16, background: 'var(--priority-low-bg)', border: '1px solid var(--priority-low-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--priority-low)', marginBottom: 6, fontSize: '0.85rem' }}>
                    Rule-Based Representation
                  </div>
                  <div className="formula-box" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'var(--priority-low-border)', fontSize: '0.95rem' }}>
                    IF operational conditions THEN priority label
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                    Menghubungkan receive schedule, cutoff policy, area, dan delivery context ke activated rule.
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--priority-high-bg)', border: '1px solid var(--priority-high-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--priority-high)', marginBottom: 6, fontSize: '0.85rem' }}>
                    Decision Tree Reconstruction
                  </div>
                  <div className="formula-box" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'var(--priority-high-border)', fontSize: '0.95rem' }}>
                    Node Path → Leaf Decision → Priority Recommendation
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                    Menampilkan traversal model, final recommendation, dan confidence untuk setiap invoice.
                  </div>
                </div>
              </div>
            </div>

            {/* Value Mapping Tables */}
            <div className="methodology-card">
              <h3><Info size={18} style={{ color: 'var(--primary-light)' }} /> Tabel Pemetaan Nilai</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Priority Mapping */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.85rem' }}>Prioritas Invoice</div>
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead><tr><th>Prioritas</th><th>Nilai</th></tr></thead>
                      <tbody>
                        {[['Tinggi', '1.00'], ['Sedang', '0.60'], ['Rendah', '0.30']].map(([p, v]) => (
                          <tr key={p}>
                            <td><span className={`badge ${getPriorityBadgeClass(p)}`}>{p}</span></td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cutoff Mapping */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.85rem' }}>Urgensi Cut-off</div>
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead><tr><th>Sisa Waktu</th><th>Nilai</th></tr></thead>
                      <tbody>
                        {[['≤ 2 jam', '1.00'], ['2–4 jam', '0.75'], ['4–6 jam', '0.50'], ['> 6 jam', '0.25']].map(([t, v]) => (
                          <tr key={t}>
                            <td style={{ fontSize: '0.8rem' }}>{t}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Area Mapping */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.85rem' }}>Kecocokan Area</div>
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead><tr><th>Kondisi</th><th>Nilai</th></tr></thead>
                      <tbody>
                        {[['Area sama persis', '1.00'], ['Area berdekatan', '0.60'], ['Area berbeda', '0.20']].map(([c, v]) => (
                          <tr key={c}>
                            <td style={{ fontSize: '0.8rem' }}>{c}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Schedule Mapping */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, fontSize: '0.85rem' }}>Kecocokan Jadwal</div>
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead><tr><th>Kondisi</th><th>Nilai</th></tr></thead>
                      <tbody>
                        {[['Jadwal cocok hari ini', '1.00'], ['Jadwal cocok besok', '0.60'], ['Jadwal tidak cocok', '0.20']].map(([c, v]) => (
                          <tr key={c}>
                            <td style={{ fontSize: '0.8rem' }}>{c}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Day Rules */}
            <div className="methodology-card">
              <h3><Truck size={18} style={{ color: 'var(--primary-light)' }} /> Operational Priority Guideline</h3>
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Priority Level</th>
                      <th>Recommended Action</th>
                      <th>Operational Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Tinggi', 'Kirim Hari Ini', 'Cutoff dan jadwal membutuhkan prioritas eksekusi segera', 'today'],
                      ['Sedang', 'Kirim Besok', 'Operational evidence mendukung persiapan pengiriman terencana', 'tomorrow'],
                      ['Rendah', 'Jadwalkan Ulang', 'Operational evidence membutuhkan penjadwalan atau verifikasi tambahan', 'reschedule'],
                    ].map(([level, rec, desc, cls]) => (
                      <tr key={level}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-light)' }}>{level}</td>
                        <td><span className={`delivery-badge ${cls}`}>{rec}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Research Contribution */}
            <div className="methodology-card" style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04))',
              borderColor: 'var(--border-accent)'
            }}>
              <h3><Star size={18} style={{ color: 'var(--primary-light)' }} /> Kontribusi Penelitian: Operational Knowledge Formalization Framework</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Sistem ini mengimplementasikan framework penelitian yang memformalkan pengetahuan operasional menjadi
                evidence, rule activation, decision path, dan rekomendasi prioritas.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <div style={{
                  padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--priority-medium)' }} />
                  <div style={{ fontWeight: 700, color: 'var(--priority-medium)', fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🌳 Decision Tree Reconstruction
                  </div>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: 16, lineHeight: 1.8 }}>
                    <li>Rekonstruksi path keputusan</li>
                    <li>Node traversal dan final recommendation</li>
                    <li>Input: operational attributes</li>
                    <li>Output: priority label dan confidence</li>
                  </ul>
                </div>
                <div style={{
                  padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--primary-light)' }} />
                  <div style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🎯 Rule Evidence and Priority Recommendation
                  </div>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: 16, lineHeight: 1.8 }}>
                    <li>Operational labeling guideline</li>
                    <li>Rule ID dan activated conditions</li>
                    <li>Input: receive schedule, cutoff, delivery context</li>
                    <li>Output: priority recommendation dan POD handoff</li>
                  </ul>
                </div>
              </div>
              <div style={{
                marginTop: 16, padding: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6
              }}>
                <strong style={{ color: 'var(--primary-light)' }}>Alur Kerja:</strong> Operational attributes diformalisasi
                menjadi guideline, rule evidence, decision tree path, priority recommendation, dan lifecycle Invoice Tracking & POD.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════ Feedback Modal ══════════════════ */}
      {feedbackModal && (
        <div className="feedback-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setFeedbackModal(null); }}>
          <div className="feedback-modal">
            <h3>📝 Feedback Rekomendasi</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Accepted? */}
              <div className="form-group">
                <label className="form-label">Apakah rekomendasi diterima?</label>
                <div className="radio-group">
                  <label className={`radio-option ${feedbackForm.recommendation_accepted === true ? 'selected' : ''}`}>
                    <input type="radio" name="accepted" checked={feedbackForm.recommendation_accepted === true}
                      onChange={() => setFeedbackForm(p => ({ ...p, recommendation_accepted: true }))} />
                    <CheckCircle2 size={14} /> Ya
                  </label>
                  <label className={`radio-option ${feedbackForm.recommendation_accepted === false ? 'selected' : ''}`}>
                    <input type="radio" name="accepted" checked={feedbackForm.recommendation_accepted === false}
                      onChange={() => setFeedbackForm(p => ({ ...p, recommendation_accepted: false }))} />
                    <XCircle size={14} /> Tidak
                  </label>
                </div>
              </div>

              {/* Actual delivery time */}
              <div className="form-group">
                <label className="form-label">Waktu pengiriman aktual (menit)</label>
                <input type="number" className="form-input" placeholder="Contoh: 135"
                  value={feedbackForm.actual_delivery_time}
                  onChange={e => setFeedbackForm(p => ({ ...p, actual_delivery_time: e.target.value }))} />
              </div>

              {/* Delivery success? */}
              <div className="form-group">
                <label className="form-label">Pengiriman berhasil?</label>
                <div className="radio-group">
                  <label className={`radio-option ${feedbackForm.delivery_success === true ? 'selected' : ''}`}>
                    <input type="radio" name="success" checked={feedbackForm.delivery_success === true}
                      onChange={() => setFeedbackForm(p => ({ ...p, delivery_success: true }))} />
                    <CheckCircle2 size={14} /> Ya
                  </label>
                  <label className={`radio-option ${feedbackForm.delivery_success === false ? 'selected' : ''}`}>
                    <input type="radio" name="success" checked={feedbackForm.delivery_success === false}
                      onChange={() => setFeedbackForm(p => ({ ...p, delivery_success: false }))} />
                    <XCircle size={14} /> Tidak
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <textarea className="form-textarea" placeholder="Catatan tambahan mengenai rekomendasi ini..."
                  value={feedbackForm.feedback_notes}
                  onChange={e => setFeedbackForm(p => ({ ...p, feedback_notes: e.target.value }))} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setFeedbackModal(null)}>
                  Batal
                </button>
                <button className="btn btn-primary" onClick={handleSubmitFeedback}
                  disabled={feedbackForm.recommendation_accepted === null}>
                  <CheckCircle2 size={14} /> Simpan Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
