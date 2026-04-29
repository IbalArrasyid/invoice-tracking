const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  area: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  schedule: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Jadwal penerimaan, contoh: Senin & Kamis',
  },
  cutoff: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'Batas waktu cut-off, format HH:MM',
  },
  contact: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'customers',
});

module.exports = Customer;
