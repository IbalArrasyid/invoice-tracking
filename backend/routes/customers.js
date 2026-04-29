const router   = require('express').Router();
const { Customer } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ─── GET /api/customers ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.findAll({ order: [['name', 'ASC']] });
    return res.json({ success: true, data: customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/customers/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    return res.json({ success: true, data: customer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/customers ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, area, schedule, cutoff, contact, phone, address } = req.body;
    if (!name || !area || !schedule || !cutoff) {
      return res.status(400).json({ success: false, message: 'name, area, schedule, dan cutoff wajib diisi.' });
    }
    const customer = await Customer.create({ name, area, schedule, cutoff, contact, phone, address });
    return res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan.', data: customer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/customers/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });

    const fields = ['name', 'area', 'schedule', 'cutoff', 'contact', 'phone', 'address'];
    fields.forEach(f => { if (req.body[f] !== undefined) customer[f] = req.body[f]; });
    await customer.save();

    return res.json({ success: true, message: 'Pelanggan berhasil diperbarui.', data: customer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/customers/:id ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    await customer.destroy();
    return res.json({ success: true, message: 'Pelanggan berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
