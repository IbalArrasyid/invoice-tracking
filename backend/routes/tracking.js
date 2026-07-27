const router = require('express').Router();
const { Invoice, Customer, Driver, Delivery } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ─── GET /api/tracking ───────────────────────────────────────────
// Daftar invoice untuk tracking (filter by status, driver, area)
router.get('/', async (req, res) => {
  try {
    const { status, driverId, area } = req.query;
    const where = {};
    const customerWhere = {};

    if (status)   where.status = status;
    if (driverId) where.driver_id = driverId;
    if (area)     customerWhere.area = area;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Customer, as: 'customer', where: Object.keys(customerWhere).length ? customerWhere : undefined, attributes: ['id', 'name', 'area', 'schedule', 'cutoff', 'contact'] },
        { model: Driver,   as: 'driver',   attributes: ['id', 'name', 'phone'] },
        { model: Delivery, as: 'deliveries', order: [['created_at', 'DESC']], limit: 1 },
      ],
      order: [
        [{ model: Customer, as: 'customer' }, 'area', 'ASC'],
        ['priority', 'ASC'],
        ['due_date',  'ASC'],
      ],
    });

    return res.json({ success: true, data: invoices });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/tracking/:id ─────────────────────────────────────
// Update status pengiriman (Menunggu → Dalam Pengiriman → Terkirim/Kembali)
router.patch('/:id', async (req, res) => {
  try {
    const {
      status,
      notes,
      updatedBy,
      courierSignature,
      receiverName,
      receiverSignature,
    } = req.body;
    const validStatuses = ['Menunggu', 'Dalam Pengiriman', 'Terkirim', 'Kembali'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Pilih: ${validStatuses.join(', ')}`,
      });
    }
    if (req.user?.role === 'driver') {
      if (status === 'Dalam Pengiriman' && !courierSignature) {
        return res.status(400).json({
          success: false,
          message: 'Tanda tangan kurir wajib diisi saat mulai pengiriman.',
        });
      }
      if (status === 'Terkirim' && (!receiverName || !receiverSignature)) {
        return res.status(400).json({
          success: false,
          message: 'Nama dan tanda tangan penerima wajib diisi saat invoice diterima.',
        });
      }
    }

    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });

    // Update status invoice
    invoice.status = status;
    if (status === 'Terkirim') invoice.deliveredAt = new Date();
    await invoice.save();

    const now = new Date();

    // Simpan riwayat ke tabel deliveries
    await Delivery.create({
      invoiceId: invoice.id,
      status,
      deliveredAt: status === 'Terkirim' ? now : null,
      notes: notes || null,
      courierSignature: courierSignature || null,
      courierSignedAt: courierSignature ? now : null,
      receiverName: receiverName || null,
      receiverSignature: receiverSignature || null,
      receiverSignedAt: receiverSignature ? now : null,
      updatedBy: updatedBy || req.user.email,
    });

    const full = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'area', 'schedule', 'cutoff', 'contact'] },
        { model: Driver, as: 'driver', attributes: ['id', 'name', 'phone'] },
        { model: Delivery, as: 'deliveries', order: [['created_at', 'DESC']], limit: 5 },
      ],
    });

    return res.json({
      success: true,
      message: `Status diperbarui menjadi "${status}".`,
      data: full,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/tracking/:id/history ──────────────────────────────
// Riwayat perubahan status satu invoice
router.get('/:id/history', async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      where: { invoice_id: req.params.id },
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, data: deliveries });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
