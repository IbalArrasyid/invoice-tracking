import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, CheckCircle2, ClipboardList,
  FileText, GitBranch, Loader2, Scale, Zap
} from 'lucide-react';
import { invoiceService, recommendationService } from '../api';
import {
  field,
  normalizePriorityResponse,
  toDisplayValue,
} from '../utils/priorityRecommendationAdapter';
import {
  THESIS_DATASET_FIELDS,
  getThesisInvoice,
  normalizeThesisLabel,
  thesisPriorityBadgeClass,
} from '../utils/thesisDataset';

const FINAL_RULE_SET = 'Rule-Based R1-R8';

function toVisiblePriority(value) {
  return value ? normalizeThesisLabel(value) : '-';
}

function priorityBadgeClass(priority) {
  return thesisPriorityBadgeClass(priority);
}

function sanitizeText(value) {
  return toDisplayValue(value)
    .replace(/C4\.5/gi, 'Decision Tree Classification')
    .replace(/Priority Recommendation/gi, 'Priority Classification')
    .replace(/Recommendation Score/gi, 'Classification Result')
    .replace(/Operational Knowledge/gi, 'Priority Classification')
    .replace(/Knowledge Trace/gi, 'Classification Evidence')
    .replace(/Knowledge Acquisition/gi, 'Invoice Data')
    .replace(/Knowledge Formalization/gi, 'Classification Preparation')
    .replace(/Decision Tree Reconstruction/gi, 'Decision Tree Classification')
    .replace(/SAW/gi, 'Classification')
    .replace(/Hybrid Recommendation/gi, 'Comparative Classification')
    .replace(/recommendation/gi, 'classification')
    .replace(/Tinggi/gi, 'HIGH')
    .replace(/Sedang/gi, 'NORMAL')
    .replace(/Rendah/gi, 'NORMAL')
    .replace(/Prioritas/gi, 'HIGH')
    .replace(/Normal/gi, 'NORMAL');
}

function normalizeRuleId(value) {
  const match = String(value || '').match(/R[-\s]?(\d+)/i);

  if (!match) return FINAL_RULE_SET;

  const number = Number(match[1]);
  if (number >= 1 && number <= 8) return `R${number}`;

  return FINAL_RULE_SET;
}

function getActivatedRule(classification) {
  const activatedRule = field(classification.ruleEvidence, 'activated_rule')
    || field(classification.ruleBasedResult, 'activated_rule')
    || {};

  const ruleId = field(activatedRule, 'rule_id', 'id')
    || field(classification.ruleEvidence, 'rule_id')
    || field(classification.ruleBasedResult, 'rule_id')
    || classification.ruleRows?.[0]?.id;

  return {
    id: normalizeRuleId(ruleId),
    rawName: field(activatedRule, 'rule_name', 'name')
      || field(classification.ruleEvidence, 'rule_name')
      || classification.ruleRows?.[0]?.name,
  };
}

function getRuleBasedResult(classification) {
  return field(classification.ruleBasedResult, 'priority_label', 'priority', 'result')
    || field(classification.ruleEvidence, 'priority_label', 'priority')
    || classification.ruleRows?.[0]?.evidence
    || classification.summary.priority;
}

function getDecisionTreeResult(classification) {
  return field(classification.decisionTreeResult, 'priority_label', 'prediction', 'result')
    || field(classification.raw, 'priority_label', 'raw_prediction')
    || classification.summary.priority;
}

function getDecisionTreeConfidence(classification) {
  return field(classification.decisionTreeResult, 'confidence', 'confidence_score')
    ?? field(classification.raw, 'decision_confidence');
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return sanitizeText(value);
  return `${Math.round(numeric * 100)}%`;
}

function buildDecisionPath(decisionPath = []) {
  const meaningfulPath = decisionPath.filter((step) => {
    const combined = `${step.node || ''} ${step.fact || ''} ${step.value || ''}`.toLowerCase();
    return !combined.includes('no decision path available');
  });

  return meaningfulPath.map((step, index) => ({
    id: `${index + 1}`,
    node: sanitizeText(step.node || `Step ${index + 1}`),
    fact: sanitizeText(step.fact || '-'),
    value: sanitizeText(step.value || '-'),
  }));
}

function buildClassificationView(classification) {
  if (!classification) return null;

  const activatedRule = getActivatedRule(classification);
  const ruleBasedResult = toVisiblePriority(getRuleBasedResult(classification));
  const decisionTreeResult = toVisiblePriority(getDecisionTreeResult(classification));
  const decisionPath = buildDecisionPath(classification.decisionPath);
  const decisionTreeConfidence = formatPercent(getDecisionTreeConfidence(classification));

  return {
    ruleBased: {
      result: ruleBasedResult,
      ruleId: activatedRule.id,
      ruleName: activatedRule.rawName ? sanitizeText(activatedRule.rawName) : FINAL_RULE_SET,
      explanation: `The selected invoice is evaluated using the finalized ${FINAL_RULE_SET} rule set.`,
    },
    decisionTree: {
      result: decisionTreeResult,
      model: 'Entropy-based Decision Tree',
      confidence: decisionTreeConfidence,
      decisionPath,
      explanation: 'The selected invoice is evaluated by the entropy-based decision tree and mapped to the final thesis classes.',
    },
    agreement: ruleBasedResult === decisionTreeResult ? 'Agreement' : 'Different Prediction',
  };
}

export default function PriorityRecommendationPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadInvoices = async () => {
      try {
        setLoadingInvoices(true);
        const result = await invoiceService.getAll({ limit: 200 });
        if (mounted) setInvoices(result.data || []);
      } catch (err) {
        console.error('Error loading invoices:', err);
        if (mounted) setError('Unable to load invoices.');
      } finally {
        if (mounted) setLoadingInvoices(false);
      }
    };

    loadInvoices();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => String(invoice.id) === String(selectedInvoiceId)),
    [invoices, selectedInvoiceId]
  );

  const classification = useMemo(
    () => rawResponse ? normalizePriorityResponse(rawResponse, selectedInvoice) : null,
    [rawResponse, selectedInvoice]
  );

  const classificationView = useMemo(
    () => buildClassificationView(classification),
    [classification]
  );

  const handleGenerate = async () => {
    if (!selectedInvoiceId) return;

    try {
      setIsGenerating(true);
      setError(null);
      const response = await recommendationService.generate(selectedInvoiceId);
      setRawResponse(response.data || response);
    } catch (err) {
      console.error('Priority classification error:', err);
      setError(err.response?.data?.message || 'Priority classification failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInvoiceChange = (event) => {
    setSelectedInvoiceId(event.target.value);
    setRawResponse(null);
    setError(null);
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Priority Classification</h1>
          <p>Rule-Based Classification and Decision Tree Classification for invoice priority</p>
        </div>
      </header>

      <div className="page-container">
        <div className="grid-2" style={{ alignItems: 'start', marginBottom: 24 }}>
          <section className="card">
            <div className="section-header" style={{ marginBottom: 18 }}>
              <div>
                <div className="section-title">Classification Input</div>
                <div className="section-subtitle">Select an invoice before running priority classification</div>
              </div>
              <div className="tag"><FileText size={12} /> Invoice Data</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Invoice</label>
                <select
                  className="form-select"
                  value={selectedInvoiceId}
                  onChange={handleInvoiceChange}
                  disabled={loadingInvoices}
                >
                  <option value="">{loadingInvoices ? 'Loading invoices...' : '-- Select invoice --'}</option>
                  {invoices.map((invoice) => {
                    const thesis = getThesisInvoice(invoice);
                    return (
                      <option key={invoice.id} value={invoice.id}>
                        {thesis.invoice_no} - {thesis.customer_name_masking || 'customer_name_masking'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedInvoice && <InvoicePreview invoice={selectedInvoice} />}

              <button
                className="btn btn-primary"
                type="button"
                onClick={handleGenerate}
                disabled={!selectedInvoiceId || isGenerating}
              >
                {isGenerating ? <Loader2 size={16} /> : <Zap size={16} />}
                {isGenerating ? 'Processing...' : 'Run Priority Classification'}
              </button>

              {error && (
                <div className="alert alert-danger">
                  <AlertTriangle size={18} />
                  <span>{sanitizeText(error)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="section-header" style={{ marginBottom: 18 }}>
              <div>
                <div className="section-title">Classification Methods</div>
                <div className="section-subtitle">The two methods evaluated in the final thesis</div>
              </div>
              <div className="tag"><Scale size={12} /> Comparative Analysis</div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <MethodOverview
                icon={ClipboardList}
                title="Rule-Based Classification"
                detail="Uses the finalized Rule-Based R1-R8 rule set."
              />
              <MethodOverview
                icon={Brain}
                title="Decision Tree Classification"
                detail="Uses an entropy-based decision tree."
              />
            </div>
          </section>
        </div>

        {!classificationView ? (
          <EmptyClassificationState />
        ) : (
          <div style={{ display: 'grid', gap: 24 }}>
            <section className="card">
              <div className="section-header" style={{ marginBottom: 18 }}>
                <div>
                  <div className="section-title">Classification Result</div>
                  <div className="section-subtitle">Side-by-side result from both thesis methods</div>
                </div>
                <span className={`tag ${classificationView.agreement === 'Agreement' ? 'success' : ''}`}>
                  <CheckCircle2 size={12} /> {classificationView.agreement}
                </span>
              </div>

              <div className="grid-2" style={{ alignItems: 'stretch' }}>
                <ClassificationMethodCard
                  icon={ClipboardList}
                  title="Rule-Based Classification"
                  result={classificationView.ruleBased.result}
                  rows={[
                    ['Triggered Rule', classificationView.ruleBased.ruleId],
                    ['Rule Set', FINAL_RULE_SET],
                    ['Rule Label', classificationView.ruleBased.ruleName],
                  ]}
                  explanation={classificationView.ruleBased.explanation}
                />

                <ClassificationMethodCard
                  icon={Brain}
                  title="Decision Tree Classification"
                  result={classificationView.decisionTree.result}
                  rows={[
                    ['Model', classificationView.decisionTree.model],
                    ['Criterion', 'Entropy'],
                    ['Confidence', classificationView.decisionTree.confidence || 'Available in model response'],
                  ]}
                  explanation={classificationView.decisionTree.explanation}
                />
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <div className="section-title">Decision Path</div>
                  <div className="section-subtitle">Displayed when the current response includes path evidence</div>
                </div>
                <div className="tag"><GitBranch size={12} /> Entropy-based Decision Tree</div>
              </div>

              {classificationView.decisionTree.decisionPath.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {classificationView.decisionTree.decisionPath.map((step) => (
                    <div
                      key={step.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr',
                        gap: 12,
                        alignItems: 'start',
                        padding: '12px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div className="priority-sequence-num priority-sequence-1">{step.id}</div>
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 4 }}>
                          {step.node}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
                          {step.fact}: {step.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 28 }}>
                  <div className="empty-title">Decision path is not exposed by the current response.</div>
                  <div className="empty-desc">The classification result remains available above.</div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function MethodOverview({ icon: Icon, title, detail }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      background: 'var(--bg-input)',
    }}>
      <div className="stat-icon-wrap" style={{
        '--icon-bg': 'rgba(37,99,235,0.12)',
        '--icon-color': 'var(--primary)'
      }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 3 }}>{detail}</div>
      </div>
    </div>
  );
}

function ClassificationMethodCard({ icon: Icon, title, result, rows, explanation }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 18,
      background: 'var(--bg-input)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stat-icon-wrap" style={{
            '--icon-bg': 'rgba(37,99,235,0.12)',
            '--icon-color': 'var(--primary)'
          }}>
            <Icon size={18} />
          </div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{title}</div>
        </div>
        <span className={`badge ${priorityBadgeClass(result)}`}>{result}</span>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 14,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 8,
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{label}</span>
            <strong style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{sanitizeText(value)}</strong>
          </div>
        ))}
      </div>

      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
        {sanitizeText(explanation)}
      </div>
    </div>
  );
}

function InvoicePreview({ invoice }) {
  const thesis = getThesisInvoice(invoice);
  const fields = THESIS_DATASET_FIELDS
    .filter(fieldName => fieldName !== 'expert_label')
    .map(fieldName => [fieldName, thesis[fieldName] || '-']);

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      background: 'var(--bg-input)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FileText size={16} color="var(--primary)" />
        <div style={{ fontWeight: 700 }}>Selected Invoice</div>
      </div>

      <div style={{ display: 'grid', gap: 9 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: '0.84rem',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>
              {sanitizeText(value)}
            </span>
          </div>
        ))}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          fontSize: '0.84rem',
          marginTop: 2,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>expert_label</span>
          <span className={`badge ${priorityBadgeClass(thesis.expert_label)}`}>
            {toVisiblePriority(thesis.expert_label)}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyClassificationState() {
  return (
    <section className="card" style={{
      minHeight: 260,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-lg)',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(37,99,235,0.1)',
          color: 'var(--primary)',
        }}>
          <Brain size={26} />
        </div>
        <div className="section-title" style={{ marginBottom: 8 }}>
          Classification Result
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Select an invoice and run priority classification to display Rule-Based Classification
          and Decision Tree Classification results.
        </div>
      </div>
    </section>
  );
}
