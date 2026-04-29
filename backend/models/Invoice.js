const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  invoiceNo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    field: 'invoice_no',
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'customer_id',
    references: { model: 'customers', key: 'id' },
  },
  driverId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'driver_id',
    references: { model: 'drivers', key: 'id' },
  },
  amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Nominal invoice dalam Rupiah',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal invoice dibuat',
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'due_date',
  },
  status: {
    type: DataTypes.ENUM('Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'),
    defaultValue: 'Menunggu',
  },
  priority: {
    type: DataTypes.ENUM('Tinggi', 'Sedang', 'Rendah'),
    defaultValue: 'Sedang',
    comment: 'Hasil klasifikasi C4.5',
  },
  schedule: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Jadwal penerimaan pelanggan',
  },
  cutoff: {
    type: DataTypes.STRING(5),
    allowNull: true,
    comment: 'Batas cut-off HH:MM',
  },
  deliveryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'delivery_date',
    comment: 'Rencana tanggal pengiriman',
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at',
    comment: 'Waktu aktual terkirim',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'invoices',
});

module.exports = Invoice;
