const router = require('express').Router();
const { PriorityLog } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware, requireRole('admin', 'staff'));

// GET /api/priority-logs
router.get('/', async (req, res) => {
  try {
    const logs = await PriorityLog.findAll({ order: [['created_at', 'DESC']], limit: 100 });
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/priority-logs/:id/actual — update label aktual
router.patch('/:id/actual', async (req, res) => {
  try {
    const { actual } = req.body;
    const log = await PriorityLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Log tidak ditemukan.' });
    log.actual   = actual;
    log.accuracy = log.predicted === actual;
    await log.save();
    return res.json({ success: true, data: log });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
