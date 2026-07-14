const { Sequelize } = require('sequelize');
require('dotenv').config();

const isPostgresUrl = process.env.DATABASE_URL?.startsWith('postgresql://')
  || process.env.DATABASE_URL?.startsWith('postgres://');

const commonOptions = {
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

const sequelize = isPostgresUrl
  ? new Sequelize(process.env.DATABASE_URL, {
      ...commonOptions,
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'invoice_tracking',
      process.env.DB_USER || 'root',
      process.env.DB_PASS || '',
      {
        ...commonOptions,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        dialect: 'mysql',
      }
    );

module.exports = sequelize;
