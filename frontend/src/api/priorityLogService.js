import api from './axios';

/**
 * priorityLogService — endpoint /api/priority-logs
 */
const priorityLogService = {
  /**
   * Ambil semua log klasifikasi C4.5
   */
  async getAll() {
    const res = await api.get('/priority-logs');
    return res.data.data;
  },

  /**
   * Update label aktual untuk evaluasi model
   * @param {number|string} id
   * @param {'Tinggi'|'Sedang'|'Rendah'} actual
   */
  async updateActual(id, actual) {
    const res = await api.patch(`/priority-logs/${id}/actual`, { actual });
    return res.data.data;
  },
};

export default priorityLogService;
