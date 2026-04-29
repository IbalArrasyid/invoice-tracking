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

# ─── Paths ────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'c45_model.pkl')
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


def load_model():
    """Load model, encoders, dan metadata dari disk."""
    global model, encoders, metadata

    if not os.path.exists(MODEL_PATH):
        print('⚠️  Model belum ada. Jalankan train.py terlebih dahulu.')
        return False

    model = joblib.load(MODEL_PATH)
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

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'AI Module — C4.5 Decision Tree',
        'model_loaded': model is not None,
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
        'data': metadata,
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

        # Encode setiap fitur
        input_values = {
            'nama_customer': nama_customer,
            'nama_driver': nama_driver,
            'area_pengantaran': area,
            'jadwal_terima': jadwal,
            'cut_off_jam': cutoff,
        }

        encoded = []
        for col in FEATURE_COLS:
            val = input_values[col]
            enc = safe_encode(encoders[col], val)
            encoded.append(enc)

        X_input = np.array([encoded])

        # Prediksi
        prediction_idx = model.predict(X_input)[0]
        probabilities = model.predict_proba(X_input)[0]
        confidence = float(np.max(probabilities))

        # Decode target
        le_target = encoders['__target__']
        raw_prediction = le_target.inverse_transform([prediction_idx])[0]

        # Map ke tiga level
        priority = map_to_three_levels(raw_prediction, confidence)
        reason = generate_reason(raw_prediction, confidence, jadwal, cutoff)

        model_version = metadata.get('trained_at', 'unknown')[:10] if metadata else 'unknown'

        return jsonify({
            'priority': priority,
            'confidence': round(confidence, 4),
            'reason': reason,
            'raw_prediction': raw_prediction,
            'model_version': model_version,
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
        global model, encoders, metadata
        model = new_model
        encoders = new_encoders
        metadata = new_metadata

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


# ─── Main ─────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('=' * 50)
    print('  AI Module — C4.5 Invoice Priority Prediction')
    print('=' * 50)

    load_model()

    PORT = int(os.environ.get('AI_PORT', 5001))
    print(f'\n🚀 Flask server berjalan di http://localhost:{PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=True)
