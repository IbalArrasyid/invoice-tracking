import api from './axios';

/**
 * dashboardService — endpoint /api/dashboard
 */
const dashboardService = {
  /**
   * Ambil statistik dashboard
   * @returns {{
   *   invoices: { total, menunggu, dalamPengiriman, terkirim, kembali },
   *   priority: { tinggi, sedang, rendah },
   *   model:    { totalLogs, correctLogs, accuracy }
   * }}
   */
  async getStats() {
    const res = await api.get('/dashboard/stats');
    return res.data.data;
  },
};

export default dashboardService;
