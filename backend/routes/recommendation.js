const router = require('express').Router();
const axios  = require('axios');
const { Op } = require('sequelize');
const { Invoice, Customer, Driver, DeliveryRecommendation, DeliveryAnalyticsLog } = require('../models');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware, requireRole('admin', 'staff'));

const AI_MODULE_URL = process.env.AI_MODULE_URL || 'http://localhost:5001';

const FRAMEWORK_NAME = 'Operational Knowledge Formalization Framework';
const FRAMEWORK_STAGES = [
  'Knowledge Acquisition',
  'Knowledge Formalization',
  'Operational Labeling Guideline',
  'Rule-Based Representation',
  'Decision Tree Reconstruction',
  'Priority Recommendation',
  'Invoice Tracking & POD',
];

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getValue(source, snakeKey, camelKey, fallback = null) {
  if (!source) return fallback;
  return firstDefined(source[snakeKey], source[camelKey], fallback);
}

function toPlainRecord(record) {
  if (!record) return {};
  return typeof record.toJSON === 'function' ? record.toJSON() : record;
}

function normalizeDeliveryCandidates(topRecommendations = [], drivers = []) {
  const source = topRecommendations.length > 0 ? topRecommendations : drivers;

  return source.map((candidate, index) => ({
    rank: firstDefined(candidate.rank, index + 1),
    driver: firstDefined(candidate.driver, candidate.name, candidate.recommendedDriver, null),
    score: firstDefined(candidate.score, candidate.adjusted_score, candidate.recommendationScore, null),
    estimated_time: firstDefined(candidate.estimated_time, candidate.estimatedDeliveryTime, null),
    estimated_minutes: firstDefined(candidate.estimated_minutes, candidate.estimatedDeliveryMinutes, null),
    area: candidate.area ?? null,
    workload: firstDefined(candidate.workload, candidate.activeDeliveries, candidate.active_deliveries, null),
    eligible: firstDefined(candidate.eligible, true),
    violations: candidate.violations ?? [],
  }));
}

function buildOperationalKnowledgeContract({
  recommendation = {},
  invoice = null,
  context = {},
  priorityLabel = null,
  source = 'stored_record',
  predictionContext = null,
  drivers = [],
} = {}) {
  const invoiceContext = {
    invoiceId: firstDefined(context.invoiceId, recommendation.invoiceId, invoice?.id, null),
    invoiceNo: firstDefined(context.invoiceNo, recommendation.invoiceNo, invoice?.invoiceNo, null),
    namaCustomer: firstDefined(context.namaCustomer, recommendation.namaCustomer, invoice?.customer?.name, null),
    namaDriver: firstDefined(context.namaDriver, recommendation.namaDriver, invoice?.driver?.name, null),
    areaPengantaran: firstDefined(
      context.areaPengantaran,
      recommendation.areaPengantaran,
      invoice?.customer?.area,
      invoice?.driver?.area,
      null
    ),
    jadwalTerima: firstDefined(context.jadwalTerima, recommendation.jadwalTerima, invoice?.schedule, null),
    cutOffJam: firstDefined(context.cutOffJam, recommendation.cutOffJam, invoice?.cutoff, null),
    status: firstDefined(context.status, invoice?.status, null),
  };

  const label = firstDefined(
    recommendation.priority_label,
    priorityLabel,
    invoice?.priority,
    'Sedang'
  );
  const recommendationScore = toNumber(
    getValue(recommendation, 'recommendation_score', 'recommendationScore', null)
  );
  const recommendationConfidenceScore = toNumber(
    getValue(recommendation, 'recommendation_confidence_score', 'recommendationConfidenceScore', null)
  );
  const decisionConfidence = toNumber(
    firstDefined(
      recommendation.decision_confidence,
      predictionContext?.confidence,
      recommendationConfidenceScore,
      recommendationScore
    )
  );
  const confidenceLabel = getValue(
    recommendation,
    'recommendation_confidence',
    'recommendationConfidence',
    decisionConfidence >= 0.8 ? 'High' : decisionConfidence >= 0.6 ? 'Medium' : 'Low'
  );
  const priorityAction = getValue(
    recommendation,
    'recommended_delivery_day',
    'recommendedDeliveryDay',
    'Review Manual'
  );
  const recommendedDriver = getValue(
    recommendation,
    'recommended_driver',
    'recommendedDriver',
    invoiceContext.namaDriver || 'Tidak tersedia'
  );
  const topRecommendations = getValue(recommendation, 'top_recommendations', 'topRecommendations', []);
  const scoreDetails = getValue(recommendation, 'score_details', 'scoreDetails', {});
  const factorExplanation = getValue(recommendation, 'factor_explanation', 'factorExplanation', []);

  const ruleEvidence = recommendation.rule_evidence ?? {
    priority_label: label,
    receive_schedule: invoiceContext.jadwalTerima,
    cutoff_policy: invoiceContext.cutOffJam,
    delivery_area: invoiceContext.areaPengantaran,
    compatibility_score: recommendationScore,
    score_details: scoreDetails,
    factor_explanation: factorExplanation,
  };

  const decisionTreePath = recommendation.decision_tree_path ?? [
    {
      stage: 'Knowledge Acquisition',
      fact: 'invoice_operational_context',
      value: {
        invoice_no: invoiceContext.invoiceNo,
        customer: invoiceContext.namaCustomer,
        area_pengantaran: invoiceContext.areaPengantaran,
        jadwal_terima: invoiceContext.jadwalTerima,
        cut_off_jam: invoiceContext.cutOffJam,
      },
    },
    {
      stage: 'Operational Labeling Guideline',
      fact: 'priority_label',
      value: label,
    },
    {
      stage: 'Rule-Based Representation',
      fact: 'priority_action',
      value: priorityAction,
    },
    {
      stage: 'Priority Recommendation',
      fact: 'recommended_delivery_action',
      value: priorityAction,
    },
  ];

  const knowledgeTrace = recommendation.knowledge_trace ?? [
    {
      stage: 'Knowledge Acquisition',
      data: {
        invoice_id: invoiceContext.invoiceId,
        invoice_no: invoiceContext.invoiceNo,
        customer: invoiceContext.namaCustomer,
        area_pengantaran: invoiceContext.areaPengantaran,
        jadwal_terima: invoiceContext.jadwalTerima,
        cut_off_jam: invoiceContext.cutOffJam,
        delivery_actor: invoiceContext.namaDriver,
      },
    },
    {
      stage: 'Knowledge Formalization',
      data: ruleEvidence,
    },
    {
      stage: 'Operational Labeling Guideline',
      data: {
        priority_label: label,
        raw_prediction: predictionContext?.raw_prediction ?? null,
        model_version: predictionContext?.model_version ?? null,
      },
    },
    {
      stage: 'Rule-Based Representation',
      data: {
        rule_evidence: ruleEvidence,
      },
    },
    {
      stage: 'Decision Tree Reconstruction',
      data: {
        decision_tree_path: decisionTreePath,
        decision_confidence: decisionConfidence,
      },
    },
    {
      stage: 'Priority Recommendation',
      data: {
        priority_label: label,
        priority_action: priorityAction,
        confidence: confidenceLabel,
      },
    },
    {
      stage: 'Invoice Tracking & POD',
      data: {
        recommended_driver: recommendedDriver,
        invoice_status: invoiceContext.status,
        pod_required: true,
      },
    },
  ];

  const deliveryContext = recommendation.delivery_context ?? {
    current_driver: invoiceContext.namaDriver,
    recommended_driver: recommendedDriver,
    assigned_driver: recommendedDriver,
    driver_assignment_supported: true,
    research_role: 'Delivery Context',
    estimated_delivery_time: getValue(recommendation, 'estimated_delivery_time', 'estimatedDeliveryTime', null),
    estimated_delivery_minutes: getValue(recommendation, 'estimated_delivery_minutes', 'estimatedDeliveryMinutes', null),
    workload_factor: getValue(recommendation, 'workload_factor', 'workloadFactor', null),
    candidates: normalizeDeliveryCandidates(topRecommendations, drivers),
  };

  const podContext = recommendation.pod_context ?? {
    stage: 'Invoice Tracking & POD',
    handoff_from: 'Priority Recommendation',
    invoice_id: invoiceContext.invoiceId,
    invoice_no: invoiceContext.invoiceNo,
    invoice_status: invoiceContext.status,
    pod_required: true,
    expected_evidence: [
      'receiver_name',
      'receiver_signature',
      'courier_signature',
      'delivery_timestamp',
    ],
  };

  const priorityRecommendation = recommendation.priority_recommendation ?? {
    label,
    action: priorityAction,
    confidence: confidenceLabel,
    confidence_score: decisionConfidence,
    evidence_score: recommendationScore,
    source,
  };

  const ruleBasedResult = recommendation.rule_based_result ?? {
    result: priorityAction,
    priority_label: label,
    evidence: ruleEvidence,
    source: source === 'ai_module' ? 'ai_module_legacy_engines' : 'local_rule_fallback',
    compatibility_mode: true,
  };

  const decisionTreeResult = recommendation.decision_tree_result ?? {
    priority_label: label,
    raw_prediction: predictionContext?.raw_prediction ?? null,
    model_version: predictionContext?.model_version ?? null,
    confidence: decisionConfidence,
    path: decisionTreePath,
    reconstructed: true,
    source: predictionContext ? 'ai_module_predict' : 'priority_label_fallback',
  };

  return {
    framework: recommendation.framework ?? FRAMEWORK_NAME,
    framework_stages: recommendation.framework_stages ?? FRAMEWORK_STAGES,
    compatibility_mode: true,
    research_artifact_mode: recommendation.research_artifact_mode ?? false,
    research_engine_version: recommendation.research_engine_version ?? null,
    model_artifact: recommendation.model_artifact ?? null,
    priority_recommendation: priorityRecommendation,
    priority_label: label,
    knowledge_trace: knowledgeTrace,
    rule_evidence: ruleEvidence,
    rule_based_result: ruleBasedResult,
    decision_tree_result: decisionTreeResult,
    decision_tree_path: decisionTreePath,
    decision_confidence: decisionConfidence,
    priority_explanation: recommendation.priority_explanation ?? null,
    operational_attributes: recommendation.operational_attributes ?? null,
    delivery_context: deliveryContext,
    pod_context: podContext,
  };
}

function attachOperationalKnowledgeContract(recommendation, options) {
  return {
    ...recommendation,
    ...buildOperationalKnowledgeContract({
      ...options,
      recommendation,
    }),
  };
}

function legacySnakeAliases(record) {
  return {
    recommendation_score: record.recommendationScore ?? null,
    recommended_delivery_day: record.recommendedDeliveryDay ?? null,
    recommended_driver: record.recommendedDriver ?? null,
    recommendation_reason: record.recommendationReason ?? null,
    recommendation_confidence: record.recommendationConfidence ?? null,
    recommendation_confidence_score: record.recommendationConfidenceScore ?? null,
    estimated_delivery_time: record.estimatedDeliveryTime ?? null,
    estimated_delivery_minutes: record.estimatedDeliveryMinutes ?? null,
    top_recommendations: record.topRecommendations ?? null,
    score_details: record.scoreDetails ?? null,
    factor_explanation: record.factorExplanation ?? null,
    recommendation_summary: record.recommendationSummary ?? null,
    operational_constraints: record.operationalConstraints ?? null,
    traffic_adjustment: record.trafficAdjustment ?? null,
    workload_factor: record.workloadFactor ?? null,
  };
}

function formatRecommendationRecord(record, options = {}) {
  const plainRecord = toPlainRecord(record);
  const aliases = legacySnakeAliases(plainRecord);
  const mergedRecommendation = {
    ...aliases,
    ...plainRecord,
    ...(options.recommendation || {}),
  };

  return {
    ...plainRecord,
    ...aliases,
    ...buildOperationalKnowledgeContract({
      recommendation: mergedRecommendation,
      invoice: options.invoice,
      context: {
        invoiceId: plainRecord.invoiceId,
        invoiceNo: plainRecord.invoiceNo,
        namaCustomer: plainRecord.namaCustomer,
        namaDriver: plainRecord.namaDriver,
        areaPengantaran: plainRecord.areaPengantaran,
        jadwalTerima: plainRecord.jadwalTerima,
        cutOffJam: plainRecord.cutOffJam,
        status: options.invoice?.status,
        ...(options.context || {}),
      },
      priorityLabel: plainRecord.priority_label,
      source: options.source || 'stored_record',
      predictionContext: options.predictionContext,
      drivers: options.drivers || [],
    }),
    source: options.source || plainRecord.source || 'stored_record',
  };
}

// ─── Helper: local fallback recommendation ──────────────────────
/**
 * Generates a simple rule-based recommendation when the Flask AI Module
 * is unavailable. Uses priority weight + cut-off urgency to produce a score.
 *
 * @param {string} priorityLabel  - 'Tinggi' | 'Sedang' | 'Rendah'
 * @param {string} area           - Area pengantaran
 * @param {string} jadwal         - Jadwal penerimaan customer
 * @param {string} cutoff         - Cut-off jam (HH:MM)
 * @param {Array}  drivers        - List of { name, activeDeliveries }
 * @returns {object} Recommendation result
 */
function localRecommendation(priorityLabel, area, jadwal, cutoff, drivers) {
  const priorityScores = { 'Tinggi': 1.0, 'Sedang': 0.7, 'Rendah': 0.4 };
  const hour = parseInt(cutoff?.split(':')[0] ?? 12);

  // Score components
  const priorityScore = priorityScores[priorityLabel] || 0.5;
  const cutoffScore   = hour <= 10 ? 1.0 : hour <= 12 ? 0.8 : hour <= 14 ? 0.6 : 0.3;
  const areaScore     = 0.7;
  const jadwalScore   = 0.7;
  const baseScore     = 0.7;

  const score = priorityScore * 0.4 + cutoffScore * 0.25 + areaScore * 0.15 + jadwalScore * 0.10 + baseScore * 0.10;

  // Determine delivery day based on score
  let recommendedDay;
  if (score >= 0.75) {
    recommendedDay = 'Kirim Hari Ini';
  } else if (score >= 0.5) {
    recommendedDay = 'Kirim Besok';
  } else {
    recommendedDay = 'Jadwalkan Ulang';
  }

  // Determine confidence
  let confidence, confidenceScore;
  if (score >= 0.8) {
    confidence = 'High';
    confidenceScore = 0.9;
  } else if (score >= 0.6) {
    confidence = 'Medium';
    confidenceScore = 0.7;
  } else {
    confidence = 'Low';
    confidenceScore = 0.5;
  }

  // Pick recommended driver (one with fewest active deliveries)
  let recommendedDriver = drivers.length > 0 ? drivers[0].name : 'Tidak tersedia';
  let lowestWorkload = Infinity;
  for (const d of drivers) {
    if (d.activeDeliveries < lowestWorkload) {
      lowestWorkload = d.activeDeliveries;
      recommendedDriver = d.name;
    }
  }

  // Estimated delivery time
  const estimatedMinutes = hour <= 10 ? 45 : hour <= 12 ? 60 : hour <= 14 ? 90 : 120;
  const estimatedTime = `${estimatedMinutes} menit`;

  // Build top recommendations list (rank all drivers)
  const topRecommendations = drivers
    .map((d) => {
      const workloadPenalty = d.activeDeliveries * 0.05;
      const driverScore = Math.max(0, score - workloadPenalty);
      return {
        driver: d.name,
        score: parseFloat(driverScore.toFixed(3)),
        activeDeliveries: d.activeDeliveries,
        recommendation: driverScore >= 0.75 ? 'Kirim Hari Ini' : driverScore >= 0.5 ? 'Kirim Besok' : 'Jadwalkan Ulang',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const reason = `Prioritas ${priorityLabel} dengan cut-off ${cutoff}. `
    + `Area: ${area || 'N/A'}, Jadwal: ${jadwal || 'N/A'}. `
    + `Skor rekomendasi: ${score.toFixed(3)}.`;

  const summary = `Rekomendasi ${recommendedDay} via driver ${recommendedDriver} `
    + `(estimasi ${estimatedTime}). Skor: ${score.toFixed(3)}, `
    + `Confidence: ${confidence}.`;

  return {
    recommendation_score: parseFloat(score.toFixed(3)),
    recommended_delivery_day: recommendedDay,
    recommended_driver: recommendedDriver,
    recommendation_reason: reason,
    recommendation_confidence: confidence,
    recommendation_confidence_score: confidenceScore,
    estimated_delivery_time: estimatedTime,
    estimated_delivery_minutes: estimatedMinutes,
    top_recommendations: topRecommendations,
    score_details: {
      priority_weight: parseFloat((priorityScore * 0.4).toFixed(3)),
      cutoff_weight: parseFloat((cutoffScore * 0.25).toFixed(3)),
      area_weight: parseFloat((areaScore * 0.15).toFixed(3)),
      jadwal_weight: parseFloat((jadwalScore * 0.10).toFixed(3)),
      base_weight: parseFloat((baseScore * 0.10).toFixed(3)),
    },
    factor_explanation: {
      priority: `Prioritas ${priorityLabel} (skor: ${priorityScore})`,
      cutoff: `Cut-off ${cutoff} → jam ${hour} (skor: ${cutoffScore})`,
      area: `Area ${area || 'default'} (skor: ${areaScore})`,
      jadwal: `Jadwal ${jadwal || 'default'} (skor: ${jadwalScore})`,
    },
    recommendation_summary: summary,
    operational_constraints: {
      max_deliveries_per_driver: 10,
      business_hours: '08:00 - 17:00',
    },
    traffic_adjustment: hour <= 10 ? 10 : hour <= 14 ? 15 : 20,
    workload_factor: lowestWorkload === Infinity ? 0 : lowestWorkload,
  };
}

// ─── POST /api/recommendation — Generate recommendation ─────────
router.post('/', async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'invoiceId wajib diisi.' });
    }

    // 1. Find invoice with associations
    const invoice = await Invoice.findByPk(invoiceId, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Driver, as: 'driver' },
      ],
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    }

    // 2. Get all active drivers with their current workload
    const activeDrivers = await Driver.findAll({ where: { isActive: true } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const driversWithWorkload = await Promise.all(
      activeDrivers.map(async (driver) => {
        const activeCount = await Invoice.count({
          where: {
            driverId: driver.id,
            status: 'Dalam Pengiriman',
          },
        });
        return {
          id: driver.id,
          name: driver.name,
          area: driver.area,
          phone: driver.phone,
          activeDeliveries: activeCount,
        };
      })
    );

    // 3. Extract invoice data for prediction
    const area         = invoice.customer?.area || invoice.driver?.area || '';
    const jadwal       = invoice.schedule || '';
    const cutoff       = invoice.cutoff || '12:00';
    const namaCustomer = invoice.customer?.name || '';
    const namaDriver   = invoice.driver?.name || '';

    // 4. Get priority via Flask AI /predict (or fallback)
    let priorityLabel = invoice.priority || 'Sedang';
    let source = 'local';
    let predictionContext = null;

    try {
      const predictResp = await axios.post(`${AI_MODULE_URL}/predict`, {
        area:          area || 'Jakarta Pusat',
        jadwal:        jadwal,
        cutoff:        cutoff,
        nama_customer: namaCustomer || 'Unknown',
        nama_driver:   namaDriver   || 'Unknown',
      }, { timeout: 5000 });

      if (predictResp.data?.priority) {
        priorityLabel = predictResp.data.priority;
        predictionContext = predictResp.data;
        source = 'ai_module';
      }
    } catch (_aiErr) {
      // Flask unavailable — use invoice's existing priority
    }

    // 5. Get recommendation from Flask AI /recommend (or fallback)
    let recommendation;

    try {
      const recResp = await axios.post(`${AI_MODULE_URL}/recommend`, {
        priority_label:   priorityLabel,
        area_pengantaran: area,
        jadwal_terima:    jadwal,
        cut_off_jam:      cutoff,
        nama_customer:    namaCustomer,
        nama_driver:      namaDriver,
        drivers:          driversWithWorkload.map((d) => ({
          name:              d.name,
          area:              d.area,
          active_deliveries: d.activeDeliveries,
        })),
      }, { timeout: 10000 });

      recommendation = recResp.data;
      source = 'ai_module';
    } catch (_aiErr) {
      // Flask unavailable — use local fallback
      recommendation = localRecommendation(priorityLabel, area, jadwal, cutoff, driversWithWorkload);
      source = 'local';
    }

    recommendation = attachOperationalKnowledgeContract(recommendation, {
      invoice,
      context: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        namaCustomer,
        namaDriver,
        areaPengantaran: area,
        jadwalTerima: jadwal,
        cutOffJam: cutoff,
        status: invoice.status,
      },
      priorityLabel,
      source,
      predictionContext,
      drivers: driversWithWorkload,
    });

    // 6. Save to DeliveryRecommendation
    const record = await DeliveryRecommendation.create({
      invoiceId:                   invoice.id,
      invoiceNo:                   invoice.invoiceNo,
      namaCustomer:                namaCustomer,
      namaDriver:                  namaDriver,
      areaPengantaran:             area,
      jadwalTerima:                jadwal,
      cutOffJam:                   cutoff,
      priority_label:              priorityLabel,
      recommendationScore:         recommendation.recommendation_score         ?? null,
      recommendedDeliveryDay:      recommendation.recommended_delivery_day     ?? null,
      recommendedDriver:           recommendation.recommended_driver           ?? null,
      recommendationReason:        recommendation.recommendation_reason        ?? null,
      recommendationConfidence:    recommendation.recommendation_confidence    ?? null,
      recommendationConfidenceScore: recommendation.recommendation_confidence_score ?? null,
      estimatedDeliveryTime:       recommendation.estimated_delivery_time      ?? null,
      estimatedDeliveryMinutes:    recommendation.estimated_delivery_minutes   ?? null,
      topRecommendations:          recommendation.top_recommendations          ?? null,
      scoreDetails:                recommendation.score_details                ?? null,
      factorExplanation:           recommendation.factor_explanation           ?? null,
      recommendationSummary:       recommendation.recommendation_summary       ?? null,
      operationalConstraints:      recommendation.operational_constraints      ?? null,
      trafficAdjustment:           recommendation.traffic_adjustment           ?? null,
      workloadFactor:              recommendation.workload_factor              ?? null,
    });

    // 7. Log analytics event
    await DeliveryAnalyticsLog.create({
      eventType:   'recommendation_generated',
      eventData:   {
        recommendation_id: record.id,
        invoice_id:        invoice.id,
        invoice_no:        invoice.invoiceNo,
        priority_label:    priorityLabel,
        score:             recommendation.recommendation_score,
        source,
        framework:         recommendation.framework,
        compatibility_mode: recommendation.compatibility_mode,
        research_artifact_mode: recommendation.research_artifact_mode,
        research_engine_version: recommendation.research_engine_version,
        model_artifact:    recommendation.model_artifact,
        priority_recommendation: recommendation.priority_recommendation,
        priority_explanation: recommendation.priority_explanation,
        knowledge_trace:   recommendation.knowledge_trace,
        rule_evidence:     recommendation.rule_evidence,
        rule_based_result: recommendation.rule_based_result,
        decision_tree_result: recommendation.decision_tree_result,
        decision_tree_path: recommendation.decision_tree_path,
        decision_confidence: recommendation.decision_confidence,
        operational_attributes: recommendation.operational_attributes,
        delivery_context:  recommendation.delivery_context,
        pod_context:       recommendation.pod_context,
      },
      metricName:  'recommendation_score',
      metricValue: recommendation.recommendation_score ?? null,
    });

    // 8. Return response
    return res.json({
      success: true,
      data: formatRecommendationRecord(record, {
        invoice,
        recommendation,
        source,
        predictionContext,
        drivers: driversWithWorkload,
      }),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/recommendation/history — List recommendation history
router.get('/history', async (_req, res) => {
  try {
    const results = await DeliveryRecommendation.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    return res.json({
      success: true,
      data: results.map((record) => formatRecommendationRecord(record)),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/recommendation/:id — Single recommendation ────────
router.get('/:id', async (req, res) => {
  try {
    const result = await DeliveryRecommendation.findByPk(req.params.id);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Rekomendasi tidak ditemukan.' });
    }

    return res.json({ success: true, data: formatRecommendationRecord(result) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/recommendation/:id/feedback — Submit feedback ───
router.patch('/:id/feedback', async (req, res) => {
  try {
    const {
      recommendation_accepted,
      actual_delivery_time,
      delivery_success,
      delivery_delay_minutes,
      actual_driver,
      feedback_notes,
    } = req.body;

    const record = await DeliveryRecommendation.findByPk(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Rekomendasi tidak ditemukan.' });
    }

    // Update feedback fields
    if (recommendation_accepted !== undefined) record.recommendationAccepted = recommendation_accepted;
    if (actual_delivery_time !== undefined)    record.actualDeliveryTime      = actual_delivery_time;
    if (delivery_success !== undefined)        record.deliverySuccess         = delivery_success;
    if (delivery_delay_minutes !== undefined)  record.deliveryDelayMinutes    = delivery_delay_minutes;
    if (actual_driver !== undefined)           record.actualDriver            = actual_driver;
    if (feedback_notes !== undefined)          record.feedbackNotes           = feedback_notes;

    await record.save();

    // Log analytics event
    await DeliveryAnalyticsLog.create({
      eventType:   'feedback_submitted',
      eventData:   {
        recommendation_id:      record.id,
        invoice_id:             record.invoiceId,
        recommendation_accepted,
        delivery_success,
        delivery_delay_minutes,
      },
      metricName:  'delivery_delay_minutes',
      metricValue: delivery_delay_minutes ?? null,
    });

    return res.json({
      success: true,
      message: 'Feedback berhasil disimpan.',
      data:    formatRecommendationRecord(record),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/recommendation/:id — Delete recommendation ─────
router.delete('/:id', async (req, res) => {
  try {
    const record = await DeliveryRecommendation.findByPk(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Rekomendasi tidak ditemukan.' });
    }

    await record.destroy();

    return res.json({ success: true, message: 'Rekomendasi berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
