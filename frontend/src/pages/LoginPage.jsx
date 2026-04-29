import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Lock, User, Eye, EyeOff } from 'lucide-react';
import { authService } from '../api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token, user } = await authService.login(email, password);
      onLogin(token, user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  // Helper button to auto-fill mock credentials for testing
  const fillMock = () => {
    setEmail('admin@invoicetrack.id');
    setPassword('admin123');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-default)',
      padding: 20
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '40px 32px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: 400,
        border: '1px solid var(--border)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--primary)',
            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', margin: '0 auto 16px',
            boxShadow: '0 8px 16px rgba(99,102,241,0.2)'
          }}>
            <FileText size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            InvoiceTracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Masuk untuk mengakses dashboard admin
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--priority-high-bg)', color: 'var(--priority-high)',
            padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 20,
            fontSize: '0.875rem', border: '1px solid var(--priority-high-border)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> Email
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="Masukkan email Anda"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <Lock size={14} /> Password
              </label>
            </div>
            <div style={{ position: 'relative', marginTop: 6 }}>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  padding: 4, display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: 44, fontSize: '1rem', marginBottom: 16 }}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk Sekarang'}
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <button type="button" onClick={fillMock} style={{
              background: 'none', border: 'none', color: 'var(--primary-light)', 
              fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline'
            }}>
              Isi Data Demo (admin@invoicetrack.id)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
