# Frontend Terminology Migration Report

## Scope

Batch 6A aligns frontend terminology and user-facing language with the finalized thesis contribution:

**Operational Knowledge Formalization Framework**

This batch only modified frontend terminology, comments, constants, labels, and component-facing wording.

No backend, API route, Rule Engine, Decision Tree, database, authentication, or routing changes were made.

## Files Modified

| File | Change Summary |
| --- | --- |
| `frontend/src/components/Sidebar.jsx` | Replaced legacy recommendation and analytics labels with Priority Recommendation and Operational Analytics language. |
| `frontend/src/pages/RecommendationPage.jsx` | Reframed the legacy recommendation page from SAW demo wording into operational knowledge, rule evidence, decision tree, delivery context, and POD language. |
| `frontend/src/pages/PriorityPage.jsx` | Renamed visible Confusion Matrix wording to Decision Tree Evaluation. |
| `frontend/src/pages/AnalyticsPage.jsx` | Replaced score/dashboard wording with operational analytics, evidence, priority recommendation, and delivery context language. |
| `frontend/src/pages/Dashboard.jsx` | Renamed priority list CSS usage from rank terminology to priority sequence terminology. |
| `frontend/src/components/RecommendationWorkflowSections.jsx` | Kept Batch 5 workflow terminology aligned with lifecycle, outcome, POD, and operational history language. |
| `frontend/src/utils/priorityRecommendationAdapter.js` | Reframed compatibility score details as operational evidence and removed visible score-detail wording. |
| `frontend/src/utils/recommendationWorkflowAdapter.js` | Replaced visible Rule Engine ownership label with Operational Knowledge Engine. |
| `frontend/src/api/recommendationService.js` | Updated comments from SAW recommendation wording to Priority Recommendation framework wording. |
| `frontend/src/api/analyticsService.js` | Updated comments from score/recommendation wording to priority recommendation and delivery context analytics wording. |
| `frontend/src/index.css` | Renamed comments/classes from score/rank/driver-ranking vocabulary to evidence, priority sequence, and delivery context vocabulary. |

## Components Modified

| Component / Area | Terminology Alignment |
| --- | --- |
| Sidebar navigation | `Rekomendasi SAW` became `Priority Recommendation`; analytics became `Operational Analytics`. |
| Legacy Recommendation page | Reframed as Operational Knowledge / Priority Recommendation page while preserving existing data flow. |
| Recommendation result panel | Reframed numeric compatibility value as `Priority Recommendation Evidence`. |
| Delivery actor section | `Driver Ranking` became `Delivery Context`. |
| Evidence breakdown section | `Score Breakdown` became `Rule Evidence Breakdown`. |
| Methodology tab | Replaced SAW formula explanation with Operational Knowledge Flow and Operational Guideline. |
| Analytics page | `Score` labels became `Evidence`; driver performance became `Delivery Context Performance`. |
| Priority page model area | `Confusion Matrix` became `Decision Tree Evaluation`. |
| Dashboard priority sequence UI | CSS class usage changed from rank wording to priority sequence wording. |

## Old Terminology to New Terminology

| OLD | NEW |
| --- | --- |
| SAW | Priority Recommendation / Operational Knowledge Formalization Framework |
| Simple Additive Weighting | Operational Knowledge Formalization Framework |
| Recommendation Score | Priority Recommendation Evidence |
| Ranking / Peringkat | Priority Level / Delivery Context |
| Driver Ranking | Delivery Context |
| Weighted Score | Operational Evidence |
| Criteria / Kriteria | Operational Attribute |
| Criteria Weight / Bobot | Knowledge Role / Evidence Role |
| Normalization / Normalisasi | Knowledge Formalization |
| Recommendation Engine | Operational Knowledge Engine |
| Recommendation History | Priority Recommendation History |
| Score Breakdown / Score Detail | Rule Evidence Breakdown |
| Matrix / Confusion Matrix | Decision Tree Evaluation |
| Benefit / Cost | Operational Evidence Role |
| Alternative / Alternatif | Invoice |
| SAW Formula | Operational Knowledge Flow |
| SAW Methodology | Operational Guideline |

## Verification

Source scan completed for the requested legacy terminology set in `frontend/src`.

No source matches remain for:

- `SAW`
- `Recommendation Score`
- `Driver Ranking`
- `Recommendation Engine`
- `SAW Result`
- `Weighted Score`
- `Criteria Weight`
- `Ranking`
- `Peringkat`
- `Normalization`
- `Normalisasi`
- `Alternative`
- `Alternatif`
- `Score Detail`
- `Weighted`
- `Benefit`
- `Cost`
- `Matrix`

Frontend production build completed successfully:

```bash
npm run build -- --outDir ..\batch6a-build-output --emptyOutDir false
```

Build warnings observed:

- Existing CSS warning: `*, *::before, *after` contains `*after`.
- Existing Vite chunk-size warning.

No Batch 6A build errors were introduced.

Temporary build output was removed after verification.

## Remaining Legacy Wording

No visible legacy SAW/ranking terminology remains in `frontend/src`.

Some backend compatibility response field names are still referenced internally, such as:

- `recommendation_score`
- `score_details`
- `avgScore`
- `scoreDistribution`
- `confidence_score`

These are not shown as UI terminology. They remain because Batch 6A explicitly does not change backend APIs, database fields, or compatibility contracts.

## Recommendations for Future Cleanup

- In a later backend/API batch, introduce final field aliases such as `operational_evidence`, `priority_evidence`, and `evidence_distribution`.
- After backend aliases are stable, remove frontend reads of old score-shaped compatibility fields.
- Consider removing or fully retiring the legacy `RecommendationPage.jsx` if the new `PriorityRecommendationPage.jsx` is the only intended route.
- Fix the existing global CSS selector typo `*after` to `*::after` in a future UI maintenance batch.
- Consider code-splitting the frontend bundle to address the existing Vite chunk-size warning.
