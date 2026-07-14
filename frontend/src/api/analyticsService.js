import api from './axios';

/**
 * analyticsService - endpoint /api/analytics
 * Data analitik untuk priority recommendation, delivery context, dan area.
 */
const analyticsService = {
  /**
   * Statistik priority recommendation (total, average evidence, acceptance rate, success rate, distribusi)
   * @returns {{ totalRecommendations, avgScore, acceptanceRate, successRate, distribution, confidenceDistribution }}
   */
  async getRecommendationStats() {
    const res = await api.get('/analytics/recommendation');
    return res.data.data;
  },

  /**
   * Statistik delivery context.
   * @returns {Array<{ driverName, totalRecommendations, avgScore, selectedCount, acceptanceRate }>}
   */
  async getDriverStats() {
    const res = await api.get('/analytics/drivers');
    return res.data.data;
  },

  /**
   * Statistik area operasional.
   * @returns {Array<{ area, totalRecommendations, avgScore, avgEstimatedTime }>}
   */
  async getAreaStats() {
    const res = await api.get('/analytics/areas');
    return res.data.data;
  },
};

export default analyticsService;
