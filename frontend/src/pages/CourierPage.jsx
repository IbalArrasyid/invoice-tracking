import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, Clock, FileSignature, MapPin, PackageCheck,
  RotateCcw, Search, Send, Truck
} from 'lucide-react';
import { trackingService } from '../api';
import { formatCurrency, formatDate, formatDateTime, getStatusBadgeClass } from '../data/mockData';

const STATUS_FLOW = ['Dalam Pengiriman', 'Terkirim', 'Kembali'];

function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = point(event);
    drawingRef.current = true;
    hasInkRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = point(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    hasInkRef.current = false;
    onChange('');
  };

  return (
    <div className="signature-panel">
      <div className="signature-head">
        <div>
          <div className="section-title">{label}</div>
          <div className="section-subtitle">Gunakan mouse atau layar sentuh</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>Bersihkan</button>
      </div>
      <canvas
        ref={canvasRef}
        width="640"
        height="220"
        className="signature-canvas"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerLeave={stop}
      />
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'Terkirim') return <CheckCircle2 size={15} />;
  if (status === 'Dalam Pengiriman') return <Truck size={15} />;
  if (status === 'Kembali') return <RotateCcw size={15} />;
  return <Clock size={15} />;
}

function getVisiblePriority(priority) {
  const normalized = String(priority || '').trim().toLowerCase();
  if (normalized === 'tinggi' || normalized === 'prioritas' || normalized === 'urgent') return 'Urgent';
  if (normalized === 'sedang' || normalized === 'rendah' || normalized === 'normal' || normalized === 'not urgent') return 'Not Urgent';
  return priority || '-';
}

function getVisiblePriorityBadgeClass(priority) {
  return getVisiblePriority(priority) === 'Urgent' ? 'badge-high' : 'badge-low';
}

export default function CourierPage() {
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Dalam Pengiriman');
  const [notes, setNotes] = useState('');
  const [courierSignature, setCourierSignature] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverSignature, setReceiverSignature] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Kurir' };
  const courierName = user.name || user.email || 'Kurir';

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await trackingService.getAll();
      setInvoices(data || []);
      if (!selected && data?.length) setSelected(data[0]);
    } catch (err) {
      console.error('Error fetching courier data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!selected?.id) return;
      try {
        const data = await trackingService.getHistory(selected.id);
        setHistory(data || []);
      } catch (err) {
        console.error('Error fetching delivery history:', err);
      }
    };
    loadHistory();
  }, [selected?.id]);

  const filtered = invoices.filter((invoice) => {
    const q = search.toLowerCase();
    return !q ||
      (invoice.invoiceNo || '').toLowerCase().includes(q) ||
      (invoice.customer?.name || '').toLowerCase().includes(q) ||
      (invoice.customer?.area || '').toLowerCase().includes(q);
  });

  const resetAction = () => {
    setNotes('');
    setCourierSignature('');
    setReceiverName('');
    setReceiverSignature('');
  };

  const submitUpdate = async () => {
    if (!selected) return;
    if (status === 'Dalam Pengiriman' && !courierSignature) {
      alert('Tanda tangan kurir wajib diisi saat mulai pengiriman.');
      return;
    }
    if (status === 'Terkirim' && (!receiverName || !receiverSignature)) {
      alert('Nama dan tanda tangan penerima wajib diisi saat invoice diterima.');
      return;
    }

    try {
      setSaving(true);
      const updated = await trackingService.updateStatus(selected.id, status, {
        notes,
        updatedBy: courierName,
        courierSignature: status === 'Dalam Pengiriman' ? courierSignature : undefined,
        receiverName: status === 'Terkirim' ? receiverName : undefined,
        receiverSignature: status === 'Terkirim' ? receiverSignature : undefined,
      });
      await fetchData();
      setSelected(updated);
      const updatedHistory = await trackingService.getHistory(selected.id);
      setHistory(updatedHistory || []);
      resetAction();
    } catch (err) {
      console.error('Courier update error:', err);
      alert('Gagal menyimpan update pengiriman.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="topbar">
        <div className="topbar-title">
          <h1>Proof of Delivery</h1>
          <p>Capture delivery updates and receiver proof for invoice completion</p>
        </div>
      </header>

      <div className="page-container courier-layout">
        <section className="courier-list">
          <div className="search-wrap" style={{ marginBottom: 12 }}>
            <Search className="search-icon" />
            <input
              className="search-input"
              placeholder="Cari invoice, pelanggan, atau area..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="courier-stack">
            {filtered.map((invoice) => (
              <button
                type="button"
                key={invoice.id}
                className={`courier-card ${selected?.id === invoice.id ? 'active' : ''}`}
                onClick={() => setSelected(invoice)}
              >
                <div className="courier-card-top">
                  <span className="invoice-no">{invoice.invoiceNo}</span>
                  <span className={`badge ${getStatusBadgeClass(invoice.status)}`}>
                    <StatusIcon status={invoice.status} /> {invoice.status}
                  </span>
                </div>
                <strong>{invoice.customer?.name}</strong>
                <span><MapPin size={12} /> {invoice.customer?.area}</span>
                <div className="courier-card-foot">
                  <span>{formatCurrency(invoice.amount)}</span>
                  <span className={`badge ${getVisiblePriorityBadgeClass(invoice.priority)}`}>{getVisiblePriority(invoice.priority)}</span>
                </div>
              </button>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon"><PackageCheck size={22} /></div>
                <div className="empty-title">Tidak ada invoice</div>
              </div>
            )}
          </div>
        </section>

        {selected ? (
          <section className="courier-detail">
            <div className="card">
              <div className="courier-detail-head">
                <div>
                  <div className="invoice-no" style={{ marginBottom: 6 }}>{selected.invoiceNo}</div>
                  <h2>{selected.customer?.name}</h2>
                  <p>{selected.customer?.area} · Cut-off {selected.cutoff} · Jatuh tempo {formatDate(selected.dueDate || selected.due_date)}</p>
                </div>
                <span className={`badge ${getVisiblePriorityBadgeClass(selected.priority)}`}>Priority: {getVisiblePriority(selected.priority)}</span>
              </div>

              <div className="delivery-kpi">
                <div><span>Status</span><strong>{selected.status}</strong></div>
                <div><span>Driver</span><strong>{selected.driver?.name || courierName}</strong></div>
                <div><span>Nominal</span><strong>{formatCurrency(selected.amount)}</strong></div>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <div>
                  <div className="section-title">Update Pengiriman</div>
                  <div className="section-subtitle">Pilih proses saat ini, lalu simpan bukti digital</div>
                </div>
                <Send size={18} color="var(--primary-light)" />
              </div>

              <div className="segmented-control">
                {STATUS_FLOW.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={status === item ? 'active' : ''}
                    onClick={() => setStatus(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Catatan perjalanan</label>
                <textarea
                  className="form-textarea"
                  placeholder="Contoh: invoice sudah diterima security lobby..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              {status === 'Dalam Pengiriman' && (
                <SignaturePad
                  label="Tanda Tangan Kurir"
                  value={courierSignature}
                  onChange={setCourierSignature}
                />
              )}

              {status === 'Terkirim' && (
                <>
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">Nama penerima <span>*</span></label>
                    <input
                      className="form-input"
                      value={receiverName}
                      onChange={(event) => setReceiverName(event.target.value)}
                      placeholder="Nama lengkap penerima"
                    />
                  </div>
                  <SignaturePad
                    label="Tanda Tangan Penerima"
                    value={receiverSignature}
                    onChange={setReceiverSignature}
                  />
                </>
              )}

              <div className="modal-footer" style={{ marginTop: 18 }}>
                <button type="button" className="btn btn-secondary" onClick={resetAction}>Reset</button>
                <button type="button" className="btn btn-primary" onClick={submitUpdate} disabled={saving}>
                  <FileSignature size={15} /> {saving ? 'Menyimpan...' : 'Simpan Update'}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Bukti & Riwayat Digital</div>
              <div className="delivery-history">
                {history.map((item) => (
                  <div className="delivery-history-item" key={item.id}>
                    <div>
                      <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                        <StatusIcon status={item.status} /> {item.status}
                      </span>
                      <p>{item.notes || 'Tidak ada catatan'}</p>
                      <small>{formatDateTime(item.createdAt || item.created_at)} · {item.updatedBy || item.updated_by}</small>
                    </div>
                    <div className="signature-proof">
                      {item.courierSignature && <img src={item.courierSignature} alt="Tanda tangan kurir" />}
                      {item.receiverSignature && <img src={item.receiverSignature} alt="Tanda tangan penerima" />}
                      {item.receiverName && <span>Diterima oleh {item.receiverName}</span>}
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="empty-desc">Belum ada riwayat pengiriman.</div>}
              </div>
            </div>
          </section>
        ) : (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Truck size={22} /></div>
              <div className="empty-title">Pilih invoice</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
