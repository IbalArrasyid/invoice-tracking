# Migration Plan

Project: Invoice Tracking & Proof of Delivery System  
Migration target: Operational Knowledge Formalization Framework  
Generated: 2026-07-14  
Scope: Audit and planning only. No code, UI, authentication, business logic, database schema, route, or file rename changes are made by this document.

## 1. Summary

The existing website still contains a SAW-centered recommendation architecture in the AI module, backend API, database model, frontend route, frontend page, analytics page, navigation, CSS naming, and architecture/research documents.

The final thesis contribution is no longer:

```text
C4.5 + SAW Recommendation + Driver Ranking
```

The final thesis contribution is:

```text
Knowledge Acquisition
-> Knowledge Formalization
-> Operational Labeling Guideline
-> Rule-Based Representation
-> Decision Tree Reconstruction
-> Priority Recommendation
-> Invoice Tracking & POD
```

The migration should preserve the existing website and refactor terminology, contracts, and architecture gradually. The goal is not to rebuild the app, but to remove SAW as the conceptual center and make Operational Knowledge Formalization the core system.

## 2. Global OLD -> NEW Mapping

| OLD | NEW |
| --- | --- |
| SAW | Operational Knowledge Formalization Framework |
| Simple Additive Weighting | Rule-Based Representation and Decision Tree Reconstruction |
| MCDM | Operational Knowledge Formalization |
| Recommendation Engine | Priority Recommendation module |
| SAW Recommendation Engine | Formalized Priority Recommendation module |
| Ranking Engine | Operational constraint evaluation |
| Driver Ranking | Delivery feasibility / assignment context |
| Recommendation Score | Formalized priority evidence |
| Skor SAW | Rule evidence / decision tree confidence / priority recommendation result |
| Score Breakdown | Knowledge trace |
| Weighted criteria | Formalized operational rules |
| Factor explanation | Rule evidence explanation |
| Top recommendations | Candidate delivery windows / priority action alternatives |
| Recommended driver | Assigned delivery actor / POD courier context |
| Recommended delivery day | Priority action / valid delivery window |
| Hybrid C4.5 + SAW | Rule-Based Representation + Decision Tree Reconstruction |
| Metodologi SAW | Operational Knowledge Formalization Methodology |
| Rekomendasi SAW | Priority Recommendation |
| Recommendation history | Priority recommendation audit trail |
| Recommendation feedback | Operational outcome feedback |

## 3. Every File That Still Depends On SAW

### Runtime Source Files

| File | Current SAW Dependency | OLD -> NEW |
| --- | --- | --- |
| `ai-module/app.py` | Imports `SAWRecommendationEngine`, `DriverRankingEngine`, exposes `/recommend`, returns `recommendation_score`, `top_recommendations`, `score_details`, `recommended_driver`. | Replace SAW orchestration with the final pipeline: knowledge acquisition context -> formalized rules -> decision tree reconstruction -> priority recommendation -> tracking/POD context. |
| `ai-module/recommendation_engine.py` | Core SAW implementation, class `SAWRecommendationEngine`, weighted criteria, final SAW score. | Replace or retire as `priority_recommendation_engine` focused on formalized operational rules and decision tree evidence. |
| `ai-module/ranking_engine.py` | Driver ranking using SAW score and adjusted score. | Replace with operational constraint evaluation if driver feasibility remains needed; remove driver ranking as a research contribution. |
| `ai-module/explainable_engine.py` | Explains SAW factors, `score_details`, weighted score, recommendation score, and driver chosen by highest SAW score. | Refactor to explain knowledge trace: acquisition source, formalized rule, labeling guideline, rule-based result, decision tree path, and priority recommendation. |
| `ai-module/delivery_date_engine.py` | Newer date engine, but still references `3-criteria SAW`, `SAWRecommendationEngine`, composite score, weighted scores. | Keep delivery-window logic, but reword and refactor scoring as rule evidence / priority recommendation evidence, not SAW. |
| `backend/routes/recommendation.js` | Express route centered on recommendation score, top driver recommendations, score details, fallback scoring, AI `/recommend`. | Refactor into priority recommendation endpoint using formalized rules and decision tree reconstruction evidence. |
| `backend/routes/analytics.js` | Analytics based on `DeliveryRecommendation`, average recommendation score, recommended driver count, score distribution. | Refactor analytics around labeling guideline quality, rule coverage, decision tree reconstruction accuracy, priority recommendation outcomes, and POD results. |
| `backend/models/DeliveryRecommendation.js` | Database model stores score, recommended driver, top recommendations, score details, factor explanation, traffic/workload factors. | Replace conceptually with priority recommendation audit / operational knowledge decision log. Do not modify schema until a formal migration is approved. |
| `backend/models/DeliveryAnalyticsLog.js` | Event examples use `recommendation_generated` and metrics can store `recommendation_score`. | Reframe events as `priority_recommendation_generated`, `knowledge_rule_evaluated`, `label_feedback_submitted`, `pod_completed`. |
| `backend/models/index.js` | Registers `DeliveryRecommendation` relation as invoice recommendations. | Future model association should point to priority recommendation audit records. |
| `backend/server.js` | Registers `/api/recommendation`. | Future route should expose priority recommendation / operational knowledge endpoints. |
| `frontend/src/pages/RecommendationPage.jsx` | Main SAW UI: "Rekomendasi Pengiriman SAW", SAW methodology, score display, driver ranking, score breakdown, Hybrid C4.5 + SAW wording. | Refactor page into Operational Knowledge / Priority Recommendation workflow. |
| `frontend/src/pages/AnalyticsPage.jsx` | Shows recommendation totals, average score, score visual, driver selected counts, area score. | Refactor metrics to framework metrics: rule coverage, label guideline consistency, decision tree reconstruction, priority recommendation outcome, POD completion. |
| `frontend/src/api/recommendationService.js` | Service comments and endpoints reference SAW and `/api/recommendation`. | Refactor service contract toward priority recommendation API. |
| `frontend/src/api/analyticsService.js` | Service comments and return contracts reference recommendation score and driver selection metrics. | Refactor contract toward operational knowledge analytics. |
| `frontend/src/api/index.js` | Exports `recommendationService`. | Future export should represent `priorityRecommendationService` or `operationalKnowledgeService`. |
| `frontend/src/App.jsx` | Imports `RecommendationPage` and routes `/recommendation`. | Future route should point to priority recommendation / operational knowledge page. |
| `frontend/src/components/Sidebar.jsx` | Navigation label is `Rekomendasi SAW`. | Change label to `Priority Recommendation` or `Operational Knowledge`. |
| `frontend/src/index.css` | CSS section named `Recommendation Engine - SAW Components`; includes score, score breakdown, driver ranking classes. | Reclassify styles as knowledge trace / priority recommendation components during UI refactor. |

### Planning And Documentation Files

| File | Current Dependency | OLD -> NEW |
| --- | --- | --- |
| `Website-Architecture.md` | Contains SAW recommendation UI, ranking engine, recommendation score, recommended driver ranking. | Update architecture to the final framework pipeline. |
| `Frontend-Architecture.md` | Contains `Rekomendasi SAW` in navigation section. | Update to `Priority Recommendation` or `Operational Knowledge`. |
| `Data-Architecture.md` | Mentions recommendation score in analytics data. | Replace with priority recommendation evidence / decision trace metrics. |
| `Conference_Template/sections-indonesia/00_abstract.tex` | Describes integration with SAW and SAW simulation results. | Replace with final thesis contribution pipeline and remove SAW claims. |
| `Conference_Template/sections-indonesia/01_introduction.tex` | Frames solution as C4.5 + SAW. | Reframe as Operational Knowledge Formalization + Rule-Based + Decision Tree Reconstruction. |
| `Conference_Template/sections-indonesia/02_related_work.tex` | Contains SAW theory section. | Replace or reduce to explain why SAW is out of scope; focus on knowledge formalization, rule-based systems, decision trees, POD. |
| `Conference_Template/sections-indonesia/03_methodology.tex` | Contains SAW criteria and weights. | Replace with Knowledge Acquisition -> Formalization -> Labeling Guideline -> Rule-Based -> Decision Tree Reconstruction methodology. |
| `Conference_Template/sections-indonesia/04_results.tex` | Contains SAW simulation score table and interpretation. | Replace with rule coverage, labeling consistency, decision tree reconstruction, priority recommendation, and POD tracking results. |
| `Conference_Template/sections-indonesia/05_conclusion.tex` | Concludes with SAW recommendation. | Conclude with Operational Knowledge Formalization Framework. |
| `Conference_Template/references.bib` | Contains SAW/MCDM references. | Remove if no longer cited after thesis refactor. |
| `Conference_Template/taks-1-draft-bab1-bab2.txt` | Mentions that SAW is not used. | This is mostly aligned; keep only if useful as research note. |
| `Conference_Template/REVIEW_NOTES.md` | Contains review notes about removing SAW. | This is historical and can remain, but should not be used as application architecture. |

### Generated Or Non-Actionable Files

| File | Finding | Action |
| --- | --- | --- |
| `backend/package-lock.json` | `rg` finds `saw` inside integrity hashes only. | Ignore. This is not SAW terminology. |
| `frontend/dist/**` | No meaningful source-level SAW hits were found in the targeted scan. | Regenerate only after source migration, if needed. |
| `*.pkl`, `*.xlsx`, `*.pdf`, `*.png` | Binary artifacts were not manually inspected as source text. | Treat as artifacts; review manually only if included in final thesis deliverables. |

## 4. Every Backend Endpoint That Should Change

| Current Endpoint | Current Meaning | OLD -> NEW Endpoint Direction |
| --- | --- | --- |
| `POST /api/recommendation` | Generates SAW-style delivery recommendation and driver ranking. | `POST /api/priority-recommendations` to generate priority recommendation from formalized operational knowledge and decision tree evidence. |
| `GET /api/recommendation/history` | Lists delivery recommendation records. | `GET /api/priority-recommendations/history` or `GET /api/priority-recommendations/audit` for decision trace history. |
| `GET /api/recommendation/:id` | Reads one recommendation record. | `GET /api/priority-recommendations/:id` to read one priority recommendation audit record. |
| `PATCH /api/recommendation/:id/feedback` | Stores recommendation acceptance and delivery outcome feedback. | `PATCH /api/priority-recommendations/:id/outcome` to store operational outcome feedback tied to POD/tracking. |
| `DELETE /api/recommendation/:id` | Deletes a recommendation record. | Reconsider. Final research audit trail should likely be append-only or soft-deleted, not hard-deleted. |
| `GET /api/analytics/recommendation` | Recommendation count, average score, score distribution, confidence distribution. | `GET /api/analytics/priority-recommendations` for label quality, rule coverage, reconstruction accuracy, and outcome metrics. |
| `GET /api/analytics/drivers` | Driver metrics derived from recommendation table and recommended driver count. | `GET /api/analytics/delivery-execution` or keep driver performance only as POD/tracking analytics, not driver ranking. |
| `GET /api/analytics/areas` | Area metrics derived from recommendation score and estimated time. | `GET /api/analytics/operational-constraints` or area-level rule coverage and delivery outcome metrics. |

Backend-to-AI calls affected inside `backend/routes/recommendation.js`:

| Current AI Call | Current Meaning | OLD -> NEW |
| --- | --- | --- |
| `POST {AI_MODULE_URL}/predict` | C4.5 priority prediction. | Keep conceptually, but reframe as Decision Tree Reconstruction result and include rule/label trace if supported. |
| `POST {AI_MODULE_URL}/recommend` | SAW recommendation and driver ranking. | Replace with `POST /priority-recommend` or `POST /operational-knowledge/priority-recommendation`. |

## 5. Every Frontend Page That Should Change

| Page | Current SAW Dependency | OLD -> NEW |
| --- | --- | --- |
| `frontend/src/pages/RecommendationPage.jsx` | Entire page is SAW-centered: title, tabs, intro, processing text, result score, driver ranking, score breakdown, methodology, formula, hybrid C4.5 + SAW research contribution. | Convert into a framework page showing Knowledge Acquisition, Knowledge Formalization, Operational Labeling Guideline, Rule-Based Representation, Decision Tree Reconstruction, Priority Recommendation, and Tracking/POD handoff. |
| `frontend/src/pages/AnalyticsPage.jsx` | Metrics are centered on total recommendations, average score, score distribution, driver selected count, avg score by area. | Convert to Operational Knowledge analytics: rule coverage, unknown rule count, label agreement, decision tree accuracy, priority recommendation outcome, POD completion. |
| Route shell in `frontend/src/App.jsx` | Exposes `/recommendation` to `RecommendationPage`. | Future route should become `/priority-recommendation` or `/operational-knowledge` while preserving compatibility during migration. |

Pages not directly SAW-dependent but worth reviewing for final thesis alignment:

| Page | Reason |
| --- | --- |
| `frontend/src/pages/PriorityPage.jsx` | Already C4.5-focused, but should be aligned with "Decision Tree Reconstruction" and "Operational Labeling Guideline" wording. |
| `frontend/src/pages/Dashboard.jsx` | No direct SAW wording found, but dashboard cards may later need final framework metrics. |
| `frontend/src/pages/TrackerPage.jsx` and `frontend/src/pages/CourierPage.jsx` | These belong to final "Invoice Tracking & POD" stage and should remain, with only wording alignment if needed. |

## 6. Every Component Affected

| Component / UI Area | Current Dependency | OLD -> NEW |
| --- | --- | --- |
| `frontend/src/components/Sidebar.jsx` | Menu item label `Rekomendasi SAW`, route `/recommendation`. | Label should become `Priority Recommendation` or `Operational Knowledge`; route should map to the final framework page. |
| `frontend/src/App.jsx` | Imports and routes `RecommendationPage`. | Keep app shell, but future route/page naming should reflect priority recommendation or operational knowledge. |
| `frontend/src/pages/RecommendationPage.jsx` internal result panels | Components display SAW score, delivery recommendation, driver ranking, score breakdown, methodology, formula. | Panels should display knowledge source, formalized rules, labeling guideline, rule evaluation, decision tree path, priority recommendation, and POD handoff. |
| `frontend/src/pages/AnalyticsPage.jsx` KPI cards and tables | Cards show total recommendations, average score, driver score visual, selected driver count. | Cards should show knowledge formalization metrics, label quality, rule coverage, reconstruction accuracy, priority recommendation outcomes. |
| `frontend/src/index.css` SAW component styles | Section and classes are named around recommendation result, score display, score breakdown, driver rank cards. | Styling can be reused later, but semantic names should move toward `knowledge-trace`, `rule-evidence`, `priority-result`, and `decision-path`. |

## 7. Every Database Field Affected

Do not modify the database yet. This section lists schema concepts that are SAW/recommendation-score oriented and need a future migration design.

### `delivery_recommendations` Table / `DeliveryRecommendation` Model

| Current Field | Current Meaning | OLD -> NEW Direction |
| --- | --- | --- |
| table `delivery_recommendations` | Stores SAW delivery recommendation records. | Future table concept: `priority_recommendation_audits` or `operational_decision_logs`. |
| `priority_label` | Priority label used as recommendation input. | Keep, but link to labeling guideline and decision tree reconstruction result. |
| `recommendation_score` / `recommendationScore` | SAW-style weighted score. | Replace conceptually with `priority_evidence`, `decision_confidence`, or `rule_evaluation_result`. |
| `recommended_delivery_day` / `recommendedDeliveryDay` | Label derived from score thresholds. | Replace with `priority_action` or `valid_delivery_window`. |
| `recommended_driver` / `recommendedDriver` | Driver selected by ranking. | Replace with `assigned_delivery_actor` or move to tracking/POD assignment context. |
| `recommendation_reason` / `recommendationReason` | Narrative based on score and driver. | Replace with `knowledge_trace_reason` or `rule_based_reason`. |
| `recommendation_confidence` / `recommendationConfidence` | Confidence label tied to score threshold. | Replace with decision tree confidence or rule coverage confidence. |
| `recommendation_confidence_score` / `recommendationConfidenceScore` | Numeric confidence tied to recommendation score. | Replace with model confidence or rule coverage metric. |
| `top_recommendations` / `topRecommendations` | Ranked driver alternatives. | Replace with candidate delivery windows or formalized decision alternatives. |
| `score_details` / `scoreDetails` | Weighted criteria details. | Replace with `knowledge_trace`, `rule_evidence`, or `decision_path`. |
| `factor_explanation` / `factorExplanation` | SAW factor explanations. | Replace with operational rule explanations and decision tree path explanations. |
| `recommendation_summary` / `recommendationSummary` | Summary of score-based recommendation. | Replace with framework summary: acquisition source -> formalized rule -> priority result. |
| `operational_constraints` / `operationalConstraints` | Driver/ranking constraints. | Keep only if reframed as formalized customer constraints, receive schedule, cutoff policy, POD constraints. |
| `traffic_adjustment` / `trafficAdjustment` | Delivery-time adjustment from recommendation engine. | Move outside thesis core unless used for POD/tracking analytics. |
| `workload_factor` / `workloadFactor` | Driver workload factor in score. | Move outside priority recommendation; use only as delivery execution context if needed. |
| `recommendation_accepted` / `recommendationAccepted` | User feedback on recommendation. | Rename conceptually to `priority_recommendation_used` or `operator_decision_followed`. |
| `actual_driver` / `actualDriver` | Driver selected in actual outcome. | Move to Delivery/POD execution context. |
| `delivery_delay_minutes` / `deliveryDelayMinutes` | Outcome metric. | Keep as POD/tracking analytics, not SAW evaluation. |
| `delivery_success` / `deliverySuccess` | Outcome metric. | Keep as POD/tracking analytics. |

### `delivery_analytics_logs` Table / `DeliveryAnalyticsLog` Model

| Current Field / Value | Current Meaning | OLD -> NEW |
| --- | --- | --- |
| `event_type = recommendation_generated` | SAW recommendation generated. | `priority_recommendation_generated`, `rule_evaluation_completed`, or `decision_tree_reconstruction_completed`. |
| `metric_name = recommendation_score` | Tracks SAW score. | `rule_coverage_rate`, `label_agreement`, `decision_tree_confidence`, or `priority_outcome_accuracy`. |
| `event_data.score` | Stores recommendation score. | Store rule trace, label guideline id, decision tree path id, priority result, outcome link. |

### Current Prisma Schema Gap

`backend/prisma/schema.prisma` currently does not define `DeliveryRecommendation` or `DeliveryAnalyticsLog`, while Sequelize models do. Before any database migration, choose one schema authority and align it.

## 8. Every API Affected

### Frontend API Services

| Current API File | Affected Contract | OLD -> NEW |
| --- | --- | --- |
| `frontend/src/api/recommendationService.js` | Calls `/recommendation`, comments say SAW, returns `driverRanking`, `scoreBreakdown`. | Replace with `priorityRecommendationService` or `operationalKnowledgeService` returning knowledge trace and priority recommendation. |
| `frontend/src/api/analyticsService.js` | Calls `/analytics/recommendation`, `/analytics/drivers`, `/analytics/areas`, expects avg score. | Replace with operational knowledge analytics APIs. |
| `frontend/src/api/index.js` | Exports `recommendationService`. | Export future service under final terminology. |

### Backend API Response Fields

| Current Field | OLD Meaning | NEW Field Direction |
| --- | --- | --- |
| `recommendation_score` | SAW weighted score. | `priority_evidence`, `decision_confidence`, or `rule_evaluation_result`. |
| `recommended_delivery_day` | Score-threshold delivery label. | `priority_action` or `valid_delivery_window`. |
| `recommended_driver` | Driver chosen by ranking. | `assigned_delivery_actor` or delivery execution context. |
| `top_recommendations` | Ranked drivers. | `candidate_delivery_windows` or `priority_action_alternatives`. |
| `score_details` | Weighted SAW criteria. | `knowledge_trace` or `rule_evidence`. |
| `factor_explanation` | SAW factor explanation. | `formalized_rule_explanation`. |
| `recommendation_summary` | Score-based summary. | `framework_trace_summary`. |
| `recommendation_confidence_score` | Numeric score confidence. | `decision_tree_confidence` or `rule_coverage_confidence`. |
| `operational_constraints` | Ranking constraints. | `formalized_customer_constraints`. |
| `traffic_adjustment` | Delivery-time score adjustment. | Move to delivery execution analytics if still needed. |
| `workload_factor` | Driver workload score factor. | Move to delivery execution analytics if still needed. |

### AI Module API

| Current Endpoint | Current Contract | OLD -> NEW |
| --- | --- | --- |
| `POST /recommend` | SAW + ranking + estimation + explanation response. | `POST /priority-recommend` or `POST /operational-knowledge/priority-recommendation`. |
| `GET /recommend/health` | Reports `SAW Recommendation Engine`, engines `SAW`, `Ranking`, `Estimation`, `Explainable`. | Report `Operational Knowledge Formalization`, engines `Rule-Based`, `Decision Tree Reconstruction`, `Priority Recommendation`, `POD Context`. |
| `POST /predict` | C4.5 priority prediction. | Keep, but include final framework context: label guideline, rule path, decision tree reconstruction metadata. |
| `GET /model-info` | Model metadata. | Keep, but add reconstruction/labeling metadata in future. |

## 9. Every Navigation Item Affected

| Current Navigation | Location | OLD -> NEW |
| --- | --- | --- |
| `Rekomendasi SAW` | `frontend/src/components/Sidebar.jsx` | `Priority Recommendation` or `Operational Knowledge`. |
| `/recommendation` | `frontend/src/App.jsx`, `recommendationService.js`, `Sidebar.jsx` | `/priority-recommendation` or `/operational-knowledge`. |
| `Analytics Dashboard` metrics | `Sidebar.jsx` links to `AnalyticsPage`; page content is score-based. | Menu label can remain, but dashboard content should become operational knowledge analytics. |

## 10. Every Menu Affected

| Current Menu / Tab / Action | File | OLD -> NEW |
| --- | --- | --- |
| Main sidebar item `Rekomendasi SAW` | `Sidebar.jsx` | `Priority Recommendation` / `Operational Knowledge`. |
| Page title `Rekomendasi Pengiriman SAW` | `RecommendationPage.jsx` | `Operational Knowledge Framework` or `Priority Recommendation`. |
| Page subtitle `Simple Additive Weighting...` | `RecommendationPage.jsx` | `Formalisasi pengetahuan operasional untuk rekomendasi prioritas invoice`. |
| Tab `Rekomendasi SAW` | `RecommendationPage.jsx` | `Priority Recommendation`. |
| Tab `Metodologi SAW` | `RecommendationPage.jsx` | `Framework Methodology`. |
| Button `Dapatkan Rekomendasi SAW` | `RecommendationPage.jsx` | `Generate Priority Recommendation`. |
| Loading text `Memproses SAW...` | `RecommendationPage.jsx` | `Memproses formalisasi pengetahuan...`. |
| Empty text `Buat rekomendasi pertama di tab "Rekomendasi SAW"` | `RecommendationPage.jsx` | `Buat priority recommendation pertama dari framework`. |
| Section `Hasil Analisis SAW` | `RecommendationPage.jsx` | `Hasil Priority Recommendation`. |
| Section `Driver Ranking` | `RecommendationPage.jsx` | `Delivery execution context` or remove from core flow. |
| Section `Rincian Skor SAW` | `RecommendationPage.jsx` | `Knowledge Trace` or `Rule Evidence`. |
| Section `Formula SAW` | `RecommendationPage.jsx` | `Operational Knowledge Formalization Flow`. |
| Section `Hybrid C4.5 + SAW` | `RecommendationPage.jsx` | `Rule-Based Representation + Decision Tree Reconstruction`. |
| Analytics card `Rata-rata Score` | `AnalyticsPage.jsx` | `Rule Coverage` / `Label Agreement` / `Decision Confidence`. |
| Analytics table `Avg Score`, `Score Visual` | `AnalyticsPage.jsx` | `Evidence Completeness`, `Rule Coverage`, or `Priority Accuracy`. |

## 11. Every AI Module Affected

| AI File | Current Role | Migration Direction |
| --- | --- | --- |
| `ai-module/app.py` | Runtime orchestrator for C4.5 + SAW + Ranking + Estimation + Explainable. | Refactor orchestration to final pipeline. Remove SAW and ranking from the core response contract. |
| `ai-module/recommendation_engine.py` | SAW engine. | Retire or replace with `priority_recommendation_engine.py` that consumes rule-based representation and decision tree reconstruction. |
| `ai-module/ranking_engine.py` | Driver ranking engine. | Retire from research core or convert to optional delivery constraint evaluator outside priority recommendation. |
| `ai-module/explainable_engine.py` | Explains score factors and ranked driver decision. | Refactor to explain knowledge trace and decision tree reconstruction. |
| `ai-module/delivery_date_engine.py` | Mostly aligned delivery-window engine, but still describes scoring as SAW and references old engine. | Keep date/window logic; remove SAW terminology and tie output to formalized customer constraints. |
| `ai-module/constraint_model.py` | Formalizes customer constraints, cutoff, schedule, receiving time. | Keep and elevate as core Knowledge Formalization module. |
| `ai-module/train.py` | Trains C4.5-style decision tree with entropy. | Keep, but align terminology with Decision Tree Reconstruction and label guideline traceability. |
| `ai-module/estimation_engine.py` | Delivery time estimation. | Optional support for tracking/POD, not thesis core unless tied to final framework. |
| `ai-module/model/model_metadata.json` | Model metadata. | Keep, but future metadata should include labeling guideline and reconstruction metadata. |

## 12. Every Wording That Should Change

### Frontend Wording

| OLD | NEW |
| --- | --- |
| `Rekomendasi Pengiriman SAW` | `Priority Recommendation` |
| `Sistem rekomendasi menggunakan metode Simple Additive Weighting` | `Sistem rekomendasi prioritas berbasis formalisasi pengetahuan operasional` |
| `Metode SAW` | `Operational Knowledge Formalization Framework` |
| `Rincian Skor SAW` | `Knowledge Trace` |
| `Hasil Analisis SAW` | `Priority Recommendation Result` |
| `Skor dihitung berdasarkan 5 kriteria berbobot menggunakan metode SAW` | `Rekomendasi dihasilkan dari aturan operasional, guideline label, dan rekonstruksi decision tree` |
| `Driver diurutkan berdasarkan skor SAW tertinggi` | `Konteks pengiriman ditampilkan berdasarkan kendala operasional dan POD` |
| `Metodologi SAW` | `Framework Methodology` |
| `Formula SAW` | `Operational Knowledge Flow` |
| `Hybrid C4.5 + SAW` | `Rule-Based Representation + Decision Tree Reconstruction` |
| `Skor SAW` | `Priority Evidence` |
| `Score Progress` | `Evidence Completeness` |
| `Avg Score` | `Rule Coverage` or `Decision Confidence` |
| `Driver Rekomendasi` | `Delivery Actor` or `POD Courier Context` |

### Backend And API Wording

| OLD | NEW |
| --- | --- |
| `recommendationRoutes` | `priorityRecommendationRoutes` |
| `/api/recommendation` | `/api/priority-recommendations` |
| `DeliveryRecommendation` | `PriorityRecommendationAudit` or `OperationalDecisionLog` |
| `recommendation_generated` | `priority_recommendation_generated` |
| `recommendation_score` | `priority_evidence` / `decision_confidence` |
| `recommended_driver` | `assigned_delivery_actor` |
| `top_recommendations` | `candidate_delivery_windows` |
| `score_details` | `knowledge_trace` |
| `factor_explanation` | `rule_evidence_explanation` |
| `recommendation_summary` | `framework_trace_summary` |
| `recommendation_accepted` | `operator_decision_followed` |

### AI Module Wording

| OLD | NEW |
| --- | --- |
| `SAWRecommendationEngine` | `PriorityRecommendationEngine` |
| `DriverRankingEngine` | `OperationalConstraintEvaluator` |
| `Recommendation Engine` | `Priority Recommendation Module` |
| `Ranking Engine` | `Constraint Evaluation Module` |
| `calculate_saw_score` | `evaluate_priority_evidence` |
| `score_details` | `knowledge_trace` |
| `weighted_score` | `rule_evidence_weight` only if weights remain explainable; otherwise `rule_evidence` |
| `final_score` | `decision_confidence` or `priority_evidence_level` |
| `get_delivery_day` | `derive_priority_action` |
| `get_top_recommendations` | `get_candidate_delivery_windows` |
| `SAW + MCDM` | `Operational Knowledge Formalization` |

### Research Document Wording

| OLD | NEW |
| --- | --- |
| `SAW` | Remove from final contribution unless discussed as abandoned prior design. |
| `Simulasi SAW` | `Evaluasi Rule-Based dan Decision Tree Reconstruction`. |
| `Bobot Kriteria SAW` | `Operational Labeling Guideline` or `Rule-Based Representation`. |
| `C4.5 + SAW` | `Rule-Based Representation + Decision Tree Reconstruction`. |
| `rekomendasi hari pengiriman, driver, dan estimasi waktu` | `priority recommendation and Invoice Tracking & POD handoff`. |
| `skor 1,000 dan 0,465` | Replace with final evaluation metrics: labeling consistency, rule coverage, C4.5 reconstruction accuracy, priority recommendation outcome. |

## 13. Proposed Migration Sequence

This is a safe sequence for future implementation. Do not execute it until approved.

1. Freeze current behavior and add tests around existing recommendation APIs if needed.
2. Update architecture terminology and route contracts in documentation first.
3. Define final data contract for priority recommendation audit records.
4. Decide whether to keep old `/api/recommendation` as compatibility alias during transition.
5. Refactor AI module contract from `/recommend` to final priority recommendation contract.
6. Refactor backend route and model names conceptually, then plan schema migration separately.
7. Refactor frontend service contract.
8. Refactor `RecommendationPage` content into the final framework page.
9. Refactor analytics metrics away from recommendation score and driver ranking.
10. Update navigation and menus.
11. Regenerate build artifacts.
12. Update thesis/conference documents to remove SAW as final contribution.

## 14. Migration Risks

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Removing SAW terms before replacing API contracts | Frontend and backend currently exchange score/ranking fields. | Define new response schema first. |
| Database table still stores score/ranking fields | Existing history depends on `delivery_recommendations`. | Add compatibility layer or migration view before schema changes. |
| Driver ranking removed too quickly | Some UI and analytics depend on recommended driver counts. | Move driver data to delivery execution/POD context. |
| Recommendation history loses audit value | Thesis framework needs traceability. | Preserve old records and map them to legacy audit entries. |
| AI `/recommend` contract changes abruptly | Backend route depends on this endpoint. | Version AI endpoint or add adapter. |
| Research documents contradict website | Conference files still discuss SAW as contribution. | Update documents after code migration plan is approved. |

## 15. Non-Implementation Statement

This report only identifies migration targets and proposes OLD -> NEW mappings. It does not:

- edit source code,
- delete SAW files,
- rename routes,
- rename frontend pages,
- modify authentication,
- modify database schema,
- migrate database records,
- remove UI elements,
- change business logic.

