"""
train.py — Script Training Model C4.5 (Decision Tree dengan Entropy)
=====================================================================
Algoritma C4.5 diimplementasikan menggunakan scikit-learn DecisionTreeClassifier
dengan criterion='entropy' (information gain), yang merupakan inti dari C4.5.

Fitur yang digunakan:
  - nama_customer  : Nama pelanggan
  - nama_driver    : Nama driver
  - area_pengantaran: Area tujuan pengiriman
  - jadwal_terima  : Jadwal penerimaan pelanggan
  - cut_off_jam    : Batas waktu cut-off

Target:
  - status_prioritas: Prioritas / Normal
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder
import joblib

# ─── Paths ────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, '..', 'dataset_invoice_simulasi.csv')
MODEL_DIR = os.path.join(BASE_DIR, 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'c45_model.pkl')
ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoders.pkl')
METADATA_PATH = os.path.join(MODEL_DIR, 'model_metadata.json')

# Pastikan folder model ada
os.makedirs(MODEL_DIR, exist_ok=True)

# ─── Feature columns ─────────────────────────────────────────────
FEATURE_COLS = [
    'nama_customer',
    'nama_driver',
    'area_pengantaran',
    'jadwal_terima',
    'cut_off_jam',
]
TARGET_COL = 'status_prioritas'


def load_dataset(path: str) -> pd.DataFrame:
    """Load dan validasi dataset CSV."""
    print(f'\n📂 Memuat dataset dari: {path}')
    df = pd.read_csv(path)
    print(f'   Jumlah baris : {len(df)}')
    print(f'   Kolom        : {list(df.columns)}')

    # Validasi kolom yang dibutuhkan
    required = FEATURE_COLS + [TARGET_COL]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'Kolom tidak ditemukan dalam dataset: {missing}')

    # Bersihkan whitespace
    for col in required:
        df[col] = df[col].astype(str).str.strip()

    # Hapus baris dengan nilai kosong
    before = len(df)
    df.dropna(subset=required, inplace=True)
    if len(df) < before:
        print(f'   ⚠️  {before - len(df)} baris dihapus karena nilai kosong')

    print(f'\n📊 Distribusi target ({TARGET_COL}):')
    print(df[TARGET_COL].value_counts().to_string())
    return df


def encode_features(df: pd.DataFrame):
    """
    Encode fitur kategorikal menggunakan LabelEncoder.
    Returns: X (numpy array), y (numpy array), encoders (dict)
    """
    encoders = {}
    X_encoded = pd.DataFrame()

    for col in FEATURE_COLS:
        le = LabelEncoder()
        X_encoded[col] = le.fit_transform(df[col])
        encoders[col] = le
        print(f'   ✅ {col}: {len(le.classes_)} kelas → {list(le.classes_[:5])}{"..." if len(le.classes_) > 5 else ""}')

    # Encode target
    le_target = LabelEncoder()
    y = le_target.fit_transform(df[TARGET_COL])
    encoders['__target__'] = le_target
    print(f'   ✅ {TARGET_COL}: {list(le_target.classes_)}')

    return X_encoded.values, y, encoders


def train_model(X_train, y_train):
    """
    Train Decision Tree dengan criterion='entropy' (C4.5).
    C4.5 menggunakan information gain (entropy) untuk memilih fitur split terbaik.
    """
    model = DecisionTreeClassifier(
        criterion='entropy',       # C4.5 menggunakan entropy / information gain
        max_depth=None,            # Biarkan tree tumbuh penuh
        min_samples_split=5,       # Minimal 5 sampel untuk split
        min_samples_leaf=2,        # Minimal 2 sampel di leaf
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def evaluate_model(model, X_test, y_test, le_target):
    """Evaluasi performa model."""
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    target_names = list(le_target.classes_)
    report = classification_report(y_test, y_pred, target_names=target_names)
    cm = confusion_matrix(y_test, y_pred)

    print(f'\n📈 Accuracy: {acc:.4f} ({acc*100:.2f}%)')
    print(f'\n📋 Classification Report:\n{report}')
    print(f'📊 Confusion Matrix:\n{cm}')

    return acc, report


def main():
    print('=' * 60)
    print('  TRAINING MODEL C4.5 — Invoice Priority Classification')
    print('=' * 60)

    # 1. Load dataset
    df = load_dataset(DATASET_PATH)

    # 2. Encode features
    print('\n🔧 Encoding fitur kategorikal...')
    X, y, encoders = encode_features(df)

    # 3. Split data (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f'\n📦 Split data: {len(X_train)} train, {len(X_test)} test')

    # 4. Train model
    print('\n🚀 Training Decision Tree (C4.5 - entropy)...')
    model = train_model(X_train, y_train)
    print(f'   Kedalaman tree: {model.get_depth()}')
    print(f'   Jumlah leaf   : {model.get_n_leaves()}')

    # 5. Evaluate
    le_target = encoders['__target__']
    acc, report = evaluate_model(model, X_test, y_test, le_target)

    # 6. Print tree rules
    print('\n🌳 Decision Tree Rules:')
    tree_rules = export_text(model, feature_names=FEATURE_COLS, max_depth=5)
    print(tree_rules[:2000])  # Print first 2000 chars
    if len(tree_rules) > 2000:
        print(f'   ... (dipotong, total {len(tree_rules)} karakter)')

    # 7. Feature importance
    print('\n📊 Feature Importance:')
    importances = model.feature_importances_
    for col, imp in sorted(zip(FEATURE_COLS, importances), key=lambda x: -x[1]):
        bar = '█' * int(imp * 40)
        print(f'   {col:25s} {imp:.4f} {bar}')

    # 8. Save model & encoders
    joblib.dump(model, MODEL_PATH)
    print(f'\n💾 Model disimpan ke: {MODEL_PATH}')

    joblib.dump(encoders, ENCODER_PATH)
    print(f'💾 Encoders disimpan ke: {ENCODER_PATH}')

    # 9. Save metadata
    metadata = {
        'trained_at': datetime.now().isoformat(),
        'accuracy': round(acc, 4),
        'dataset_rows': int(len(df)),
        'train_size': int(len(X_train)),
        'test_size': int(len(X_test)),
        'tree_depth': int(model.get_depth()),
        'tree_leaves': int(model.get_n_leaves()),
        'features': FEATURE_COLS,
        'target_classes': list(le_target.classes_),
        'feature_importance': {
            col: round(float(imp), 4)
            for col, imp in zip(FEATURE_COLS, importances)
        },
    }
    with open(METADATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f'💾 Metadata disimpan ke: {METADATA_PATH}')

    print('\n✅ Training selesai!')
    print('=' * 60)


if __name__ == '__main__':
    main()
