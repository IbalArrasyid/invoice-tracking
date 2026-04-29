import api from './axios';

/**
 * predictService — endpoint /api/predict
 * Mengirim data ke backend → backend forward ke Flask AI (atau pakai logika lokal)
 */
const predictService = {
  /**
   * Prediksi prioritas C4.5
   * @param {{ jadwal: string, cutoff: string, area?: string, invoiceNo?: string }} input
   * @returns {{ priority, confidence, reason, source }}
   */
  async predict(input) {
    const res = await api.post('/predict', input);
    return res.data.data; // { priority, confidence, reason, source }
  },

  /**
   * Update label aktual pada log prediksi (untuk evaluasi akurasi)
   * @param {number|string} logId
   * @param {'Tinggi'|'Sedang'|'Rendah'} actual
   */
  async updateActual(logId, actual) {
    const res = await api.patch(`/predict/${logId}/actual`, { actual });
    return res.data.data;
  },
};

export default predictService;
