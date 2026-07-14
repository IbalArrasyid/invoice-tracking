const sequelize = require('../config/database');
const User        = require('./User');
const Customer    = require('./Customer');
const Driver      = require('./Driver');
const Invoice     = require('./Invoice');
const Delivery    = require('./Delivery');
const PriorityLog = require('./PriorityLog');
const DeliveryRecommendation = require('./DeliveryRecommendation');
const DeliveryAnalyticsLog   = require('./DeliveryAnalyticsLog');

// ─── Associations ────────────────────────────────────────────────
// Invoice → Customer (many-to-one)
Invoice.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Invoice,   { foreignKey: 'customer_id', as: 'invoices' });

// Invoice → Driver (many-to-one)
Invoice.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });
Driver.hasMany(Invoice,   { foreignKey: 'driver_id',  as: 'invoices' });

// Invoice → Delivery (one-to-many, riwayat status)
Invoice.hasMany(Delivery,  { foreignKey: 'invoice_id', as: 'deliveries' });
Delivery.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

// Invoice → DeliveryRecommendation (one-to-many)
Invoice.hasMany(DeliveryRecommendation, { foreignKey: 'invoice_id', as: 'recommendations' });
DeliveryRecommendation.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

module.exports = {
  sequelize,
  User,
  Customer,
  Driver,
  Invoice,
  Delivery,
  PriorityLog,
  DeliveryRecommendation,
  DeliveryAnalyticsLog,
};
