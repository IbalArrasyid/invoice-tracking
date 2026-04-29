import api from './axios';

/**
 * trackingService — endpoint /api/tracking
 */
const trackingService = {
  /**
   * Ambil daftar invoice untuk tracking
   * @param {{ status?, driverId?, area? }} params
   */
  async getAll(params = {}) {
    const res = await api.get('/tracking', { params });
    return res.data.data;
  },

  /**
   * Update status pengiriman invoice
   * @param {number|string} id         - Invoice ID
   * @param {string} status            - 'Menunggu' | 'Dalam Pengiriman' | 'Terkirim' | 'Kembali'
   * @param {{ notes?, updatedBy? }} extra
   */
  async updateStatus(id, status, extra = {}) {
    const res = await api.patch(`/tracking/${id}`, { status, ...extra });
    return res.data.data;
  },

  /**
   * Ambil riwayat perubahan status satu invoice
   * @param {number|string} id
   */
  async getHistory(id) {
    const res = await api.get(`/tracking/${id}/history`);
    return res.data.data;
  },
};

export default trackingService;
