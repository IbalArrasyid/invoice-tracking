import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileSignature,
  History,
  Route,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { workflowTone } from '../utils/recommendationWorkflowAdapter';

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

export function WorkflowStatusPanel({ workflow }) {
  if (!workflow) return null;

  const items = [
    { label: 'Current Workflow Status', value: workflow.currentStatus.label, detail: workflow.currentStatus.status, icon: <ShieldCheck size={17} /> },
    { label: 'Responsible User', value: workflow.currentStatus.responsibleUser, detail: 'Current owner', icon: <UserCheck size={17} /> },
    { label: 'Timestamp', value: workflow.currentStatus.timestampLabel, detail: 'Latest workflow evidence', icon: <CalendarClock size={17} /> },
    { label: 'Operational Notes', value: workflow.currentStatus.operationalNotes, detail: 'Execution context', icon: <ClipboardList size={17} /> },
  ];

  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><Route size={18} /></div>
        <div>
          <div className="section-title">Current Workflow Status</div>
          <div className="section-subtitle">Operational handoff from priority recommendation into invoice tracking and POD</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
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
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, overflowWrap: 'anywhere', lineHeight: 1.25 }}>
              {item.value || '-'}
            </div>
            <div style={{ ...mutedTextStyle, marginTop: 6 }}>{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecommendationLifecyclePanel({ lifecycle }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><CheckCircle2 size={18} /></div>
        <div>
          <div className="section-title">Recommendation Lifecycle</div>
          <div className="section-subtitle">Generated, accepted, assigned, dispatched, delivered, POD uploaded, and closed</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {lifecycle.map((item, index) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 10 }}>
            <div style={{ display: 'grid', justifyItems: 'center' }}>
              <StatusDot status={item.status} isCurrent={item.isCurrent} />
              {index < lifecycle.length - 1 && <div style={{ width: 1, minHeight: 28, background: 'var(--border)', marginTop: 6 }} />}
            </div>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '11px 12px',
              background: item.isCurrent ? 'rgba(37,99,235,0.06)' : 'var(--bg-input)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.label}</div>
                <StatusPill status={item.status} label={item.statusLabel} />
              </div>
              <div style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                <span>{item.responsibleUser}</span>
                <span>{item.timestampLabel}</span>
                <span>{item.operationalNotes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecommendationOutcomePanel({ outcome }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><FileSignature size={18} /></div>
        <div>
          <div className="section-title">Recommendation Outcome</div>
          <div className="section-subtitle">Operational result tracked after the priority decision</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {outcome.map((item) => (
          <div key={item.label} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            alignItems: 'start',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            background: 'var(--bg-input)',
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>{item.label}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 800, overflowWrap: 'anywhere' }}>{item.value || '-'}</span>
                <StatusPill status={item.tone} />
              </div>
              <div style={{ ...mutedTextStyle, marginTop: 5 }}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperationalTimelinePanel({ events }) {
  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><Route size={18} /></div>
        <div>
          <div className="section-title">Operational Timeline</div>
          <div className="section-subtitle">Priority generated, driver assigned, invoice sent, POD uploaded, and completed</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {events.map((event, index) => (
          <div key={event.id} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            background: 'var(--bg-input)',
            minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: statusColors(event.status).background,
                color: statusColors(event.status).color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.76rem',
                fontWeight: 800,
              }}>
                {index + 1}
              </div>
              <StatusPill status={event.status} />
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: 6 }}>{event.label}</div>
            <div style={{ display: 'grid', gap: 4, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              <span>{event.responsibleUser}</span>
              <span>{event.timestampLabel}</span>
              <span>{event.operationalNotes}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecommendationHistoryPanel({ history }) {
  const groups = [
    { key: 'recommendation', title: 'Recommendation History', icon: <History size={16} />, rows: history.recommendation },
    { key: 'rule', title: 'Rule History', icon: <ClipboardList size={16} />, rows: history.rule },
    { key: 'decisionTree', title: 'Decision Tree History', icon: <Route size={16} />, rows: history.decisionTree },
    { key: 'status', title: 'Status History', icon: <CheckCircle2 size={16} />, rows: history.status },
  ];

  return (
    <section className="card">
      <div style={cardTitleStyle}>
        <div style={iconWrapStyle}><History size={18} /></div>
        <div>
          <div className="section-title">History</div>
          <div className="section-subtitle">Recommendation, rule, decision tree, and status evidence for this operational decision</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {groups.map((group) => (
          <div key={group.key} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)',
            minWidth: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 13px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 800,
            }}>
              {group.icon}
              <span>{group.title}</span>
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              {(group.rows || []).map((row) => (
                <div key={row.id} style={{
                  padding: '12px 13px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: '0.86rem', marginBottom: 5 }}>
                    {row.label}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                    {row.operationalNotes}
                  </div>
                  <div style={{ ...mutedTextStyle, marginTop: 7 }}>
                    {row.timestampLabel} - {row.responsibleUser}
                  </div>
                </div>
              ))}
              {(!group.rows || group.rows.length === 0) && (
                <div style={{ padding: 13, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No history evidence available.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusDot({ status, isCurrent }) {
  const colors = statusColors(status);
  return (
    <div style={{
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: colors.background,
      color: colors.color,
      border: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
    }}>
      {status === 'pending' ? <Circle size={10} /> : <CheckCircle2 size={14} />}
    </div>
  );
}

function StatusPill({ status, label }) {
  const colors = statusColors(status || workflowTone(label));
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: `1px solid ${colors.border}`,
      borderRadius: 999,
      padding: '3px 8px',
      color: colors.color,
      background: colors.background,
      fontSize: '0.7rem',
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {label || labelForStatus(status)}
    </span>
  );
}

function statusColors(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('exception') || value.includes('danger')) {
    return { color: 'var(--priority-high)', background: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.24)' };
  }
  if (value.includes('inferred') || value.includes('warning')) {
    return { color: 'var(--priority-medium)', background: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' };
  }
  if (value.includes('completed') || value.includes('current') || value.includes('success')) {
    return { color: 'var(--priority-low)', background: 'rgba(22,163,74,0.11)', border: 'rgba(22,163,74,0.24)' };
  }
  return { color: 'var(--text-muted)', background: 'rgba(148,163,184,0.12)', border: 'var(--border)' };
}

function labelForStatus(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('exception')) return 'Exception';
  if (value.includes('inferred')) return 'Inferred';
  if (value.includes('completed')) return 'Completed';
  if (value.includes('current')) return 'Current';
  if (value.includes('success')) return 'Complete';
  if (value.includes('danger')) return 'Attention';
  if (value.includes('warning')) return 'Review';
  return 'Pending';
}
