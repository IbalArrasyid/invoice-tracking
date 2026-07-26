"""Central configuration for the finalized comparative experiment."""

from __future__ import annotations

from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = PACKAGE_DIR.parent

SOURCE_WORKBOOK = REPOSITORY_ROOT / "dataset_invoice.xlsx"
SOURCE_SHEET = "Data Labeling"
OUTPUT_DIR = PACKAGE_DIR / "outputs"

RANDOM_STATE = 42

SOURCE_LABEL_COLUMN = "expert_label"
TARGET_COLUMN = "admin_ground_truth"
LABEL_MAP = {
    "HIGH": "Urgent",
    "NORMAL": "Not Urgent",
}

CLASS_LABELS = ["Not Urgent", "Urgent"]
POSITIVE_LABEL = "Urgent"

EXPECTED_UNIQUE_INVOICES = 99
EXPECTED_CLASS_DISTRIBUTION = {
    "Urgent": 30,
    "Not Urgent": 69,
}

CATEGORICAL_FEATURES = [
    "cutoff_rule",
    "receive_day_code",
    "receive_schedule",
    "receive_date_schedule_status",
    "receive_month_end_flag",
    "limited_receive_schedule_flag",
]

NUMERIC_FEATURES = [
    "cutoff_value_feature",
    "days_to_cutoff_feature",
    "next_receive_day_gap_feature",
    "receive_weekday_code",
    "receive_week_of_month",
    "receive_day_of_month",
]

MODEL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

EXPERIMENT_ORDER = [
    "E1_80_20",
    "E2_70_30",
    "E3_5_Fold_CV",
    "E4_LOOCV",
]

EXPERIMENT_DESCRIPTIONS = {
    "E1_80_20": "Stratified Hold-out 80:20",
    "E2_70_30": "Stratified Hold-out 70:30",
    "E3_5_Fold_CV": "5-Fold Stratified Cross Validation",
    "E4_LOOCV": "Leave-One-Out Cross Validation (LOOCV)",
}

