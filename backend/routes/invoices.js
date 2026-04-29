const router = require('express').Router();
const { Op }  = require('sequelize');
const { Invoice, Customer, Driver } = require('../models');
const { authMiddleware } = require('../middleware/auth');

// Semua route invoice butuh login
router.use(authMiddleware);

// ─── GET /api/invoices ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    if (search) {
      where[Op.or] = [
        { invoice_no:   { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'area', 'contact'] },
        { model: Driver,   as: 'driver',   attributes: ['id', 'name', 'phone'] },
      ],
      order: [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    return res.json({
      success: true,
      data: rows,
      meta: { total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/invoices/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Driver,   as: 'driver'   },
      ],
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    return res.json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/invoices ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { customerId, driverId, amount, date, dueDate, status, priority,
            schedule, cutoff, deliveryDate, notes, invoiceNo } = req.body;
    if (!customerId || !amount || !date) {
      return res.status(400).json({ success: false, message: 'customerId, amount, dan date wajib diisi.' });
    }

    // Generate invoice number jika tidak disediakan
    const no = invoiceNo || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const invoice = await Invoice.create({
      invoiceNo: no, customerId, driverId, amount, date, dueDate,
      status: status || 'Menunggu', priority: priority || 'Sedang',
      schedule, cutoff, deliveryDate, notes,
    });

    const full = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Driver,   as: 'driver'   },
      ],
    });
    return res.status(201).json({ success: true, message: 'Invoice berhasil ditambahkan.', data: full });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Nomor invoice sudah ada.' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/invoices/:id ───────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });

    const fields = ['customerId', 'driverId', 'amount', 'date', 'dueDate',
                    'status', 'priority', 'schedule', 'cutoff', 'deliveryDate',
                    'deliveredAt', 'notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) invoice[f] = req.body[f]; });

    await invoice.save();
    return res.json({ success: true, message: 'Invoice berhasil diperbarui.', data: invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/invoices/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    await invoice.destroy();
    return res.json({ success: true, message: 'Invoice berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
