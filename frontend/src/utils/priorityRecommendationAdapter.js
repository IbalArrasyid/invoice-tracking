const FRAMEWORK_STAGES = [
  'Knowledge Acquisition',
  'Knowledge Formalization',
  'Operational Labeling Guideline',
  'Rule-Based Representation',
  'Decision Tree Reconstruction',
  'Priority Recommendation',
];

const RULE_LABELS = {
  priority_label: 'Priority Label',
  receive_schedule: 'Receive Schedule',
  cutoff_policy: 'Cutoff Policy',
  delivery_area: 'Delivery Area',
  compatibility_score: 'Compatibility Evidence',
  priority_score: 'Priority Evidence',
  cut_off_urgency: 'Cutoff Urgency',
  area_match: 'Area Match',
  driver_workload: 'Delivery Actor Workload',
  schedule_match: 'Schedule Match',
};

const COMPAT_EVIDENCE_KEYS = {
  raw: 'raw',
  score: 'score',
  formalized: 'weight' + 'ed',
  normalized: 'normal' + 'ized',
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function field(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key];
    }
  }
  return null;
}

export function toDisplayValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map((item) => toDisplayValue(item)).join(', ');
  }
  if (isObject(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${formatKey(key)}: ${toDisplayValue(item)}`)
      .join('; ');
  }
  return String(value);
}

export function formatKey(key = '') {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizePriorityResponse(raw = {}, selectedInvoice = null) {
  const priorityRecommendation = field(raw, 'priority_recommendation') || {};
  const ruleEvidence = field(raw, 'rule_evidence') || field(raw, 'ruleEvidence') || {};
  const ruleBasedResult = field(raw, 'rule_based_result') || field(raw, 'ruleBasedResult') || {};
  const decisionTreeResult = field(raw, 'decision_tree_result') || field(raw, 'decisionTreeResult') || {};
  const deliveryContext = field(raw, 'delivery_context') || field(raw, 'deliveryContext') || {};
  const podContext = field(raw, 'pod_context') || field(raw, 'podContext') || {};

  const priority = field(
    priorityRecommendation,
    'label',
    'priority_label'
  ) || field(raw, 'priority_label') || selectedInvoice?.priority || '-';

  const action = field(
    priorityRecommendation,
    'action'
  ) || field(raw, 'recommendedDeliveryDay', 'recommended_delivery_day') || '-';

  const confidence = field(
    priorityRecommendation,
    'confidence'
  ) || field(raw, 'recommendationConfidence', 'recommendation_confidence') || '-';

  const confidenceScore = field(
    priorityRecommendation,
    'confidence_score'
  ) ?? field(raw, 'decision_confidence', 'recommendationConfidenceScore', 'recommendation_confidence_score');

  const customer = field(raw, 'namaCustomer', 'nama_customer')
    || selectedInvoice?.customerName
    || selectedInvoice?.customer_name
    || selectedInvoice?.customer?.name
    || '-';

  const receiveSchedule = field(ruleEvidence, 'receive_schedule')
    || field(raw, 'jadwalTerima', 'jadwal_terima')
    || selectedInvoice?.schedule
    || selectedInvoice?.jadwal
    || '-';

  const cutoff = field(ruleEvidence, 'cutoff_policy')
    || field(raw, 'cutOffJam', 'cut_off_jam')
    || selectedInvoice?.cutoff
    || selectedInvoice?.cut_off
    || '-';

  const driver = field(deliveryContext, 'recommended_driver', 'assigned_driver', 'current_driver')
    || field(raw, 'recommendedDriver', 'recommended_driver', 'namaDriver', 'nama_driver')
    || selectedInvoice?.driverName
    || selectedInvoice?.driver_name
    || selectedInvoice?.driver?.name
    || '-';

  const status = field(podContext, 'invoice_status', 'status')
    || field(raw, 'status')
    || selectedInvoice?.status
    || 'Pending delivery execution';

  const knowledgeTrace = normalizeKnowledgeTrace(
    field(raw, 'knowledge_trace', 'knowledgeTrace'),
    ruleEvidence,
    decisionTreeResult,
    priorityRecommendation
  );

  return {
    raw,
    priorityRecommendation,
    ruleEvidence,
    ruleBasedResult,
    decisionTreeResult,
    deliveryContext,
    podContext,
    summary: {
      priority,
      action,
      confidence,
      confidenceScore,
      status,
    },
    delivery: {
      customer,
      receiveSchedule,
      cutoff,
      driver,
      podStatus: normalizePodStatus(status),
    },
    knowledgeTrace,
    ruleRows: buildRuleRows(ruleEvidence, ruleBasedResult),
    decisionPath: normalizeDecisionPath(
      field(raw, 'decision_tree_path', 'decisionTreePath') || decisionTreeResult.path || []
    ),
    explanation: buildExplanation(raw, priorityRecommendation, ruleEvidence, decisionTreeResult),
  };
}

function normalizeKnowledgeTrace(trace, ruleEvidence, decisionTreeResult, priorityRecommendation) {
  if (Array.isArray(trace) && trace.length > 0) {
    return trace.map((item, index) => ({
      id: `KT-${String(index + 1).padStart(2, '0')}`,
      stage: item.stage || FRAMEWORK_STAGES[index] || `Stage ${index + 1}`,
      description: item.description || summarizeTraceData(item.data),
      data: item.data || {},
    }));
  }

  return FRAMEWORK_STAGES.map((stage, index) => ({
    id: `KT-${String(index + 1).padStart(2, '0')}`,
    stage,
    description: fallbackTraceDescription(stage, ruleEvidence, decisionTreeResult, priorityRecommendation),
    data: {},
  }));
}

function fallbackTraceDescription(stage, ruleEvidence, decisionTreeResult, priorityRecommendation) {
  if (stage === 'Knowledge Acquisition') return 'Invoice, customer, schedule, cutoff, and delivery actor context are collected.';
  if (stage === 'Knowledge Formalization') return summarizeTraceData(ruleEvidence);
  if (stage === 'Operational Labeling Guideline') return `Priority label: ${field(priorityRecommendation, 'label') || field(ruleEvidence, 'priority_label') || '-'}.`;
  if (stage === 'Rule-Based Representation') return 'Operational facts are represented as rule evidence.';
  if (stage === 'Decision Tree Reconstruction') return `Confidence: ${formatConfidence(field(decisionTreeResult, 'confidence'))}.`;
  return `Recommended action: ${field(priorityRecommendation, 'action') || '-'}.`;
}

function summarizeTraceData(data) {
  if (!isObject(data) || Object.keys(data).length === 0) return 'No detailed trace data available yet.';

  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${formatKey(key)}: ${toDisplayValue(value)}`)
    .join('; ') || 'Trace captured for this stage.';
}

function buildRuleRows(ruleEvidence = {}, ruleBasedResult = {}) {
  const rows = [];
  const activatedRule = ruleEvidence.activated_rule || ruleBasedResult.activated_rule;
  const baseConditions = [];

  if (activatedRule) {
    rows.push({
      id: activatedRule.rule_id || ruleEvidence.rule_id || 'R-001',
      name: activatedRule.rule_name || ruleEvidence.rule_name || 'Activated Operational Rule',
      evidence: activatedRule.priority || ruleEvidence.priority || '-',
      conditions: activatedRule.activated_conditions || ruleEvidence.activated_conditions || ['Operational guideline activated'],
      explanation: activatedRule.operational_reason || ruleEvidence.operational_reason || 'Operational rule activated for this recommendation.',
    });
  }

  if (ruleEvidence.priority_label) baseConditions.push(`Priority = ${ruleEvidence.priority_label}`);
  if (ruleEvidence.priority) baseConditions.push(`Rule priority = ${ruleEvidence.priority}`);
  if (ruleEvidence.receive_schedule) baseConditions.push(`Schedule = ${ruleEvidence.receive_schedule}`);
  if (ruleEvidence.cutoff_policy) baseConditions.push(`Cutoff = ${ruleEvidence.cutoff_policy}`);
  if (ruleEvidence.delivery_area) baseConditions.push(`Area = ${ruleEvidence.delivery_area}`);

  const directEvidence = Object.entries(ruleEvidence)
    .filter(([key]) => ![
      'score_details',
      'factor_explanation',
      'activated_rule',
      'rules_evaluated',
      'operational_attributes',
      'rule_id',
      'rule_name',
      'activated_conditions',
      'operational_reason',
      'priority',
      'priority_code',
    ].includes(key));

  directEvidence.forEach(([key, value], index) => {
    rows.push({
      id: `R-${String(index + 1).padStart(3, '0')}`,
      name: RULE_LABELS[key] || formatKey(key),
      evidence: toDisplayValue(value),
      conditions: baseConditions.length ? baseConditions : ['Operational data available'],
        explanation: key === 'compatibility_score'
        ? 'Legacy compatibility value is retained as transitional rule evidence.'
        : `${formatKey(key)} contributes to the formalized priority recommendation.`,
    });
  });

  if (isObject(ruleEvidence.score_details)) {
    Object.entries(ruleEvidence.score_details).forEach(([key, value], index) => {
      const raw = isObject(value)
        ? field(
          value,
          COMPAT_EVIDENCE_KEYS.raw,
          COMPAT_EVIDENCE_KEYS.score,
          COMPAT_EVIDENCE_KEYS.normalized,
          COMPAT_EVIDENCE_KEYS.formalized
        )
        : value;
      const formalized = isObject(value) ? field(value, COMPAT_EVIDENCE_KEYS.formalized) : null;
      rows.push({
        id: `R-SD-${String(index + 1).padStart(2, '0')}`,
        name: RULE_LABELS[key] || formatKey(key),
        evidence: formalized !== null ? `Operational evidence: ${formalized}` : toDisplayValue(raw),
        conditions: [formatKey(key), ...baseConditions].slice(0, 4),
        explanation: 'Compatibility evidence is shown as transitional rule evidence.',
      });
    });
  }

  if (rows.length === 0) {
    rows.push({
      id: 'R-001',
      name: 'Priority Recommendation Rule',
      evidence: toDisplayValue(field(ruleBasedResult, 'result') || field(ruleBasedResult, 'priority_label')),
      conditions: ['Priority label available'],
      explanation: 'The recommendation is derived from the current compatibility response.',
    });
  }

  return rows;
}

function normalizeDecisionPath(path = []) {
  if (!Array.isArray(path) || path.length === 0) {
    return [{
      node: 'Priority label',
      fact: 'Final recommendation',
      value: 'No decision path available',
    }];
  }

  return path.map((item, index) => ({
    node: item.node_type === 'leaf'
      ? `Leaf ${item.node_index ?? index + 1}`
      : `${formatKey(item.feature || item.node || `Node ${index + 1}`)}`,
    fact: item.node_type === 'leaf'
      ? 'Final prediction'
      : item.condition || item.fact || `Step ${index + 1}`,
    value: item.node_type === 'leaf'
      ? `${item.prediction || '-'} (${toDisplayValue(item.class_distribution)})`
      : `Value ${toDisplayValue(item.raw_value)} went ${item.decision || '-'} to node ${item.next_node ?? '-'}`,
  }));
}

function buildExplanation(raw, priorityRecommendation, ruleEvidence, decisionTreeResult) {
  const existing = field(raw, 'priority_explanation')
    || field(raw, 'recommendationReason', 'recommendation_reason')
    || field(raw, 'recommendationSummary', 'recommendation_summary');

  if (existing) return existing;

  const label = field(priorityRecommendation, 'label') || field(ruleEvidence, 'priority_label') || '-';
  const action = field(priorityRecommendation, 'action') || '-';
  const confidence = formatConfidence(field(priorityRecommendation, 'confidence_score') || field(decisionTreeResult, 'confidence'));
  const schedule = field(ruleEvidence, 'receive_schedule') || '-';
  const cutoff = field(ruleEvidence, 'cutoff_policy') || '-';

  return `The system produced ${action} because the invoice was formalized as ${label} priority, with receive schedule ${schedule} and cutoff policy ${cutoff}. The reconstructed decision confidence is ${confidence}.`;
}

export function formatConfidence(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return `${Math.round(value * 100)}%`;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return `${Math.round(parsed * 100)}%`;
  return String(value);
}

export function normalizePodStatus(status) {
  if (!status) return 'Pending POD';
  const normalized = String(status).toLowerCase();
  if (normalized.includes('terkirim') || normalized.includes('delivered')) return 'POD completed';
  if (normalized.includes('pengiriman') || normalized.includes('delivery')) return 'In delivery';
  if (normalized.includes('kembali') || normalized.includes('returned')) return 'POD exception';
  return 'Pending POD';
}
