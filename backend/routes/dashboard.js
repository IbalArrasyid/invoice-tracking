const router = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const { Invoice, Customer, Driver, PriorityLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [total, menunggu, dalamPengiriman, terkirim, kembali,
      tinggi, sedang, rendah, totalLogs, correctLogs] = await Promise.all([
        Invoice.count(),
        Invoice.count({ where: { status: 'Menunggu' } }),
        Invoice.count({ where: { status: 'Dalam Pengiriman' } }),
        Invoice.count({ where: { status: 'Terkirim' } }),
        Invoice.count({ where: { status: 'Kembali' } }),
        Invoice.count({ where: { priority: 'Tinggi' } }),
        Invoice.count({ where: { priority: 'Sedang' } }),
        Invoice.count({ where: { priority: 'Rendah' } }),
        PriorityLog.count({ where: { actual: { [Op.ne]: null } } }),
        PriorityLog.count({ where: { accuracy: true } }),
      ]);

    const accuracy = totalLogs > 0 ? Math.round((correctLogs / totalLogs) * 100) : 0;

    return res.json({
      success: true,
      data: {
        invoices: { total, menunggu, dalamPengiriman, terkirim, kembali },
        priority: { tinggi, sedang, rendah },
        model: { totalLogs, correctLogs, accuracy },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
