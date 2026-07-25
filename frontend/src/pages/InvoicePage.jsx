import { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, FileText, Edit2, Trash2,
  MapPin, Clock, ChevronDown, Download, Eye, Upload
} from 'lucide-react';
import { invoiceService, customerService, driverService, predictService } from '../api';
import { AREAS, SCHEDULES, getStatusBadgeClass, formatCurrency, formatDate } from '../data/mockData';

const STATUS_OPTIONS = ['Semua', 'Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'];
const PRIORITY_OPTIONS = [
  { value: 'All', label: 'All Priority' },
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Not Urgent', label: 'Not Urgent' },
];
const BULK_TEMPLATE = 'invoiceNo,customerName,area,schedule,cutoff,amount,dueDate,driverName,notes\nINV-2026-001,PT Nusantara,Jakarta Pusat,Senin & Kamis,10:00,2500000,2026-05-20,Budi,Kontrak utama';

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

function parseBulkText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter);

  return lines.slice(1).map(line => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] || '';
      return row;
    }, {});
  }).filter(row => Object.values(row).some(Boolean));
}

function pickBulk(row, keys) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return '-';
}

function getVisiblePriority(priority) {
  const normalized = String(priority || '').trim().toLowerCase();

  if (normalized === 'tinggi' || normalized === 'prioritas' || normalized === 'urgent') {
    return 'Urgent';
  }

  if (
    normalized === 'sedang' ||
    normalized === 'rendah' ||
    normalized === 'normal' ||
    normalized === 'not urgent' ||
    normalized === 'not_urgent'
  ) {
    return 'Not Urgent';
  }

  return priority || '-';
}

function getVisiblePriorityBadgeClass(priority) {
  return getVisiblePriority(priority) === 'Urgent' ? 'badge-high' : 'badge-low';
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
  const [form, setForm] = useState({
    customerName: '', area: '', jadwal: '', cutoff: '',
    amount: '', dueDate: '', notes: '', driverId: ''
  });
  const [predictResult, setPredictResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [bulkText, setBulkText] = useState(BULK_TEMPLATE);
  const [bulkRows, setBulkRows] = useState(parseBulkText(BULK_TEMPLATE));
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
    const invNo = inv.invoiceNo || inv.invoice_no || '';
    const custName = inv.customer?.name || inv.customerName || '';
    const invArea = inv.customer?.area || inv.area || '';
    
    const matchSearch = search === '' ||
      invNo.toLowerCase().includes(search.toLowerCase()) ||
      custName.toLowerCase().includes(search.toLowerCase()) ||
      invArea.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || inv.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || getVisiblePriority(inv.priority) === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setPredictResult(null);
  };

  const handlePredict = async () => {
    if (!form.jadwal || !form.cutoff) return;
    setIsLoading(true);
    try {
      const result = await predictService.predict({ area: form.area, jadwal: form.jadwal, cutoff: form.cutoff });
      setPredictResult(result);
    } catch (err) {
      console.error('Prediction error:', err);
      alert('Priority classification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!predictResult) {
      alert('Run priority classification first.');
      return;
    }
    
    try {
      setIsLoading(true);
      const cust = customers.find(c => c.name === form.customerName);
      
      await invoiceService.create({
        customerId: cust?.id,
        driverId: form.driverId ? parseInt(form.driverId) : null,
        amount: parseFloat(form.amount) || 0,
        date: new Date().toISOString().split('T')[0],
        dueDate: form.dueDate,
        status: 'Menunggu',
        priority: predictResult.priority,
        schedule: form.jadwal,
        cutoff: form.cutoff,
        deliveryDate: form.dueDate,
        notes: form.notes,
      });
      
      await fetchInvoices(); // Refresh list
      setShowModal(false);
      setForm({ customerName: '', area: '', jadwal: '', cutoff: '', amount: '', dueDate: '', notes: '', driverId: '' });
      setPredictResult(null);
    } catch (err) {
      console.error('Create error:', err);
      alert('Gagal membuat invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkTextChange = (value) => {
    setBulkText(value);
    setBulkRows(parseBulkText(value));
    setBulkResult(null);
  };

  const handleBulkFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      alert('Untuk sementara gunakan file CSV dari Excel (Save As CSV) atau copy-paste tabel Excel ke kolom impor.');
      event.target.value = '';
      return;
    }

    const text = await file.text();
    handleBulkTextChange(text);
  };

  const handleBulkSubmit = async () => {
    if (!bulkRows.length) {
      alert('Data belum valid. Pastikan baris pertama berisi header kolom.');
      return;
    }

    try {
      setBulkLoading(true);
      const result = await invoiceService.bulkCreate(bulkRows);
      setBulkResult(result);
      await fetchInvoices();
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Gagal mengimpor invoice secara bulk.');
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
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
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
              placeholder="Cari nomor invoice, pelanggan, atau area..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className="form-select" style={{ width: 'auto', flex: 'none', minWidth: 150 }}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>

          <select className="form-select" style={{ width: 'auto', flex: 'none', minWidth: 140 }}
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
                  <th>No. Invoice</th>
                  <th>Pelanggan / Area</th>
                  <th>Jadwal & Cut-off</th>
                  <th>Nominal</th>
                  <th>Jatuh Tempo</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon"><FileText size={22} /></div>
                        <div className="empty-title">Tidak ada invoice ditemukan</div>
                        <div className="empty-desc">Coba ubah filter atau tambah invoice baru</div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(inv => (
                  <tr key={inv.id}>
                    <td><span className="invoice-no">{inv.invoiceNo || inv.invoice_no}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {inv.customer?.name || inv.customerName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <MapPin size={11} /> {inv.customer?.area || inv.area}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{inv.schedule}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Clock size={11} /> Cut-off: {inv.cutoff}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {formatCurrency(inv.amount)}
                    </td>
                    <td>{formatDate(inv.dueDate || inv.due_date)}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{inv.driver?.name || inv.driverName || '-'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                        <span className="badge-dot" /> {inv.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getVisiblePriorityBadgeClass(inv.priority)}`}>
                        {getVisiblePriority(inv.priority)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 6 }}
                          onClick={() => setDetailInvoice(inv)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 6 }}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Create Invoice */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Create Invoice</div>
                <div className="modal-subtitle">Invoice context will be used for priority classification</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nama Pelanggan <span>*</span></label>
                    <select name="customerName" className="form-select" required
                      value={form.customerName}
                      onChange={e => {
                        const cust = customers.find(c => c.name === e.target.value);
                        setForm(prev => ({
                          ...prev,
                          customerName: e.target.value,
                          area: cust?.area || prev.area,
                          jadwal: cust?.schedule || prev.jadwal,
                          cutoff: cust?.cutoff || prev.cutoff,
                        }));
                        setPredictResult(null);
                      }}>
                      <option value="">-- Pilih pelanggan --</option>
                      {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nominal Invoice <span>*</span></label>
                    <input type="number" name="amount" className="form-input" required
                      placeholder="Rp 0" value={form.amount} onChange={handleFormChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Area / Wilayah <span>*</span></label>
                    <select name="area" className="form-select" required value={form.area} onChange={handleFormChange}>
                      <option value="">-- Pilih area --</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jatuh Tempo <span>*</span></label>
                    <input type="date" name="dueDate" className="form-input" required
                      value={form.dueDate} onChange={handleFormChange} />
                  </div>
                </div>

                <div style={{
                  background: 'rgba(99,102,241,0.05)', border: '1px solid var(--border-accent)',
                  borderRadius: 'var(--radius-md)', padding: '14px 16px'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Classification Parameters
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Jadwal Penerimaan <span>*</span></label>
                      <select name="jadwal" className="form-select" required value={form.jadwal} onChange={handleFormChange}>
                        <option value="">-- Pilih jadwal --</option>
                        {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Batas Waktu (Cut-off) <span>*</span></label>
                      <input type="time" name="cutoff" className="form-input" required
                        value={form.cutoff} onChange={handleFormChange} />
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={handlePredict}
                    disabled={!form.jadwal || !form.cutoff || isLoading}>
                    {isLoading ? (
                      <><span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />Memproses...</>
                    ) : 'Run Priority Classification'}
                  </button>

                  {predictResult && (
                    <div className="prediction-result" style={{ marginTop: 12 }}>
                      <div className="prediction-label">Priority Classification Result</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="prediction-value" style={{
                          color: getVisiblePriority(predictResult.priority) === 'Urgent' ? 'var(--priority-high)' : 'var(--priority-low)'
                        }}>
                          Priority: {getVisiblePriority(predictResult.priority)}
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

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Driver</label>
                    <select name="driverId" className="form-select" value={form.driverId} onChange={handleFormChange}>
                      <option value="">-- Pilih driver --</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Catatan</label>
                    <input type="text" name="notes" className="form-input"
                      placeholder="Instruksi khusus..." value={form.notes} onChange={handleFormChange} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Menyimpan...' : <><Plus size={15} /> Simpan Invoice</>}
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
                <div className="modal-subtitle">Upload CSV dari Excel atau paste tabel langsung dari spreadsheet</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="bulk-import-grid">
                <div className="form-group">
                  <label className="form-label">File CSV / TSV</label>
                  <input
                    type="file"
                    className="form-input"
                    accept=".csv,.tsv,.txt"
                    onChange={handleBulkFile}
                  />
                </div>
                <div className="bulk-hint">
                  Kolom yang didukung: invoiceNo, customerName, area, schedule, cutoff, amount, dueDate, driverName, notes.
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
                  <div className="section-subtitle">{bulkRows.length} baris siap diproses</div>
                </div>
              </div>

              <div className="table-wrapper bulk-preview">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Invoice</th>
                      <th>Pelanggan</th>
                      <th>Area</th>
                      <th>Jadwal</th>
                      <th>Cut-off</th>
                      <th>Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 6).map((row, index) => (
                      <tr key={index}>
                        <td><span className="invoice-no">{pickBulk(row, ['invoiceNo', 'invoice_no', 'no_invoice', 'No Invoice', 'Nomor Invoice'])}</span></td>
                        <td>{pickBulk(row, ['customerName', 'customer_name', 'pelanggan', 'Pelanggan', 'Nama Pelanggan'])}</td>
                        <td>{pickBulk(row, ['area', 'Area', 'wilayah', 'Wilayah'])}</td>
                        <td>{pickBulk(row, ['schedule', 'jadwal', 'Jadwal', 'Jadwal Penerimaan'])}</td>
                        <td>{pickBulk(row, ['cutoff', 'Cutoff', 'cut_off', 'Cut-off'])}</td>
                        <td>{pickBulk(row, ['amount', 'nominal', 'Nominal', 'Nilai Invoice'])}</td>
                      </tr>
                    ))}
                    {bulkRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>
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
              <button className="btn btn-primary" onClick={handleBulkSubmit} disabled={bulkLoading || bulkRows.length === 0}>
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
                <div className="modal-title">{detailInvoice.invoiceNo || detailInvoice.invoice_no}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span className={`badge ${getStatusBadgeClass(detailInvoice.status)}`}>
                    <span className="badge-dot" />{detailInvoice.status}
                  </span>
                  <span className={`badge ${getVisiblePriorityBadgeClass(detailInvoice.priority)}`}>
                    Priority: {getVisiblePriority(detailInvoice.priority)}
                  </span>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetailInvoice(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {[
                ['Pelanggan', detailInvoice.customer?.name || detailInvoice.customerName],
                ['Area', detailInvoice.customer?.area || detailInvoice.area],
                ['Nominal', formatCurrency(detailInvoice.amount)],
                ['Tanggal Input', formatDate(detailInvoice.date)],
                ['Jatuh Tempo', formatDate(detailInvoice.dueDate || detailInvoice.due_date)],
                ['Jadwal', detailInvoice.schedule],
                ['Cut-off', detailInvoice.cutoff],
                ['Driver', detailInvoice.driver?.name || detailInvoice.driverName || '-'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {detailInvoice.notes && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Catatan</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{detailInvoice.notes}</div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailInvoice(null)}>Tutup</button>
              <button className="btn btn-primary"><Edit2 size={14} /> Edit Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
