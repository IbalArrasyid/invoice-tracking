import { field, formatConfidence, formatKey, toDisplayValue } from './priorityRecommendationAdapter';

const LIFECYCLE_TEMPLATE = [
  { id: 'generated', label: 'Generated', responsibleUser: 'System' },
  { id: 'accepted', label: 'Accepted', responsibleUser: 'Operations User' },
  { id: 'assigned', label: 'Assigned', responsibleUser: 'Dispatch Coordinator' },
  { id: 'dispatched', label: 'Dispatched', responsibleUser: 'Dispatch Coordinator' },
  { id: 'delivered', label: 'Delivered', responsibleUser: 'Driver' },
  { id: 'pod-uploaded', label: 'POD Uploaded', responsibleUser: 'Driver / Receiver' },
  { id: 'closed', label: 'Closed', responsibleUser: 'Operations User' },
];

export function normalizeRecommendationWorkflow({
  recommendation,
  selectedInvoice,
  recommendationHistory = [],
  trackingHistory = [],
} = {}) {
  if (!recommendation) return null;

  const raw = recommendation.raw || {};
  const filteredRecommendationHistory = filterRecommendationHistory(recommendationHistory, raw, selectedInvoice);
  const sortedTrackingHistory = sortByDate(trackingHistory, 'asc');

  const generatedAt = firstValue([
    raw,
    filteredRecommendationHistory[0],
    selectedInvoice,
  ], ['createdAt', 'created_at', 'date']) || null;
  const updatedAt = firstValue([
    raw,
    filteredRecommendationHistory[0],
    selectedInvoice,
  ], ['updatedAt', 'updated_at']) || generatedAt;
  const acceptance = coerceBoolean(firstValue([
    raw,
    filteredRecommendationHistory[0],
  ], ['recommendationAccepted', 'recommendation_accepted']));
  const invoiceStatus = firstValue([
    selectedInvoice,
    raw,
    recommendation.podContext,
  ], ['status', 'invoice_status']) || recommendation.summary?.status || 'Pending';
  const driver = firstValue([
    raw,
    recommendation.deliveryContext,
    selectedInvoice,
  ], [
    'actualDriver',
    'actual_driver',
    'assigned_driver',
    'recommendedDriver',
    'recommended_driver',
    'driverName',
    'driver_name',
  ]) || recommendation.delivery?.driver;
  const actualDeliveryDate = findActualDeliveryDate(raw, selectedInvoice, sortedTrackingHistory);
  const hasAssignedDriver = hasMeaningfulValue(driver);
  const hasDispatch = hasTrackingStatus(sortedTrackingHistory, 'Dalam Pengiriman') || statusAtLeastDispatched(invoiceStatus);
  const hasDelivered = acceptance !== false && (
    coerceBoolean(field(raw, 'deliverySuccess', 'delivery_success')) === true
    || hasTrackingStatus(sortedTrackingHistory, 'Terkirim')
    || String(invoiceStatus).toLowerCase().includes('terkirim')
    || Boolean(actualDeliveryDate)
  );
  const hasPodEvidence = hasPodUploadEvidence(raw, recommendation.podContext, sortedTrackingHistory);
  const hasPodUploaded = hasPodEvidence || hasDelivered && coerceBoolean(field(raw, 'deliverySuccess', 'delivery_success')) === true;
  const hasClosed = hasDelivered && hasPodUploaded && acceptance !== false;
  const hasDownstreamProgress = hasAssignedDriver || hasDispatch || hasDelivered || hasPodUploaded;

  const lifecycle = buildLifecycle({
    generatedAt,
    updatedAt,
    acceptance,
    invoiceStatus,
    driver,
    hasAssignedDriver,
    hasDispatch,
    hasDelivered,
    hasPodEvidence,
    hasPodUploaded,
    hasClosed,
    hasDownstreamProgress,
    actualDeliveryDate,
    sortedTrackingHistory,
    raw,
  });
  const currentStatus = findCurrentStatus(lifecycle);
  const outcome = buildOutcome({
    recommendation,
    raw,
    selectedInvoice,
    actualDeliveryDate,
    hasPodUploaded,
    hasPodEvidence,
    hasClosed,
    acceptance,
    invoiceStatus,
  });
  const operationalTimeline = buildOperationalTimeline({
    lifecycle,
    generatedAt,
    driver,
    selectedInvoice,
    actualDeliveryDate,
    hasPodUploaded,
    hasClosed,
    sortedTrackingHistory,
  });

  return {
    currentStatus,
    lifecycle,
    outcome,
    operationalTimeline,
    history: {
      recommendation: buildRecommendationHistory(filteredRecommendationHistory, raw, recommendation, generatedAt),
      rule: buildRuleHistory(recommendation.ruleRows, generatedAt),
      decisionTree: buildDecisionTreeHistory(recommendation.decisionPath, generatedAt),
      status: buildStatusHistory(sortedTrackingHistory, lifecycle),
    },
  };
}

function buildLifecycle({
  generatedAt,
  updatedAt,
  acceptance,
  invoiceStatus,
  driver,
  hasAssignedDriver,
  hasDispatch,
  hasDelivered,
  hasPodEvidence,
  hasPodUploaded,
  hasClosed,
  hasDownstreamProgress,
  actualDeliveryDate,
  sortedTrackingHistory,
  raw,
}) {
  const dispatchEvent = firstTrackingEvent(sortedTrackingHistory, 'Dalam Pengiriman');
  const deliveryEvent = firstTrackingEvent(sortedTrackingHistory, 'Terkirim');
  const podEvent = firstPodEvent(sortedTrackingHistory);
  const lifecycle = LIFECYCLE_TEMPLATE.map((step) => ({ ...step, status: 'pending', timestamp: null, operationalNotes: 'Waiting for operational evidence.' }));

  setLifecycle(lifecycle, 'generated', {
    status: 'completed',
    timestamp: generatedAt,
    operationalNotes: 'Priority recommendation generated from operational knowledge evidence.',
  });

  setLifecycle(lifecycle, 'accepted', {
    status: acceptance === true ? 'completed' : acceptance === false ? 'exception' : hasDownstreamProgress ? 'inferred' : 'pending',
    timestamp: acceptance === null ? null : updatedAt,
    operationalNotes: acceptance === true
      ? 'Recommendation acceptance was recorded.'
      : acceptance === false
        ? 'Recommendation was rejected in feedback.'
        : hasDownstreamProgress
          ? 'Downstream delivery activity exists, but explicit acceptance feedback is not recorded.'
          : 'Waiting for recommendation acceptance.',
  });

  setLifecycle(lifecycle, 'assigned', {
    status: acceptance === false ? 'pending' : hasAssignedDriver ? 'completed' : 'pending',
    timestamp: hasAssignedDriver ? generatedAt : null,
    operationalNotes: hasAssignedDriver
      ? `Delivery context assigned to ${driver}.`
      : 'Waiting for driver assignment evidence.',
  });

  setLifecycle(lifecycle, 'dispatched', {
    status: hasDispatch ? 'completed' : 'pending',
    timestamp: field(dispatchEvent, 'createdAt', 'created_at') || null,
    operationalNotes: hasDispatch
      ? `Invoice moved to dispatch status: ${invoiceStatus}.`
      : 'Waiting for invoice dispatch.',
  });

  setLifecycle(lifecycle, 'delivered', {
    status: hasDelivered ? 'completed' : 'pending',
    timestamp: actualDeliveryDate || field(deliveryEvent, 'createdAt', 'created_at') || null,
    operationalNotes: hasDelivered
      ? 'Delivery completion evidence is available.'
      : 'Waiting for delivery completion.',
  });

  setLifecycle(lifecycle, 'pod-uploaded', {
    status: hasPodEvidence ? 'completed' : hasPodUploaded ? 'inferred' : 'pending',
    timestamp: field(podEvent, 'receiverSignedAt', 'receiver_signed_at', 'createdAt', 'created_at') || actualDeliveryDate || null,
    operationalNotes: hasPodEvidence
      ? 'POD evidence exists in courier delivery history.'
      : hasPodUploaded
        ? 'POD completion is inferred from successful delivery feedback.'
        : 'Waiting for proof of delivery evidence.',
  });

  setLifecycle(lifecycle, 'closed', {
    status: hasClosed ? 'completed' : 'pending',
    timestamp: hasClosed ? (updatedAt || actualDeliveryDate) : null,
    operationalNotes: hasClosed
      ? 'Recommendation workflow is closed after delivery and POD evidence.'
      : 'Workflow remains open until delivery and POD evidence are complete.',
  });

  return markCurrent(lifecycle);
}

function buildOutcome({
  recommendation,
  raw,
  selectedInvoice,
  actualDeliveryDate,
  hasPodUploaded,
  hasPodEvidence,
  hasClosed,
  acceptance,
  invoiceStatus,
}) {
  const cutoff = recommendation.delivery?.cutoff || field(raw, 'cutOffJam', 'cut_off_jam') || selectedInvoice?.cutoff || selectedInvoice?.cut_off;
  const cutoffResult = evaluateCutoff(actualDeliveryDate, cutoff);
  const deliverySuccess = coerceBoolean(field(raw, 'deliverySuccess', 'delivery_success'));

  return [
    {
      label: 'Recommended Priority',
      value: recommendation.summary?.priority || '-',
      detail: recommendation.summary?.action || 'No recommended action recorded.',
      tone: priorityTone(recommendation.summary?.priority),
    },
    {
      label: 'Actual Delivery Date',
      value: formatWorkflowTimestamp(actualDeliveryDate),
      detail: actualDeliveryDate ? 'Actual delivery evidence is available.' : 'Delivery completion is not recorded yet.',
      tone: actualDeliveryDate ? 'success' : 'pending',
    },
    {
      label: 'Cutoff Met',
      value: cutoffResult.value,
      detail: cutoffResult.detail,
      tone: cutoffResult.tone,
    },
    {
      label: 'POD Uploaded',
      value: hasPodUploaded ? 'Yes' : 'Pending',
      detail: hasPodEvidence ? 'POD signature evidence is available.' : 'No dedicated POD upload field is available; status may be inferred.',
      tone: hasPodUploaded ? 'success' : 'pending',
    },
    {
      label: 'Final Status',
      value: finalStatusLabel({ hasClosed, deliverySuccess, acceptance, invoiceStatus }),
      detail: `Invoice status: ${invoiceStatus || '-'}.`,
      tone: hasClosed || deliverySuccess === true ? 'success' : acceptance === false ? 'danger' : 'pending',
    },
  ];
}

function buildOperationalTimeline({
  lifecycle,
  generatedAt,
  driver,
  selectedInvoice,
  actualDeliveryDate,
  hasPodUploaded,
  hasClosed,
  sortedTrackingHistory,
}) {
  const dispatchEvent = firstTrackingEvent(sortedTrackingHistory, 'Dalam Pengiriman');
  const podEvent = firstPodEvent(sortedTrackingHistory);
  const closedStep = lifecycle.find((item) => item.id === 'closed');

  return [
    {
      id: 'priority-generated',
      label: 'Priority Generated',
      status: lifecycleStatus(lifecycle, 'generated'),
      timestamp: generatedAt,
      responsibleUser: 'System',
      operationalNotes: 'Priority recommendation generated and attached to the invoice context.',
    },
    {
      id: 'driver-assigned',
      label: 'Driver Assigned',
      status: lifecycleStatus(lifecycle, 'assigned'),
      timestamp: generatedAt,
      responsibleUser: 'Dispatch Coordinator',
      operationalNotes: hasMeaningfulValue(driver) ? `Assigned delivery context: ${driver}.` : 'Driver assignment is pending.',
    },
    {
      id: 'invoice-sent',
      label: 'Invoice Sent',
      status: lifecycleStatus(lifecycle, 'dispatched'),
      timestamp: field(dispatchEvent, 'createdAt', 'created_at') || selectedInvoice?.deliveryDate || selectedInvoice?.delivery_date || null,
      responsibleUser: 'Dispatch Coordinator',
      operationalNotes: field(dispatchEvent, 'notes') || 'Invoice dispatch follows the priority recommendation.',
    },
    {
      id: 'pod-uploaded',
      label: 'POD Uploaded',
      status: lifecycleStatus(lifecycle, 'pod-uploaded'),
      timestamp: field(podEvent, 'receiverSignedAt', 'receiver_signed_at', 'createdAt', 'created_at') || actualDeliveryDate,
      responsibleUser: 'Driver / Receiver',
      operationalNotes: hasPodUploaded ? 'Proof of delivery evidence is available or inferred.' : 'POD evidence is pending.',
    },
    {
      id: 'completed',
      label: 'Completed',
      status: hasClosed ? 'completed' : lifecycleStatus(lifecycle, 'delivered'),
      timestamp: closedStep?.timestamp || actualDeliveryDate,
      responsibleUser: 'Operations User',
      operationalNotes: hasClosed ? 'Operational workflow completed.' : 'Completion is waiting for final delivery/POD closure.',
    },
  ].map((event) => ({
    ...event,
    timestampLabel: formatWorkflowTimestamp(event.timestamp),
  }));
}

function buildRecommendationHistory(history, raw, recommendation, generatedAt) {
  const rows = history.length ? history : [raw];

  return rows
    .filter(Boolean)
    .slice(0, 6)
    .map((record, index) => ({
      id: field(record, 'id') || `recommendation-${index + 1}`,
      label: `${field(record, 'invoiceNo', 'invoice_no') || 'Current invoice'} - ${field(record, 'priority_label') || recommendation.summary?.priority || '-'}`,
      timestamp: field(record, 'createdAt', 'created_at') || generatedAt,
      timestampLabel: formatWorkflowTimestamp(field(record, 'createdAt', 'created_at') || generatedAt),
      responsibleUser: 'System',
      operationalNotes: field(record, 'recommendedDeliveryDay', 'recommended_delivery_day') || recommendation.summary?.action || 'Recommendation generated.',
    }));
}

function buildRuleHistory(ruleRows = [], generatedAt) {
  if (!ruleRows.length) {
    return [{
      id: 'rule-history-empty',
      label: 'Rule Evidence',
      timestamp: generatedAt,
      timestampLabel: formatWorkflowTimestamp(generatedAt),
      responsibleUser: 'Operational Knowledge Engine',
      operationalNotes: 'No rule evidence was returned for this recommendation.',
    }];
  }

  return ruleRows.slice(0, 6).map((row) => ({
    id: row.id,
    label: `${row.id} - ${row.name}`,
    timestamp: generatedAt,
    timestampLabel: formatWorkflowTimestamp(generatedAt),
    responsibleUser: 'Operational Knowledge Engine',
    operationalNotes: `${row.explanation || 'Rule evaluated.'} Conditions: ${toDisplayValue(row.conditions)}.`,
  }));
}

function buildDecisionTreeHistory(decisionPath = [], generatedAt) {
  if (!decisionPath.length) {
    return [{
      id: 'decision-tree-history-empty',
      label: 'Decision Tree',
      timestamp: generatedAt,
      timestampLabel: formatWorkflowTimestamp(generatedAt),
      responsibleUser: 'Decision Tree',
      operationalNotes: 'No decision path was returned for this recommendation.',
    }];
  }

  return decisionPath.slice(0, 6).map((step, index) => ({
    id: `${step.node || 'node'}-${index}`,
    label: step.node || `Node ${index + 1}`,
    timestamp: generatedAt,
    timestampLabel: formatWorkflowTimestamp(generatedAt),
    responsibleUser: 'Decision Tree',
    operationalNotes: `${step.fact || 'Traversal'}: ${step.value || '-'}`,
  }));
}

function buildStatusHistory(trackingHistory = [], lifecycle = []) {
  if (trackingHistory.length) {
    return sortByDate(trackingHistory, 'desc').slice(0, 6).map((item) => ({
      id: field(item, 'id') || `${field(item, 'status')}-${field(item, 'createdAt', 'created_at')}`,
      label: field(item, 'status') || 'Status update',
      timestamp: field(item, 'createdAt', 'created_at'),
      timestampLabel: formatWorkflowTimestamp(field(item, 'createdAt', 'created_at')),
      responsibleUser: field(item, 'updatedBy', 'updated_by') || 'Operations User',
      operationalNotes: field(item, 'notes') || podSignatureNote(item) || 'Status update recorded.',
    }));
  }

  return lifecycle
    .filter((item) => item.status !== 'pending')
    .map((item) => ({
      id: item.id,
      label: item.label,
      timestamp: item.timestamp,
      timestampLabel: item.timestampLabel,
      responsibleUser: item.responsibleUser,
      operationalNotes: item.operationalNotes,
    }));
}

function filterRecommendationHistory(history, raw, selectedInvoice) {
  const rows = Array.isArray(history) ? history : [];
  const invoiceId = field(raw, 'invoiceId', 'invoice_id')
    || field(selectedInvoice, 'id', 'invoiceId', 'invoice_id');
  const invoiceNo = firstValue([raw, selectedInvoice], ['invoiceNo', 'invoice_no']);

  return sortByDate(rows.filter((record) => {
    const recordInvoiceId = field(record, 'invoiceId', 'invoice_id');
    const recordInvoiceNo = field(record, 'invoiceNo', 'invoice_no');
    return (invoiceId && String(recordInvoiceId) === String(invoiceId))
      || (invoiceNo && String(recordInvoiceNo) === String(invoiceNo));
  }), 'desc');
}

function setLifecycle(lifecycle, id, patch) {
  const index = lifecycle.findIndex((item) => item.id === id);
  if (index >= 0) lifecycle[index] = { ...lifecycle[index], ...patch };
}

function markCurrent(lifecycle) {
  const exceptionIndex = lifecycle.findIndex((item) => item.status === 'exception');
  const currentIndex = exceptionIndex >= 0
    ? exceptionIndex
    : lifecycle.reduce((latest, item, index) => (
      ['completed', 'inferred'].includes(item.status) ? index : latest
    ), 0);

  return lifecycle.map((item, index) => ({
    ...item,
    isCurrent: index === currentIndex,
    timestampLabel: formatWorkflowTimestamp(item.timestamp),
    statusLabel: statusLabel(item.status, index === currentIndex),
  }));
}

function findCurrentStatus(lifecycle) {
  const current = lifecycle.find((item) => item.isCurrent) || lifecycle[0];
  return {
    ...current,
    status: current?.statusLabel || 'Pending',
    label: current?.label || 'Generated',
    timestampLabel: current?.timestampLabel || 'Not recorded',
  };
}

function lifecycleStatus(lifecycle, id) {
  return lifecycle.find((item) => item.id === id)?.status || 'pending';
}

function firstValue(sources, keys) {
  for (const source of sources) {
    const value = field(source, ...keys);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function findActualDeliveryDate(raw, selectedInvoice, trackingHistory) {
  const deliveredEvent = firstTrackingEvent(trackingHistory, 'Terkirim');
  return firstValue([
    raw,
    deliveredEvent,
    selectedInvoice,
  ], [
    'actualDeliveryTime',
    'actual_delivery_time',
    'deliveredAt',
    'delivered_at',
    'deliveredAt',
    'delivered_at',
  ]);
}

function hasTrackingStatus(trackingHistory, expectedStatus) {
  return trackingHistory.some((item) => String(field(item, 'status') || '').toLowerCase() === expectedStatus.toLowerCase());
}

function firstTrackingEvent(trackingHistory, expectedStatus) {
  return trackingHistory.find((item) => String(field(item, 'status') || '').toLowerCase() === expectedStatus.toLowerCase()) || null;
}

function firstPodEvent(trackingHistory) {
  return trackingHistory.find((item) => hasMeaningfulValue(field(item, 'receiverSignature', 'receiver_signature'))
    || hasMeaningfulValue(field(item, 'receiverSignedAt', 'receiver_signed_at'))
    || hasMeaningfulValue(field(item, 'receiverName', 'receiver_name'))) || null;
}

function hasPodUploadEvidence(raw, podContext, trackingHistory) {
  const contextStatus = String(field(podContext, 'status', 'invoice_status') || '').toLowerCase();
  return coerceBoolean(field(raw, 'podUploaded', 'pod_uploaded')) === true
    || coerceBoolean(field(podContext, 'pod_uploaded', 'podUploaded')) === true
    || contextStatus.includes('pod completed')
    || Boolean(firstPodEvent(trackingHistory));
}

function statusAtLeastDispatched(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized.includes('pengiriman') || normalized.includes('terkirim') || normalized.includes('kembali');
}

function evaluateCutoff(actualDeliveryDate, cutoff) {
  if (!actualDeliveryDate) {
    return { value: 'Pending', detail: 'Actual delivery date is not recorded yet.', tone: 'pending' };
  }
  if (!cutoff || cutoff === '-') {
    return { value: 'Unknown', detail: 'Cutoff policy is not available for comparison.', tone: 'pending' };
  }

  const deliveryMinutes = extractTimeMinutes(actualDeliveryDate);
  const cutoffMinutes = extractTimeMinutes(cutoff);
  if (deliveryMinutes === null || cutoffMinutes === null) {
    return { value: 'Unknown', detail: `Cutoff ${cutoff} could not be compared with ${actualDeliveryDate}.`, tone: 'pending' };
  }

  const met = deliveryMinutes <= cutoffMinutes;
  return {
    value: met ? 'Yes' : 'No',
    detail: `Actual time ${minutesToClock(deliveryMinutes)} compared with cutoff ${minutesToClock(cutoffMinutes)}.`,
    tone: met ? 'success' : 'danger',
  };
}

function extractTimeMinutes(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }

  const raw = String(value);
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime()) && raw.includes('T')) {
    return date.getHours() * 60 + date.getMinutes();
  }

  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function finalStatusLabel({ hasClosed, deliverySuccess, acceptance, invoiceStatus }) {
  if (acceptance === false) return 'Recommendation Rejected';
  if (hasClosed) return 'Closed';
  if (deliverySuccess === false) return 'Delivery Exception';
  if (String(invoiceStatus || '').toLowerCase().includes('terkirim')) return 'Delivered';
  if (String(invoiceStatus || '').toLowerCase().includes('pengiriman')) return 'In Transit';
  return 'Open';
}

function podSignatureNote(item) {
  if (field(item, 'receiverName', 'receiver_name')) return `Received by ${field(item, 'receiverName', 'receiver_name')}.`;
  if (field(item, 'receiverSignature', 'receiver_signature')) return 'Receiver signature captured.';
  if (field(item, 'courierSignature', 'courier_signature')) return 'Courier signature captured.';
  return null;
}

function sortByDate(rows, direction = 'asc') {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aDate = safeDate(field(a, 'createdAt', 'created_at', 'updatedAt', 'updated_at'));
    const bDate = safeDate(field(b, 'createdAt', 'created_at', 'updatedAt', 'updated_at'));
    return direction === 'desc' ? bDate - aDate : aDate - bDate;
  });
}

function safeDate(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && normalized !== '-' && normalized !== 'tidak tersedia';
}

function coerceBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function statusLabel(status, isCurrent) {
  if (status === 'completed') return isCurrent ? 'Current' : 'Completed';
  if (status === 'inferred') return isCurrent ? 'Current (Inferred)' : 'Inferred';
  if (status === 'exception') return 'Exception';
  return 'Pending';
}

function priorityTone(priority = '') {
  const value = String(priority).toLowerCase();
  if (value.includes('tinggi') || value.includes('high')) return 'danger';
  if (value.includes('sedang') || value.includes('medium')) return 'warning';
  if (value.includes('rendah') || value.includes('low')) return 'success';
  return 'pending';
}

export function workflowTone(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('exception') || value.includes('danger') || value.includes('no')) return 'danger';
  if (value.includes('inferred') || value.includes('warning')) return 'warning';
  if (value.includes('complete') || value.includes('current') || value.includes('yes') || value.includes('success')) return 'success';
  return 'pending';
}

export function formatWorkflowTimestamp(value) {
  if (!value || value === '-') return 'Not recorded';

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: valueIsDateOnly(value) ? undefined : 'short',
    }).format(parsed);
  }

  return toDisplayValue(value);
}

function valueIsDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatWorkflowValue(value) {
  if (Array.isArray(value)) return value.map((item) => toDisplayValue(item)).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${formatKey(key)}: ${toDisplayValue(item)}`)
      .join('; ');
  }
  if (typeof value === 'number' && value >= 0 && value <= 1) return formatConfidence(value);
  return toDisplayValue(value);
}
