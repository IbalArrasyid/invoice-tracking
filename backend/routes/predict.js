const router = require('express').Router();
const axios  = require('axios');
const { PriorityLog } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * Logika C4.5 rule-based (sama dengan simulateC45Prediction di frontend).
 * Digunakan sebagai fallback jika Flask AI Module tidak tersedia.
 */
function localC45Predict(jadwal, cutoff) {
  const hour = parseInt(cutoff?.split(':')[0] ?? 12);

  if (hour <= 10) {
    if (['Senin & Kamis', 'Senin saja', 'Selasa & Jumat'].includes(jadwal)) {
      return { priority: 'Tinggi', confidence: 0.94, reason: 'Cut-off ketat (≤10:00) + jadwal terbatas' };
    }
    return { priority: 'Tinggi', confidence: 0.91, reason: 'Cut-off pagi sangat ketat (≤10:00)' };
  } else if (hour <= 12) {
    if (['Senin & Kamis', 'Senin saja'].includes(jadwal)) {
      return { priority: 'Tinggi', confidence: 0.87, reason: 'Jadwal penerimaan sangat terbatas' };
    }
    return { priority: 'Sedang', confidence: 0.82, reason: 'Cut-off sedang, jadwal reguler' };
  } else {
    if (jadwal === 'Senin saja') {
      return { priority: 'Sedang', confidence: 0.78, reason: 'Jadwal Senin saja meski cut-off longgar' };
    }
    return { priority: 'Rendah', confidence: 0.89, reason: 'Cut-off longgar, jadwal fleksibel' };
  }
}

// ─── POST /api/predict ───────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { area, jadwal, cutoff, invoiceNo, nama_customer, nama_driver } = req.body;

    if (!jadwal || !cutoff) {
      return res.status(400).json({ success: false, message: 'jadwal dan cutoff wajib diisi.' });
    }

    let result;
    let source = 'local';

    // Coba forward ke Flask AI Module jika tersedia
    const aiUrl = process.env.AI_MODULE_URL;
    if (aiUrl) {
      try {
        const response = await axios.post(`${aiUrl}/predict`, {
          area:           area           || 'Jakarta Pusat',
          jadwal:         jadwal,
          cutoff:         cutoff,
          nama_customer:  nama_customer  || 'Unknown',
          nama_driver:    nama_driver    || 'Unknown',
        }, { timeout: 5000 });
        result = response.data;
        source = 'ai_module';
      } catch (_aiErr) {
        // Flask tidak tersedia, gunakan logika lokal
        result = localC45Predict(jadwal, cutoff);
      }
    } else {
      result = localC45Predict(jadwal, cutoff);
    }

    // Simpan log prediksi
    if (invoiceNo) {
      await PriorityLog.create({
        invoiceNo,
        area:      area    || null,
        schedule:  jadwal,
        cutoff,
        predicted: result.priority,
        actual:    null,
        accuracy:  null,
        confidence: result.confidence,
      });
    }

    return res.json({
      success: true,
      data: {
        priority:       result.priority,
        confidence:     result.confidence,
        reason:         result.reason,
        source,
        raw_prediction: result.raw_prediction || null,
        model_version:  result.model_version  || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/predict/:id/actual ──────────────────────────────
// Update label aktual untuk evaluasi akurasi model
router.patch('/:id/actual', async (req, res) => {
  try {
    const { actual } = req.body;
    const log = await PriorityLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Log tidak ditemukan.' });

    log.actual   = actual;
    log.accuracy = log.predicted === actual;
    await log.save();

    return res.json({ success: true, message: 'Label aktual berhasil disimpan.', data: log });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
