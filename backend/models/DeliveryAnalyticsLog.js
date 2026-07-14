const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * DeliveryAnalyticsLog — log event analitik untuk rekomendasi pengiriman.
 * Contoh event: recommendation_generated, feedback_submitted.
 */
const DeliveryAnalyticsLog = sequelize.define('DeliveryAnalyticsLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  eventType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'event_type',
    comment: 'Tipe event: recommendation_generated, feedback_submitted, dll.',
  },
  eventData: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'event_data',
  },
  metricName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'metric_name',
  },
  metricValue: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'metric_value',
  },
}, {
  tableName: 'delivery_analytics_logs',
});

module.exports = DeliveryAnalyticsLog;
