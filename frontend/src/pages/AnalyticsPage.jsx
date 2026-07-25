import {
  BarChart2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Scale,
  ShieldCheck,
} from 'lucide-react';

const RESULT_CARDS = [
  {
    label: 'Rule-Based Accuracy',
    value: '93.94%',
    detail: 'Rule-Based Classification',
    icon: ClipboardList,
    color: '#60a5fa',
    bg: 'rgba(37,99,235,0.12)',
  },
  {
    label: 'Decision Tree Accuracy',
    value: '97.98%',
    detail: 'Decision Tree Classification',
    icon: BarChart2,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.14)',
  },
  {
    label: 'Exact McNemar',
    value: 'p = 0.2891',
    detail: 'Statistical Test',
    icon: Scale,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)',
  },
];

const DATASET_CARDS = [
  ['99', 'Unique Invoices', FileText],
  ['30', 'Urgent', ShieldCheck],
  ['69', 'Not Urgent', CheckCircle2],
  ['expert_label', 'Ground Truth', Database],
];

const METHOD_ROWS = [
  ['Ground Truth', 'Historical Admin Labels (expert_label)'],
  ['Rule-Based Model', 'Rule-Based R1-R8'],
  ['Decision Tree Model', 'Entropy-based Decision Tree'],
  ['Primary Evaluation', 'Leave-One-Out Cross Validation (LOOCV)'],
  ['Interpretation', 'There is no statistically significant difference between the two methods at common significance levels.'],
];

export default function AnalyticsPage() {
  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Research Results</h1>
          <p>Final thesis results prepared for live defense</p>
        </div>
      </header>

      <div className="page-container" style={{ display: 'grid', gap: 24 }}>
        <section className="card">
          <div className="section-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="section-title">Final Evaluation Results</div>
              <div className="section-subtitle">Frozen values from the final undergraduate thesis</div>
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {RESULT_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div className="stat-card default" key={card.label}>
                  <div className="stat-header">
                    <div className="stat-icon-wrap" style={{ '--icon-bg': card.bg, '--icon-color': card.color }}>
                      <Icon size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={card.value.length > 8 ? { fontSize: '1.45rem' } : undefined}>
                    {card.value}
                  </div>
                  <div className="stat-label">{card.label}</div>
                  <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {card.detail}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <section className="card">
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="section-title">Dataset</div>
                <div className="section-subtitle">Final research dataset used for evaluation</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {DATASET_CARDS.map(([value, label, Icon]) => (
                <div
                  key={label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    padding: 14,
                  }}
                >
                  <div className="stat-icon-wrap" style={{ '--icon-bg': 'rgba(37,99,235,0.12)', '--icon-color': 'var(--primary)' }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: value === 'expert_label' ? '1.15rem' : '1.7rem', fontWeight: 900, marginTop: 12 }}>
                    {value}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="section-title">Research Conclusion</div>
                <div className="section-subtitle">How the results should be presented during defense</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {METHOD_ROWS.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-input)',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{label}</span>
                  <strong style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: 360 }}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
