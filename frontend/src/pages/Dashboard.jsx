import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  BarChart2, Brain, CheckCircle2, ClipboardList,
  Database, FileText, Scale, ShieldCheck
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const DATASET_DISTRIBUTION = [
  { name: 'Urgent', invoices: 30, color: '#ef4444' },
  { name: 'Not Urgent', invoices: 69, color: '#10b981' },
];

const ACCURACY_COMPARISON = [
  { method: 'Rule-Based', accuracy: 93.94, color: '#2563eb' },
  { method: 'Decision Tree', accuracy: 97.98, color: '#10b981' },
];

const SUMMARY_CARDS = [
  {
    label: 'Dataset',
    value: '99',
    detail: 'Unique Invoices',
    icon: FileText,
    tone: 'default',
    bg: 'rgba(37,99,235,0.12)',
    color: '#60a5fa'
  },
  {
    label: 'Urgent',
    value: '30',
    detail: 'Ground Truth Class',
    icon: ShieldCheck,
    tone: 'high',
    bg: 'rgba(239,68,68,0.14)',
    color: '#ef4444'
  },
  {
    label: 'Not Urgent',
    value: '69',
    detail: 'Ground Truth Class',
    icon: CheckCircle2,
    tone: 'low',
    bg: 'rgba(16,185,129,0.14)',
    color: '#10b981'
  },
  {
    label: 'Ground Truth',
    value: 'expert_label',
    detail: 'Historical Admin Labels',
    icon: Database,
    tone: 'medium',
    bg: 'rgba(245,158,11,0.14)',
    color: '#f59e0b'
  },
];

const RESEARCH_FACTS = [
  ['Research Contribution', 'Comparative Analysis'],
  ['Method 1', 'Rule-Based Classification'],
  ['Method 2', 'Decision Tree Classification'],
  ['Rule-Based Model', 'Rule-Based R1-R8'],
  ['Decision Tree Model', 'Entropy-based Decision Tree'],
  ['Evaluation Method', 'LOOCV'],
];

const RESULT_METRICS = [
  {
    label: 'Rule-Based Accuracy',
    value: '93.94%',
    icon: ClipboardList,
    color: '#60a5fa',
    bg: 'rgba(37,99,235,0.12)'
  },
  {
    label: 'Decision Tree Accuracy',
    value: '97.98%',
    icon: Brain,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.14)'
  },
  {
    label: 'Exact McNemar',
    value: 'p = 0.2891',
    icon: Scale,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.14)'
  },
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontSize: '0.8rem'
    }}>
      {label && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
          {label}
        </p>
      )}
      {payload.map((item, index) => (
        <p key={index} style={{ color: item.color || item.payload?.color, marginBottom: 2 }}>
          {item.name}: <strong>{item.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Research Summary</h1>
          <p>Comparative Analysis for Invoice Priority Classification</p>
        </div>

        <div className="topbar-actions">
          <NavLink to="/research-showcase" className="btn btn-primary btn-sm">
            <BarChart2 size={15} /> Comparative Analysis
          </NavLink>
        </div>
      </header>

      <div className="page-container">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {SUMMARY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div className={`stat-card ${card.tone}`} key={card.label}>
                <div className="stat-header">
                  <div className="stat-icon-wrap" style={{ '--icon-bg': card.bg, '--icon-color': card.color }}>
                    <Icon size={20} />
                  </div>
                </div>
                <div
                  className="stat-value"
                  style={card.value === 'expert_label' ? { fontSize: '1.35rem' } : undefined}
                >
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

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Final Thesis Position</div>
                <div className="section-subtitle">Research contribution and evaluation setup</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RESEARCH_FACTS.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '12px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</span>
                  <strong style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Dataset Distribution</div>
                <div className="section-subtitle">99 Unique Invoices with Ground Truth (expert_label)</div>
              </div>
            </div>

            <div className="chart-container" style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DATASET_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={4}
                    dataKey="invoices"
                    nameKey="name"
                    label={({ name, invoices }) => `${name}: ${invoices}`}
                    labelLine={false}
                  >
                    {DATASET_DISTRIBUTION.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} opacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Evaluation Accuracy</div>
                <div className="section-subtitle">LOOCV results from finalized thesis dataset</div>
              </div>
            </div>

            <div className="chart-container" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ACCURACY_COMPARISON} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="method" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[80, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="accuracy" name="Accuracy (%)" radius={[6, 6, 0, 0]}>
                    {ACCURACY_COMPARISON.map((entry) => (
                      <Cell key={entry.method} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Research Results</div>
                <div className="section-subtitle">Final values for thesis defense</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {RESULT_METRICS.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div className="stat-icon-wrap" style={{ '--icon-bg': metric.bg, '--icon-color': metric.color }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 4 }}>
                        {metric.label}
                      </div>
                      <div style={{ color: metric.color, fontWeight: 800, fontSize: '1.4rem' }}>
                        {metric.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="divider" />

            <div style={{
              padding: '14px 16px',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              lineHeight: 1.6
            }}>
              Decision Tree Classification achieved the higher LOOCV accuracy, while the Exact McNemar result is p = 0.2891.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
