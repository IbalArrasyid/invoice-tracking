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
  courierSignature: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    field: 'courier_signature',
    comment: 'Tanda tangan digital kurir saat mengambil tanggung jawab pengiriman',
  },
  courierSignedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'courier_signed_at',
  },
  receiverName: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'receiver_name',
  },
  receiverSignature: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    field: 'receiver_signature',
    comment: 'Tanda tangan digital penerima saat invoice diterima',
  },
  receiverSignedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'receiver_signed_at',
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
