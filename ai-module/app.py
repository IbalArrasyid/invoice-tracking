"""
app.py — Flask API Server untuk AI Module (C4.5 Decision Tree)
===============================================================
Endpoints:
  POST /predict     → Prediksi prioritas invoice
  POST /retrain     → Re-train model dari dataset
  GET  /health      → Health check
  GET  /model-info  → Informasi model (akurasi, tanggal training, dll)
"""

import os
import json
import traceback
import pandas as pd
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
from decision_tree_runtime import predict_with_path
from operational_rule_engine import (
    OperationalRuleEngine,
    priority_to_action,
    priority_to_confidence_label,
    strongest_priority,
)

# ─── Paths ────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
FINAL_MODEL_PATH = os.path.join(MODEL_DIR, 'decision_tree_model.pkl')
LEGACY_MODEL_PATH = os.path.join(MODEL_DIR, 'c45_model.pkl')
MODEL_PATH = FINAL_MODEL_PATH if os.path.exists(FINAL_MODEL_PATH) else LEGACY_MODEL_PATH
ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoders.pkl')
METADATA_PATH = os.path.join(MODEL_DIR, 'model_metadata.json')
DATASET_PATH = os.path.join(BASE_DIR, '..', 'dataset_invoice_simulasi.csv')

# ─── Feature columns (harus sama dengan train.py) ────────────────
FEATURE_COLS = [
    'nama_customer',
    'nama_driver',
    'area_pengantaran',
    'jadwal_terima',
    'cut_off_jam',
]

# ─── Flask App ────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ─── Global model & encoders ─────────────────────────────────────
model = None
encoders = None
metadata = None
model_artifact_path = None


def resolve_model_path():
    """Prefer decision_tree_model.pkl, then use the existing trained C4.5 artifact."""
    if os.path.exists(FINAL_MODEL_PATH):
        return FINAL_MODEL_PATH
    return LEGACY_MODEL_PATH


def load_model():
    """Load model, encoders, dan metadata dari disk."""
    global model, encoders, metadata, model_artifact_path

    selected_model_path = resolve_model_path()
    if not os.path.exists(selected_model_path):
        print('⚠️  Model belum ada. Jalankan train.py terlebih dahulu.')
        return False

    model = joblib.load(selected_model_path)
    model_artifact_path = selected_model_path
    encoders = joblib.load(ENCODER_PATH)

    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            metadata = json.load(f)

    print('✅ Model berhasil dimuat.')
    return True


def map_to_three_levels(raw_prediction: str, confidence: float) -> str:
    """
    Mapping dari prediksi binary (Prioritas/Normal) ke tiga level
    agar kompatibel dengan skema backend (Tinggi/Sedang/Rendah).

    Rules:
      - Prioritas + confidence >= 0.85 → Tinggi
      - Prioritas + confidence <  0.85 → Sedang
      - Normal                         → Rendah
    """
    if raw_prediction == 'Prioritas':
        return 'Tinggi' if confidence >= 0.85 else 'Sedang'
    return 'Rendah'


def generate_reason(raw_prediction: str, confidence: float, jadwal: str, cutoff: str) -> str:
    """Generate alasan prediksi yang human-readable."""
    hour = int(cutoff.split(':')[0]) if cutoff and ':' in cutoff else 12

    reasons = []

    if raw_prediction == 'Prioritas':
        if hour <= 10:
            reasons.append(f'Cut-off ketat ({cutoff})')
        elif hour <= 12:
            reasons.append(f'Cut-off sedang ({cutoff})')

        limited_schedules = [
            'Senin-Kamis', 'Selasa-Kamis', 'Rabu-Jumat',
            'Senin-Rabu', 'Selasa-Jumat',
        ]
        if jadwal in limited_schedules:
            reasons.append(f'Jadwal terbatas ({jadwal})')

        if not reasons:
            reasons.append('Pola data menunjukkan prioritas tinggi')
    else:
        if hour >= 14:
            reasons.append(f'Cut-off longgar ({cutoff})')
        if jadwal == 'Setiap Hari':
            reasons.append('Jadwal fleksibel (Setiap Hari)')
        if not reasons:
            reasons.append('Pola data menunjukkan prioritas normal')

    return ' + '.join(reasons)


def safe_encode(encoder: LabelEncoder, value: str) -> int:
    """
    Encode nilai dengan handling untuk unseen labels.
    Jika value belum dikenal encoder, gunakan label terdekat atau default.
    """
    try:
        return int(encoder.transform([value])[0])
    except ValueError:
        # Value belum pernah dilihat saat training — gunakan index 0 (fallback)
        print(f'   ⚠️  Unseen label: "{value}", menggunakan fallback')
        return 0


# ──────────────────────────────────────────────────────────────────
#  ENDPOINTS
# ──────────────────────────────────────────────────────────────────

rule_engine = OperationalRuleEngine()


def build_research_context(data: dict, require_model: bool = False) -> dict:
    """Run the finalized rule base and trained decision tree for one invoice."""
    input_values = normalize_research_input(data)

    rule_result = rule_engine.evaluate(input_values)
    if model is not None and encoders is not None:
        decision_result = predict_with_path(
            model=model,
            encoders=encoders,
            metadata=metadata or {},
            feature_cols=FEATURE_COLS,
            input_values=input_values,
            map_priority=map_to_three_levels,
            model_artifact=os.path.basename(model_artifact_path or resolve_model_path()),
        )
    elif require_model:
        raise RuntimeError('Decision tree model belum dimuat.')
    else:
        decision_result = {
            'priority_label': input_values.get('priority_label') or rule_result['priority'],
            'raw_prediction': None,
            'confidence': None,
            'class_probabilities': {},
            'model_version': 'unavailable',
            'model_artifact': os.path.basename(resolve_model_path()),
            'path': [],
            'source': 'decision_tree_unavailable',
        }

    final_priority = strongest_priority(
        rule_result.get('priority'),
        decision_result.get('priority_label'),
        input_values.get('priority_label'),
    )
    action = priority_to_action(final_priority)
    decision_confidence = decision_result.get('confidence')
    confidence_label = priority_to_confidence_label(decision_confidence)
    explanation = build_priority_explanation(
        rule_result=rule_result,
        decision_result=decision_result,
        input_values=input_values,
        final_priority=final_priority,
        action=action,
    )

    priority_recommendation = {
        'label': final_priority,
        'action': action,
        'confidence': confidence_label,
        'confidence_score': decision_confidence,
        'source': 'operational_rule_engine_and_trained_decision_tree',
        'rule_id': rule_result['rule_id'],
        'model_artifact': decision_result.get('model_artifact'),
    }

    rule_evidence = {
        'rule_id': rule_result['rule_id'],
        'rule_name': rule_result['rule_name'],
        'activated_conditions': rule_result['activated_conditions'],
        'operational_reason': rule_result['operational_reason'],
        'priority': rule_result['priority'],
        'priority_code': rule_result['priority_code'],
        'operational_attributes': rule_result['operational_attributes'],
        'rules_evaluated': rule_result['rules_evaluated'],
        'activated_rule': {
            'rule_id': rule_result['rule_id'],
            'rule_name': rule_result['rule_name'],
            'activated_conditions': rule_result['activated_conditions'],
            'operational_reason': rule_result['operational_reason'],
            'priority': rule_result['priority'],
        },
    }

    rule_based_result = {
        'result': final_priority,
        'priority_label': final_priority,
        'activated_rule': rule_evidence['activated_rule'],
        'evidence': rule_evidence,
        'source': rule_result['source'],
        'compatibility_mode': False,
    }

    decision_tree_result = {
        'priority_label': decision_result.get('priority_label'),
        'raw_prediction': decision_result.get('raw_prediction'),
        'confidence': decision_result.get('confidence'),
        'class_probabilities': decision_result.get('class_probabilities'),
        'model_version': decision_result.get('model_version'),
        'model_artifact': decision_result.get('model_artifact'),
        'tree_depth': decision_result.get('tree_depth'),
        'tree_leaves': decision_result.get('tree_leaves'),
        'feature_encoding': decision_result.get('feature_encoding'),
        'path': decision_result.get('path', []),
        'reconstructed': bool(decision_result.get('path')),
        'source': decision_result.get('source'),
    }

    knowledge_trace = build_knowledge_trace(
        input_values=input_values,
        rule_result=rule_result,
        decision_tree_result=decision_tree_result,
        priority_recommendation=priority_recommendation,
        explanation=explanation,
    )

    return {
        'priority_label': final_priority,
        'priority_recommendation': priority_recommendation,
        'knowledge_trace': knowledge_trace,
        'rule_evidence': rule_evidence,
        'rule_based_result': rule_based_result,
        'decision_tree_result': decision_tree_result,
        'decision_tree_path': decision_tree_result['path'],
        'decision_confidence': decision_confidence,
        'priority_explanation': explanation,
        'operational_attributes': rule_result['operational_attributes'],
        'model_artifact': decision_result.get('model_artifact'),
        'research_engine_version': 'batch4_research_integration',
    }


def normalize_research_input(data: dict) -> dict:
    area = data.get('area') or data.get('area_pengantaran') or 'Jakarta Pusat'
    schedule = data.get('jadwal') or data.get('jadwal_terima') or data.get('receive_schedule') or 'Setiap Hari'
    cutoff = data.get('cutoff') or data.get('cut_off_jam') or data.get('cutoff_policy') or '12:00'

    return {
        'nama_customer': data.get('nama_customer') or data.get('customer') or 'Unknown',
        'nama_driver': data.get('nama_driver') or data.get('driver') or 'Unknown',
        'area_pengantaran': area,
        'jadwal_terima': schedule,
        'cut_off_jam': cutoff,
        'priority_label': data.get('priority_label'),
        'days_to_cutoff': data.get('days_to_cutoff'),
        'next_receive_day_gap': data.get('next_receive_day_gap'),
        'missed_receive_schedule': data.get('missed_receive_schedule'),
        'month_end_flag': data.get('month_end_flag'),
    }


def build_knowledge_trace(
    input_values: dict,
    rule_result: dict,
    decision_tree_result: dict,
    priority_recommendation: dict,
    explanation: str,
) -> list:
    attributes = rule_result['operational_attributes']
    return [
        {
            'stage': 'Knowledge Acquisition',
            'description': 'Invoice, customer, receive schedule, cutoff, area, and delivery actor are collected.',
            'data': input_values,
        },
        {
            'stage': 'Knowledge Formalization',
            'description': 'Operational attributes are formalized into normalized schedule, cutoff, area, and urgency features.',
            'data': attributes,
        },
        {
            'stage': 'Operational Guideline',
            'description': 'The R1-R12 operational labeling guideline is evaluated sequentially.',
            'data': {
                'rules_evaluated': rule_result['rules_evaluated'],
            },
        },
        {
            'stage': 'Activated Rule',
            'description': f"{rule_result['rule_id']} activated: {rule_result['operational_reason']}",
            'data': {
                'rule_id': rule_result['rule_id'],
                'rule_name': rule_result['rule_name'],
                'activated_conditions': rule_result['activated_conditions'],
                'priority': rule_result['priority'],
            },
        },
        {
            'stage': 'Decision Tree Reconstruction',
            'description': 'The trained Decision Tree path is reconstructed from the model tree nodes.',
            'data': {
                'model_artifact': decision_tree_result.get('model_artifact'),
                'raw_prediction': decision_tree_result.get('raw_prediction'),
                'decision_tree_path': decision_tree_result.get('path', []),
                'confidence': decision_tree_result.get('confidence'),
            },
        },
        {
            'stage': 'Priority Recommendation',
            'description': explanation,
            'data': priority_recommendation,
        },
    ]


def build_priority_explanation(
    rule_result: dict,
    decision_result: dict,
    input_values: dict,
    final_priority: str,
    action: str,
) -> str:
    confidence = decision_result.get('confidence')
    confidence_text = f"{round(confidence * 100)}%" if isinstance(confidence, (int, float)) else 'unavailable'
    return (
        f"{action} was produced because rule {rule_result['rule_id']} "
        f"({rule_result['rule_name']}) activated with conditions: "
        f"{'; '.join(rule_result['activated_conditions'])}. "
        f"The trained decision tree predicted {decision_result.get('priority_label')} "
        f"from area {input_values.get('area_pengantaran')}, schedule "
        f"{input_values.get('jadwal_terima')}, and cutoff {input_values.get('cut_off_jam')} "
        f"with confidence {confidence_text}. Final priority is {final_priority}."
    )


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'AI Module - Operational Knowledge Research Engine',
        'model_loaded': model is not None,
        'model_artifact': os.path.basename(model_artifact_path or resolve_model_path()),
        'rule_engine': 'Operational Labeling Guideline R1-R12',
        'research_engine_version': 'batch4_research_integration',
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/model-info', methods=['GET'])
def model_info():
    """Informasi detail model yang sedang berjalan."""
    if metadata is None:
        return jsonify({
            'success': False,
            'message': 'Model belum di-train. Jalankan train.py atau POST /retrain.',
        }), 404

    return jsonify({
        'success': True,
        'data': {
            **metadata,
            'model_artifact': os.path.basename(model_artifact_path or resolve_model_path()),
            'preferred_artifact': os.path.basename(FINAL_MODEL_PATH),
            'loaded_from_finalized_name': os.path.exists(FINAL_MODEL_PATH),
        },
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Prediksi prioritas pengiriman invoice.

    Request Body (JSON):
      - area (str)          : Area pengantaran, misal "Bogor"
      - jadwal (str)        : Jadwal penerimaan, misal "Selasa-Kamis"
      - cutoff (str)        : Batas waktu, misal "10:00"
      - nama_customer (str) : Nama pelanggan (opsional)
      - nama_driver (str)   : Nama driver (opsional)

    Response:
      - priority (str)      : Tinggi / Sedang / Rendah
      - confidence (float)  : 0.0 - 1.0
      - reason (str)        : Penjelasan prediksi
      - raw_prediction (str): Prediksi asli model (Prioritas/Normal)
      - model_version (str) : Tanggal training model
    """
    if model is None or encoders is None:
        return jsonify({
            'success': False,
            'message': 'Model belum dimuat. Jalankan train.py terlebih dahulu.',
        }), 503

    try:
        data = request.get_json(force=True)

        # Ambil input — field mapping dari backend
        area = data.get('area', 'Jakarta Pusat')
        jadwal = data.get('jadwal', 'Setiap Hari')
        cutoff = data.get('cutoff', '12:00')
        nama_customer = data.get('nama_customer', 'Unknown')
        nama_driver = data.get('nama_driver', 'Unknown')

        research_result = build_research_context({
            'nama_customer': nama_customer,
            'nama_driver': nama_driver,
            'area': area,
            'jadwal': jadwal,
            'cutoff': cutoff,
        }, require_model=True)

        decision_tree_result = research_result['decision_tree_result']
        priority = research_result['priority_label']
        confidence = research_result['decision_confidence']
        raw_prediction = decision_tree_result.get('raw_prediction')
        reason = research_result['priority_explanation']
        model_version = decision_tree_result.get('model_version')

        return jsonify({
            'priority': priority,
            'confidence': round(confidence, 4) if isinstance(confidence, (int, float)) else None,
            'reason': reason,
            'raw_prediction': raw_prediction,
            'model_version': model_version,
            **research_result,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error saat prediksi: {str(e)}',
        }), 500


@app.route('/retrain', methods=['POST'])
def retrain():
    """
    Re-train model dari dataset CSV.
    Secara opsional, bisa menerima path dataset kustom dalam body request.
    """
    try:
        data = request.get_json(silent=True) or {}
        dataset_path = data.get('dataset_path', DATASET_PATH)

        if not os.path.exists(dataset_path):
            return jsonify({
                'success': False,
                'message': f'Dataset tidak ditemukan: {dataset_path}',
            }), 404

        # Import train functions
        from train import load_dataset, encode_features, train_model, evaluate_model

        # Load & train
        df = load_dataset(dataset_path)
        X, y, new_encoders = encode_features(df)

        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        new_model = train_model(X_train, y_train)
        le_target = new_encoders['__target__']
        acc, _ = evaluate_model(new_model, X_test, y_test, le_target)

        # Save
        joblib.dump(new_model, MODEL_PATH)
        joblib.dump(new_encoders, ENCODER_PATH)

        new_metadata = {
            'trained_at': datetime.now().isoformat(),
            'accuracy': round(acc, 4),
            'dataset_rows': len(df),
            'train_size': len(X_train),
            'test_size': len(X_test),
            'tree_depth': new_model.get_depth(),
            'tree_leaves': new_model.get_n_leaves(),
            'features': FEATURE_COLS,
            'target_classes': list(le_target.classes_),
            'feature_importance': {
                col: round(float(imp), 4)
                for col, imp in zip(FEATURE_COLS, new_model.feature_importances_)
            },
        }
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(new_metadata, f, indent=2, ensure_ascii=False)

        # Reload ke memory
        global model, encoders, metadata, model_artifact_path
        model = new_model
        encoders = new_encoders
        metadata = new_metadata
        model_artifact_path = MODEL_PATH

        return jsonify({
            'success': True,
            'message': 'Model berhasil di-retrain.',
            'data': {
                'accuracy': round(acc, 4),
                'dataset_rows': len(df),
                'tree_depth': new_model.get_depth(),
            },
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error saat retrain: {str(e)}',
        }), 500


# ─── Import Recommendation Engines ────────────────────────────────
from recommendation_engine import SAWRecommendationEngine
from ranking_engine import DriverRankingEngine
from estimation_engine import DeliveryEstimationEngine
from explainable_engine import ExplainableEngine
from priority_recommendation_orchestrator import PriorityRecommendationOrchestrator

# Inisialisasi engine instances
saw_engine = SAWRecommendationEngine()
ranking_engine = DriverRankingEngine()
estimation_engine = DeliveryEstimationEngine()
explainable_engine = ExplainableEngine()
priority_orchestrator = PriorityRecommendationOrchestrator()


@app.route('/recommend', methods=['POST'])
def recommend():
    """
    Generate priority recommendation in Batch 2 compatibility mode.

    Legacy engines are still used internally so existing clients keep receiving
    the same fields. The compatibility orchestrator adds the Operational
    Knowledge Formalization Framework contract on top.

    Request Body (JSON):
      - priority_label (str)     : "Tinggi"/"Sedang"/"Rendah"
      - area_pengantaran (str)   : Area tujuan, misal "Bogor"
      - jadwal_terima (str)      : Jadwal customer, misal "Senin & Kamis"
      - cut_off_jam (str)        : Batas waktu, misal "10:00"
      - nama_driver (str)        : Driver saat ini
      - drivers (list[dict])     : Semua driver aktif
          [{name, area, workload, is_active}]

    Response: JSON lengkap dengan skor, ranking, estimasi, dan penjelasan.
    """
    try:
        data = request.get_json(force=True)

        # ─── Validasi input ───────────────────────────────────────
        priority_label = data.get('priority_label', 'Sedang')
        area_pengantaran = data.get('area_pengantaran', 'Jakarta Pusat')
        jadwal_terima = data.get('jadwal_terima', 'Setiap Hari')
        cut_off_jam = data.get('cut_off_jam', '12:00')
        nama_customer = data.get('nama_customer', 'Unknown')
        nama_driver = data.get('nama_driver', 'Unknown')
        drivers = data.get('drivers', [])

        research_result = build_research_context({
            'priority_label': priority_label,
            'area_pengantaran': area_pengantaran,
            'jadwal_terima': jadwal_terima,
            'cut_off_jam': cut_off_jam,
            'nama_customer': nama_customer,
            'nama_driver': nama_driver,
        })
        priority_label = research_result['priority_label']
        priority_action = research_result['priority_recommendation']['action']

        # Normalize driver data — backend may send 'active_deliveries' instead of 'workload'
        for d in drivers:
            if 'workload' not in d and 'active_deliveries' in d:
                d['workload'] = d['active_deliveries']
            if 'workload' not in d:
                d['workload'] = 0
            if 'is_active' not in d:
                d['is_active'] = True

        invoice_data = {
            'area_pengantaran': area_pengantaran,
            'jadwal_terima': jadwal_terima,
            'cut_off_jam': cut_off_jam,
        }

        # Legacy score for the current delivery actor.
        current_driver = None
        for d in drivers:
            if d.get('name') == nama_driver:
                current_driver = d
                break

        if current_driver is None:
            current_driver = {
                'name': nama_driver,
                'area': area_pengantaran,
                'workload': 0,
                'is_active': True,
            }

        saw_result = saw_engine.get_recommendation(
            priority_label=priority_label,
            area_pengantaran=area_pengantaran,
            jadwal_terima=jadwal_terima,
            cut_off_jam=cut_off_jam,
            driver_area=current_driver.get('area', ''),
            driver_workload=current_driver.get('workload', 0),
        )

        recommendation_score = saw_result['recommendation_score']
        score_details = saw_result['score_details']
        recommended_delivery_day = priority_action

        # Delivery context candidates retained for backward compatibility.
        if drivers:
            top_recs = ranking_engine.get_top_recommendations(
                drivers=drivers,
                invoice_data=invoice_data,
                priority_label=priority_label,
                top_n=3,
            )
        else:
            top_recs = [{
                'rank': 1,
                'driver': nama_driver,
                'area': current_driver.get('area', ''),
                'adjusted_score': recommendation_score,
                'eligible': True,
                'violations': [],
                'workload': current_driver.get('workload', 0),
            }]

        # Recommended driver = rank 1
        recommended_driver = top_recs[0]['driver'] if top_recs else nama_driver

        # ─── 3. Delivery Time Estimation ─────────────────────────
        best_driver_workload = top_recs[0].get('workload', 0) if top_recs else 0
        estimation = estimation_engine.estimate_delivery_time(
            area=area_pengantaran,
            workload_count=best_driver_workload,
        )

        # Estimasi per driver di top recommendations
        for rec in top_recs:
            drv_est = estimation_engine.estimate_delivery_time(
                area=area_pengantaran,
                workload_count=rec.get('workload', 0),
            )
            rec['estimated_time'] = drv_est['formatted']
            rec['estimated_minutes'] = drv_est['total_minutes']

        # ─── 4. Confidence ───────────────────────────────────────
        confidence = {
            'level': research_result['priority_recommendation']['confidence'],
            'score': research_result.get('decision_confidence'),
            'explanation': 'Confidence comes from the trained decision tree model.',
        }

        # ─── 5. Explainable AI ───────────────────────────────────
        recommendation_data = {
            'recommendation_score': recommendation_score,
            'recommended_delivery_day': recommended_delivery_day,
            'recommended_driver': recommended_driver,
            'priority_label': priority_label,
            'area_pengantaran': area_pengantaran,
            'cut_off_jam': cut_off_jam,
            'recommendation_confidence': confidence['level'],
        }

        factor_explanation = explainable_engine.generate_factor_explanations(
            score_details
        )
        recommendation_reason = research_result['priority_explanation']
        recommendation_summary = research_result['priority_explanation']

        # Operational notes
        best_constraint = ranking_engine.check_constraints(
            current_driver, current_driver.get('workload', 0)
        )
        operational_notes = explainable_engine.generate_operational_notes(
            constraints_result=best_constraint,
            driver_data=current_driver,
        )

        # ─── 6. Build response ───────────────────────────────────
        response = {
            'recommendation_score': recommendation_score,
            'recommended_delivery_day': recommended_delivery_day,
            'recommended_driver': recommended_driver,
            'recommendation_reason': recommendation_reason,
            'recommendation_confidence': confidence['level'],
            'recommendation_confidence_score': confidence['score'],
            'confidence_explanation': confidence['explanation'],
            'estimated_delivery_time': estimation['formatted'],
            'estimated_delivery_minutes': estimation['total_minutes'],
            'estimation_breakdown': estimation['breakdown'],
            'top_recommendations': [
                {
                    'rank': rec.get('rank', i + 1),
                    'driver': rec.get('driver', ''),
                    'score': rec.get('adjusted_score', 0),
                    'estimated_time': rec.get('estimated_time', ''),
                    'estimated_minutes': rec.get('estimated_minutes', 0),
                    'area': rec.get('area', ''),
                    'workload': rec.get('workload', 0),
                    'eligible': rec.get('eligible', True),
                    'violations': rec.get('violations', []),
                }
                for i, rec in enumerate(top_recs)
            ],
            'score_details': score_details,
            'factor_explanation': [
                {
                    'factor': fe['factor'],
                    'label': fe['label'],
                    'score': fe['raw_score'],
                    'explanation': fe['explanation'],
                }
                for fe in factor_explanation
            ],
            'recommendation_summary': recommendation_summary,
            'operational_notes': operational_notes,
            'operational_constraints': ranking_engine.get_constraint_config(),
            'traffic_adjustment': estimation['breakdown']['traffic_adjustment'],
            'workload_factor': estimation['breakdown']['workload_factor'],
        }

        response.update(priority_orchestrator.build(
            request_data=data,
            legacy_response=response,
            source='ai_module',
            research_result=research_result,
        ))

        return jsonify(response)

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error saat generate rekomendasi: {str(e)}',
        }), 500


@app.route('/recommend/health', methods=['GET'])
def recommend_health():
    """Health check untuk recommendation engine."""
    return jsonify({
        'status': 'ok',
        'service': 'Priority Recommendation Compatibility Orchestrator',
        'framework': priority_orchestrator.framework_name,
        'compatibility_mode': True,
        'research_engine_version': 'batch4_research_integration',
        'model_artifact': os.path.basename(model_artifact_path or resolve_model_path()),
        'rule_engine': 'Operational Labeling Guideline R1-R12',
        'framework_stages': priority_orchestrator.framework_stages,
        'engines': [
            'Priority Recommendation Orchestrator',
            'Operational Rule Engine R1-R12',
            'Trained Decision Tree Model',
            'SAW',
            'Ranking',
            'Estimation',
            'Explainable',
        ],
        'legacy_engines': ['SAW', 'Ranking', 'Estimation', 'Explainable'],
        'weights': saw_engine.weights,
        'constraints': ranking_engine.get_constraint_config(),
        'timestamp': datetime.now().isoformat(),
    })


# ─── Main ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 50)
    print('  AI Module - Priority Recommendation Compatibility Layer')
    print('=' * 50)

    load_model()

    PORT = int(os.environ.get('AI_PORT', 5001))
    print(f'\n🚀 Flask server berjalan di http://localhost:{PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=True)
