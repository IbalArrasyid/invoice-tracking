import api from './axios';

/**
 * authService — endpoint /api/auth
 */
const authService = {
  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {{ token, user }}
   */
  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data.data;
    // Simpan ke localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return { token, user };
  },

  /**
   * Register user baru
   * @param {{ name, email, password, role? }} data
   */
  async register(data) {
    const res = await api.post('/auth/register', data);
    return res.data.data;
  },

  /**
   * Ambil profil user yang sedang login (validasi token)
   */
  async me() {
    const res = await api.get('/auth/me');
    return res.data.data;
  },

  /** Logout — hapus localStorage */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /** Ambil user dari localStorage (tanpa request) */
  getCurrentUser() {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  },
};

export default authService;
