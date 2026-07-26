export const THESIS_DATASET_FIELDS = [
  'invoice_no',
  'customer_name_masking',
  'receive_date',
  'sent_date',
  'Driver',
  'cutoff_type',
  'cutoff_rule',
  'cutoff_value',
  'receive_day_code',
  'receive_schedule',
  'days_to_cutoff',
  'expert_label',
  'expert_reason',
];

export const THESIS_REQUIRED_ROW_FIELDS = [
  'invoice_no',
  'customer_name_masking',
  'receive_date',
  'sent_date',
  'Driver',
  'cutoff_type',
  'cutoff_rule',
  'receive_schedule',
  'days_to_cutoff',
  'expert_label',
  'expert_reason',
];

export const THESIS_FIELD_LABELS = THESIS_DATASET_FIELDS.reduce((labels, field) => {
  labels[field] = field;
  return labels;
}, {});

export const THESIS_COMPATIBILITY_AMOUNT = 0;
export const THESIS_COMPATIBILITY_AREA = 'Thesis Dataset';

export function normalizeThesisLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'urgent', 'prioritas', 'tinggi'].includes(normalized)) return 'HIGH';
  if (['normal', 'not urgent', 'not_urgent', 'sedang', 'rendah', 'medium', 'low'].includes(normalized)) return 'NORMAL';
  return value ? String(value).trim().toUpperCase() : 'NORMAL';
}

export function thesisPriorityBadgeClass(value) {
  return normalizeThesisLabel(value) === 'HIGH' ? 'badge-high' : 'badge-low';
}

export function toBackendPriority(value) {
  return normalizeThesisLabel(value) === 'HIGH' ? 'Tinggi' : 'Rendah';
}

export function toCompatibilityCutoff(source = {}) {
  const direct = String(source.cutoff || source.cut_off_jam || '').trim();
  if (/^\d{1,2}:\d{2}$/.test(direct)) return direct.padStart(5, '0');

  const rule = String(source.cutoff_rule || source.cutoff_type || '').trim().toUpperCase();
  const days = Number(source.days_to_cutoff);

  if (rule === 'NO_CUTOFF' || rule === 'NO CUT OFF') return '23:59';
  if (Number.isFinite(days)) {
    if (days <= 1) return '09:00';
    if (days <= 3) return '12:00';
    return '15:00';
  }

  return '12:00';
}

export function parseThesisMetadata(notes) {
  if (!notes || typeof notes !== 'string') return {};

  try {
    const parsed = JSON.parse(notes);
    const hasDatasetField = THESIS_DATASET_FIELDS.some(field => parsed?.[field] !== undefined);
    return parsed?.__thesisDataset || hasDatasetField ? parsed : {};
  } catch (_err) {
    return {};
  }
}

export function buildThesisMetadata(values = {}) {
  return THESIS_DATASET_FIELDS.reduce((metadata, field) => {
    metadata[field] = values[field] ?? '';
    return metadata;
  }, { __thesisDataset: true });
}

export function serializeThesisMetadata(values = {}) {
  return JSON.stringify(buildThesisMetadata(values));
}

export function getThesisInvoice(invoice = {}) {
  const metadata = parseThesisMetadata(invoice.notes);
  const driverName = invoice.driver?.name || invoice.driverName || invoice.driver_name || '';
  const customerName = invoice.customer?.name || invoice.customerName || invoice.customer_name || '';

  return {
    invoice_no: metadata.invoice_no || invoice.invoiceNo || invoice.invoice_no || '',
    customer_name_masking: metadata.customer_name_masking || customerName || '',
    receive_date: metadata.receive_date || invoice.dueDate || invoice.due_date || '',
    sent_date: metadata.sent_date || invoice.date || invoice.deliveryDate || invoice.delivery_date || '',
    Driver: metadata.Driver || driverName || '',
    cutoff_type: metadata.cutoff_type || '',
    cutoff_rule: metadata.cutoff_rule || '',
    cutoff_value: metadata.cutoff_value ?? '',
    receive_day_code: metadata.receive_day_code ?? '',
    receive_schedule: metadata.receive_schedule || invoice.schedule || '',
    days_to_cutoff: metadata.days_to_cutoff ?? '',
    expert_label: normalizeThesisLabel(metadata.expert_label || invoice.priority),
    expert_reason: metadata.expert_reason || '',
  };
}

export function createEmptyThesisInvoice() {
  return {
    invoice_no: '',
    customer_name_masking: '',
    receive_date: '',
    sent_date: '',
    Driver: '',
    cutoff_type: '',
    cutoff_rule: '',
    cutoff_value: '',
    receive_day_code: '',
    receive_schedule: '',
    days_to_cutoff: '',
    expert_label: 'NORMAL',
    expert_reason: '',
  };
}
