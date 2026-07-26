"""Load, clean, deduplicate, and prepare the thesis invoice dataset.

The data-preparation logic reuses the finalized decision-time feature
derivation from the earlier repository scripts, but packages it here as the
official reproducibility source.
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from comparative_experiment.config import (
    CATEGORICAL_FEATURES,
    EXPECTED_CLASS_DISTRIBUTION,
    EXPECTED_UNIQUE_INVOICES,
    LABEL_MAP,
    NUMERIC_FEATURES,
    SOURCE_LABEL_COLUMN,
    SOURCE_SHEET,
    SOURCE_WORKBOOK,
    TARGET_COLUMN,
)


@dataclass(frozen=True)
class DatasetBundle:
    """Prepared dataset and traceability artifacts."""

    raw: pd.DataFrame
    prepared: pd.DataFrame
    duplicate_report: pd.DataFrame
    data_quality_issues: pd.DataFrame


def clean_blanks(frame: pd.DataFrame) -> pd.DataFrame:
    """Replace empty strings in object columns with missing values."""

    cleaned = frame.copy()
    for column in cleaned.columns:
        if cleaned[column].dtype == object:
            cleaned[column] = cleaned[column].map(
                lambda value: np.nan if isinstance(value, str) and value.strip() == "" else value
            )
    return cleaned


def parse_day_codes(value: object) -> list[int]:
    """Parse receiving-day codes represented as comma/semicolon separated text."""

    if pd.isna(value):
        return []

    codes: list[int] = []
    for token in re.split(r"[,;/|]+", str(value)):
        token = token.strip()
        if not token:
            continue
        try:
            code = int(float(token))
        except ValueError:
            continue
        if 1 <= code <= 7:
            codes.append(code)
    return sorted(set(codes))


def is_workday(day: date) -> bool:
    """Return True for Monday-Friday dates."""

    return day.weekday() < 5


def last_day_of_month(year: int, month: int) -> date:
    """Return the calendar last day for a month."""

    return date(year, month, calendar.monthrange(year, month)[1])


def last_workday_of_month(year: int, month: int) -> date:
    """Return the last Monday-Friday date for a month."""

    day = last_day_of_month(year, month)
    while not is_workday(day):
        day -= timedelta(days=1)
    return day


def add_months(day: date, months: int) -> date:
    """Add calendar months while clamping the day to the target month."""

    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    final_day = min(day.day, calendar.monthrange(year, month)[1])
    return date(year, month, final_day)


def safe_date(year: int, month: int, day: int) -> date:
    """Create a date and clamp invalid high day values to month end."""

    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def nth_workday(year: int, month: int, n: int) -> date:
    """Return the nth workday in a month, falling back to the last workday."""

    count = 0
    current = date(year, month, 1)
    while current.month == month:
        if is_workday(current):
            count += 1
            if count == n:
                return current
        current += timedelta(days=1)
    return last_workday_of_month(year, month)


def workday_gap(start: date, end: date) -> int:
    """Count workdays between two dates; negative when end is before start."""

    if end == start:
        return 0

    step = 1 if end > start else -1
    current = start
    count = 0
    while current != end:
        current += timedelta(days=step)
        if is_workday(current):
            count += step
    return count


def parse_multiple_monthly_dates(text: object) -> list[int]:
    """Extract monthly cutoff dates from free text."""

    if pd.isna(text):
        return []

    candidates = [
        int(match) for match in re.findall(r"\b([0-3]?\d)(?:st|nd|rd|th)?\b", str(text))
    ]
    return sorted({value for value in candidates if 1 <= value <= 31})


def derive_cutoff_date(row: pd.Series) -> tuple[object, str]:
    """Derive the effective cutoff date available at invoice receive time."""

    if pd.isna(row.get("receive_date")):
        return pd.NaT, "receive_date missing; cannot derive cutoff date"

    receive_date = pd.Timestamp(row["receive_date"]).date()
    cutoff_rule = str(row.get("cutoff_rule", "")).strip()
    cutoff_type = row.get("cutoff_type")
    cutoff_value = pd.to_numeric(row.get("cutoff_value"), errors="coerce")

    if cutoff_rule == "NO_CUTOFF":
        return pd.NaT, "NO_CUTOFF; no cutoff date required"

    if cutoff_rule == "END_MONTH":
        return (
            last_workday_of_month(receive_date.year, receive_date.month),
            "END_MONTH; last workday of receive month",
        )

    if cutoff_rule == "MONTHLY_DATE":
        text = "" if pd.isna(cutoff_type) else str(cutoff_type).lower()
        if pd.isna(cutoff_value) and "working days before end of month" in text:
            match = re.search(r"(\d+)\s+working days before end of month", text)
            if match:
                days_before = int(match.group(1))
                target = last_workday_of_month(receive_date.year, receive_date.month)
                moved = 0
                while moved < days_before:
                    target -= timedelta(days=1)
                    if is_workday(target):
                        moved += 1
                return target, "MONTHLY_DATE; parsed working-days-before-end-of-month rule"

        if pd.isna(cutoff_value):
            listed_dates = parse_multiple_monthly_dates(cutoff_type)
            if listed_dates:
                for cutoff_day in listed_dates:
                    target = safe_date(receive_date.year, receive_date.month, cutoff_day)
                    if target >= receive_date:
                        return target, "MONTHLY_DATE; parsed next listed date from cutoff_type"
                next_month = add_months(receive_date, 1)
                return (
                    safe_date(next_month.year, next_month.month, listed_dates[0]),
                    "MONTHLY_DATE; parsed first listed date in next month from cutoff_type",
                )
            return pd.NaT, "MONTHLY_DATE; cutoff_value missing and cutoff_type could not be parsed"

        target = safe_date(receive_date.year, receive_date.month, int(cutoff_value))
        if target < receive_date:
            next_month = add_months(receive_date, 1)
            target = safe_date(next_month.year, next_month.month, int(cutoff_value))
        return target, "MONTHLY_DATE; cutoff date selected from receive_date month or next month"

    if cutoff_rule == "MULTIPLE_MONTHLY_DATE":
        dates = parse_multiple_monthly_dates(cutoff_type)
        if not dates:
            return pd.NaT, "MULTIPLE_MONTHLY_DATE; no dates could be parsed from cutoff_type"
        for cutoff_day in dates:
            target = safe_date(receive_date.year, receive_date.month, cutoff_day)
            if target >= receive_date:
                return target, "MULTIPLE_MONTHLY_DATE; next listed date in receive month"
        next_month = add_months(receive_date, 1)
        return (
            safe_date(next_month.year, next_month.month, dates[0]),
            "MULTIPLE_MONTHLY_DATE; first listed date in next month",
        )

    if cutoff_rule == "NEXT_MONTH_DATE":
        if pd.isna(cutoff_value):
            return pd.NaT, "NEXT_MONTH_DATE; cutoff_value missing"
        next_month = add_months(receive_date, 1)
        return (
            safe_date(next_month.year, next_month.month, int(cutoff_value)),
            "NEXT_MONTH_DATE; date in next month",
        )

    if cutoff_rule == "NEXT_MONTH_WORKDAY":
        if pd.isna(cutoff_value):
            return pd.NaT, "NEXT_MONTH_WORKDAY; cutoff_value missing"
        next_month = add_months(receive_date, 1)
        return (
            nth_workday(next_month.year, next_month.month, int(cutoff_value)),
            "NEXT_MONTH_WORKDAY; nth workday in next month",
        )

    if cutoff_rule == "NEXT_MONTH_FIRST_WEEK":
        next_month = add_months(receive_date, 1)
        return (
            nth_workday(next_month.year, next_month.month, 5),
            "NEXT_MONTH_FIRST_WEEK; fifth workday in next month",
        )

    return pd.NaT, f"{cutoff_rule}; unsupported cutoff_rule for decision-time derivation"


def next_receive_gap_from_decision_date(receive_date: object, receive_day_code: object) -> object:
    """Return days from receive date to the next allowed receiving day."""

    codes = parse_day_codes(receive_day_code)
    if not codes or pd.isna(receive_date):
        return np.nan

    weekday_code = pd.Timestamp(receive_date).weekday() + 1
    for gap in range(0, 8):
        candidate_code = ((weekday_code - 1 + gap) % 7) + 1
        if candidate_code in codes:
            return gap
    return np.nan


def load_raw_dataset(source_workbook: Path = SOURCE_WORKBOOK) -> pd.DataFrame:
    """Load the source workbook without modifying it."""

    raw = pd.read_excel(source_workbook, sheet_name=SOURCE_SHEET)
    raw = clean_blanks(raw)
    raw = raw[raw["invoice_no"].notna()].copy()
    raw["_source_excel_row"] = raw.index + 2
    raw["receive_date"] = pd.to_datetime(raw["receive_date"], errors="coerce")
    raw["sent_date"] = pd.to_datetime(raw["sent_date"], errors="coerce")
    return raw.reset_index(drop=True)


def remove_duplicates(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Keep one representative record per invoice number before any split."""

    sortable = frame.copy()
    sortable["_receive_sort"] = sortable["receive_date"].fillna(pd.Timestamp.max)
    sortable["_sent_sort"] = sortable["sent_date"].fillna(pd.Timestamp.max)
    sortable = sortable.sort_values(
        ["invoice_no", "_receive_sort", "_sent_sort", "_source_excel_row"]
    )
    keep_indices = sortable.groupby("invoice_no", sort=False).head(1).index

    duplicate_groups = frame[frame["invoice_no"].duplicated(keep=False)].copy()
    representative_by_invoice = frame.loc[keep_indices].set_index("invoice_no")[
        "_source_excel_row"
    ].to_dict()
    duplicate_groups["duplicate_action"] = np.where(
        duplicate_groups.index.isin(keep_indices),
        "kept_representative",
        "removed_before_split",
    )
    duplicate_groups["representative_source_excel_row"] = duplicate_groups["invoice_no"].map(
        representative_by_invoice
    )
    duplicate_groups["duplicate_handling_reason"] = (
        "One representative record kept per invoice_no; earliest receive_date is preferred, "
        "then earliest sent_date, then first source row."
    )

    cleaned = frame.loc[keep_indices].sort_values("_source_excel_row").copy()
    cleaned = cleaned.drop(columns=["_receive_sort", "_sent_sort"], errors="ignore")
    duplicate_report = duplicate_groups.sort_values(["invoice_no", "_source_excel_row"]).drop(
        columns=["_receive_sort", "_sent_sort"], errors="ignore"
    )
    return cleaned.reset_index(drop=True), duplicate_report.reset_index(drop=True)


def add_decision_time_features(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Add finalized decision-time features used by the Rule-Based and tree models."""

    prepared = frame.copy()

    prepared["receive_weekday_code"] = prepared["receive_date"].dt.weekday + 1
    prepared["receive_weekday_name"] = prepared["receive_date"].dt.day_name()
    prepared["receive_day_of_month"] = prepared["receive_date"].dt.day
    prepared["receive_week_of_month"] = ((prepared["receive_day_of_month"] - 1) // 7 + 1).astype(
        "Int64"
    )
    prepared["receive_month_end_flag"] = np.where(
        prepared["receive_day_of_month"] >= 25, "Yes", "No"
    )
    prepared["limited_receive_schedule_flag"] = np.where(
        prepared["receive_schedule"].astype(str).str.strip().str.lower().eq("everyday"),
        "No",
        "Yes",
    )

    prepared["next_receive_day_gap_decision_time"] = [
        next_receive_gap_from_decision_date(receive_date, day_code)
        for receive_date, day_code in zip(
            prepared["receive_date"], prepared["receive_day_code"], strict=False
        )
    ]
    gap_series = pd.Series(prepared["next_receive_day_gap_decision_time"], index=prepared.index)
    prepared["receive_date_schedule_status"] = np.where(
        gap_series.isna(),
        "UNKNOWN_RECEIVE_DAY",
        np.where(gap_series.eq(0), "VALID_RECEIVE_DAY", "NEXT_RECEIVE_DAY_AVAILABLE_LATER"),
    )

    cutoff_dates = prepared.apply(derive_cutoff_date, axis=1, result_type="expand")
    cutoff_dates.columns = ["cutoff_date_decision_time", "cutoff_derivation_note"]
    prepared = pd.concat([prepared, cutoff_dates], axis=1)
    prepared["cutoff_date_decision_time"] = pd.to_datetime(
        prepared["cutoff_date_decision_time"], errors="coerce"
    )

    prepared["days_to_cutoff_source"] = pd.to_numeric(prepared["days_to_cutoff"], errors="coerce")
    prepared["days_to_cutoff_decision_time"] = np.nan
    has_cutoff_date = prepared["cutoff_date_decision_time"].notna()
    no_cutoff = prepared["cutoff_rule"].eq("NO_CUTOFF")
    prepared.loc[no_cutoff, "days_to_cutoff_decision_time"] = 999
    prepared.loc[has_cutoff_date, "days_to_cutoff_decision_time"] = [
        workday_gap(start.date(), end.date())
        for start, end in zip(
            prepared.loc[has_cutoff_date, "receive_date"],
            prepared.loc[has_cutoff_date, "cutoff_date_decision_time"],
            strict=False,
        )
    ]

    issues: list[dict[str, object]] = []
    missing_gap = prepared["next_receive_day_gap_decision_time"].isna()
    for _, row in prepared.loc[missing_gap].iterrows():
        issues.append(
            {
                "feature": "next_receive_day_gap_decision_time",
                "invoice_no": row["invoice_no"],
                "source_excel_row": row["_source_excel_row"],
                "issue": "Cannot derive because receive_day_code is missing or invalid.",
                "action": "Keep missing value and use configured model imputation value.",
            }
        )

    missing_cutoff = prepared["days_to_cutoff_decision_time"].isna()
    for _, row in prepared.loc[missing_cutoff].iterrows():
        issues.append(
            {
                "feature": "days_to_cutoff_decision_time",
                "invoice_no": row["invoice_no"],
                "source_excel_row": row["_source_excel_row"],
                "issue": row["cutoff_derivation_note"],
                "action": "Keep missing value and use configured model imputation value.",
            }
        )

    return prepared, pd.DataFrame(issues)


def _validate_final_dataset(prepared: pd.DataFrame) -> None:
    """Assert that the dataset matches the thesis sample definition."""

    if prepared["invoice_no"].duplicated().any():
        raise ValueError("Duplicate invoice_no remains after cleaning.")

    if prepared[TARGET_COLUMN].isna().any():
        raise ValueError("Missing administrator ground-truth label remains.")

    if len(prepared) != EXPECTED_UNIQUE_INVOICES:
        raise ValueError(
            f"Expected {EXPECTED_UNIQUE_INVOICES} unique invoices, found {len(prepared)}."
        )

    counts = prepared[TARGET_COLUMN].value_counts().to_dict()
    for label, expected_count in EXPECTED_CLASS_DISTRIBUTION.items():
        observed = int(counts.get(label, 0))
        if observed != expected_count:
            raise ValueError(
                f"Expected {expected_count} {label} invoices, found {observed}."
            )


def prepare_dataset(source_workbook: Path = SOURCE_WORKBOOK) -> DatasetBundle:
    """Prepare the 99-invoice binary classification dataset."""

    raw = load_raw_dataset(source_workbook)

    source_labels = raw[SOURCE_LABEL_COLUMN].astype("string").str.strip().str.upper()
    invalid_labels = sorted(
        label for label in source_labels.dropna().unique().tolist() if label not in LABEL_MAP
    )
    if invalid_labels:
        raise ValueError(f"Unsupported labels in {SOURCE_LABEL_COLUMN}: {invalid_labels}")
    raw[TARGET_COLUMN] = source_labels.map(LABEL_MAP)

    cleaned, duplicate_report = remove_duplicates(raw)

    cutoff_numeric = pd.to_numeric(cleaned["cutoff_value"], errors="coerce")
    invalid_monthly = cleaned["cutoff_rule"].eq("MONTHLY_DATE") & ~cutoff_numeric.between(1, 31)
    cleaning_issues = cleaned.loc[
        invalid_monthly,
        ["invoice_no", "_source_excel_row", "cutoff_type", "cutoff_rule", "cutoff_value"],
    ].rename(columns={"_source_excel_row": "source_excel_row"})
    if not cleaning_issues.empty:
        cleaning_issues["feature"] = "cutoff_value"
        cleaning_issues["issue"] = "Invalid or missing monthly cutoff day; parsed from cutoff_type."
        cleaning_issues["action"] = "Set cutoff_value to missing before decision-time derivation."
        cleaned.loc[invalid_monthly, "cutoff_value"] = np.nan

    prepared, derivation_issues = add_decision_time_features(cleaned)

    prepared["cutoff_value_feature"] = pd.to_numeric(
        prepared["cutoff_value"], errors="coerce"
    ).fillna(-1)
    prepared["days_to_cutoff_feature"] = pd.to_numeric(
        prepared["days_to_cutoff_decision_time"], errors="coerce"
    ).fillna(-999)
    prepared["next_receive_day_gap_feature"] = pd.to_numeric(
        prepared["next_receive_day_gap_decision_time"], errors="coerce"
    ).fillna(-1)

    for column in CATEGORICAL_FEATURES:
        prepared[column] = prepared[column].fillna("MISSING").astype(str)
    for column in NUMERIC_FEATURES:
        prepared[column] = pd.to_numeric(prepared[column], errors="coerce").fillna(-1)

    prepared["observation_id"] = prepared["invoice_no"].astype(str)
    prepared = prepared.reset_index(drop=True)

    data_quality_issues = pd.concat(
        [cleaning_issues, derivation_issues],
        ignore_index=True,
        sort=False,
    )

    _validate_final_dataset(prepared)
    return DatasetBundle(
        raw=raw,
        prepared=prepared,
        duplicate_report=duplicate_report,
        data_quality_issues=data_quality_issues,
    )
