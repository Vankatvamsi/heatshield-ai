"""
HeatShield AI – ML Model Training Script
=========================================

Dataset : data/weather_training.csv  (demo/synthetic data)
Model   : Random Forest Classifier
Output  : models/heatwave_model.pkl
           models/preprocess.joblib
           models/metrics.json

IMPORTANT: The dataset used here is synthetic/demo data.
Metrics displayed are calculated on the demo test split and
do NOT represent scientifically validated operational accuracy.

Usage:
    # From the project root
    python backend/app/ml/train_model.py
"""
import json
import sys
from pathlib import Path

# Ensure the backend package is on the path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[3]
DATA_FILE = ROOT / "data" / "weather_training.csv"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_PATH = MODELS_DIR / "heatwave_model.pkl"
PIPELINE_PATH = MODELS_DIR / "preprocess.joblib"
METRICS_PATH = MODELS_DIR / "metrics.json"


# ─── Feature engineering ─────────────────────────────────────────────────────
def compute_heat_index(temp_c: pd.Series, humidity: pd.Series) -> pd.Series:
    T = temp_c * 9 / 5 + 32
    RH = humidity.clip(0, 100)
    HI = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * RH
        - 0.22475541 * T * RH
        - 0.00683783 * T ** 2
        - 0.05481717 * RH ** 2
        + 0.00122874 * T ** 2 * RH
        + 0.00085282 * T * RH ** 2
        - 0.00000199 * T ** 2 * RH ** 2
    )
    return ((HI - 32) * 5 / 9).rename("heat_index")


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    df["day_of_year"] = df["date"].dt.dayofyear
    df["month"] = df["date"].dt.month
    df["heat_index"] = compute_heat_index(df["temperature"], df["humidity"])
    df["temp_humidity_interaction"] = df["temperature"] * df["humidity"] / 100
    df["temp_anomaly"] = df["temperature"] - df.groupby("city")["temperature"].transform("mean")

    # Rolling stats (3-day window, lag 1 to avoid leakage)
    df = df.sort_values(["city", "date"])
    for city_grp in df["city"].unique():
        mask = df["city"] == city_grp
        df.loc[mask, "rolling_avg_temp"] = (
            df.loc[mask, "temperature"].rolling(3, min_periods=1).mean().shift(1)
        )
        df.loc[mask, "rolling_max_temp"] = (
            df.loc[mask, "max_temperature"].rolling(3, min_periods=1).max().shift(1)
        )
        df.loc[mask, "recent_heatwave_count"] = (
            df.loc[mask, "heatwave"].rolling(7, min_periods=1).sum().shift(1)
        )

    df["rolling_avg_temp"].fillna(df["temperature"], inplace=True)
    df["rolling_max_temp"].fillna(df["max_temperature"], inplace=True)
    df["recent_heatwave_count"].fillna(0, inplace=True)

    return df


FEATURE_COLS = [
    "temperature",
    "max_temperature",
    "min_temperature",
    "humidity",
    "wind_speed",
    "pressure",
    "solar_radiation",
    "precipitation",
    "dew_point",
    "latitude",
    "longitude",
    "day_of_year",
    "month",
    "heat_index",
    "temp_humidity_interaction",
    "temp_anomaly",
    "rolling_avg_temp",
    "rolling_max_temp",
    "recent_heatwave_count",
]
TARGET_COL = "heatwave"


def main():
    print("=" * 60)
    print("HeatShield AI – Model Training")
    print("⚠️  Using DEMO/SYNTHETIC dataset – not official data.")
    print("=" * 60)

    # ── Load data ──────────────────────────────────────────────────
    if not DATA_FILE.exists():
        print(f"❌ Dataset not found at {DATA_FILE}. Run data generation script first.")
        sys.exit(1)

    print(f"📂 Loading dataset from {DATA_FILE}")
    df = pd.read_csv(DATA_FILE)
    print(f"   Rows: {len(df)}, Heatwave rows: {df[TARGET_COL].sum()}")

    # ── Feature engineering ────────────────────────────────────────
    print("🔧 Engineering features…")
    df = engineer_features(df)

    # Drop rows with NaN in features or target
    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])

    X = df[FEATURE_COLS]
    y = df[TARGET_COL].astype(int)
    print(f"   Feature matrix: {X.shape}, Class balance: {y.value_counts().to_dict()}")

    # ── Time-aware train/test split (last 20% as test) ─────────────
    split_idx = int(len(df) * 0.80)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    print(f"   Train: {len(X_train)}, Test: {len(X_test)}")

    # ── Preprocessing pipeline ─────────────────────────────────────
    preprocess = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    X_train_proc = preprocess.fit_transform(X_train)
    X_test_proc = preprocess.transform(X_test)

    # ── Train model ────────────────────────────────────────────────
    print("🤖 Training RandomForestClassifier…")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_proc, y_train)

    # ── Evaluate ───────────────────────────────────────────────────
    print("📊 Evaluating…")
    y_pred = model.predict(X_test_proc)
    y_prob = model.predict_proba(X_test_proc)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"\n   Accuracy : {acc:.3f}")
    print(f"   Precision: {prec:.3f}")
    print(f"   Recall   : {rec:.3f}")
    print(f"   F1 Score : {f1:.3f}")
    print(f"   Confusion Matrix:\n   {cm}")
    print("\n   Full Report:")
    print(classification_report(y_test, y_pred, target_names=["No Heatwave", "Heatwave"]))

    # ── Feature importance ─────────────────────────────────────────
    importances = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print("\n   Top 10 Feature Importances:")
    for feat, imp in sorted_imp[:10]:
        print(f"     {feat:35s}: {imp:.4f}")

    # ── Save model and pipeline ────────────────────────────────────
    joblib.dump(model, MODEL_PATH)
    joblib.dump(preprocess, PIPELINE_PATH)
    print(f"\n✅ Model saved → {MODEL_PATH}")
    print(f"✅ Pipeline saved → {PIPELINE_PATH}")

    # ── Save metrics ───────────────────────────────────────────────
    metrics = {
        "dataset_note": "DEMO/SYNTHETIC dataset. Metrics are for demonstration only.",
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": cm,
        "feature_importance": {k: round(v, 4) for k, v in sorted_imp},
        "feature_cols": FEATURE_COLS,
        "model": "RandomForestClassifier",
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"✅ Metrics saved → {METRICS_PATH}")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
