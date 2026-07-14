import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Brain,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  Layers3,
  Loader2,
  Network,
  Route,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import {
  DecisionTreeReconstruction,
  KnowledgeTraceTimeline,
  PrioritySummaryCards,
  RuleEvidenceTable,
} from '../components/PriorityRecommendationSections';
import { invoiceService, recommendationService } from '../api';
import { normalizePriorityResponse, toDisplayValue } from '../utils/priorityRecommendationAdapter';

const FRAMEWORK_STEPS = [
  { title: 'Knowledge Acquisition', desc: 'Customer regulation, invoice history, expert knowledge', icon: Database },
  { title: 'Knowledge Formalization', desc: 'Operational attributes and labeling guideline', icon: Layers3 },
  { title: 'Rule-Based Representation', desc: 'R1-R12 activated operational rules', icon: ClipboardList },
  { title: 'Decision Tree Reconstruction', desc: 'Model path reconstructed as explainable knowledge', icon: GitBranch },
  { title: 'Priority Recommendation', desc: 'Traceable priority decision for invoice delivery', icon: ShieldCheck },
  { title: 'Invoice Tracking & POD', desc: 'Operational execution and proof of delivery lifecycle', icon: Truck },
];

const KNOWLEDGE_SOURCES = [
  {
    title: 'Customer Regulation',
    icon: FileCheck2,
    detail: 'Receive schedule, cutoff policy, area constraints, and delivery acceptance rules.',
  },
  {
    title: 'Historical Invoice',
    icon: FileText,
    detail: 'Past invoice status, customer behavior, delivery timing, and operational outcomes.',
  },
  {
    title: 'Expert Knowledge',
    icon: Users,
    detail: 'Operational judgement from staff about urgent cases, exceptions, and delivery handling.',
  },
];

const OPERATIONAL_ATTRIBUTES = [
  'Priority Label',
  'Receive Schedule',
  'Cutoff Policy',
  'Delivery Area',
  'Delivery Context',
  'POD Context',
];

const RULE_BASE = [
  ['R1', 'Expired cutoff', 'Tinggi'],
  ['R2', 'Critical cutoff window', 'Tinggi'],
  ['R3', 'Near cutoff with limited receive schedule', 'Tinggi'],
  ['R4', 'Strict morning cutoff', 'Tinggi'],
  ['R5', 'Missed receive schedule', 'Tinggi'],
  ['R6', 'Month-end cutoff pressure', 'Tinggi'],
  ['R7', 'Remote area near cutoff', 'Sedang'],
  ['R8', 'Near cutoff general', 'Sedang'],
  ['R9', 'Limited receiving days', 'Sedang'],
  ['R10', 'Midday cutoff', 'Sedang'],
  ['R11', 'No cutoff with flexible schedule', 'Rendah'],
  ['R12', 'Normal operational window', 'Rendah'],
];

const WORKFLOW_STEPS = [
  { title: 'Invoice', desc: 'Operational document enters the system', icon: FileText },
  { title: 'Priority Recommendation', desc: 'Framework produces traceable priority decision', icon: ShieldCheck },
  { title: 'Invoice Tracking', desc: 'Delivery status is monitored through execution', icon: Route },
  { title: 'Proof of Delivery', desc: 'Receiver evidence closes the delivery handoff', icon: FileCheck2 },
  { title: 'Completed', desc: 'Operational lifecycle reaches final status', icon: BadgeCheck },
];

const panelStyle = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-input)',
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

export default function ResearchShowcasePage() {
  const [history, setHistory] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingExample, setLoadingExample] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadResearchExample = async () => {
      try {
        setLoadingExample(true);
        setError('');
        const [historyResult, invoiceResult] = await Promise.allSettled([
          recommendationService.getHistory(),
          invoiceService.getAll({ limit: 200 }),
        ]);

        if (!mounted) return;

        if (historyResult.status === 'fulfilled') {
          setHistory(historyResult.value || []);
        } else {
          setError('Gagal memuat backend recommendation response.');
        }

        if (invoiceResult.status === 'fulfilled') {
          setInvoices(invoiceResult.value.data || []);
        }
      } finally {
        if (mounted) setLoadingExample(false);
      }
    };

    loadResearchExample();
    return () => {
      mounted = false;
    };
  }, []);

  const latestRecommendation = history[0] || null;
  const selectedInvoice = useMemo(() => {
    if (!latestRecommendation) return null;
    const invoiceId = latestRecommendation.invoiceId || latestRecommendation.invoice_id;
    const invoiceNo = latestRecommendation.invoiceNo || latestRecommendation.invoice_no;
    return invoices.find((invoice) => (
      String(invoice.id) === String(invoiceId)
      || String(invoice.invoiceNo || invoice.invoice_no) === String(invoiceNo)
    )) || null;
  }, [history, invoices]);

  const example = useMemo(
    () => latestRecommendation ? normalizePriorityResponse(latestRecommendation, selectedInvoice) : null,
    [latestRecommendation, selectedInvoice]
  );

  return (
    <div>
      <Topbar
        title="Research Showcase"
        subtitle="Scientific contribution view for Operational Knowledge Formalization Framework"
      />

      <div className="page-container" style={{ display: 'grid', gap: 24 }}>
        <FrameworkOverview />
        <KnowledgeAcquisition />
        <KnowledgeFormalization />
        <KnowledgeRepresentation />
        <PriorityRecommendationExample
          loading={loadingExample}
          error={error}
          example={example}
          sourceRecord={latestRecommendation}
        />
        <OperationalWorkflow />
      </div>
    </div>
  );
}

function FrameworkOverview() {
  return (
    <section className="card">
      <SectionHeading
        icon={BookOpen}
        title="Operational Knowledge Formalization Framework"
        subtitle="A thesis contribution that converts daily delivery knowledge into traceable operational decisions."
      />

      <div className="grid-2" style={{ alignItems: 'start', gap: 18 }}>
        <FrameworkFigure />
        <div style={{ display: 'grid', gap: 12 }}>
          <InfoPanel
            title="Scientific contribution"
            body="The framework formalizes tacit delivery knowledge into explicit rules, reconstructs it through a decision tree path, and exposes the result as a priority recommendation connected to invoice tracking and POD."
          />
          <InfoPanel
            title="Defense message"
            body="In less than five minutes, this page shows where the knowledge comes from, how it is formalized, how it is represented, and how it becomes an operational decision."
          />
        </div>
      </div>
    </section>
  );
}

function FrameworkFigure() {
  return (
    <figure style={{ ...panelStyle, margin: 0, padding: 16 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {FRAMEWORK_STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '38px minmax(0, 1fr)',
                gap: 12,
                alignItems: 'center',
              }}>
                <div style={iconWrapStyle}><Icon size={17} /></div>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{step.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{step.desc}</div>
                </div>
              </div>
              {index < FRAMEWORK_STEPS.length - 1 && (
                <div style={{ marginLeft: 17, color: 'var(--text-muted)', padding: '4px 0' }}>&darr;</div>
              )}
            </div>
          );
        })}
      </div>
      <figcaption style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 12 }}>
        Figure: framework flow integrated from the existing research methodology artifact.
      </figcaption>
    </figure>
  );
}

function KnowledgeAcquisition() {
  return (
    <section className="card">
      <SectionHeading
        icon={Database}
        title="Knowledge Acquisition"
        subtitle="Three knowledge sources are acquired before formalization."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {KNOWLEDGE_SOURCES.map((source) => (
          <InfoPanel key={source.title} icon={source.icon} title={source.title} body={source.detail} />
        ))}
      </div>
    </section>
  );
}

function KnowledgeFormalization() {
  return (
    <section className="card">
      <SectionHeading
        icon={Layers3}
        title="Knowledge Formalization"
        subtitle="Operational knowledge is converted into attributes, labeling guideline, and R1-R12 rule base."
      />

      <div className="grid-2" style={{ alignItems: 'start', gap: 18 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <InfoPanel
            title="Operational Attributes"
            body="Attributes become the shared vocabulary between customer regulation, invoice history, expert rules, and the trained decision tree."
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OPERATIONAL_ATTRIBUTES.map((attribute) => (
              <span key={attribute} className="tag">{attribute}</span>
            ))}
          </div>
          <InfoPanel
            title="Operational Labeling Guideline"
            body="The guideline assigns operational priority labels from formalized conditions before the recommendation is shown to users."
          />
        </div>

        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '13px 14px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>
            Rule Base R1-R12
          </div>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Rule Name</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {RULE_BASE.map(([id, name, priority]) => (
                  <tr key={id}>
                    <td><span className="invoice-no">{id}</span></td>
                    <td>{name}</td>
                    <td><span className="tag">{priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function KnowledgeRepresentation() {
  return (
    <section className="card">
      <SectionHeading
        icon={Network}
        title="Knowledge Representation"
        subtitle="Rule-Based Representation and Decision Tree Reconstruction explain the same formalized operational knowledge."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        alignItems: 'stretch',
      }}>
        <RepresentationPanel
          icon={ClipboardList}
          title="Rule-Based Representation"
          body="R1-R12 express operational labeling rules as explicit IF-THEN evidence. Each activated rule exposes conditions, reason, and priority."
        />
        <RepresentationPanel
          icon={GitBranch}
          title="Decision Tree Reconstruction"
          body="The decision tree reconstructs formalized operational knowledge as node traversal, final recommendation, and confidence."
        />
      </div>

      <div style={{ ...panelStyle, padding: 14, marginTop: 14, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        The rule base states the operational guideline explicitly. The decision tree provides a reconstructed path that
        makes the trained model explainable using the same formalized attributes.
      </div>
    </section>
  );
}

function PriorityRecommendationExample({ loading, error, example, sourceRecord }) {
  return (
    <section className="card">
      <SectionHeading
        icon={ShieldCheck}
        title="Priority Recommendation Example"
        subtitle="One current backend response is displayed without creating placeholder research output."
        right={sourceRecord ? <span className="tag">Source: /api/recommendation/history</span> : null}
      />

      {loading ? (
        <div style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 10 }}>
          <Loader2 size={20} />
          Loading backend recommendation response...
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : !example ? (
        <div style={{ ...panelStyle, padding: 18, color: 'var(--text-secondary)' }}>
          No current backend recommendation response is available yet. Generate a recommendation from the Priority
          Recommendation page first, then return here to review the thesis contribution trace.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <PrioritySummaryCards summary={example.summary} />
          <ExampleSnapshot example={example} />
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <KnowledgeTraceTimeline trace={example.knowledgeTrace} />
            <DecisionTreeReconstruction
              decisionPath={example.decisionPath}
              decisionTreeResult={example.decisionTreeResult}
              summary={example.summary}
            />
          </div>
          <RuleEvidenceTable rows={example.ruleRows} />
        </div>
      )}
    </section>
  );
}

function ExampleSnapshot({ example }) {
  const activatedRule = example.ruleRows?.[0];
  const firstDecisionStep = example.decisionPath?.[0];
  const fields = [
    ['Priority', example.summary.priority],
    ['Rule ID', activatedRule?.id],
    ['Rule Evidence', activatedRule?.evidence],
    ['Decision Tree Path', firstDecisionStep ? `${firstDecisionStep.node}: ${firstDecisionStep.value}` : '-'],
    ['Knowledge Trace', `${example.knowledgeTrace.length} stages captured`],
  ];

  return (
    <div style={{ ...panelStyle, padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: 6 }}>{label}</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: 800, overflowWrap: 'anywhere' }}>
              {toDisplayValue(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationalWorkflow() {
  return (
    <section className="card">
      <SectionHeading
        icon={Route}
        title="Operational Workflow"
        subtitle="The thesis contribution is shown as a decision-support workflow, not only a model output."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} style={{ ...panelStyle, padding: 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <div style={iconWrapStyle}><Icon size={17} /></div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.78rem' }}>
                  {index + 1}
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: 6 }}>{step.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{step.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ icon: Icon, title, subtitle, right = null }) {
  return (
    <div className="section-header" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={iconWrapStyle}><Icon size={18} /></div>
        <div>
          <div className="section-title">{title}</div>
          <div className="section-subtitle">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function InfoPanel({ icon: Icon = Brain, title, body }) {
  return (
    <div style={{ ...panelStyle, padding: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color="var(--primary)" />
        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

function RepresentationPanel({ icon: Icon, title, body }) {
  return (
    <div style={{ ...panelStyle, padding: 16, minWidth: 0 }}>
      <div style={{ ...iconWrapStyle, marginBottom: 12 }}><Icon size={18} /></div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
