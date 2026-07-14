import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, FileText, Loader2, RefreshCw, Zap } from 'lucide-react';
import Topbar from '../components/Topbar';
import {
  DecisionTreeReconstruction,
  DeliveryContextPanel,
  KnowledgeTraceTimeline,
  PriorityExplanationPanel,
  PrioritySummaryCards,
  RuleEvidenceTable,
} from '../components/PriorityRecommendationSections';
import {
  OperationalTimelinePanel,
  RecommendationHistoryPanel,
  RecommendationLifecyclePanel,
  RecommendationOutcomePanel,
  WorkflowStatusPanel,
} from '../components/RecommendationWorkflowSections';
import { invoiceService, recommendationService, trackingService } from '../api';
import { getPriorityBadgeClass } from '../data/mockData';
import { normalizePriorityResponse } from '../utils/priorityRecommendationAdapter';
import { normalizeRecommendationWorkflow } from '../utils/recommendationWorkflowAdapter';

export default function PriorityRecommendationPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [rawRecommendation, setRawRecommendation] = useState(null);
  const [recommendationHistory, setRecommendationHistory] = useState([]);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadInvoices = async () => {
      try {
        setLoadingInvoices(true);
        const [invoiceResult, historyResult] = await Promise.allSettled([
          invoiceService.getAll({ limit: 200 }),
          recommendationService.getHistory(),
        ]);

        if (!mounted) return;

        if (invoiceResult.status === 'fulfilled') {
          setInvoices(invoiceResult.value.data || []);
        } else {
          console.error('Error loading invoices:', invoiceResult.reason);
          setError('Gagal memuat invoice.');
        }

        if (historyResult.status === 'fulfilled') {
          setRecommendationHistory(historyResult.value || []);
        } else {
          console.error('Error loading recommendation history:', historyResult.reason);
          setRecommendationHistory([]);
        }
      } catch (err) {
        console.error('Error loading invoices:', err);
        if (mounted) setError('Gagal memuat invoice.');
      } finally {
        if (mounted) setLoadingInvoices(false);
      }
    };

    loadInvoices();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadTrackingHistory = async () => {
      if (!selectedInvoiceId) {
        setTrackingHistory([]);
        return;
      }

      try {
        const history = await trackingService.getHistory(selectedInvoiceId);
        if (mounted) setTrackingHistory(history || []);
      } catch (err) {
        console.error('Error loading tracking history:', err);
        if (mounted) setTrackingHistory([]);
      }
    };

    loadTrackingHistory();
    return () => {
      mounted = false;
    };
  }, [selectedInvoiceId]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => String(invoice.id) === String(selectedInvoiceId)),
    [invoices, selectedInvoiceId]
  );

  const recommendation = useMemo(
    () => rawRecommendation ? normalizePriorityResponse(rawRecommendation, selectedInvoice) : null,
    [rawRecommendation, selectedInvoice]
  );

  const workflow = useMemo(
    () => recommendation ? normalizeRecommendationWorkflow({
      recommendation,
      selectedInvoice,
      recommendationHistory,
      trackingHistory,
    }) : null,
    [recommendation, selectedInvoice, recommendationHistory, trackingHistory]
  );

  const handleGenerate = async () => {
    if (!selectedInvoiceId) return;

    try {
      setIsGenerating(true);
      setError(null);
      const response = await recommendationService.generate(selectedInvoiceId);
      setRawRecommendation(response.data || response);
      refreshWorkflowEvidence(selectedInvoiceId);
    } catch (err) {
      console.error('Priority recommendation error:', err);
      setError(err.response?.data?.message || 'Gagal menghasilkan priority recommendation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInvoiceChange = (event) => {
    setSelectedInvoiceId(event.target.value);
    setRawRecommendation(null);
    setError(null);
  };

  const refreshWorkflowEvidence = async (invoiceId) => {
    const [historyResult, trackingResult] = await Promise.allSettled([
      recommendationService.getHistory(),
      trackingService.getHistory(invoiceId),
    ]);

    if (historyResult.status === 'fulfilled') {
      setRecommendationHistory(historyResult.value || []);
    }

    if (trackingResult.status === 'fulfilled') {
      setTrackingHistory(trackingResult.value || []);
    }
  };

  return (
    <div>
      <Topbar
        title="Priority Recommendation"
        subtitle="Operational Knowledge Formalization Framework for invoice delivery decisions"
      />

      <div className="page-container">
        <div className="grid-2" style={{ alignItems: 'start', marginBottom: 24 }}>
          <section className="card">
            <div className="section-header" style={{ marginBottom: 18 }}>
              <div>
                <div className="section-title">Invoice Selection</div>
                <div className="section-subtitle">Generate a priority recommendation from the existing API route</div>
              </div>
              <div className="tag"><Brain size={12} /> Framework</div>
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
                  <option value="">{loadingInvoices ? 'Memuat invoice...' : '-- Pilih invoice --'}</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNo || invoice.invoice_no} - {invoice.customerName || invoice.customer_name || invoice.customer?.name || 'Customer'}
                    </option>
                  ))}
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
                {isGenerating ? 'Memproses...' : 'Generate Priority Recommendation'}
              </button>

              {error && (
                <div className="alert alert-danger">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="section-header" style={{ marginBottom: 18 }}>
              <div>
                <div className="section-title">Framework Handoff</div>
                <div className="section-subtitle">Current response fields exposed by Batch 2 compatibility</div>
              </div>
              <div className="tag"><RefreshCw size={12} /> Compatible</div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Knowledge Acquisition', selectedInvoice ? 'Invoice context available' : 'Waiting for invoice'],
                ['Rule-Based Representation', recommendation ? 'Rule evidence received' : 'Waiting for recommendation'],
                ['Decision Tree Reconstruction', recommendation ? 'Decision path reconstructed' : 'Waiting for recommendation'],
                ['Invoice Tracking & POD', workflow ? workflow.currentStatus.label : 'Pending POD context'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  background: 'var(--bg-input)',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {!recommendation ? (
          <EmptyFrameworkState />
        ) : (
          <div style={{ display: 'grid', gap: 24 }}>
            <PrioritySummaryCards summary={recommendation.summary} />
            <WorkflowStatusPanel workflow={workflow} />

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <RecommendationLifecyclePanel lifecycle={workflow.lifecycle} />
              <RecommendationOutcomePanel outcome={workflow.outcome} />
            </div>

            <OperationalTimelinePanel events={workflow.operationalTimeline} />

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <KnowledgeTraceTimeline trace={recommendation.knowledgeTrace} />
              <DecisionTreeReconstruction
                decisionPath={recommendation.decisionPath}
                decisionTreeResult={recommendation.decisionTreeResult}
                summary={recommendation.summary}
              />
            </div>

            <RuleEvidenceTable rows={recommendation.ruleRows} />
            <DeliveryContextPanel delivery={recommendation.delivery} />
            <RecommendationHistoryPanel history={workflow.history} />
            <PriorityExplanationPanel explanation={recommendation.explanation} />
          </div>
        )}
      </div>
    </div>
  );
}

function InvoicePreview({ invoice }) {
  const fields = [
    ['Invoice', invoice.invoiceNo || invoice.invoice_no || '-'],
    ['Customer', invoice.customerName || invoice.customer_name || invoice.customer?.name || '-'],
    ['Area', invoice.area || invoice.customer?.area || '-'],
    ['Receive Schedule', invoice.schedule || invoice.jadwal || '-'],
    ['Cutoff', invoice.cutoff || invoice.cut_off || '-'],
    ['Driver', invoice.driverName || invoice.driver_name || invoice.driver?.name || '-'],
    ['Status', invoice.status || '-'],
  ];

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      background: 'var(--bg-input)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <FileText size={16} color="var(--primary)" />
        <div style={{ fontWeight: 700 }}>Selected Invoice Context</div>
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
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
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
          <span style={{ color: 'var(--text-muted)' }}>Priority</span>
          <span className={`badge ${getPriorityBadgeClass(invoice.priority)}`}>
            {invoice.priority || '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyFrameworkState() {
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
          Operational Knowledge Framework Ready
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Select an invoice and generate a recommendation to display the priority summary,
          knowledge trace, rule evidence, decision tree reconstruction, delivery context,
          and POD handoff.
        </div>
      </div>
    </section>
  );
}
