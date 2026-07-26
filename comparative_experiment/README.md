# Comparative Experiment Reproducibility Package

This folder contains the official source code for the undergraduate thesis comparative analysis of invoice priority classification.

## Final Methodology

- Research type: comparative analysis.
- Dataset: `dataset_invoice.xlsx`, sheet `Data Labeling`.
- Final sample: 99 unique invoices.
- Ground truth: historical admin labels in `expert_label`.
- Label mapping: `HIGH = Urgent`, `NORMAL = Not Urgent`.
- Class distribution: 30 `Urgent`, 69 `Not Urgent`.
- Rule-Based method: finalized rules R1-R8 only.
- Decision Tree method: `sklearn.tree.DecisionTreeClassifier(criterion="entropy")`.
- No Random Forest, C4.5 library, XGBoost, LightGBM, grid search, or hyperparameter tuning.
- Primary final evaluation: Leave-One-Out Cross Validation (LOOCV).

## Folder Structure

```text
comparative_experiment/
├── data/
│   └── dataset.py
├── rules/
│   └── rule_based.py
├── models/
│   └── decision_tree.py
├── experiments/
│   └── runner.py
├── evaluation/
│   ├── metrics.py
│   ├── mcnemar.py
│   └── reporting.py
├── outputs/
├── config.py
├── main.py
├── requirements.txt
└── README.md
```

## How To Run

From the repository root:

```bash
pip install -r comparative_experiment/requirements.txt
python -m comparative_experiment.main
```

You can also run:

```bash
python comparative_experiment/main.py
```

The root-level `run_comparative_experiment.py` is retained as a compatibility wrapper for the same finalized entrypoint.

## Required Outputs

The program writes these required files to `comparative_experiment/outputs/`:

- `metrics.csv`
- `comparison_table.csv`
- `confusion_matrix_rule_based.csv`
- `confusion_matrix_decision_tree.csv`
- `classification_report_rule_based.txt`
- `classification_report_decision_tree.txt`
- `mcnemar_result.txt`
- `experiment_summary.md`

Additional traceability outputs are also written:

- `predictions.csv`
- `cleaned_analysis_dataset.csv`
- `dataset_summary.csv`
- `duplicate_handling.csv`
- `data_quality_issues.csv`
- `experiment_config.json`

## Thesis Table Mapping

- Dataset summary table: `dataset_summary.csv`.
- Rule-Based metrics table: filter `metrics.csv` where `method = Rule-Based`.
- Decision Tree metrics table: filter `metrics.csv` where `method = Decision Tree`.
- Comparative performance table: `comparison_table.csv`.
- Rule-Based confusion matrix table: `confusion_matrix_rule_based.csv`.
- Decision Tree confusion matrix table: `confusion_matrix_decision_tree.csv`.
- Paired comparison and Exact McNemar test table: `mcnemar_result.txt`.
- Narrative summary for Chapter IV: `experiment_summary.md`.

