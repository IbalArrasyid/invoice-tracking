# Batch 4 Research Integration Report

Project: Invoice Tracking & Proof of Delivery System  
Migration target: Operational Knowledge Formalization Framework  
Batch: Research Engine Integration  
Date: 2026-07-14

## 1. Research Artifacts Integrated

Batch 4 integrates the finalized research artifacts into the existing recommendation flow without changing routes, endpoints, database schema, UI layout, or authentication.

Integrated artifacts:

| Artifact | Status |
| --- | --- |
| Operational Labeling Guideline R1-R12 | Implemented in `ai-module/operational_rule_engine.py`. |
| Trained Decision Tree model | Integrated through `ai-module/model/decision_tree_model.pkl`. |
| Decision Tree encoders | Uses existing `ai-module/model/label_encoders.pkl`. |
| Model metadata | Uses existing `ai-module/model/model_metadata.json`. |
| Knowledge Trace generator | Implemented dynamically in `ai-module/app.py`. |
| Decision Tree traversal generator | Implemented in `ai-module/decision_tree_runtime.py`. |

The repository previously contained the actual trained tree as `ai-module/model/c45_model.pkl`. Batch 4 created `ai-module/model/decision_tree_model.pkl` as a byte-for-byte copy of that trained artifact so the app now loads the finalized canonical artifact name. SHA-256 hashes match.

## 2. Rule Engine Status

Implemented the Operational Labeling Guideline as R1-R12.

Each recommendation now exposes:

- `rule_id`
- `rule_name`
- `activated_conditions`
- `operational_reason`
- `priority`
- `priority_code`
- `operational_attributes`
- `rules_evaluated`

The active rule is returned under:

- `rule_evidence.activated_rule`
- `rule_based_result.activated_rule`

Rules are evaluated sequentially and always produce one activated rule. The final priority is combined from the activated rule and trained decision tree result using the strongest priority level.

## 3. Decision Tree Status

The AI module now prefers:

```text
ai-module/model/decision_tree_model.pkl
```

and falls back to:

```text
ai-module/model/c45_model.pkl
```

only if the canonical artifact is missing.

Decision Tree integration now uses:

- `DecisionTreeClassifier.predict`
- `DecisionTreeClassifier.predict_proba`
- `model.tree_`
- `label_encoders.pkl`
- the exact trained feature order:
  - `nama_customer`
  - `nama_driver`
  - `area_pengantaran`
  - `jadwal_terima`
  - `cut_off_jam`

## 4. Knowledge Trace Generation

Knowledge Trace is now generated dynamically from the actual request and research outputs.

Trace stages:

```text
Knowledge Acquisition
-> Knowledge Formalization
-> Operational Guideline
-> Activated Rule
-> Decision Tree Reconstruction
-> Priority Recommendation
```

The trace includes:

- source invoice/customer/driver/schedule/cutoff fields
- formalized operational attributes
- R1-R12 rule evaluation
- activated rule
- actual tree traversal path
- final priority recommendation

## 5. Decision Path Generation

Decision Tree path is no longer hardcoded.

`ai-module/decision_tree_runtime.py` traverses the trained tree by reading:

- `tree.children_left`
- `tree.children_right`
- `tree.feature`
- `tree.threshold`
- `tree.value`
- `tree.n_node_samples`
- `tree.impurity`

Each path step exposes:

- `node_index`
- `node_type`
- `feature`
- `raw_value`
- `encoded_value`
- `threshold`
- `condition`
- `decision`
- `next_node`
- `samples`
- `entropy`

The leaf node exposes:

- final raw prediction
- class distribution
- entropy
- sample count

## 6. Files Modified

| File | Change |
| --- | --- |
| `ai-module/operational_rule_engine.py` | Added R1-R12 operational labeling guideline engine. |
| `ai-module/decision_tree_runtime.py` | Added trained Decision Tree prediction and actual traversal extraction. |
| `ai-module/app.py` | Integrated rule engine and decision tree runtime into `/predict` and `/recommend`; enriched health/model info responses. |
| `ai-module/priority_recommendation_orchestrator.py` | Updated orchestration to prefer real research outputs over compatibility placeholders. |
| `ai-module/model/decision_tree_model.pkl` | Added canonical trained model artifact, copied from the existing trained `c45_model.pkl`. |
| `backend/routes/recommendation.js` | Passed `nama_customer` to AI `/recommend` and preserved Batch 4 fields in API responses/events. |
| `frontend/src/utils/priorityRecommendationAdapter.js` | Updated data binding to display activated R1-R12 rules and actual tree path steps cleanly. |
| `Batch4-Research-Integration-Report.md` | Added this report. |

## 7. Remaining Work

- Replace the legacy scoring internals after all consumers stop depending on old score fields.
- Add automated tests for R1-R12 rule evaluation.
- Add automated tests for Decision Tree traversal formatting.
- Add a model artifact manifest with checksum, training date, feature list, and version.
- Expose richer operational attributes if future schema/API batches add customer regulation, receive schedule, and cutoff policy entities.
- Migrate remaining UI wording and analytics in later batches.

## 8. Known Limitations

- The current database only exposes schedule and cutoff as simple invoice/customer fields, so some operational attributes such as `days_to_cutoff` are derived when not supplied.
- The actual runtime model-load smoke test could not be executed with the bundled Codex Python because that runtime does not include `joblib`/`scikit-learn`; the AI module requirements file does include them.
- Legacy compatibility fields such as `recommendation_score` remain for frontend compatibility.
- Driver selection remains Delivery Context, not the thesis contribution.

## 9. Verification

Completed checks:

```text
python -m py_compile ai-module/app.py ai-module/priority_recommendation_orchestrator.py ai-module/operational_rule_engine.py ai-module/decision_tree_runtime.py
node --check backend/routes/recommendation.js
node --check frontend/src/utils/priorityRecommendationAdapter.js
npx vite build --outDir batch4-build-output --emptyOutDir false
```

The temporary Vite build output was removed after verification.

The Vite build still reports the pre-existing CSS warning for selector `*after` in `frontend/src/index.css`; that file was not changed in Batch 4.
