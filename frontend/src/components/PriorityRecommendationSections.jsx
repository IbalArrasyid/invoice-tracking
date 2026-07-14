import {
  Activity,
  ArrowDown,
  BadgeCheck,
  Brain,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Info,
  MapPinned,
  Route,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { formatConfidence, toDisplayValue } from '../utils/priorityRecommendationAdapter';

const cardTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
};

const iconWrapStyle = {
  width: 34,
  height: 34,
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(37,99,235,0.1)',
  color: 'var(--primary)',
  flexShrink: 0,
};

const mutedTextStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
};

export function PrioritySummaryCards({ summary }) {
  const cards = [
    {
      label: 'Priority',
      value: summary.priority,
      tone: priorityTone(summary.priority),
      icon: <ShieldCheck size={20} />,
    },
    {
      label: 'Recommended Action',
      value: summary.action,
      tone: 'default',
      icon: <BadgeCheck size={20} />,
    },
    {
      label: 'Confidence',
      value: summary.confidenceScore ? formatConfidence(summary.confidenceScore) : summary.confidence,
      tone: confidenceTone(summary.confidence),
      icon: <Activity size={20} />,
    },
    {
      label: 'Status',
      value: summary.status,
      tone: statusTone(summary.status),
      icon: <CheckCircle2 size={20} />,
    },
  ];

  return (
    <section>
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-title">Priority Recommendation Summary</div>
          <div className="section-subtitle">Final priority action from the compatibility response</div>
        </div>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {cards.map((card) => (
          <div key={card.label} className={`stat-card ${card.tone}`}>
            <div className="stat-header">
              <div className="stat-icon-wrap" style={iconTone(card.tone)}>
                {card.icon}
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '1.35rem', lineHeight: 1.25 }}>
              {card.value || '-'}
            </div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function KnowledgeTraceTimeline({ trace }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><Brain size={18} /></div>
        <div>
          <div className="section-title">Knowledge Trace</div>
          <div className="section-subtitle">Operational knowledge path from acquisition to priority output</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {trace.map((item, index) => (
          <div key={`${item.id}-${item.stage}`}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '46px minmax(0, 1fr)',
              gap: 12,
              alignItems: 'start',
            }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '1px solid var(--border-accent)',
                background: 'rgba(37,99,235,0.08)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.78rem',
              }}>
                {index + 1}
              </div>
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                background: 'var(--bg-input)',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {item.stage}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {item.description || 'Trace captured.'}
                </div>
              </div>
            </div>
            {index < trace.length - 1 && (
              <div style={{ width: 38, display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                <ArrowDown size={16} color="var(--text-muted)" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function RuleEvidenceTable({ rows }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><ClipboardList size={18} /></div>
        <div>
          <div className="section-title">Rule Evidence</div>
          <div className="section-subtitle">Formalized operational evidence used by the priority recommendation</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule ID</th>
              <th>Rule Name</th>
              <th>Evidence</th>
              <th>Activated Conditions</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><span className="invoice-no">{row.id}</span></td>
                <td>{row.name}</td>
                <td>{row.evidence}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(row.conditions || []).map((condition) => (
                      <span key={condition} className="tag">{condition}</span>
                    ))}
                  </div>
                </td>
                <td style={{ maxWidth: 320 }}>{row.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DecisionTreeReconstruction({ decisionPath, decisionTreeResult, summary }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><GitBranch size={18} /></div>
        <div>
          <div className="section-title">Decision Tree Reconstruction</div>
          <div className="section-subtitle">Reconstructed node traversal and final decision</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {decisionPath.map((step, index) => (
            <div key={`${step.node}-${index}`} style={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr)',
              gap: 10,
              alignItems: 'start',
            }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: index === decisionPath.length - 1 ? 'var(--primary)' : 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: index === decisionPath.length - 1 ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}>
                {index + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{step.node}</div>
                <div style={mutedTextStyle}>{step.fact}</div>
                <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{step.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
          background: 'var(--bg-input)',
          alignSelf: 'start',
        }}>
          <div style={mutedTextStyle}>Final Recommendation</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: 4 }}>{summary.action || '-'}</div>
          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
          <div style={mutedTextStyle}>Confidence</div>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', marginTop: 4 }}>
            {formatConfidence(summary.confidenceScore || decisionTreeResult?.confidence)}
          </div>
          <div style={{ ...mutedTextStyle, marginTop: 12 }}>
            Source: {toDisplayValue(decisionTreeResult?.source)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DeliveryContextPanel({ delivery }) {
  const items = [
    { label: 'Customer', value: delivery.customer, icon: <Info size={16} /> },
    { label: 'Receive Schedule', value: delivery.receiveSchedule, icon: <Route size={16} /> },
    { label: 'Cutoff', value: delivery.cutoff, icon: <Activity size={16} /> },
    { label: 'Driver', value: delivery.driver, icon: <Truck size={16} /> },
    { label: 'POD Status', value: delivery.podStatus, icon: <MapPinned size={16} /> },
  ];

  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><Truck size={18} /></div>
        <div>
          <div className="section-title">Delivery Context</div>
          <div className="section-subtitle">Execution context attached to the priority recommendation</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {items.map((item) => (
          <div key={item.label} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            background: 'var(--bg-input)',
            minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: 8 }}>
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, overflowWrap: 'anywhere' }}>
              {item.value || '-'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PriorityExplanationPanel({ explanation }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><Info size={18} /></div>
        <div>
          <div className="section-title">Priority Explanation</div>
          <div className="section-subtitle">Natural-language reason for the recommendation</div>
        </div>
      </div>
      <div style={{
        borderLeft: '4px solid var(--primary)',
        background: 'rgba(37,99,235,0.06)',
        padding: 16,
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
        color: 'var(--text-secondary)',
        fontSize: '0.94rem',
      }}>
        {explanation || 'No explanation is available for this recommendation yet.'}
      </div>
    </section>
  );
}

function priorityTone(priority = '') {
  const value = String(priority).toLowerCase();
  if (value.includes('tinggi') || value.includes('high')) return 'high';
  if (value.includes('sedang') || value.includes('medium')) return 'medium';
  if (value.includes('rendah') || value.includes('low')) return 'low';
  return 'default';
}

function confidenceTone(confidence = '') {
  const value = String(confidence).toLowerCase();
  if (value.includes('high') || value.includes('tinggi')) return 'low';
  if (value.includes('low') || value.includes('rendah')) return 'high';
  return 'medium';
}

function statusTone(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('terkirim') || value.includes('completed')) return 'low';
  if (value.includes('kembali') || value.includes('exception')) return 'high';
  if (value.includes('pengiriman') || value.includes('delivery')) return 'default';
  return 'medium';
}

function iconTone(tone) {
  if (tone === 'high') return { '--icon-bg': 'rgba(220,38,38,0.12)', '--icon-color': 'var(--priority-high)' };
  if (tone === 'medium') return { '--icon-bg': 'rgba(245,158,11,0.14)', '--icon-color': 'var(--priority-medium)' };
  if (tone === 'low') return { '--icon-bg': 'rgba(22,163,74,0.12)', '--icon-color': 'var(--priority-low)' };
  return { '--icon-bg': 'rgba(37,99,235,0.12)', '--icon-color': 'var(--primary)' };
}
