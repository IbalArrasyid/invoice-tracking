"""
Compatibility orchestration for the Operational Knowledge Formalization Framework.

This layer keeps the legacy recommendation engines in place while exposing the
new thesis contract: knowledge trace, rule evidence, decision tree reconstruction,
priority recommendation, delivery context, and POD context.
"""


class PriorityRecommendationOrchestrator:
    """Builds the compatibility response around Batch 4 research outputs."""

    framework_name = "Operational Knowledge Formalization Framework"
    framework_stages = [
        "Knowledge Acquisition",
        "Knowledge Formalization",
        "Operational Labeling Guideline",
        "Rule-Based Representation",
        "Decision Tree Reconstruction",
        "Priority Recommendation",
        "Invoice Tracking & POD",
    ]

    def build(self, request_data, legacy_response, source="ai_module", research_result=None):
        request_data = request_data or {}
        legacy_response = legacy_response or {}
        research_result = research_result or {}

        priority_label = (
            research_result.get("priority_label")
            or request_data.get("priority_label")
            or legacy_response.get("priority_label")
            or "Sedang"
        )
        area = request_data.get("area_pengantaran") or request_data.get("area") or ""
        schedule = request_data.get("jadwal_terima") or request_data.get("jadwal") or ""
        cutoff = request_data.get("cut_off_jam") or request_data.get("cutoff") or ""
        current_driver = request_data.get("nama_driver") or ""

        recommendation_score = self._as_float(
            legacy_response.get("recommendation_score")
        )
        decision_confidence = self._as_float(
            research_result.get("decision_confidence"),
            self._as_float(legacy_response.get("recommendation_confidence_score"), recommendation_score),
        )
        confidence_label = (
            legacy_response.get("recommendation_confidence")
            or self._confidence_label(decision_confidence)
        )

        priority_action = (
            legacy_response.get("recommended_delivery_day")
            or "Review Manual"
        )
        recommended_driver = (
            legacy_response.get("recommended_driver")
            or current_driver
            or "Tidak tersedia"
        )
        score_details = legacy_response.get("score_details") or {}
        factor_explanation = legacy_response.get("factor_explanation") or []
        top_recommendations = legacy_response.get("top_recommendations") or []

        rule_evidence = research_result.get("rule_evidence") or {
            "priority_label": priority_label,
            "receive_schedule": schedule or None,
            "cutoff_policy": cutoff or None,
            "delivery_area": area or None,
            "compatibility_score": recommendation_score,
            "score_details": score_details,
            "factor_explanation": factor_explanation,
        }

        decision_tree_path = research_result.get("decision_tree_path") or [
            {
                "stage": "Knowledge Acquisition",
                "fact": "invoice_operational_context",
                "value": {
                    "area_pengantaran": area or None,
                    "jadwal_terima": schedule or None,
                    "cut_off_jam": cutoff or None,
                    "nama_driver": current_driver or None,
                },
            },
            {
                "stage": "Operational Labeling Guideline",
                "fact": "priority_label",
                "value": priority_label,
            },
            {
                "stage": "Rule-Based Representation",
                "fact": "priority_action",
                "value": priority_action,
            },
            {
                "stage": "Priority Recommendation",
                "fact": "recommended_delivery_action",
                "value": priority_action,
            },
        ]

        knowledge_trace = research_result.get("knowledge_trace") or [
            {
                "stage": "Knowledge Acquisition",
                "description": "Operational facts collected from invoice, customer, schedule, cutoff, and delivery actor context.",
                "data": {
                    "area_pengantaran": area or None,
                    "jadwal_terima": schedule or None,
                    "cut_off_jam": cutoff or None,
                    "nama_driver": current_driver or None,
                },
            },
            {
                "stage": "Knowledge Formalization",
                "description": "Operational facts are normalized into labels and evidence fields used by the compatibility contract.",
                "data": rule_evidence,
            },
            {
                "stage": "Operational Labeling Guideline",
                "description": "Priority label is treated as the operational label produced by the guideline or decision tree prediction.",
                "data": {"priority_label": priority_label},
            },
            {
                "stage": "Rule-Based Representation",
                "description": "Existing engine output is exposed as transitional rule evidence.",
                "data": {"rule_evidence": rule_evidence},
            },
            {
                "stage": "Decision Tree Reconstruction",
                "description": "The decision path is reconstructed from available priority and operational evidence.",
                "data": {"decision_tree_path": decision_tree_path},
            },
            {
                "stage": "Priority Recommendation",
                "description": "Final priority action is exposed without removing legacy response fields.",
                "data": {
                    "priority_label": priority_label,
                    "priority_action": priority_action,
                    "confidence": confidence_label,
                },
            },
            {
                "stage": "Invoice Tracking & POD",
                "description": "Priority output is handed off to delivery tracking and POD evidence collection.",
                "data": {
                    "recommended_driver": recommended_driver,
                    "pod_required": True,
                },
            },
        ]

        delivery_context = {
            "current_driver": current_driver or None,
            "recommended_driver": recommended_driver,
            "driver_assignment_supported": True,
            "research_role": "Delivery Context",
            "estimated_delivery_time": legacy_response.get("estimated_delivery_time"),
            "estimated_delivery_minutes": legacy_response.get("estimated_delivery_minutes"),
            "workload_factor": legacy_response.get("workload_factor"),
            "candidates": [
                self._normalize_candidate(candidate, index)
                for index, candidate in enumerate(top_recommendations)
            ],
        }

        pod_context = {
            "stage": "Invoice Tracking & POD",
            "handoff_from": "Priority Recommendation",
            "pod_required": True,
            "expected_evidence": [
                "receiver_name",
                "receiver_signature",
                "courier_signature",
                "delivery_timestamp",
            ],
            "status": "pending_delivery_execution",
        }

        priority_recommendation = research_result.get("priority_recommendation") or {
            "label": priority_label,
            "action": priority_action,
            "confidence": confidence_label,
            "confidence_score": decision_confidence,
            "evidence_score": recommendation_score,
            "source": source,
        }

        rule_based_result = research_result.get("rule_based_result") or {
            "result": priority_action,
            "priority_label": priority_label,
            "evidence": rule_evidence,
            "source": "legacy_engine_adapter",
            "compatibility_mode": True,
        }

        decision_tree_result = research_result.get("decision_tree_result") or {
            "priority_label": priority_label,
            "confidence": decision_confidence,
            "path": decision_tree_path,
            "reconstructed": True,
            "source": "priority_label_compatibility_adapter",
        }

        return {
            "framework": self.framework_name,
            "framework_stages": self.framework_stages,
            "compatibility_mode": True,
            "research_artifact_mode": bool(research_result),
            "research_engine_version": research_result.get("research_engine_version"),
            "model_artifact": research_result.get("model_artifact"),
            "priority_recommendation": priority_recommendation,
            "priority_label": priority_label,
            "knowledge_trace": knowledge_trace,
            "rule_evidence": rule_evidence,
            "rule_based_result": rule_based_result,
            "decision_tree_result": decision_tree_result,
            "decision_tree_path": decision_tree_path,
            "decision_confidence": decision_confidence,
            "priority_explanation": research_result.get("priority_explanation"),
            "operational_attributes": research_result.get("operational_attributes"),
            "delivery_context": delivery_context,
            "pod_context": pod_context,
        }

    def _normalize_candidate(self, candidate, index):
        candidate = candidate or {}
        return {
            "rank": candidate.get("rank", index + 1),
            "driver": candidate.get("driver") or candidate.get("name"),
            "score": candidate.get("score") or candidate.get("adjusted_score"),
            "estimated_time": candidate.get("estimated_time"),
            "estimated_minutes": candidate.get("estimated_minutes"),
            "area": candidate.get("area"),
            "workload": candidate.get("workload") or candidate.get("active_deliveries"),
            "eligible": candidate.get("eligible", True),
            "violations": candidate.get("violations", []),
        }

    def _as_float(self, value, fallback=None):
        try:
            if value is None:
                return fallback
            return float(value)
        except (TypeError, ValueError):
            return fallback

    def _confidence_label(self, confidence):
        if confidence is None:
            return "Medium"
        if confidence >= 0.8:
            return "High"
        if confidence >= 0.6:
            return "Medium"
        return "Low"
