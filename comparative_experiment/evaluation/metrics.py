"""Metric and confusion-matrix utilities."""

from __future__ import annotations

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from comparative_experiment.config import CLASS_LABELS, POSITIVE_LABEL, TARGET_COLUMN


def calculate_metrics(
    frame: pd.DataFrame,
    prediction_column: str,
    experiment_id: str,
    experiment: str,
    method: str,
) -> dict[str, object]:
    """Calculate the finalized thesis metrics for one method and experiment."""

    y_true = frame[TARGET_COLUMN]
    y_pred = frame[prediction_column]
    matrix = confusion_matrix(y_true, y_pred, labels=CLASS_LABELS)
    return {
        "experiment_id": experiment_id,
        "experiment": experiment,
        "method": method,
        "n": len(frame),
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(
            y_true,
            y_pred,
            pos_label=POSITIVE_LABEL,
            zero_division=0,
        ),
        "recall": recall_score(
            y_true,
            y_pred,
            pos_label=POSITIVE_LABEL,
            zero_division=0,
        ),
        "f1_score": f1_score(
            y_true,
            y_pred,
            pos_label=POSITIVE_LABEL,
            zero_division=0,
        ),
        "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "true_negative": int(matrix[0, 0]),
        "false_positive": int(matrix[0, 1]),
        "false_negative": int(matrix[1, 0]),
        "true_positive": int(matrix[1, 1]),
    }


def confusion_matrix_rows(
    frame: pd.DataFrame,
    prediction_column: str,
    experiment_id: str,
    experiment: str,
) -> list[dict[str, object]]:
    """Return a readable confusion matrix representation for CSV output."""

    matrix = confusion_matrix(frame[TARGET_COLUMN], frame[prediction_column], labels=CLASS_LABELS)
    return [
        {
            "experiment_id": experiment_id,
            "experiment": experiment,
            "actual_label": CLASS_LABELS[actual_index],
            f"predicted_{CLASS_LABELS[0].lower().replace(' ', '_')}": int(matrix[actual_index, 0]),
            f"predicted_{CLASS_LABELS[1].lower().replace(' ', '_')}": int(matrix[actual_index, 1]),
        }
        for actual_index in range(len(CLASS_LABELS))
    ]


def classification_report_section(
    frame: pd.DataFrame,
    prediction_column: str,
    experiment_id: str,
    experiment: str,
) -> str:
    """Return a text classification report section for one experiment."""

    report = classification_report(
        frame[TARGET_COLUMN],
        frame[prediction_column],
        labels=CLASS_LABELS,
        target_names=CLASS_LABELS,
        zero_division=0,
    )
    return "\n".join(
        [
            f"Experiment: {experiment_id} - {experiment}",
            f"n = {len(frame)}",
            "",
            report,
        ]
    )

