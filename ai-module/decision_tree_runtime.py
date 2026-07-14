"""
Decision tree runtime helpers.

These functions use the trained sklearn DecisionTreeClassifier and its fitted
LabelEncoders to produce both prediction output and the actual node traversal
path for one invoice context.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
from sklearn.preprocessing import LabelEncoder


def encode_input(
    input_values: Dict[str, Any],
    encoders: Dict[str, LabelEncoder],
    feature_cols: List[str],
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    encoded_values = []
    encoded_trace = []

    for column in feature_cols:
        raw_value = str(input_values.get(column, "Unknown") or "Unknown")
        encoder = encoders[column]
        known = raw_value in set(encoder.classes_)
        if known:
            encoded = int(encoder.transform([raw_value])[0])
            encoded_value = raw_value
        else:
            encoded = 0
            encoded_value = str(encoder.classes_[0]) if len(encoder.classes_) else "Unknown"

        encoded_values.append(encoded)
        encoded_trace.append({
            "feature": column,
            "raw_value": raw_value,
            "encoded_value": encoded,
            "known_value": known,
            "fallback_value": None if known else encoded_value,
        })

    return np.array([encoded_values]), encoded_trace


def predict_with_path(
    model: Any,
    encoders: Dict[str, LabelEncoder],
    metadata: Dict[str, Any],
    feature_cols: List[str],
    input_values: Dict[str, Any],
    map_priority,
    model_artifact: str,
) -> Dict[str, Any]:
    x_input, encoded_trace = encode_input(input_values, encoders, feature_cols)

    prediction_idx = model.predict(x_input)[0]
    probabilities = model.predict_proba(x_input)[0] if hasattr(model, "predict_proba") else []
    confidence = float(np.max(probabilities)) if len(probabilities) else None

    target_encoder = encoders["__target__"]
    raw_prediction = target_encoder.inverse_transform([prediction_idx])[0]
    priority_label = map_priority(raw_prediction, confidence or 0)
    traversal_path = extract_traversal_path(
        model=model,
        encoders=encoders,
        feature_cols=feature_cols,
        x_input=x_input,
        input_values=input_values,
        target_encoder=target_encoder,
        model_classes=model.classes_,
    )

    class_probabilities = {}
    if len(probabilities):
        for index, class_id in enumerate(model.classes_):
            class_name = target_encoder.inverse_transform([class_id])[0]
            class_probabilities[class_name] = round(float(probabilities[index]), 4)

    return {
        "priority_label": priority_label,
        "raw_prediction": str(raw_prediction),
        "confidence": round(confidence, 4) if confidence is not None else None,
        "class_probabilities": class_probabilities,
        "model_version": (metadata or {}).get("trained_at", "unknown")[:10],
        "model_artifact": model_artifact,
        "tree_depth": _safe_model_call(model, "get_depth"),
        "tree_leaves": _safe_model_call(model, "get_n_leaves"),
        "feature_encoding": encoded_trace,
        "path": traversal_path,
        "source": "trained_decision_tree_model",
    }


def extract_traversal_path(
    model: Any,
    encoders: Dict[str, LabelEncoder],
    feature_cols: List[str],
    x_input: np.ndarray,
    input_values: Dict[str, Any],
    target_encoder: LabelEncoder,
    model_classes: Any,
) -> List[Dict[str, Any]]:
    tree = model.tree_
    node = 0
    path = []

    while tree.children_left[node] != tree.children_right[node]:
        feature_index = int(tree.feature[node])
        feature_name = feature_cols[feature_index]
        threshold = float(tree.threshold[node])
        encoded_value = float(x_input[0, feature_index])
        raw_value = input_values.get(feature_name)
        go_left = encoded_value <= threshold
        next_node = int(tree.children_left[node] if go_left else tree.children_right[node])
        encoder = encoders.get(feature_name)

        path.append({
            "node_index": int(node),
            "stage": "Decision Tree Reconstruction",
            "node_type": "decision",
            "feature": feature_name,
            "raw_value": raw_value,
            "encoded_value": int(encoded_value),
            "threshold": round(threshold, 4),
            "operator": "<=" if go_left else ">",
            "condition": f"{feature_name} encoded {('<=' if go_left else '>')} {threshold:.4f}",
            "decision": "left" if go_left else "right",
            "next_node": next_node,
            "categories_left": _categories_for_threshold(encoder, threshold, left=True),
            "categories_right": _categories_for_threshold(encoder, threshold, left=False),
            "samples": int(tree.n_node_samples[node]),
            "entropy": round(float(tree.impurity[node]), 4),
        })
        node = next_node

    path.append(_leaf_node(tree, node, target_encoder, model_classes))
    return path


def _leaf_node(tree: Any, node: int, target_encoder: LabelEncoder, model_classes: Any) -> Dict[str, Any]:
    values = tree.value[node][0]
    winner_index = int(np.argmax(values))
    class_id = model_classes[winner_index] if winner_index < len(model_classes) else winner_index
    predicted_class = target_encoder.inverse_transform([class_id])[0]

    distribution = {}
    total = float(np.sum(values)) or 1.0
    for index, value in enumerate(values):
        class_id = model_classes[index] if index < len(model_classes) else index
        class_name = target_encoder.inverse_transform([class_id])[0]
        distribution[class_name] = round(float(value) / total, 4)

    return {
        "node_index": int(node),
        "stage": "Decision Tree Reconstruction",
        "node_type": "leaf",
        "prediction": str(predicted_class),
        "class_distribution": distribution,
        "samples": int(tree.n_node_samples[node]),
        "entropy": round(float(tree.impurity[node]), 4),
    }


def _categories_for_threshold(
    encoder: LabelEncoder,
    threshold: float,
    left: bool,
    limit: int = 8,
) -> List[str]:
    if encoder is None:
        return []

    categories = []
    for index, label in enumerate(encoder.classes_):
        if (left and index <= threshold) or (not left and index > threshold):
            categories.append(str(label))

    return categories[:limit]


def _safe_model_call(model: Any, method_name: str):
    method = getattr(model, method_name, None)
    if not method:
        return None
    try:
        return int(method())
    except Exception:
        return None
