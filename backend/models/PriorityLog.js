const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PriorityLog = sequelize.define('PriorityLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  invoiceNo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    field: 'invoice_no',
  },
  area: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  schedule: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  cutoff: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  predicted: {
    type: DataTypes.ENUM('Tinggi', 'Sedang', 'Rendah'),
    allowNull: false,
    comment: 'Hasil prediksi C4.5',
  },
  actual: {
    type: DataTypes.ENUM('Tinggi', 'Sedang', 'Rendah'),
    allowNull: true,
    comment: 'Label aktual (diisi manual)',
  },
  accuracy: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Apakah prediksi sesuai aktual',
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Confidence score 0.0 - 1.0',
  },
}, {
  tableName: 'priority_logs',
});

module.exports = PriorityLog;
