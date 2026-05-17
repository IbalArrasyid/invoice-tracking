import { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Clock, Phone } from 'lucide-react';
import Topbar from '../components/Topbar';
import { customerService, invoiceService } from '../api';
import { AREAS, SCHEDULES } from '../data/mockData';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    area: '',
    schedule: '',
    cutoff: '',
    contact: '',
    phone: '',
    address: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custRes, invRes] = await Promise.all([
        customerService.getAll(),
        invoiceService.getAll()
      ]);
      setCustomers(custRes || []);
      setInvoices(invRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await customerService.create(form);
      await fetchData();
      setShowModal(false);
      setForm({ name: '', area: '', schedule: '', cutoff: '', contact: '', phone: '', address: '' });
    } catch (err) {
      console.error('Create customer error:', err);
      alert(err.response?.data?.message || 'Gagal menambahkan pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.area.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat data pelanggan...</div>;
  }

  return (
    <div>
      <Topbar
        title="Data Pelanggan"
        subtitle="Manajemen data pelanggan dan jadwal penerimaan"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={15} /> Tambah Pelanggan</button>}
      />
      <div className="page-container">
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          <div className="search-wrap">
            <Search className="search-icon" />
            <input className="search-input" placeholder="Cari pelanggan..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(c => {
            const invCount = invoices.filter(i => (i.customerId === c.id) || (i.customer?.id === c.id) || (i.customerName === c.name)).length;
            return (
              <div key={c.id} className="card" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kontak: {c.contact}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-light)' }}>{invCount}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Invoice</div>
                  </div>
                </div>
                <div className="divider" style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={13} color="var(--text-muted)" /> {c.area}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <Clock size={13} color="var(--text-muted)" /> {c.schedule} · Cut-off {c.cutoff}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Tambah Pelanggan</div>
                <div className="modal-subtitle">Data ini dipakai untuk jadwal penerimaan dan prediksi prioritas invoice</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nama Pelanggan <span>*</span></label>
                    <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Area <span>*</span></label>
                    <select name="area" className="form-select" value={form.area} onChange={handleChange} required>
                      <option value="">-- Pilih area --</option>
                      {AREAS.map(area => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Jadwal Penerimaan <span>*</span></label>
                    <select name="schedule" className="form-select" value={form.schedule} onChange={handleChange} required>
                      <option value="">-- Pilih jadwal --</option>
                      {SCHEDULES.map(schedule => <option key={schedule} value={schedule}>{schedule}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cut-off <span>*</span></label>
                    <input type="time" name="cutoff" className="form-input" value={form.cutoff} onChange={handleChange} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kontak</label>
                    <input name="contact" className="form-input" value={form.contact} onChange={handleChange} placeholder="Nama PIC" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telepon</label>
                    <input name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="Nomor telepon" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat</label>
                  <textarea name="address" className="form-textarea" value={form.address} onChange={handleChange} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Plus size={15} /> {saving ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
