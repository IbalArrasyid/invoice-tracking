const router = require('express').Router();
const { fn, col, literal, Op } = require('sequelize');
const { DeliveryRecommendation, DeliveryAnalyticsLog } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware, requireRole('admin', 'staff'));

// ─── GET /api/analytics/recommendation — Recommendation metrics ─
router.get('/recommendation', async (_req, res) => {
  try {
    // Total recommendations
    const totalRecommendations = await DeliveryRecommendation.count();

    // Average score
    const avgScoreResult = await DeliveryRecommendation.findOne({
      attributes: [[fn('AVG', col('recommendation_score')), 'avg_score']],
      raw: true,
    });
    const avgScore = avgScoreResult?.avg_score
      ? parseFloat(parseFloat(avgScoreResult.avg_score).toFixed(3))
      : 0;

    // Score distribution by recommended delivery day
    const scoreDistributionRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'recommendedDeliveryDay',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['recommended_delivery_day'],
      raw: true,
    });
    const scoreDistribution = {};
    for (const row of scoreDistributionRaw) {
      const key = row.recommendedDeliveryDay || row.recommended_delivery_day || 'Unknown';
      scoreDistribution[key] = parseInt(row.count, 10);
    }

    // Confidence distribution (High / Medium / Low)
    const confidenceDistributionRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'recommendationConfidence',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['recommendation_confidence'],
      raw: true,
    });
    const confidenceDistribution = {};
    for (const row of confidenceDistributionRaw) {
      const key = row.recommendationConfidence || row.recommendation_confidence || 'Unknown';
      confidenceDistribution[key] = parseInt(row.count, 10);
    }

    // Feedback metrics
    const totalFeedback = await DeliveryRecommendation.count({
      where: { recommendationAccepted: { [Op.ne]: null } },
    });

    const acceptedCount = await DeliveryRecommendation.count({
      where: { recommendationAccepted: true },
    });
    const acceptanceRate = totalFeedback > 0
      ? parseFloat(((acceptedCount / totalFeedback) * 100).toFixed(1))
      : 0;

    const successCount = await DeliveryRecommendation.count({
      where: { deliverySuccess: true },
    });
    const successRate = totalFeedback > 0
      ? parseFloat(((successCount / totalFeedback) * 100).toFixed(1))
      : 0;

    // Average delay
    const avgDelayResult = await DeliveryRecommendation.findOne({
      attributes: [[fn('AVG', col('delivery_delay_minutes')), 'avg_delay']],
      where: { deliveryDelayMinutes: { [Op.ne]: null } },
      raw: true,
    });
    const avgDelay = avgDelayResult?.avg_delay
      ? parseFloat(parseFloat(avgDelayResult.avg_delay).toFixed(1))
      : 0;

    // Recent recommendations (last 5)
    const recentRecommendations = await DeliveryRecommendation.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    return res.json({
      success: true,
      data: {
        totalRecommendations,
        avgScore,
        scoreDistribution,
        confidenceDistribution,
        totalFeedback,
        acceptedCount,
        acceptanceRate,
        successCount,
        successRate,
        avgDelay,
        recentRecommendations,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/analytics/drivers — Driver performance ────────────
router.get('/drivers', async (_req, res) => {
  try {
    // Count recommendations per driver (nama_driver = driver at prediction time)
    const driverStatsRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'namaDriver',
        [fn('COUNT', col('id')), 'total_recommendations'],
        [fn('AVG', col('recommendation_score')), 'avg_score'],
      ],
      group: ['nama_driver'],
      raw: true,
    });

    // Count how many times each driver was the recommended driver
    const recommendedCountRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'recommendedDriver',
        [fn('COUNT', col('id')), 'recommended_count'],
      ],
      group: ['recommended_driver'],
      raw: true,
    });
    const recommendedMap = {};
    for (const row of recommendedCountRaw) {
      const key = row.recommendedDriver || row.recommended_driver || 'Unknown';
      recommendedMap[key] = parseInt(row.recommended_count, 10);
    }

    // Success rate per driver (based on actual_driver feedback)
    const successRateRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'actualDriver',
        [fn('COUNT', col('id')), 'total_feedback'],
        [fn('SUM', literal('CASE WHEN delivery_success = true THEN 1 ELSE 0 END')), 'success_count'],
      ],
      where: { actualDriver: { [Op.ne]: null } },
      group: ['actual_driver'],
      raw: true,
    });
    const successMap = {};
    for (const row of successRateRaw) {
      const key = row.actualDriver || row.actual_driver || 'Unknown';
      const total = parseInt(row.total_feedback, 10);
      const successes = parseInt(row.success_count, 10) || 0;
      successMap[key] = {
        total_feedback: total,
        success_count: successes,
        success_rate: total > 0 ? parseFloat(((successes / total) * 100).toFixed(1)) : 0,
      };
    }

    // Combine driver stats
    const drivers = driverStatsRaw.map((row) => {
      const name = row.namaDriver || row.nama_driver || 'Unknown';
      return {
        driver: name,
        total_recommendations: parseInt(row.total_recommendations, 10),
        avg_score: row.avg_score ? parseFloat(parseFloat(row.avg_score).toFixed(3)) : 0,
        recommended_count: recommendedMap[name] || 0,
        success_rate: successMap[name]?.success_rate || 0,
        success_count: successMap[name]?.success_count || 0,
        total_feedback: successMap[name]?.total_feedback || 0,
      };
    });

    return res.json({ success: true, data: drivers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/analytics/areas — Area statistics ─────────────────
router.get('/areas', async (_req, res) => {
  try {
    const areaStatsRaw = await DeliveryRecommendation.findAll({
      attributes: [
        'areaPengantaran',
        [fn('COUNT', col('id')), 'total_recommendations'],
        [fn('AVG', col('recommendation_score')), 'avg_score'],
        [fn('AVG', col('estimated_delivery_minutes')), 'avg_estimated_minutes'],
      ],
      group: ['area_pengantaran'],
      raw: true,
    });

    const areas = areaStatsRaw.map((row) => ({
      area: row.areaPengantaran || row.area_pengantaran || 'Unknown',
      total_recommendations: parseInt(row.total_recommendations, 10),
      avg_score: row.avg_score ? parseFloat(parseFloat(row.avg_score).toFixed(3)) : 0,
      avg_estimated_minutes: row.avg_estimated_minutes
        ? parseFloat(parseFloat(row.avg_estimated_minutes).toFixed(1))
        : 0,
    }));

    return res.json({ success: true, data: areas });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
