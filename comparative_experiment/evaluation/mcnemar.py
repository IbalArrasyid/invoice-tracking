"""Exact McNemar test for paired classifier predictions."""

from __future__ import annotations

import pandas as pd
from scipy.stats import binomtest

from comparative_experiment.config import TARGET_COLUMN


def exact_mcnemar(frame: pd.DataFrame) -> dict[str, object]:
    """Calculate the two-sided exact McNemar test for paired predictions."""

    rule_correct = frame["prediction_rule_based"].eq(frame[TARGET_COLUMN])
    tree_correct = frame["prediction_decision_tree"].eq(frame[TARGET_COLUMN])

    rule_only = int((rule_correct & ~tree_correct).sum())
    tree_only = int((~rule_correct & tree_correct).sum())
    discordant = rule_only + tree_only
    p_value = float(binomtest(rule_only, discordant, 0.5).pvalue) if discordant else 1.0

    return {
        "both_correct": int((rule_correct & tree_correct).sum()),
        "rule_based_only_correct_b": rule_only,
        "decision_tree_only_correct_c": tree_only,
        "both_wrong": int((~rule_correct & ~tree_correct).sum()),
        "discordant_pairs": discordant,
        "p_value": p_value,
    }

