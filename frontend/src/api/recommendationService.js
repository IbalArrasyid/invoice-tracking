import api from './axios';

/**
 * recommendationService - endpoint /api/recommendation
 * Priority Recommendation menggunakan Operational Knowledge Formalization Framework.
 */
const recommendationService = {
  /**
   * Generate priority recommendation untuk invoice tertentu.
   * @param {number|string} invoiceId
   * @returns {{ priority_recommendation, knowledge_trace, rule_evidence, decision_tree_result, delivery_context }}
   */
  async generate(invoiceId) {
    const res = await api.post('/recommendation', { invoiceId });
    return res.data;
  },

  /**
   * Ambil riwayat priority recommendation.
   * @returns {Array}
   */
  async getHistory() {
    const res = await api.get('/recommendation/history');
    return res.data.data;
  },

  /**
   * Ambil detail rekomendasi berdasarkan ID
   * @param {number|string} id
   * @returns {object}
   */
  async getById(id) {
    const res = await api.get(`/recommendation/${id}`);
    return res.data.data;
  },

  /**
   * Submit feedback untuk rekomendasi
   * @param {number|string} id
   * @param {{ recommendation_accepted, actual_delivery_time, delivery_success, feedback_notes }} feedbackData
   */
  async submitFeedback(id, feedbackData) {
    const res = await api.patch(`/recommendation/${id}/feedback`, feedbackData);
    return res.data;
  },

  /**
   * Hapus rekomendasi
   * @param {number|string} id
   */
  async deleteRecommendation(id) {
    const res = await api.delete(`/recommendation/${id}`);
    return res.data;
  },
};

export default recommendationService;
