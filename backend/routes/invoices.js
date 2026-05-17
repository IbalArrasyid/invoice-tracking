const router = require('express').Router();
const { Op }  = require('sequelize');
const { sequelize, Invoice, Customer, Driver } = require('../models');
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

function parseAmount(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value || '0').replace(/[^\d.-]/g, '');
  return Number(cleaned) || 0;
}

function normalizeDate(value, fallback = new Date()) {
  if (!value) return fallback.toISOString().split('T')[0];
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().split('T')[0];
  return String(value).slice(0, 10);
}

function predictPriority(schedule, cutoff) {
  const hour = parseInt(String(cutoff || '12:00').split(':')[0], 10);
  if (hour <= 10) return 'Tinggi';
  if (hour <= 12 && ['Senin & Kamis', 'Senin saja'].includes(schedule)) return 'Tinggi';
  if (hour <= 12) return 'Sedang';
  if (schedule === 'Senin saja') return 'Sedang';
  return 'Rendah';
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

// Bulk input invoice dari file CSV/Excel-export atau tabel yang dipaste dari Excel.
router.post('/bulk', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Tidak ada data invoice untuk diimpor.' });
    }

    const created = [];
    const skipped = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const line = index + 1;
      const invoiceNo = pick(row, ['invoiceNo', 'invoice_no', 'no_invoice', 'No Invoice', 'Nomor Invoice']);
      const customerName = pick(row, ['customerName', 'customer_name', 'pelanggan', 'Pelanggan', 'Nama Pelanggan']);
      const area = pick(row, ['area', 'Area', 'wilayah', 'Wilayah']) || 'Belum ditentukan';
      const schedule = pick(row, ['schedule', 'jadwal', 'Jadwal', 'Jadwal Penerimaan']) || 'Setiap hari';
      const cutoff = pick(row, ['cutoff', 'Cutoff', 'cut_off', 'Cut-off']) || '12:00';
      const amount = parseAmount(pick(row, ['amount', 'nominal', 'Nominal', 'Nilai Invoice']));
      const dueDate = normalizeDate(pick(row, ['dueDate', 'due_date', 'jatuhTempo', 'Jatuh Tempo']));
      const driverName = pick(row, ['driverName', 'driver_name', 'kurir', 'Kurir', 'Driver']);
      const notes = pick(row, ['notes', 'catatan', 'Catatan']);

      if (!customerName || !amount) {
        skipped.push({ line, invoiceNo, reason: 'Nama pelanggan dan nominal wajib diisi.' });
        continue;
      }

      const [customer] = await Customer.findOrCreate({
        where: { name: customerName },
        defaults: { name: customerName, area, schedule, cutoff },
        transaction,
      });

      let driverId = null;
      if (driverName) {
        const driver = await Driver.findOne({ where: { name: driverName }, transaction });
        driverId = driver?.id || null;
      }

      const payload = {
        invoiceNo: invoiceNo || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}-${line}`,
        customerId: customer.id,
        driverId,
        amount,
        date: normalizeDate(pick(row, ['date', 'tanggal', 'Tanggal']), new Date()),
        dueDate,
        status: pick(row, ['status', 'Status']) || 'Menunggu',
        priority: pick(row, ['priority', 'prioritas', 'Prioritas']) || predictPriority(schedule, cutoff),
        schedule,
        cutoff,
        deliveryDate: normalizeDate(pick(row, ['deliveryDate', 'tanggalKirim', 'Tanggal Kirim']), new Date()),
        notes,
      };

      try {
        const invoice = await Invoice.create(payload, { transaction });
        created.push(invoice);
      } catch (err) {
        skipped.push({
          line,
          invoiceNo: payload.invoiceNo,
          reason: err.name === 'SequelizeUniqueConstraintError' ? 'Nomor invoice sudah ada.' : err.message,
        });
      }
    }

    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: `${created.length} invoice berhasil diimpor.`,
      data: { created, skipped },
    });
  } catch (err) {
    await transaction.rollback();
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
