import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Download } from 'lucide-react';
import Topbar from '../components/Topbar';
import { invoiceService } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const monthlyData = [
  { bulan: 'Jan', terkirim: 32, kembali: 3, total: 38 },
  { bulan: 'Feb', terkirim: 28, kembali: 5, total: 35 },
  { bulan: 'Mar', terkirim: 41, kembali: 2, total: 46 },
  { bulan: 'Apr', terkirim: 38, kembali: 4, total: 45 },
];

export default function ReportsPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const res = await invoiceService.getAll();
        setInvoices(res.data || []);
      } catch (err) {
        console.error('Error fetching invoices for reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const totalTerkirim = invoices.filter(i => i.status === 'Terkirim').length;
  const successRate = invoices.length > 0 ? Math.round((totalTerkirim / invoices.length) * 100) : 0;

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat laporan...</div>;
  }

  return (
    <div>
      <Topbar
        title="Laporan"
        subtitle="Analisis performa pengiriman invoice"
        actions={<button className="btn btn-secondary btn-sm"><Download size={14} /> Export PDF</button>}
      />
      <div className="page-container">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          {[
            { label: 'Total Invoice', value: invoices.length, icon: 'INV' },
            { label: 'Invoice Terkirim', value: totalTerkirim, icon: 'OK' },
            { label: 'Tingkat Keberhasilan', value: `${successRate}%`, icon: '%' },
          ].map(s => (
            <div key={s.label} className="stat-card default">
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>Tren Pengiriman Bulanan</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="bulan" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                  <Line type="monotone" dataKey="terkirim" name="Terkirim" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                  <Line type="monotone" dataKey="kembali" name="Kembali" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="var(--primary-light)" strokeWidth={2} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <div className="section-title" style={{ marginBottom: 16 }}>Perbandingan per Bulan</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                  <Bar dataKey="terkirim" name="Terkirim" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kembali" name="Kembali" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
