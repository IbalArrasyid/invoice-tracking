"""Run the four finalized comparative experiments."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np
import pandas as pd
from sklearn.model_selection import LeaveOneOut, StratifiedKFold, train_test_split

from comparative_experiment.config import (
    EXPERIMENT_DESCRIPTIONS,
    MODEL_FEATURES,
    RANDOM_STATE,
    TARGET_COLUMN,
)
from comparative_experiment.models.decision_tree import fit_decision_tree
from comparative_experiment.rules.rule_based import predict_frame


@dataclass(frozen=True)
class SplitDefinition:
    """One train/test split within an experiment."""

    experiment_id: str
    fold: int
    train_indices: np.ndarray
    test_indices: np.ndarray


def iter_splits(data: pd.DataFrame, random_state: int = RANDOM_STATE) -> Iterator[SplitDefinition]:
    """Yield the exact four experiment protocols."""

    indices = np.arange(len(data))

    train_idx, test_idx = train_test_split(
        indices,
        test_size=0.20,
        random_state=random_state,
        stratify=data[TARGET_COLUMN],
    )
    yield SplitDefinition("E1_80_20", 1, train_idx, test_idx)

    train_idx, test_idx = train_test_split(
        indices,
        test_size=0.30,
        random_state=random_state,
        stratify=data[TARGET_COLUMN],
    )
    yield SplitDefinition("E2_70_30", 1, train_idx, test_idx)

    five_fold = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)
    for fold, (train_idx, test_idx) in enumerate(
        five_fold.split(data[MODEL_FEATURES], data[TARGET_COLUMN]),
        start=1,
    ):
        yield SplitDefinition("E3_5_Fold_CV", fold, train_idx, test_idx)

    leave_one_out = LeaveOneOut()
    for fold, (train_idx, test_idx) in enumerate(leave_one_out.split(data), start=1):
        yield SplitDefinition("E4_LOOCV", fold, train_idx, test_idx)


def run_experiments(data: pd.DataFrame, random_state: int = RANDOM_STATE) -> pd.DataFrame:
    """Run Rule-Based and Decision Tree predictions for E1-E4."""

    rule_predictions = predict_frame(data)
    working = pd.concat([data.reset_index(drop=True), rule_predictions], axis=1)

    rows: list[dict[str, object]] = []
    for split in iter_splits(working, random_state=random_state):
        train_frame = working.iloc[split.train_indices].copy()
        test_frame = working.iloc[split.test_indices].copy()

        model = fit_decision_tree(train_frame, random_state=random_state)
        decision_tree_predictions = model.predict(test_frame[MODEL_FEATURES])

        for position, (_, row) in enumerate(test_frame.iterrows()):
            rows.append(
                {
                    "experiment_id": split.experiment_id,
                    "experiment": EXPERIMENT_DESCRIPTIONS[split.experiment_id],
                    "fold": split.fold,
                    "train_n": len(train_frame),
                    "test_n": len(test_frame),
                    "invoice_no": row["invoice_no"],
                    "observation_id": row["observation_id"],
                    "source_excel_row": row["_source_excel_row"],
                    TARGET_COLUMN: row[TARGET_COLUMN],
                    "prediction_rule_based": row["prediction_rule_based"],
                    "rule_ids": row["rule_ids"],
                    "prediction_decision_tree": decision_tree_predictions[position],
                }
            )

    return pd.DataFrame(rows)

