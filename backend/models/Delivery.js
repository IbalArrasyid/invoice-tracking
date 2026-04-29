const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Delivery = sequelize.define('Delivery', {
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
  status: {
    type: DataTypes.ENUM('Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'),
    allowNull: false,
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Catatan pengiriman atau alasan kembali',
  },
  updatedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'updated_by',
    comment: 'Nama driver atau admin yang update',
  },
}, {
  tableName: 'deliveries',
});

module.exports = Delivery;
