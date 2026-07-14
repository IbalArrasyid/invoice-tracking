require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

// ─── Import Routes ───────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const invoiceRoutes   = require('./routes/invoices');
const trackingRoutes  = require('./routes/tracking');
const predictRoutes   = require('./routes/predict');
const customerRoutes  = require('./routes/customers');
const driverRoutes    = require('./routes/drivers');
const dashboardRoutes = require('./routes/dashboard');
const priorityLogRoutes = require('./routes/priorityLogs');
const recommendationRoutes = require('./routes/recommendation');
const analyticsRoutes      = require('./routes/analytics');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin
    if (/^http:\/\/localhost:\d+$/.test(origin) || origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/invoices',      invoiceRoutes);
app.use('/api/tracking',      trackingRoutes);
app.use('/api/predict',       predictRoutes);
app.use('/api/customers',     customerRoutes);
app.use('/api/drivers',       driverRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/priority-logs', priorityLogRoutes);
app.use('/api/recommendation', recommendationRoutes);
app.use('/api/analytics',      analyticsRoutes);

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Invoice Tracking API is running', timestamp: new Date() });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });
});

// ─── Global Error Handler ────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan server',
  });
});

// ─── Start Server ────────────────────────────────────────────────
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database terhubung');

    // Sync models (alter: true untuk update schema tanpa drop data)
    await sequelize.sync({ alter: true });
    console.log('✅ Model tersinkronisasi');

    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Gagal memulai server:', error.message);
    process.exit(1);
  }
}

startServer();
