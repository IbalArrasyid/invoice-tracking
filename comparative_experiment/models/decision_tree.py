"""Fixed entropy Decision Tree model used in the comparative experiment."""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

from comparative_experiment.config import (
    CATEGORICAL_FEATURES,
    MODEL_FEATURES,
    NUMERIC_FEATURES,
    PACKAGE_DIR,
    RANDOM_STATE,
    TARGET_COLUMN,
)


def _json_default(value: object) -> object:
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def build_decision_tree_pipeline(random_state: int = RANDOM_STATE) -> Pipeline:
    """Build the fixed, untuned entropy Decision Tree pipeline."""

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            ("num", "passthrough", NUMERIC_FEATURES),
        ],
        remainder="drop",
        verbose_feature_names_out=True,
    )
    classifier = DecisionTreeClassifier(
        criterion="entropy",
        random_state=random_state,
    )
    return Pipeline(
        steps=[
            ("preprocess", preprocessor),
            ("tree", classifier),
        ]
    )


def fit_decision_tree(train_frame: pd.DataFrame, random_state: int = RANDOM_STATE) -> Pipeline:
    """Fit the fixed entropy Decision Tree without hyperparameter tuning."""

    model = build_decision_tree_pipeline(random_state=random_state)
    model.fit(train_frame[MODEL_FEATURES], train_frame[TARGET_COLUMN])
    return model


def save_final_full_data_tree(
    prepared: pd.DataFrame,
    models_dir: Path = PACKAGE_DIR / "models",
    random_state: int = RANDOM_STATE,
) -> dict[str, object]:
    """Fit and save a full-data tree for inspection, not for evaluation metrics."""

    models_dir.mkdir(parents=True, exist_ok=True)
    model = fit_decision_tree(prepared, random_state=random_state)
    feature_names = list(model.named_steps["preprocess"].get_feature_names_out())
    tree = model.named_steps["tree"]

    rules_text = export_text(tree, feature_names=feature_names)
    (models_dir / "final_decision_tree_rules.txt").write_text(rules_text, encoding="utf-8")
    with (models_dir / "final_decision_tree_model.pkl").open("wb") as handle:
        pickle.dump(model, handle)

    metadata: dict[str, object] = {
        "criterion": "entropy",
        "random_state": random_state,
        "hyperparameter_tuning": False,
        "algorithm": "sklearn.tree.DecisionTreeClassifier",
        "features": MODEL_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "tree_depth": int(tree.get_depth()),
        "tree_leaves": int(tree.get_n_leaves()),
        "note": "Full-data tree is saved for inspection only; reported metrics use validation predictions.",
    }
    (models_dir / "final_model_metadata.json").write_text(
        json.dumps(metadata, indent=2, default=_json_default),
        encoding="utf-8",
    )
    return metadata

