import {
  BarChart2,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';

const DATASET_SUMMARY = [
  {
    label: 'Dataset',
    value: '99',
    detail: 'Unique Invoices',
    icon: FileText,
    color: '#60a5fa',
    bg: 'rgba(37,99,235,0.12)',
  },
  {
    label: 'Ground Truth',
    value: 'expert_label',
    detail: 'Historical Admin Labels',
    icon: Database,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)',
  },
  {
    label: 'Urgent',
    value: '30',
    detail: 'Invoices',
    icon: ShieldCheck,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.14)',
  },
  {
    label: 'Not Urgent',
    value: '69',
    detail: 'Invoices',
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.14)',
  },
];

const EVALUATION_METHODS = [
  {
    title: 'Stratified Hold-out',
    body: 'Used as an evaluation view that preserves the class distribution between training and testing data.',
  },
  {
    title: '5-Fold Cross Validation',
    body: 'Used to observe method performance across repeated training and validation folds.',
  },
  {
    title: 'Leave-One-Out Cross Validation (LOOCV)',
    body: 'Used as the primary final evaluation reported in the thesis.',
    primary: true,
  },
];

const PERFORMANCE_RESULTS = [
  {
    method: 'Rule-Based Classification',
    label: 'Rule-Based',
    accuracy: '93.94%',
    width: '93.94%',
    icon: ClipboardList,
    color: '#60a5fa',
  },
  {
    method: 'Decision Tree Classification',
    label: 'Decision Tree',
    accuracy: '97.98%',
    width: '97.98%',
    icon: BarChart2,
    color: '#10b981',
  },
];

const panelStyle = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-input)',
};

const iconWrapBase = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export default function ResearchShowcasePage() {
  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Comparative Analysis</h1>
          <p>Rule-Based Classification and Decision Tree Classification evaluation</p>
        </div>
      </header>

      <div className="page-container" style={{ display: 'grid', gap: 24 }}>
        <DatasetSummary />
        <EvaluationMethod />
        <PerformanceComparison />
        <StatisticalTest />
      </div>
    </div>
  );
}

function DatasetSummary() {
  return (
    <section className="card">
      <SectionHeading
        icon={Database}
        title="Dataset Summary"
        subtitle="Final thesis dataset and ground truth definition."
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {DATASET_SUMMARY.map((item) => {
          const Icon = item.icon;
          return (
            <div className="stat-card default" key={item.label}>
              <div className="stat-header">
                <div className="stat-icon-wrap" style={{ '--icon-bg': item.bg, '--icon-color': item.color }}>
                  <Icon size={20} />
                </div>
              </div>
              <div
                className="stat-value"
                style={item.value === 'expert_label' ? { fontSize: '1.35rem' } : undefined}
              >
                {item.value}
              </div>
              <div className="stat-label">{item.label}</div>
              <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {item.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...panelStyle, padding: 16, marginTop: 18 }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: 6 }}>
          Ground Truth: Historical Admin Labels (expert_label)
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          The final evaluation uses historical admin labels as the reference class for invoice priority classification.
        </div>
      </div>
    </section>
  );
}

function EvaluationMethod() {
  return (
    <section className="card">
      <SectionHeading
        icon={Target}
        title="Evaluation Method"
        subtitle="Evaluation approaches documented in the final thesis."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {EVALUATION_METHODS.map((method) => (
          <div
            key={method.title}
            style={{
              ...panelStyle,
              padding: 16,
              borderColor: method.primary ? 'var(--border-accent)' : 'var(--border)',
              background: method.primary ? 'rgba(37,99,235,0.08)' : 'var(--bg-input)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{method.title}</div>
              {method.primary && <span className="tag">Primary</span>}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              {method.body}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformanceComparison() {
  return (
    <section className="card">
      <SectionHeading
        icon={BarChart2}
        title="Performance Comparison"
        subtitle="Finalized accuracy values from the thesis."
      />

      <div style={{ display: 'grid', gap: 16 }}>
        {PERFORMANCE_RESULTS.map((result) => {
          const Icon = result.icon;
          return (
            <div key={result.method} style={{ ...panelStyle, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ ...iconWrapBase, background: 'rgba(37,99,235,0.1)', color: result.color }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{result.method}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>Accuracy</div>
                  </div>
                </div>
                <div style={{ color: result.color, fontSize: '1.6rem', fontWeight: 900 }}>
                  {result.accuracy}
                </div>
              </div>

              <div className="progress-bar" style={{ height: 12 }}>
                <div
                  className="progress-fill"
                  style={{ width: result.width, background: result.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatisticalTest() {
  return (
    <section className="card">
      <SectionHeading
        icon={Scale}
        title="Statistical Test"
        subtitle="Final hypothesis test result reported in the thesis."
      />

      <div style={{
        ...panelStyle,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 18,
        alignItems: 'center',
      }}>
        <div>
          <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 900, marginBottom: 6 }}>
            Exact McNemar Test
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.65 }}>
            There is no statistically significant difference between the two methods at common significance levels.
          </div>
        </div>
        <div style={{
          minWidth: 140,
          textAlign: 'center',
          padding: '16px 18px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(245,158,11,0.14)',
          color: '#f59e0b',
          fontWeight: 900,
          fontSize: '1.35rem',
        }}>
          p = 0.2891
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="section-header" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ ...iconWrapBase, background: 'rgba(37,99,235,0.1)', color: 'var(--primary)' }}>
          <Icon size={18} />
        </div>
        <div>
          <div className="section-title">{title}</div>
          <div className="section-subtitle">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
