"""
Operational labeling guideline rule engine.

Batch 4 introduces the finalized R1-R12 operational rule base. The rules use
the operational attributes available in the current application contract and
produce an explicit activated rule for every recommendation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional


PRIORITY_ORDER = {
    "Rendah": 1,
    "Sedang": 2,
    "Tinggi": 3,
}

PRIORITY_CODE = {
    "Tinggi": "HIGH",
    "Sedang": "MEDIUM",
    "Rendah": "NORMAL",
}


@dataclass(frozen=True)
class OperationalRule:
    rule_id: str
    name: str
    priority: str
    reason: str
    condition: Callable[[Dict[str, Any]], bool]
    condition_labels: Callable[[Dict[str, Any]], List[str]]


class OperationalRuleEngine:
    """Evaluates the R1-R12 operational labeling guideline."""

    def __init__(self):
        self.rules = self._build_rules()

    def evaluate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        attributes = self.formalize(data)
        evaluated = []
        activated = None

        for rule in self.rules:
            matched = bool(rule.condition(attributes))
            evaluated.append({
                "rule_id": rule.rule_id,
                "rule_name": rule.name,
                "priority": rule.priority,
                "priority_code": PRIORITY_CODE[rule.priority],
                "matched": matched,
                "conditions": rule.condition_labels(attributes),
                "operational_reason": rule.reason,
            })
            if matched and activated is None:
                activated = evaluated[-1]

        if activated is None:
            activated = evaluated[-1]

        return {
            "rule_id": activated["rule_id"],
            "rule_name": activated["rule_name"],
            "activated_conditions": activated["conditions"],
            "operational_reason": activated["operational_reason"],
            "priority": activated["priority"],
            "priority_code": activated["priority_code"],
            "operational_attributes": attributes,
            "rules_evaluated": evaluated,
            "source": "Operational Labeling Guideline R1-R12",
        }

    def formalize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        schedule = _text(
            data.get("jadwal_terima")
            or data.get("jadwal")
            or data.get("receive_schedule")
            or "Setiap Hari"
        )
        cutoff = _text(
            data.get("cut_off_jam")
            or data.get("cutoff")
            or data.get("cutoff_policy")
            or "12:00"
        )
        area = _text(data.get("area_pengantaran") or data.get("area") or "")

        cutoff_hour = _parse_hour(cutoff)
        days_to_cutoff = _as_int(data.get("days_to_cutoff"))
        if days_to_cutoff is None:
            days_to_cutoff = _derive_days_to_cutoff(cutoff_hour, cutoff)

        receive_day_count = _estimate_receive_day_count(schedule)
        schedule_type = _classify_schedule(schedule, receive_day_count)
        cutoff_type = _classify_cutoff(cutoff, cutoff_hour)
        missed_schedule = _truthy(data.get("missed_receive_schedule"))
        month_end_flag = _truthy(data.get("month_end_flag"))
        if data.get("month_end_flag") is None:
            month_end_flag = datetime.now().day >= 25

        next_receive_day_gap = _as_int(data.get("next_receive_day_gap"))
        if next_receive_day_gap is None:
            next_receive_day_gap = 0 if schedule_type in ("EVERYDAY", "WEEKDAY_SET") else 2

        area_type = _classify_area(area)

        return {
            "nama_customer": data.get("nama_customer") or data.get("customer") or None,
            "nama_driver": data.get("nama_driver") or data.get("driver") or None,
            "area_pengantaran": area or None,
            "area_type": area_type,
            "jadwal_terima": schedule or None,
            "receive_schedule_type": schedule_type,
            "receive_day_count": receive_day_count,
            "cut_off_jam": cutoff or None,
            "cutoff_type": cutoff_type,
            "cutoff_hour": cutoff_hour,
            "days_to_cutoff": days_to_cutoff,
            "next_receive_day_gap": next_receive_day_gap,
            "missed_receive_schedule": missed_schedule,
            "month_end_flag": month_end_flag,
        }

    def _build_rules(self) -> List[OperationalRule]:
        return [
            OperationalRule(
                "R1",
                "Expired cutoff",
                "Tinggi",
                "Cutoff has already passed, so the invoice requires immediate operational handling.",
                lambda a: _is_number(a["days_to_cutoff"]) and a["days_to_cutoff"] < 0,
                lambda a: [f"days_to_cutoff = {a['days_to_cutoff']}"],
            ),
            OperationalRule(
                "R2",
                "Critical cutoff window",
                "Tinggi",
                "Cutoff is within one day, creating a critical delivery window.",
                lambda a: _is_number(a["days_to_cutoff"]) and 0 <= a["days_to_cutoff"] <= 1,
                lambda a: [f"days_to_cutoff <= 1 ({a['days_to_cutoff']})"],
            ),
            OperationalRule(
                "R3",
                "Near cutoff with limited receive schedule",
                "Tinggi",
                "Cutoff is near and the customer has limited receiving days.",
                lambda a: _within(a["days_to_cutoff"], 2, 3) and a["receive_schedule_type"] == "LIMITED_DAY",
                lambda a: [
                    f"days_to_cutoff = {a['days_to_cutoff']}",
                    f"receive_schedule_type = {a['receive_schedule_type']}",
                ],
            ),
            OperationalRule(
                "R4",
                "Strict morning cutoff",
                "Tinggi",
                "Morning cutoff requires same-day prioritization.",
                lambda a: _is_number(a["cutoff_hour"]) and a["cutoff_hour"] <= 10,
                lambda a: [f"cutoff_hour <= 10 ({a['cutoff_hour']})"],
            ),
            OperationalRule(
                "R5",
                "Missed receive schedule",
                "Tinggi",
                "The planned delivery missed the valid customer receiving schedule.",
                lambda a: a["missed_receive_schedule"] is True,
                lambda a: ["missed_receive_schedule = true"],
            ),
            OperationalRule(
                "R6",
                "Month-end cutoff pressure",
                "Tinggi",
                "Month-end condition plus near cutoff increases collection and delivery risk.",
                lambda a: a["month_end_flag"] is True and _is_number(a["days_to_cutoff"]) and a["days_to_cutoff"] <= 3,
                lambda a: ["month_end_flag = true", f"days_to_cutoff <= 3 ({a['days_to_cutoff']})"],
            ),
            OperationalRule(
                "R7",
                "Remote area near cutoff",
                "Sedang",
                "Remote delivery area requires planning buffer before cutoff.",
                lambda a: a["area_type"] == "REMOTE" and _is_number(a["days_to_cutoff"]) and a["days_to_cutoff"] <= 3,
                lambda a: [f"area_type = {a['area_type']}", f"days_to_cutoff <= 3 ({a['days_to_cutoff']})"],
            ),
            OperationalRule(
                "R8",
                "Near cutoff general",
                "Sedang",
                "Cutoff is near but no critical exception was activated.",
                lambda a: _within(a["days_to_cutoff"], 2, 3),
                lambda a: [f"days_to_cutoff = {a['days_to_cutoff']}"],
            ),
            OperationalRule(
                "R9",
                "Limited receiving days",
                "Sedang",
                "Customer receiving schedule is limited and should be planned carefully.",
                lambda a: a["receive_schedule_type"] == "LIMITED_DAY",
                lambda a: [f"receive_schedule_type = {a['receive_schedule_type']}"],
            ),
            OperationalRule(
                "R10",
                "Midday cutoff",
                "Sedang",
                "Cutoff occurs before or at midday, requiring operational attention.",
                lambda a: _is_number(a["cutoff_hour"]) and 10 < a["cutoff_hour"] <= 12,
                lambda a: [f"10 < cutoff_hour <= 12 ({a['cutoff_hour']})"],
            ),
            OperationalRule(
                "R11",
                "No cutoff with flexible schedule",
                "Rendah",
                "No explicit cutoff and flexible receiving schedule indicate normal priority.",
                lambda a: a["cutoff_type"] == "NO_CUTOFF" and a["receive_schedule_type"] in ("EVERYDAY", "WEEKDAY_SET"),
                lambda a: [f"cutoff_type = {a['cutoff_type']}", f"receive_schedule_type = {a['receive_schedule_type']}"],
            ),
            OperationalRule(
                "R12",
                "Normal operational window",
                "Rendah",
                "No urgent operational constraint was activated.",
                lambda a: True,
                lambda a: ["default operational rule"],
            ),
        ]


def strongest_priority(*priorities: Optional[str]) -> str:
    candidates = [p for p in priorities if p in PRIORITY_ORDER]
    if not candidates:
        return "Sedang"
    return max(candidates, key=lambda p: PRIORITY_ORDER[p])


def priority_to_action(priority: str) -> str:
    if priority == "Tinggi":
        return "Kirim Hari Ini"
    if priority == "Sedang":
        return "Kirim Besok"
    return "Jadwalkan Normal"


def priority_to_confidence_label(confidence: Optional[float]) -> str:
    if confidence is None:
        return "Medium"
    if confidence >= 0.8:
        return "High"
    if confidence >= 0.6:
        return "Medium"
    return "Low"


def _text(value: Any) -> str:
    return str(value or "").strip()


def _as_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float))


def _within(value: Any, minimum: int, maximum: int) -> bool:
    return _is_number(value) and minimum <= value <= maximum


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    text = str(value).strip().lower()
    return text in {"true", "yes", "y", "1", "missed", "terlewat", "lewat"}


def _parse_hour(cutoff: str) -> Optional[int]:
    match = re.search(r"(\d{1,2})(?::|\.)?(\d{2})?", cutoff or "")
    if not match:
        return None
    hour = int(match.group(1))
    if 0 <= hour <= 23:
        return hour
    return None


def _derive_days_to_cutoff(cutoff_hour: Optional[int], cutoff: str) -> Optional[int]:
    cutoff_lower = (cutoff or "").strip().lower()
    if cutoff_lower in {"", "-", "no cutoff", "no cut off", "none", "n/a"}:
        return None
    if cutoff_hour is None:
        return 8
    if cutoff_hour <= 10:
        return 1
    if cutoff_hour <= 12:
        return 2
    if cutoff_hour <= 14:
        return 4
    return 8


def _estimate_receive_day_count(schedule: str) -> int:
    text = (schedule or "").lower()
    if any(token in text for token in ["setiap hari", "everyday", "every day"]):
        return 7
    if "senin-jumat" in text or "monday-friday" in text:
        return 5
    day_tokens = [
        "senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu",
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    ]
    count = sum(1 for token in day_tokens if token in text)
    if "-" in text and count >= 2:
        return min(5, max(count + 1, 3))
    return max(count, 1)


def _classify_schedule(schedule: str, receive_day_count: int) -> str:
    text = (schedule or "").lower()
    if any(token in text for token in ["setiap hari", "everyday", "every day"]):
        return "EVERYDAY"
    if receive_day_count >= 5:
        return "WEEKDAY_SET"
    return "LIMITED_DAY"


def _classify_cutoff(cutoff: str, cutoff_hour: Optional[int]) -> str:
    text = (cutoff or "").lower().strip()
    if text in {"", "-", "no cutoff", "no cut off", "none", "n/a"}:
        return "NO_CUTOFF"
    if cutoff_hour is None:
        return "UNKNOWN"
    if cutoff_hour <= 10:
        return "STRICT_MORNING"
    if cutoff_hour <= 12:
        return "MIDDAY"
    if cutoff_hour <= 14:
        return "AFTERNOON"
    return "LONG_TIME_TO_CUTOFF"


def _classify_area(area: str) -> str:
    text = (area or "").lower()
    remote_markers = [
        "bogor", "karawang", "cikarang", "purwakarta", "bandung",
        "serang", "cilegon", "sukabumi",
    ]
    if any(marker in text for marker in remote_markers):
        return "REMOTE"
    if text:
        return "URBAN"
    return "UNKNOWN"
