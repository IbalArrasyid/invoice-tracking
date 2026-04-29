import { useState, useEffect } from 'react';
import { Search, Plus, MapPin, Clock, Phone } from 'lucide-react';
import Topbar from '../components/Topbar';
import { customerService, invoiceService } from '../api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchData();
  }, []);

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
        actions={<button className="btn btn-primary btn-sm"><Plus size={15} /> Tambah Pelanggan</button>}
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
    </div>
  );
}
