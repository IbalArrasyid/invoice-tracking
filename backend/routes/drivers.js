const router = require('express').Router();
const { Driver } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware, requireRole('admin', 'staff'));

router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    return res.json({ success: true, data: drivers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });
    return res.json({ success: true, data: driver });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, area } = req.body;
    if (!name || !phone || !area) {
      return res.status(400).json({ success: false, message: 'name, phone, dan area wajib diisi.' });
    }
    const driver = await Driver.create({ name, phone, area });
    return res.status(201).json({ success: true, data: driver });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver tidak ditemukan.' });
    ['name', 'phone', 'area', 'isActive'].forEach(f => { if (req.body[f] !== undefined) driver[f] = req.body[f]; });
    await driver.save();
    return res.json({ success: true, data: driver });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
