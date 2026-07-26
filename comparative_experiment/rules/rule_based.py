"""Finalized R1-R8 Rule-Based classifier."""

from __future__ import annotations

import pandas as pd


MONTHLY_RULES = {"END_MONTH", "MONTHLY_DATE", "MULTIPLE_MONTHLY_DATE"}
NEXT_MONTH_RULES = {"NEXT_MONTH_DATE", "NEXT_MONTH_WORKDAY", "NEXT_MONTH_FIRST_WEEK"}

RULE_DESCRIPTIONS = {
    "R1": "Receiving schedule has been missed.",
    "R2": "Customer cutoff has already passed.",
    "R3": "Invoice receive date is on the cutoff date.",
    "R4": "Monthly or end-month cutoff is within one to two workdays.",
    "R5": "Next-month cutoff is within one to two workdays.",
    "R6": "Invoice is received near month end and cutoff is within four workdays.",
    "R7": "Receiving schedule is limited and the next allowed receiving day is at most one day away.",
    "R8": "No urgent R1-R7 condition is met.",
}


def _clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _to_number(value: object) -> float:
    return pd.to_numeric(value, errors="coerce")


def matching_urgent_rules(row: pd.Series) -> list[str]:
    """Return matching urgent rules from R1-R7 for a single invoice."""

    cutoff_rule = _clean_text(row.get("cutoff_rule"))
    days = _to_number(row.get("days_to_cutoff_decision_time"))
    gap = _to_number(row.get("next_receive_day_gap_decision_time"))
    limited = _clean_text(row.get("limited_receive_schedule_flag")).lower() == "yes"
    month_end = _clean_text(row.get("receive_month_end_flag")).lower() == "yes"
    schedule_status = _clean_text(row.get("receive_date_schedule_status"))

    has_days = not pd.isna(days)
    has_gap = not pd.isna(gap)

    rules: list[str] = []
    if schedule_status == "MISSED_RECEIVE_DAY":
        rules.append("R1")
    if cutoff_rule != "NO_CUTOFF" and has_days and days < 0:
        rules.append("R2")
    if cutoff_rule != "NO_CUTOFF" and has_days and days == 0:
        rules.append("R3")
    if cutoff_rule in MONTHLY_RULES and has_days and 0 < days <= 2:
        rules.append("R4")
    if cutoff_rule in NEXT_MONTH_RULES and has_days and 0 < days <= 2:
        rules.append("R5")
    if month_end and has_days and days <= 4:
        rules.append("R6")
    if limited and has_gap and gap <= 1:
        rules.append("R7")
    return rules


def predict_row(row: pd.Series) -> tuple[str, str]:
    """Classify one invoice and return the predicted label plus applied rule IDs."""

    rules = matching_urgent_rules(row)
    if rules:
        return "Urgent", ";".join(rules)
    return "Not Urgent", "R8"


def predict_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Apply the finalized Rule-Based classifier to a dataframe."""

    predictions = frame.apply(predict_row, axis=1, result_type="expand")
    predictions.columns = ["prediction_rule_based", "rule_ids"]
    return predictions

