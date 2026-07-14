# Batch 2 Compatibility Report

Project: Invoice Tracking & Proof of Delivery System  
Migration target: Operational Knowledge Formalization Framework  
Batch: Backend Compatibility Layer  
Date: 2026-07-14

## 1. Files Modified

| File | Change |
| --- | --- |
| `ai-module/priority_recommendation_orchestrator.py` | Added a compatibility orchestration layer that exposes Operational Knowledge fields while preserving legacy engine output. |
| `ai-module/app.py` | Kept `/recommend` unchanged, kept legacy engines active, and added the orchestration layer output to the existing response. Updated `/recommend/health` to identify the compatibility orchestrator while still exposing legacy engines. |
| `backend/routes/recommendation.js` | Kept all `/api/recommendation` routes unchanged, added response-format helpers, attached Operational Knowledge fields to generated/read responses, and enriched analytics event payloads without changing the metric name or schema. |
| `Batch2-Compatibility-Report.md` | Added this implementation report. |

No frontend page, frontend routing, sidebar, navigation, authentication file, Sequelize model, Prisma schema, migration, or database table was modified.

## 2. Compatibility Strategy

The backend now uses an additive compatibility contract.

Existing behavior remains active:

- `POST /api/recommendation` is still the generation endpoint.
- AI module endpoint `/recommend` is still available.
- Existing database fields are still written exactly as before.
- Existing frontend fields such as `recommendationScore`, `recommendedDriver`, `topRecommendations`, and `scoreDetails` remain populated.
- Legacy snake_case aliases are also returned by the backend for transition safety.

New framework fields are layered on top:

- `priority_recommendation`
- `priority_label`
- `knowledge_trace`
- `rule_evidence`
- `rule_based_result`
- `decision_tree_result`
- `decision_tree_path`
- `decision_confidence`
- `delivery_context`
- `pod_context`

Driver assignment is still supported, but the new contract presents it under `delivery_context` instead of treating it as the thesis contribution.

The existing AI engines are not removed. They are wrapped by `PriorityRecommendationOrchestrator`, which presents their output as transitional rule evidence and delivery context.

## 3. New Response Contract

`POST /api/recommendation` now returns the legacy record fields plus this compatibility structure:

```json
{
  "framework": "Operational Knowledge Formalization Framework",
  "framework_stages": [
    "Knowledge Acquisition",
    "Knowledge Formalization",
    "Operational Labeling Guideline",
    "Rule-Based Representation",
    "Decision Tree Reconstruction",
    "Priority Recommendation",
    "Invoice Tracking & POD"
  ],
  "compatibility_mode": true,
  "priority_recommendation": {
    "label": "Tinggi | Sedang | Rendah",
    "action": "Kirim Hari Ini | Kirim Besok | Jadwalkan Ulang",
    "confidence": "High | Medium | Low",
    "confidence_score": 0.0,
    "evidence_score": 0.0,
    "source": "ai_module | local"
  },
  "priority_label": "Tinggi | Sedang | Rendah",
  "knowledge_trace": [],
  "rule_evidence": {},
  "rule_based_result": {},
  "decision_tree_result": {},
  "decision_tree_path": [],
  "decision_confidence": 0.0,
  "delivery_context": {},
  "pod_context": {}
}
```

The same compatibility structure is also added dynamically to:

- `GET /api/recommendation/history`
- `GET /api/recommendation/:id`
- `PATCH /api/recommendation/:id/feedback`

## 4. Backward Compatibility Status

| Requirement | Status |
| --- | --- |
| Existing frontend still works | Preserved. Existing response fields remain populated. |
| Existing API routes still work | Preserved. No endpoint was renamed. |
| Database unchanged | Preserved. No models, schemas, migrations, or tables were changed. |
| Authentication unchanged | Preserved. Route middleware was not modified. |
| Driver assignment still supported | Preserved as `delivery_context`. |
| SAW no longer conceptual center | Started. Public compatibility contract now centers Priority Recommendation and Operational Knowledge fields. |
| Legacy engines retained | Preserved. Existing engines are still used internally. |

Verification performed:

- `node --check backend/routes/recommendation.js`
- `python -m py_compile ai-module/app.py ai-module/priority_recommendation_orchestrator.py` using the bundled Python runtime

## 5. Deprecated Fields

These fields are still returned and/or persisted for compatibility, but should now be treated as transitional:

| Deprecated Field | Transitional Meaning | New Direction |
| --- | --- | --- |
| `recommendation_score` / `recommendationScore` | Compatibility evidence score | `decision_confidence`, `rule_evidence.compatibility_score` |
| `recommended_delivery_day` / `recommendedDeliveryDay` | Legacy delivery action | `priority_recommendation.action` |
| `recommended_driver` / `recommendedDriver` | Legacy selected driver | `delivery_context.recommended_driver` |
| `top_recommendations` / `topRecommendations` | Legacy ranked driver candidates | `delivery_context.candidates` |
| `score_details` / `scoreDetails` | Legacy score breakdown | `rule_evidence.score_details`, `knowledge_trace` |
| `factor_explanation` / `factorExplanation` | Legacy factor explanation | `rule_evidence.factor_explanation` |
| `recommendation_confidence_score` / `recommendationConfidenceScore` | Legacy confidence score | `decision_confidence` |
| `traffic_adjustment` / `trafficAdjustment` | Delivery execution estimate factor | `delivery_context` or future tracking analytics |
| `workload_factor` / `workloadFactor` | Driver workload estimate factor | `delivery_context.workload_factor` |

## 6. Fields Planned For Future Removal

Do not remove these in Batch 2. They should only be removed after frontend and analytics batches stop depending on them.

| Planned Removal | Replacement |
| --- | --- |
| `recommendation_score` | `decision_confidence` and `rule_evidence` |
| `recommended_delivery_day` | `priority_recommendation.action` |
| `recommended_driver` | `delivery_context.recommended_driver` |
| `top_recommendations` | `delivery_context.candidates` |
| `score_details` | `knowledge_trace` and `rule_evidence` |
| `factor_explanation` | `rule_evidence.factor_explanation` |
| `recommendation_summary` | Future `framework_trace_summary` |
| `operational_constraints` as ranking constraints | Future formalized customer, schedule, cutoff, and POD constraints |
| `metricName = recommendation_score` | Future `priority_recommendation_generated`, `decision_tree_confidence`, or rule coverage metrics |

## 7. Remaining Work For Batch 3

Batch 3 should focus on frontend and terminology migration without breaking the existing workflow:

- Update `RecommendationPage.jsx` to read and display `priority_recommendation`, `knowledge_trace`, `rule_based_result`, `decision_tree_result`, `delivery_context`, and `pod_context`.
- Keep `/recommendation` route temporarily, but change visible wording away from SAW.
- Update sidebar/menu labels from SAW Recommendation to Priority Recommendation or Operational Knowledge.
- Update analytics to introduce framework metrics while keeping old score metrics during transition.
- Decide when to introduce new endpoint aliases such as `/api/priority-recommendations` without removing `/api/recommendation`.
- Design a future database migration only after frontend/API compatibility is complete.
- Plan retirement of old engine names after the compatibility contract is fully adopted.
