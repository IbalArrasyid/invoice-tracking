const router = require('express').Router();
const { Op }  = require('sequelize');
const { sequelize, Invoice, Customer, Driver } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Semua route invoice butuh login
router.use(authMiddleware);

const FINAL_DATASET_FIELDS = [
  'invoice_no',
  'customer_name_masking',
  'receive_date',
  'sent_date',
  'Driver',
  'cutoff_type',
  'cutoff_rule',
  'cutoff_value',
  'receive_day_code',
  'receive_schedule',
  'days_to_cutoff',
  'expert_label',
  'expert_reason',
];

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

function mapExpertLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'urgent', 'prioritas', 'tinggi'].includes(normalized)) return 'Tinggi';
  if (['normal', 'not urgent', 'not_urgent', 'sedang', 'rendah'].includes(normalized)) return 'Rendah';
  return null;
}

function compatibilityCutoff(row, fallback = '12:00') {
  const direct = pick(row, ['cutoff', 'Cutoff', 'cut_off', 'Cut-off', 'cut_off_jam']);
  if (/^\d{1,2}:\d{2}$/.test(String(direct || '').trim())) return String(direct).padStart(5, '0');

  const rule = String(pick(row, ['cutoff_rule', 'cutoff_type']) || '').trim().toUpperCase();
  const days = Number(pick(row, ['days_to_cutoff']));
  if (rule === 'NO_CUTOFF' || rule === 'NO CUT OFF') return '23:59';
  if (Number.isFinite(days)) {
    if (days <= 1) return '09:00';
    if (days <= 3) return '12:00';
    return '15:00';
  }
  return fallback;
}

function buildDatasetNotes(row) {
  const hasDatasetField = FINAL_DATASET_FIELDS.some(field => row[field] !== undefined && row[field] !== null && row[field] !== '');
  if (!hasDatasetField) return pick(row, ['notes', 'catatan', 'Catatan']);

  const metadata = FINAL_DATASET_FIELDS.reduce((acc, field) => {
    acc[field] = row[field] ?? '';
    return acc;
  }, { __thesisDataset: true });
  return JSON.stringify(metadata);
}

// Bulk input invoice dari file CSV/Excel-export atau tabel yang dipaste dari Excel.
router.post('/bulk', requireRole('admin', 'staff'), async (req, res) => {
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
      const customerName = pick(row, ['customerName', 'customer_name_masking', 'customer_name', 'pelanggan', 'Pelanggan', 'Nama Pelanggan']);
      const area = pick(row, ['area', 'Area', 'wilayah', 'Wilayah']) || 'Thesis Dataset';
      const schedule = pick(row, ['schedule', 'receive_schedule', 'jadwal', 'Jadwal', 'Jadwal Penerimaan']) || 'Everyday';
      const cutoff = compatibilityCutoff(row);
      const amount = parseAmount(pick(row, ['amount', 'nominal', 'Nominal', 'Nilai Invoice']));
      const dueDate = normalizeDate(pick(row, ['dueDate', 'receive_date', 'due_date', 'jatuhTempo', 'Jatuh Tempo']));
      const driverName = pick(row, ['driverName', 'driver_name', 'kurir', 'Kurir', 'Driver']);
      const notes = buildDatasetNotes(row);

      if (!customerName) {
        skipped.push({ line, invoiceNo, reason: 'Nama pelanggan wajib diisi.' });
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
        date: normalizeDate(pick(row, ['date', 'sent_date', 'tanggal', 'Tanggal']), new Date()),
        dueDate,
        status: pick(row, ['status', 'Status']) || 'Menunggu',
        priority: mapExpertLabel(pick(row, ['expert_label'])) || pick(row, ['priority', 'prioritas', 'Prioritas']) || predictPriority(schedule, cutoff),
        schedule,
        cutoff,
        deliveryDate: normalizeDate(pick(row, ['deliveryDate', 'sent_date', 'tanggalKirim', 'Tanggal Kirim']), new Date()),
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
router.post('/', requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { customerId, driverId, amount, date, dueDate, status, priority,
            schedule, cutoff, deliveryDate, notes, invoiceNo } = req.body;
    if (!customerId || amount === undefined || amount === '' || !date) {
      return res.status(400).json({ success: false, message: 'customerId, amount, dan date wajib diisi.' });
    }

    // Generate invoice number jika tidak disediakan
    const no = invoiceNo || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const invoice = await Invoice.create({
      invoiceNo: no, customerId, driverId, amount: parseAmount(amount), date, dueDate,
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
router.put('/:id', requireRole('admin', 'staff'), async (req, res) => {
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
router.delete('/:id', requireRole('admin', 'staff'), async (req, res) => {
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
