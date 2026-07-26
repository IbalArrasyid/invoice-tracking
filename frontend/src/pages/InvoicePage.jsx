import { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, FileText, Edit2, Trash2,
  MapPin, Clock, ChevronDown, Download, Eye, Upload
} from 'lucide-react';
import { invoiceService, customerService, driverService, predictService } from '../api';
import { getStatusBadgeClass, formatDate } from '../data/mockData';
import {
  THESIS_DATASET_FIELDS,
  THESIS_REQUIRED_ROW_FIELDS,
  THESIS_FIELD_LABELS,
  THESIS_COMPATIBILITY_AMOUNT,
  THESIS_COMPATIBILITY_AREA,
  createEmptyThesisInvoice,
  getThesisInvoice,
  normalizeThesisLabel,
  serializeThesisMetadata,
  thesisPriorityBadgeClass,
  toBackendPriority,
  toCompatibilityCutoff,
} from '../utils/thesisDataset';

const STATUS_OPTIONS = ['Semua', 'Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'];
const PRIORITY_OPTIONS = [
  { value: 'All', label: 'All Priority' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'NORMAL', label: 'NORMAL' },
];
const BULK_TEMPLATE = [
  THESIS_DATASET_FIELDS.join(','),
  'S202605-0795,CUST172,2026-05-19,2026-05-19,AMIT,End of month,END_MONTH,0,1,Everyday,9,NORMAL,LONG_TIME_TO_CUTOFF',
].join('\n');
const SUPPORTED_BULK_FORMATS = [
  { ext: 'csv', label: 'CSV' },
  { ext: 'xlsx', label: 'Excel (.xlsx)' },
  { ext: 'xls', label: 'Excel (.xls)' },
  { ext: 'txt', label: 'TXT' },
];
const BULK_COLUMN_LABELS = THESIS_FIELD_LABELS;
const BULK_PREVIEW_COLUMNS = THESIS_DATASET_FIELDS;
const REQUIRED_BULK_COLUMNS = THESIS_DATASET_FIELDS;
const CUTOFF_RULE_OPTIONS = ['NO_CUTOFF', 'END_MONTH', 'MONTHLY_DATE', 'NEXT_MONTH_DATE', 'MULTIPLE_MONTHLY_DATE'];
const EXPERT_LABEL_OPTIONS = ['HIGH', 'NORMAL'];
const EXPERT_REASON_OPTIONS = [
  'LONG_TIME_TO_CUTOFF',
  'NO_CUTOFF',
  'LIMITED_RECEIVE_DAY',
  'CUTOFF_NEAR',
  'CUTOFF_TODAY',
  'OVERDUE_CUTOFF',
];
const HEADER_LOOKUP = THESIS_DATASET_FIELDS.reduce((lookup, field) => {
  lookup.set(normalizeHeader(field), field);
  return lookup;
}, new Map());

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.-]+/g, '');
}

function canonicalHeader(value) {
  const normalized = normalizeHeader(value);
  return HEADER_LOOKUP.get(normalized) || String(value || '').replace(/^\uFEFF/, '').trim();
}

function toCellString(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  return String(value).trim();
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(line) {
  return ['\t', ';', ',']
    .map(delimiter => ({ delimiter, count: splitDelimitedLine(line, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function isDuplicateHeaderRow(cells, rawHeaders, headers) {
  const rawMatch = rawHeaders.every((header, index) => normalizeHeader(cells[index]) === normalizeHeader(header));
  const canonicalMatch = headers.every((header, index) => canonicalHeader(cells[index]) === header);
  return rawMatch || canonicalMatch;
}

function parseBulkMatrix(matrix) {
  const rows = matrix
    .map(row => (Array.isArray(row) ? row : []).map(toCellString))
    .filter(row => row.some(Boolean));

  if (!rows.length) {
    return { rows: [], headers: [], error: 'File impor kosong. Tambahkan header dan minimal satu baris invoice.' };
  }

  const rawHeaders = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
  const headers = rawHeaders.map(canonicalHeader);
  const parsedRows = [];

  rows.slice(1).forEach(cells => {
    if (isDuplicateHeaderRow(cells, rawHeaders, headers)) return;

    const row = headers.reduce((item, header, index) => {
      if (header) item[header] = cells[index] || '';
      return item;
    }, {});

    if (Object.values(row).some(Boolean)) parsedRows.push(row);
  });

  return { rows: parsedRows, headers };
}

function parseBulkText(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) {
    return { rows: [], headers: [], error: 'Data impor kosong. Tambahkan header dan minimal satu baris invoice.' };
  }

  const delimiter = detectDelimiter(lines[0]);
  return parseBulkMatrix(lines.map(line => splitDelimitedLine(line, delimiter)));
}

async function parseBulkExcel(arrayBuffer) {
  const XLSXModule = await import('xlsx');
  const XLSX = XLSXModule.default || XLSXModule;
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return { rows: [], headers: [], error: 'File Excel tidak memiliki worksheet.' };
  }

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    header: 1,
    defval: '',
    raw: false,
  });

  return parseBulkMatrix(matrix);
}

function pickBulk(row, keys) {
  const candidates = Array.isArray(keys) ? keys : [keys];
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '-';
}

function getFileExtension(fileName) {
  return String(fileName || '').split('.').pop()?.toLowerCase() || '';
}

function getRowValue(row, key) {
  return String(row?.[key] || '').trim();
}

function formatList(values, limit = 5) {
  const visible = values.slice(0, limit).join(', ');
  return values.length > limit ? `${visible}, dan ${values.length - limit} lainnya` : visible;
}

function validateBulkImport(parsed, existingInvoices = []) {
  const errors = [];
  const rows = parsed?.rows || [];
  const headers = parsed?.headers || [];

  if (parsed?.error) errors.push(parsed.error);
  if (!rows.length && !parsed?.error) {
    errors.push('File impor tidak memiliki baris invoice yang dapat diproses.');
  }

  const missingColumns = REQUIRED_BULK_COLUMNS.filter(column => !headers.includes(column));
  if (missingColumns.length) {
    errors.push(`Kolom wajib belum ada: ${missingColumns.map(column => BULK_COLUMN_LABELS[column]).join(', ')}.`);
  }

  const incompleteRows = rows
    .map((row, index) => ({
      rowNumber: index + 2,
      missing: THESIS_REQUIRED_ROW_FIELDS.filter(column => !getRowValue(row, column)),
    }))
    .filter(item => item.missing.length);

  if (incompleteRows.length) {
    errors.push(`Baris ${formatList(incompleteRows.map(item => item.rowNumber))} belum lengkap.`);
  }

  const existingInvoiceNos = new Set(
    existingInvoices
      .map(invoice => String(getThesisInvoice(invoice).invoice_no || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const duplicatedExisting = rows
    .map(row => getRowValue(row, 'invoice_no'))
    .filter(invoiceNo => invoiceNo && existingInvoiceNos.has(invoiceNo.toLowerCase()));

  if (duplicatedExisting.length) {
    errors.push(`Nomor invoice sudah ada: ${formatList([...new Set(duplicatedExisting)])}.`);
  }

  return errors;
}

function toCsvCell(value) {
  const cell = String(value || '');
  if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function rowsToBulkText(rows) {
  const header = THESIS_DATASET_FIELDS;
  return [
    header.join(','),
    ...rows.map(row => header.map(column => toCsvCell(row[column])).join(',')),
  ].join('\n');
}

function makeInternalInvoiceNo(invoiceNo, usedInvoiceNos) {
  const raw = String(invoiceNo || '').trim() || `INV-${Date.now()}`;
  let candidate = raw.slice(0, 30);
  let counter = 2;

  while (usedInvoiceNos.has(candidate.toLowerCase())) {
    const suffix = `-${counter}`;
    candidate = `${raw.slice(0, 30 - suffix.length)}${suffix}`;
    counter += 1;
  }

  usedInvoiceNos.add(candidate.toLowerCase());
  return candidate;
}

function prepareBulkRowsForApi(rows, existingInvoices = []) {
  const usedInvoiceNos = new Set(
    existingInvoices
      .map(invoice => String(invoice.invoiceNo || invoice.invoice_no || '').trim().toLowerCase())
      .filter(Boolean)
  );

  return rows.map(row => ({
    invoiceNo: makeInternalInvoiceNo(row.invoice_no, usedInvoiceNos),
    customerName: row.customer_name_masking,
    area: THESIS_COMPATIBILITY_AREA,
    schedule: row.receive_schedule,
    cutoff: toCompatibilityCutoff(row),
    dueDate: row.receive_date,
    date: row.sent_date,
    deliveryDate: row.sent_date,
    driverName: row.Driver,
    amount: THESIS_COMPATIBILITY_AMOUNT,
    status: 'Menunggu',
    priority: toBackendPriority(row.expert_label),
    notes: serializeThesisMetadata(row),
  }));
}

function getVisiblePriority(priority) {
  return normalizeThesisLabel(priority);
}

function getVisiblePriorityBadgeClass(priority) {
  return thesisPriorityBadgeClass(priority);
}

function formatThesisValue(field, value) {
  if (['receive_date', 'sent_date'].includes(field)) return formatDate(value);
  return value || '-';
}

function getThesisDisplayRows(invoice) {
  const thesis = getThesisInvoice(invoice);
  return THESIS_DATASET_FIELDS.map(field => [field, formatThesisValue(field, thesis[field])]);
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [form, setForm] = useState(createEmptyThesisInvoice());
  const [predictResult, setPredictResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [bulkText, setBulkText] = useState(BULK_TEMPLATE);
  const [bulkRows, setBulkRows] = useState(() => parseBulkText(BULK_TEMPLATE).rows);
  const [bulkHeaders, setBulkHeaders] = useState(() => parseBulkText(BULK_TEMPLATE).headers);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkSourceName, setBulkSourceName] = useState('Template CSV');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchInvoices = async () => {
    try {
      const res = await invoiceService.getAll();
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setPageLoading(true);
      try {
        await fetchInvoices();
        const [custRes, drvRes] = await Promise.all([
          customerService.getAll(),
          driverService.getAll()
        ]);
        setCustomers(custRes || []);
        setDrivers(drvRes || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setPageLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = invoices.filter(inv => {
    const thesis = getThesisInvoice(inv);
    
    const matchSearch = search === '' ||
      thesis.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
      thesis.customer_name_masking.toLowerCase().includes(search.toLowerCase()) ||
      thesis.Driver.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || inv.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || getVisiblePriority(thesis.expert_label || inv.priority) === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setPredictResult(null);
  };

  const handlePredict = async () => {
    if (!form.receive_schedule || !form.cutoff_rule || !form.days_to_cutoff) return;
    setIsLoading(true);
    try {
      const result = await predictService.predict({
        area: THESIS_COMPATIBILITY_AREA,
        jadwal: form.receive_schedule,
        cutoff: toCompatibilityCutoff(form),
        invoiceNo: form.invoice_no,
        nama_customer: form.customer_name_masking,
        nama_driver: form.Driver,
      });
      setPredictResult(result);
      setForm(prev => ({
        ...prev,
        expert_label: normalizeThesisLabel(result.priority || prev.expert_label),
        expert_reason: prev.expert_reason || String(result.reason || '').replace(/\s+/g, '_').toUpperCase(),
      }));
    } catch (err) {
      console.error('Prediction error:', err);
      alert('Priority classification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingInvoice(null);
    setForm(createEmptyThesisInvoice());
    setPredictResult(null);
    setShowModal(true);
  };

  const openEditModal = (invoice) => {
    setEditingInvoice(invoice);
    setForm(getThesisInvoice(invoice));
    setPredictResult(null);
    setShowModal(true);
  };

  const ensureCustomer = async (values) => {
    const name = values.customer_name_masking.trim();
    let customer = customers.find(c => c.name === name);
    if (customer) return customer;

    customer = await customerService.create({
      name,
      area: THESIS_COMPATIBILITY_AREA,
      schedule: values.receive_schedule || 'Everyday',
      cutoff: toCompatibilityCutoff(values),
    });
    setCustomers(prev => [...prev, customer]);
    return customer;
  };

  const ensureDriver = async (driverName) => {
    const name = String(driverName || '').trim();
    if (!name) return null;

    let driver = drivers.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (driver) return driver;

    driver = await driverService.create({
      name,
      phone: '-',
      area: THESIS_COMPATIBILITY_AREA,
    });
    setDrivers(prev => [...prev, driver]);
    return driver;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = THESIS_REQUIRED_ROW_FIELDS.filter(field => !getRowValue(form, field));
    if (missing.length) {
      alert(`Field wajib belum lengkap: ${missing.join(', ')}.`);
      return;
    }
    
    try {
      setIsLoading(true);
      const customer = await ensureCustomer(form);
      const driver = await ensureDriver(form.Driver);
      const payload = {
        customerId: customer.id,
        driverId: driver?.id || null,
        amount: THESIS_COMPATIBILITY_AMOUNT,
        date: form.sent_date,
        dueDate: form.receive_date,
        status: editingInvoice?.status || 'Menunggu',
        priority: toBackendPriority(form.expert_label),
        schedule: form.receive_schedule,
        cutoff: toCompatibilityCutoff(form),
        deliveryDate: form.sent_date,
        notes: serializeThesisMetadata(form),
      };
      
      if (editingInvoice) {
        await invoiceService.update(editingInvoice.id, payload);
      } else {
        const usedInvoiceNos = new Set(
          invoices
            .map(invoice => String(invoice.invoiceNo || invoice.invoice_no || '').trim().toLowerCase())
            .filter(Boolean)
        );
        await invoiceService.create({
          ...payload,
          invoiceNo: makeInternalInvoiceNo(form.invoice_no, usedInvoiceNos),
        });
      }
      
      await fetchInvoices(); // Refresh list
      setShowModal(false);
      setEditingInvoice(null);
      setForm(createEmptyThesisInvoice());
      setPredictResult(null);
    } catch (err) {
      console.error('Create error:', err);
      alert(editingInvoice ? 'Gagal memperbarui invoice' : 'Gagal membuat invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkTextChange = (value) => {
    const parsed = parseBulkText(value);
    setBulkText(value);
    setBulkRows(parsed.rows);
    setBulkHeaders(parsed.headers);
    setBulkErrors(validateBulkImport(parsed, invoices));
    setBulkSourceName('Paste data');
    setBulkResult(null);
  };

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name);
    const supported = SUPPORTED_BULK_FORMATS.some(format => format.ext === extension);

    if (!supported) {
      const message = 'Format file tidak didukung. Gunakan CSV, Excel (.xlsx/.xls), atau TXT.';
      setBulkRows([]);
      setBulkHeaders([]);
      setBulkErrors([message]);
      setBulkSourceName(file.name);
      setBulkResult(null);
      alert(message);
      event.target.value = '';
      return;
    }

    try {
      const parsed = ['xlsx', 'xls'].includes(extension)
        ? await parseBulkExcel(await file.arrayBuffer())
        : parseBulkText(await file.text());

      setBulkRows(parsed.rows);
      setBulkHeaders(parsed.headers);
      setBulkErrors(validateBulkImport(parsed, invoices));
      setBulkText(rowsToBulkText(parsed.rows));
      setBulkSourceName(file.name);
      setBulkResult(null);
    } catch (err) {
      const message = 'File tidak dapat dibaca. Pastikan format dan header kolom sudah benar.';
      console.error('Bulk file parse error:', err);
      setBulkRows([]);
      setBulkHeaders([]);
      setBulkErrors([message]);
      setBulkSourceName(file.name);
      setBulkResult(null);
      alert(message);
    } finally {
      event.target.value = '';
    }
  };

  const handleBulkSubmit = async () => {
    const errors = validateBulkImport({ rows: bulkRows, headers: bulkHeaders }, invoices);
    setBulkErrors(errors);

    if (errors.length) {
      alert(errors[0]);
      return;
    }

    try {
      setBulkLoading(true);
      const result = await invoiceService.bulkCreate(prepareBulkRowsForApi(bulkRows, invoices));
      setBulkResult(result);
      await fetchInvoices();
    } catch (err) {
      console.error('Bulk import error:', err);
      const message = err.code === 'ECONNABORTED'
        ? 'Import membutuhkan waktu lebih lama dari batas koneksi. Coba lagi, atau pastikan backend tidak sedang sibuk.'
        : err.response?.data?.message
          || (err.request ? 'Backend tidak merespons. Pastikan server backend berjalan di http://localhost:3000.' : 'Gagal mengimpor invoice secara bulk.');
      setBulkErrors([message]);
      alert(message);
    } finally {
      setBulkLoading(false);
    }
  };

  if (pageLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data invoice...</div>;
  }

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Invoice List</h1>
          <p>Prepare invoice data before priority classification</p>
        </div>

        <div className="topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkModal(true)}>
            <Upload size={14} /> Bulk Import
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </header>

      <div className="page-container">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="search-wrap">
            <Search className="search-icon" />
            <input
              className="search-input"
              placeholder="Cari invoice_no, customer_name_masking, atau Driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className="form-select" style={{ width: 'auto', minWidth: 150, maxWidth: '100%' }}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>

          <select className="form-select" style={{ width: 'auto', minWidth: 140, maxWidth: '100%' }}
            value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <button className="btn btn-secondary btn-sm">
            <Download size={14} /> Export
          </button>
        </div>

        {/* Count summary */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'].map(s => {
            const count = invoices.filter(i => i.status === s).length;
            return (
              <button key={s}
                className={`tag`}
                style={{ cursor: 'pointer', padding: '4px 12px' }}
                onClick={() => setStatusFilter(statusFilter === s ? 'Semua' : s)}
              >
                <span className={`badge-dot`} style={{
                  background: s === 'Terkirim' ? 'var(--priority-low)' :
                    s === 'Menunggu' ? 'var(--priority-medium)' :
                      s === 'Dalam Pengiriman' ? 'var(--primary-light)' : 'var(--priority-high)'
                }} />
                {s}: <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
              </button>
            );
          })}
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
            Menampilkan {filtered.length} dari {invoices.length}
          </span>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper" style={{ borderRadius: 'var(--radius-lg)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>invoice_no</th>
                  <th>customer_name_masking</th>
                  <th>sent_date</th>
                  <th>receive_schedule</th>
                  <th>days_to_cutoff</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>expert_label</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-icon"><FileText size={22} /></div>
                        <div className="empty-title">Tidak ada invoice ditemukan</div>
                        <div className="empty-desc">Coba ubah filter atau tambah invoice baru</div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(inv => {
                  const thesis = getThesisInvoice(inv);
                  return (
                  <tr key={inv.id}>
                    <td><span className="invoice-no">{thesis.invoice_no}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {thesis.customer_name_masking}
                      </div>
                    </td>
                    <td>{formatDate(thesis.sent_date)}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{thesis.receive_schedule || '-'}</td>
                    <td>{thesis.days_to_cutoff || '-'}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{thesis.Driver || '-'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                        <span className="badge-dot" /> {inv.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getVisiblePriorityBadgeClass(thesis.expert_label)}`}>
                        {getVisiblePriority(thesis.expert_label)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 6 }}
                          onClick={() => setDetailInvoice(inv)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 6 }}
                          onClick={() => openEditModal(inv)}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Create/Edit Invoice */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</div>
                <div className="modal-subtitle">Use the finalized thesis dataset fields only</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">invoice_no <span>*</span></label>
                    <input name="invoice_no" className="form-input" required
                      value={form.invoice_no} onChange={handleFormChange} placeholder="S202605-0795" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">customer_name_masking <span>*</span></label>
                    <input name="customer_name_masking" className="form-input" required list="customer-mask-options"
                      value={form.customer_name_masking} onChange={handleFormChange} placeholder="CUST172" />
                    <datalist id="customer-mask-options">
                      {customers.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">receive_date <span>*</span></label>
                    <input type="date" name="receive_date" className="form-input" required
                      value={form.receive_date} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">sent_date <span>*</span></label>
                    <input type="date" name="sent_date" className="form-input" required
                      value={form.sent_date} onChange={handleFormChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Driver <span>*</span></label>
                    <input name="Driver" className="form-input" required list="driver-options"
                      value={form.Driver} onChange={handleFormChange} placeholder="AMIT" />
                    <datalist id="driver-options">
                      {drivers.map(d => <option key={d.id} value={d.name} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="form-label">receive_schedule <span>*</span></label>
                    <input name="receive_schedule" className="form-input" required
                      value={form.receive_schedule} onChange={handleFormChange} placeholder="Everyday" />
                  </div>
                </div>

                <div style={{
                  background: 'rgba(99,102,241,0.05)', border: '1px solid var(--border-accent)',
                  borderRadius: 'var(--radius-md)', padding: '14px 16px'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Classification Features
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">cutoff_type <span>*</span></label>
                      <input name="cutoff_type" className="form-input" required
                        value={form.cutoff_type} onChange={handleFormChange} placeholder="End of month" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">cutoff_rule <span>*</span></label>
                      <select name="cutoff_rule" className="form-select" required value={form.cutoff_rule} onChange={handleFormChange}>
                        <option value="">-- Select cutoff_rule --</option>
                        {CUTOFF_RULE_OPTIONS.map(rule => <option key={rule} value={rule}>{rule}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">cutoff_value</label>
                      <input name="cutoff_value" className="form-input"
                        value={form.cutoff_value} onChange={handleFormChange} placeholder="25" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">receive_day_code</label>
                      <input name="receive_day_code" className="form-input"
                        value={form.receive_day_code} onChange={handleFormChange} placeholder="1,2,3,4,5" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">days_to_cutoff <span>*</span></label>
                      <input type="number" name="days_to_cutoff" className="form-input" required
                        value={form.days_to_cutoff} onChange={handleFormChange} placeholder="9" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">expert_label <span>*</span></label>
                      <select name="expert_label" className="form-select" required value={form.expert_label} onChange={handleFormChange}>
                        {EXPERT_LABEL_OPTIONS.map(label => <option key={label} value={label}>{label}</option>)}
                      </select>
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={handlePredict}
                    disabled={!form.receive_schedule || !form.cutoff_rule || !form.days_to_cutoff || isLoading}>
                    {isLoading ? (
                      <><span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />Memproses...</>
                    ) : 'Run Priority Classification'}
                  </button>

                  {predictResult && (
                    <div className="prediction-result" style={{ marginTop: 12 }}>
                      <div className="prediction-label">Priority Classification Result</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="prediction-value" style={{
                          color: getVisiblePriority(predictResult.priority) === 'HIGH' ? 'var(--priority-high)' : 'var(--priority-low)'
                        }}>
                          expert_label: {getVisiblePriority(predictResult.priority)}
                        </div>
                        <span className="tag">
                          Confidence: {Math.round(predictResult.confidence * 100)}%
                        </span>
                      </div>
                      <div className="prediction-confidence">
                        Classification output is ready for the next workflow step.
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="form-group">
                    <label className="form-label">expert_reason <span>*</span></label>
                    <input name="expert_reason" className="form-input" required list="expert-reason-options"
                      value={form.expert_reason} onChange={handleFormChange} placeholder="LONG_TIME_TO_CUTOFF" />
                    <datalist id="expert-reason-options">
                      {EXPERT_REASON_OPTIONS.map(reason => <option key={reason} value={reason} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : <><Plus size={15} /> {editingInvoice ? 'Update Invoice' : 'Simpan Invoice'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
          <div className="modal" style={{ maxWidth: 900 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Bulk Input Invoice</div>
                <div className="modal-subtitle">Upload finalized thesis dataset headers from CSV, Excel, TXT, or pasted table data</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="bulk-import-grid">
                <div className="form-group">
                  <label className="form-label">File Bulk Import</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleBulkFile}
                  />
                </div>
                <div className="bulk-hint">
                  <div className="supported-format-list">
                    {SUPPORTED_BULK_FORMATS.map(format => (
                      <span key={format.ext} className="format-chip">{format.label}</span>
                    ))}
                  </div>
                  Header wajib: {THESIS_DATASET_FIELDS.join(', ')}.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Paste data dari Excel</label>
                <textarea
                  className="form-textarea bulk-textarea"
                  value={bulkText}
                  onChange={e => handleBulkTextChange(e.target.value)}
                />
              </div>

              <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="section-title">Preview Import</div>
                  <div className="section-subtitle">
                    {bulkRows.length} baris siap diproses{bulkSourceName ? ` dari ${bulkSourceName}` : ''}
                  </div>
                </div>
              </div>

              {bulkErrors.length > 0 && (
                <div className="alert alert-danger">
                  <FileText size={16} />
                  <div>
                    {bulkErrors.map(error => (
                      <div key={error}>{error}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="table-wrapper bulk-preview">
                <table className="data-table">
                  <thead>
                    <tr>
                      {BULK_PREVIEW_COLUMNS.map(column => (
                        <th key={column}>{BULK_COLUMN_LABELS[column]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 6).map((row, index) => (
                      <tr key={index}>
                        {BULK_PREVIEW_COLUMNS.map(column => (
                          <td key={column}>
                            {column === 'invoiceNo'
                              ? <span className="invoice-no">{pickBulk(row, column)}</span>
                              : pickBulk(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {bulkRows.length === 0 && (
                      <tr>
                        <td colSpan={BULK_PREVIEW_COLUMNS.length}>
                          <div className="empty-state" style={{ padding: 28 }}>
                            <div className="empty-title">Belum ada data valid</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {bulkResult && (
                <div className="alert alert-success">
                  <FileText size={16} />
                  <div>
                    <strong>{bulkResult.created?.length || 0} invoice berhasil diimpor.</strong>
                    {bulkResult.skipped?.length > 0 && ` ${bulkResult.skipped.length} baris dilewati karena data belum lengkap atau nomor invoice duplikat.`}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)}>Tutup</button>
              <button className="btn btn-primary" onClick={handleBulkSubmit} disabled={bulkLoading || bulkRows.length === 0 || bulkErrors.length > 0}>
                <Upload size={15} /> {bulkLoading ? 'Mengimpor...' : 'Import Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detail Invoice ── */}
      {detailInvoice && (
        <div className="modal-backdrop" onClick={() => setDetailInvoice(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{getThesisInvoice(detailInvoice).invoice_no}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span className={`badge ${getStatusBadgeClass(detailInvoice.status)}`}>
                    <span className="badge-dot" />{detailInvoice.status}
                  </span>
                  <span className={`badge ${getVisiblePriorityBadgeClass(getThesisInvoice(detailInvoice).expert_label)}`}>
                    expert_label: {getVisiblePriority(getThesisInvoice(detailInvoice).expert_label)}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailInvoice(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {getThesisDisplayRows(detailInvoice).map(([label, value]) => (
                <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailInvoice(null)}>Tutup</button>
              <button className="btn btn-primary" onClick={() => {
                openEditModal(detailInvoice);
                setDetailInvoice(null);
              }}><Edit2 size={14} /> Edit Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
