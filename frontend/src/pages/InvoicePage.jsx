import { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, FileText, Edit2, Trash2,
  MapPin, Clock, ChevronDown, Download, Eye
} from 'lucide-react';
import Topbar from '../components/Topbar';
import { invoiceService, customerService, driverService, predictService } from '../api';
import { AREAS, SCHEDULES, getStatusBadgeClass, getPriorityBadgeClass, formatCurrency, formatDate } from '../data/mockData';

const STATUS_OPTIONS = ['Semua', 'Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'];
const PRIORITY_OPTIONS = ['Semua', 'Tinggi', 'Sedang', 'Rendah'];

export default function InvoicePage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [priorityFilter, setPriorityFilter] = useState('Semua');
  const [showModal, setShowModal] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [form, setForm] = useState({
    customerName: '', area: '', jadwal: '', cutoff: '',
    amount: '', dueDate: '', notes: '', driverId: ''
  });
  const [predictResult, setPredictResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

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
    const matchPriority = priorityFilter === 'Semua' || inv.priority === priorityFilter;
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
      alert('Gagal memprediksi prioritas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!predictResult) {
      alert('Jalankan prediksi C4.5 terlebih dahulu!');
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

  const priorityChipColors = {
    'Tinggi': { bg: 'var(--priority-high-bg)', text: 'var(--priority-high)' },
    'Sedang': { bg: 'var(--priority-medium-bg)', text: 'var(--priority-medium)' },
    'Rendah': { bg: 'var(--priority-low-bg)', text: 'var(--priority-low)' },
  };

  if (pageLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data invoice...</div>;
  }

  return (
    <div>
      <Topbar
        title="Input Invoice"
        subtitle="Manajemen data invoice dan prediksi prioritas"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={15} /> Invoice Baru
          </button>
        }
      />

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
            {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
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
                  <th>Prioritas</th>
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
                      <span className={`badge ${getPriorityBadgeClass(inv.priority)}`}>
                        {inv.priority}
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

      {/* ── Modal: Input Invoice Baru ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Input Invoice Baru</div>
                <div className="modal-subtitle">Data akan diproses oleh model C4.5 untuk klasifikasi prioritas</div>
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
                    🧠 Parameter Model C4.5
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
                    ) : '🔮 Prediksi Prioritas C4.5'}
                  </button>

                  {predictResult && (
                    <div className="prediction-result" style={{ marginTop: 12 }}>
                      <div className="prediction-label">Hasil Prediksi Model</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="prediction-value" style={{
                          color: predictResult.priority === 'Tinggi' ? 'var(--priority-high)' :
                            predictResult.priority === 'Sedang' ? 'var(--priority-medium)' : 'var(--priority-low)'
                        }}>
                          Prioritas {predictResult.priority}
                        </div>
                        <span className="tag">
                          Confidence: {Math.round(predictResult.confidence * 100)}%
                        </span>
                      </div>
                      <div className="prediction-confidence">{predictResult.reason}</div>
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
                  <span className={`badge ${getPriorityBadgeClass(detailInvoice.priority)}`}>
                    Prioritas {detailInvoice.priority}
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
