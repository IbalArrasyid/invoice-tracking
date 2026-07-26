"""Write reproducibility outputs required by the thesis package."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from comparative_experiment.config import (
    CLASS_LABELS,
    EXPERIMENT_DESCRIPTIONS,
    EXPERIMENT_ORDER,
    LABEL_MAP,
    MODEL_FEATURES,
    OUTPUT_DIR,
    RANDOM_STATE,
    SOURCE_LABEL_COLUMN,
    SOURCE_SHEET,
    SOURCE_WORKBOOK,
    TARGET_COLUMN,
)
from comparative_experiment.data.dataset import DatasetBundle
from comparative_experiment.evaluation.mcnemar import exact_mcnemar
from comparative_experiment.evaluation.metrics import (
    calculate_metrics,
    classification_report_section,
    confusion_matrix_rows,
)


METHOD_COLUMNS = {
    "Rule-Based": "prediction_rule_based",
    "Decision Tree": "prediction_decision_tree",
}


def markdown_table(frame: pd.DataFrame) -> str:
    """Render a dataframe as a compact Markdown table without extra dependencies."""

    if frame.empty:
        return "No rows."

    text_frame = frame.fillna("").astype(str)
    columns = list(text_frame.columns)
    lines = [
        "| " + " | ".join(columns) + " |",
        "| " + " | ".join("---" for _ in columns) + " |",
    ]
    for _, row in text_frame.iterrows():
        values = [str(row[column]).replace("\n", " ").replace("|", "\\|") for column in columns]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def build_metrics_table(predictions: pd.DataFrame) -> pd.DataFrame:
    """Build metrics for both methods across E1-E4."""

    rows: list[dict[str, object]] = []
    for experiment_id in EXPERIMENT_ORDER:
        experiment_frame = predictions[predictions["experiment_id"].eq(experiment_id)]
        experiment = EXPERIMENT_DESCRIPTIONS[experiment_id]
        for method, column in METHOD_COLUMNS.items():
            rows.append(
                calculate_metrics(
                    experiment_frame,
                    prediction_column=column,
                    experiment_id=experiment_id,
                    experiment=experiment,
                    method=method,
                )
            )
    return pd.DataFrame(rows)


def build_comparison_table(metrics: pd.DataFrame) -> pd.DataFrame:
    """Build the Rule-Based versus Decision Tree comparison table."""

    return metrics[
        [
            "experiment_id",
            "experiment",
            "method",
            "n",
            "accuracy",
            "precision",
            "recall",
            "f1_score",
            "macro_f1",
            "false_positive",
            "false_negative",
        ]
    ].copy()


def build_confusion_table(predictions: pd.DataFrame, method: str) -> pd.DataFrame:
    """Build confusion matrices across E1-E4 for one method."""

    rows: list[dict[str, object]] = []
    prediction_column = METHOD_COLUMNS[method]
    for experiment_id in EXPERIMENT_ORDER:
        experiment_frame = predictions[predictions["experiment_id"].eq(experiment_id)]
        rows.extend(
            confusion_matrix_rows(
                experiment_frame,
                prediction_column=prediction_column,
                experiment_id=experiment_id,
                experiment=EXPERIMENT_DESCRIPTIONS[experiment_id],
            )
        )
    return pd.DataFrame(rows)


def build_classification_report_text(predictions: pd.DataFrame, method: str) -> str:
    """Build a multi-section sklearn classification report text file."""

    prediction_column = METHOD_COLUMNS[method]
    sections = [f"Classification Report: {method}", f"Labels: {CLASS_LABELS}", ""]
    for experiment_id in EXPERIMENT_ORDER:
        experiment_frame = predictions[predictions["experiment_id"].eq(experiment_id)]
        sections.append(
            classification_report_section(
                experiment_frame,
                prediction_column=prediction_column,
                experiment_id=experiment_id,
                experiment=EXPERIMENT_DESCRIPTIONS[experiment_id],
            )
        )
        sections.append("")
    return "\n".join(sections).rstrip() + "\n"


def build_mcnemar_table(predictions: pd.DataFrame) -> pd.DataFrame:
    """Build Exact McNemar results for paired predictions in E1-E4."""

    rows: list[dict[str, object]] = []
    for experiment_id in EXPERIMENT_ORDER:
        experiment_frame = predictions[predictions["experiment_id"].eq(experiment_id)]
        rows.append(
            {
                "experiment_id": experiment_id,
                "experiment": EXPERIMENT_DESCRIPTIONS[experiment_id],
                **exact_mcnemar(experiment_frame),
            }
        )
    return pd.DataFrame(rows)


def dataset_summary(bundle: DatasetBundle) -> pd.DataFrame:
    """Create a compact dataset summary table."""

    prepared = bundle.prepared
    counts = prepared[TARGET_COLUMN].value_counts().reindex(CLASS_LABELS, fill_value=0)
    rows = [
        {"item": "Source workbook", "value": str(SOURCE_WORKBOOK)},
        {"item": "Source sheet", "value": SOURCE_SHEET},
        {"item": "Raw invoice rows", "value": len(bundle.raw)},
        {"item": "Unique invoices used", "value": len(prepared)},
        {"item": "Removed duplicate rows", "value": len(bundle.raw) - len(prepared)},
        {"item": "Urgent invoices", "value": int(counts["Urgent"])},
        {"item": "Not Urgent invoices", "value": int(counts["Not Urgent"])},
        {"item": "Ground-truth source column", "value": SOURCE_LABEL_COLUMN},
        {"item": "Target column", "value": TARGET_COLUMN},
    ]
    return pd.DataFrame(rows)


def write_mcnemar_text(mcnemar: pd.DataFrame) -> str:
    """Create the Exact McNemar result text artifact."""

    primary = mcnemar[mcnemar["experiment_id"].eq("E4_LOOCV")].iloc[0]
    rounded = mcnemar.copy()
    rounded["p_value"] = rounded["p_value"].map(lambda value: f"{value:.6f}")

    lines = [
        "Exact McNemar Test: Rule-Based vs Decision Tree",
        "",
        "Test definition: two-sided exact binomial test on discordant paired outcomes.",
        "b = cases correct only by Rule-Based.",
        "c = cases correct only by Decision Tree.",
        "",
        "Primary final evaluation: E4_LOOCV",
        f"LOOCV p-value: {primary['p_value']:.6f}",
        "",
        markdown_table(rounded),
        "",
    ]
    return "\n".join(lines)


def write_experiment_summary(
    bundle: DatasetBundle,
    metrics: pd.DataFrame,
    comparison: pd.DataFrame,
    mcnemar: pd.DataFrame,
) -> str:
    """Create the Markdown summary artifact."""

    metrics_display = metrics.copy()
    for column in ["accuracy", "precision", "recall", "f1_score", "macro_f1"]:
        metrics_display[column] = metrics_display[column].map(lambda value: f"{value:.4f}")

    mcnemar_display = mcnemar.copy()
    mcnemar_display["p_value"] = mcnemar_display["p_value"].map(lambda value: f"{value:.4f}")

    summary = dataset_summary(bundle)
    lines = [
        "# Comparative Experiment Summary",
        "",
        "## Dataset",
        "",
        markdown_table(summary),
        "",
        "## Final Methodology",
        "",
        "- Research type: comparative analysis.",
        "- Methods: Rule-Based Classification using only R1-R8 and Decision Tree Classification.",
        "- Ground truth: historical admin labels from expert_label.",
        "- Decision Tree implementation: sklearn.tree.DecisionTreeClassifier with criterion=\"entropy\".",
        "- Hyperparameter tuning: not performed.",
        "- Experiments: E1 80:20 hold-out, E2 70:30 hold-out, E3 5-fold stratified CV, E4 LOOCV.",
        "- Primary final evaluation: E4 LOOCV.",
        "",
        "## Metrics",
        "",
        markdown_table(
            metrics_display[
                [
                    "experiment_id",
                    "method",
                    "n",
                    "accuracy",
                    "precision",
                    "recall",
                    "f1_score",
                    "macro_f1",
                    "false_positive",
                    "false_negative",
                ]
            ]
        ),
        "",
        "## Comparison Table",
        "",
        markdown_table(comparison),
        "",
        "## Exact McNemar Test",
        "",
        markdown_table(mcnemar_display),
        "",
        "The CSV and text files in this output directory are the reproducibility sources for the thesis tables.",
    ]
    return "\n".join(lines)


def write_outputs(
    bundle: DatasetBundle,
    predictions: pd.DataFrame,
    final_model_metadata: dict[str, object],
    output_dir: Path = OUTPUT_DIR,
) -> dict[str, Path]:
    """Write every required output file and supporting traceability artifacts."""

    output_dir.mkdir(parents=True, exist_ok=True)

    metrics = build_metrics_table(predictions)
    comparison = build_comparison_table(metrics)
    confusion_rule_based = build_confusion_table(predictions, "Rule-Based")
    confusion_decision_tree = build_confusion_table(predictions, "Decision Tree")
    mcnemar = build_mcnemar_table(predictions)

    paths = {
        "metrics": output_dir / "metrics.csv",
        "comparison_table": output_dir / "comparison_table.csv",
        "confusion_matrix_rule_based": output_dir / "confusion_matrix_rule_based.csv",
        "confusion_matrix_decision_tree": output_dir / "confusion_matrix_decision_tree.csv",
        "classification_report_rule_based": output_dir / "classification_report_rule_based.txt",
        "classification_report_decision_tree": output_dir / "classification_report_decision_tree.txt",
        "mcnemar_result": output_dir / "mcnemar_result.txt",
        "experiment_summary": output_dir / "experiment_summary.md",
        "predictions": output_dir / "predictions.csv",
        "cleaned_dataset": output_dir / "cleaned_analysis_dataset.csv",
        "dataset_summary": output_dir / "dataset_summary.csv",
        "duplicate_report": output_dir / "duplicate_handling.csv",
        "data_quality_issues": output_dir / "data_quality_issues.csv",
        "experiment_config": output_dir / "experiment_config.json",
    }

    metrics.to_csv(paths["metrics"], index=False)
    comparison.to_csv(paths["comparison_table"], index=False)
    confusion_rule_based.to_csv(paths["confusion_matrix_rule_based"], index=False)
    confusion_decision_tree.to_csv(paths["confusion_matrix_decision_tree"], index=False)
    paths["classification_report_rule_based"].write_text(
        build_classification_report_text(predictions, "Rule-Based"),
        encoding="utf-8",
    )
    paths["classification_report_decision_tree"].write_text(
        build_classification_report_text(predictions, "Decision Tree"),
        encoding="utf-8",
    )
    paths["mcnemar_result"].write_text(write_mcnemar_text(mcnemar), encoding="utf-8")
    paths["experiment_summary"].write_text(
        write_experiment_summary(bundle, metrics, comparison, mcnemar),
        encoding="utf-8",
    )

    predictions.to_csv(paths["predictions"], index=False)
    bundle.prepared.to_csv(paths["cleaned_dataset"], index=False)
    dataset_summary(bundle).to_csv(paths["dataset_summary"], index=False)
    bundle.duplicate_report.to_csv(paths["duplicate_report"], index=False)
    bundle.data_quality_issues.to_csv(paths["data_quality_issues"], index=False)

    config = {
        "source_workbook": str(SOURCE_WORKBOOK),
        "source_sheet": SOURCE_SHEET,
        "source_label_column": SOURCE_LABEL_COLUMN,
        "target_column": TARGET_COLUMN,
        "label_map": LABEL_MAP,
        "class_labels": CLASS_LABELS,
        "random_state": RANDOM_STATE,
        "model_features": MODEL_FEATURES,
        "experiments": EXPERIMENT_DESCRIPTIONS,
        "decision_tree": {
            "implementation": "sklearn.tree.DecisionTreeClassifier",
            "criterion": "entropy",
            "hyperparameter_tuning": False,
        },
        "final_full_data_tree": final_model_metadata,
    }
    paths["experiment_config"].write_text(json.dumps(config, indent=2), encoding="utf-8")
    return paths

