const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * DeliveryRecommendation — menyimpan hasil rekomendasi pengiriman
 * dari AI Module beserta feedback aktual.
 */
const DeliveryRecommendation = sequelize.define('DeliveryRecommendation', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'invoice_id',
    references: { model: 'invoices', key: 'id' },
  },
  invoiceNo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'invoice_no',
  },
  namaCustomer: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'nama_customer',
  },
  namaDriver: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'nama_driver',
    comment: 'Driver pada saat prediksi',
  },
  areaPengantaran: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'area_pengantaran',
  },
  jadwalTerima: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'jadwal_terima',
  },
  cutOffJam: {
    type: DataTypes.STRING(5),
    allowNull: true,
    field: 'cut_off_jam',
  },
  priority_label: {
    type: DataTypes.ENUM('Tinggi', 'Sedang', 'Rendah'),
    allowNull: false,
  },
  recommendationScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'recommendation_score',
  },
  recommendedDeliveryDay: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'recommended_delivery_day',
  },
  recommendedDriver: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'recommended_driver',
  },
  recommendationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'recommendation_reason',
  },
  recommendationConfidence: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'recommendation_confidence',
    comment: 'High / Medium / Low',
  },
  recommendationConfidenceScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'recommendation_confidence_score',
  },
  estimatedDeliveryTime: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'estimated_delivery_time',
  },
  estimatedDeliveryMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estimated_delivery_minutes',
  },
  actualDeliveryTime: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'actual_delivery_time',
  },
  deliveryDelayMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'delivery_delay_minutes',
  },
  deliverySuccess: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    field: 'delivery_success',
  },
  recommendationAccepted: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    field: 'recommendation_accepted',
  },
  actualDriver: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'actual_driver',
  },
  feedbackNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'feedback_notes',
  },
  topRecommendations: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'top_recommendations',
  },
  scoreDetails: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'score_details',
  },
  factorExplanation: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'factor_explanation',
  },
  recommendationSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'recommendation_summary',
  },
  operationalConstraints: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'operational_constraints',
  },
  trafficAdjustment: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'traffic_adjustment',
  },
  workloadFactor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'workload_factor',
  },
}, {
  tableName: 'delivery_recommendations',
});

module.exports = DeliveryRecommendation;
