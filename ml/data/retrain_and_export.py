"""
Retrain GBC models and export .pkl files.
Runs INSIDE the Docker container with sklearn 1.7.2 + Python 3.11.
"""
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import time
import json
import os
import joblib

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.base import clone

# ── Constants ──
DATA_PATH = '/input/train.csv'
OUTPUT_DIR = '/output'
HORIZONS = [5, 10, 15]
TRAIN_FRAC = 0.70
RANDOM_STATE = 42

KPI_ONLY_COLS = ['roll_mean', 'roll_max', 'roll_std', 'roll_slope', 'first_diff']
LOG_PROXY_COLS = ['error_rate', 'warn_rate', 'severity_change_flag']
KPI_PLUS_LOGS_COLS = KPI_ONLY_COLS + LOG_PROXY_COLS
FEATURE_ORDER = KPI_PLUS_LOGS_COLS  # for reference

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Cell 2: Load data ──
print("Loading data...")
df = pd.read_csv(DATA_PATH)
print(f'Loaded {len(df):,} rows, {df["KPI ID"].nunique()} KPIs')

kpi_meta = []
for kpi_id, grp in df.groupby('KPI ID'):
    grp_sorted = grp.sort_values('timestamp')
    diffs = grp_sorted['timestamp'].diff().dropna()
    interval_sec = int(diffs.median())
    kpi_meta.append({'KPI ID': kpi_id, 'interval_sec': interval_sec})
kpi_meta_df = pd.DataFrame(kpi_meta)
kpi_interval = dict(zip(kpi_meta_df['KPI ID'], kpi_meta_df['interval_sec']))

# ── Cell 3: Forward labels ──
def construct_forward_labels(labels, n_forward_steps):
    window = n_forward_steps + 1
    reversed_labels = labels.iloc[::-1].reset_index(drop=True)
    forward = reversed_labels.rolling(window=window, min_periods=1).max()
    forward = forward.iloc[::-1].reset_index(drop=True)
    forward.index = labels.index
    return forward.astype(int)

# ── Cell 4: Apply forward labels ──
print("Computing forward labels...")
df = df.sort_values(['KPI ID', 'timestamp']).reset_index(drop=True)
for H in HORIZONS:
    col = f'label_H{H}'
    parts = []
    for kpi_id, grp in df.groupby('KPI ID'):
        interval = kpi_interval[kpi_id]
        n_forward = H * 60 // interval
        fwd = construct_forward_labels(grp['label'], n_forward)
        parts.append(fwd)
    df[col] = pd.concat(parts)

# ── Cell 5: KPI features ──
def compute_kpi_features(values, window_steps):
    w = max(window_steps, 2)
    roll = values.rolling(window=w, min_periods=w)
    features = pd.DataFrame(index=values.index)
    features['roll_mean'] = roll.mean()
    features['roll_max'] = roll.max()
    features['roll_std'] = roll.std(ddof=0)
    x_range = np.arange(w, dtype=float)
    x_mean = x_range.mean()
    x_var = ((x_range - x_mean) ** 2).sum()
    def slope_func(y):
        if len(y) < w:
            return np.nan
        return np.sum((x_range - x_mean) * (y - y.mean())) / x_var
    features['roll_slope'] = roll.apply(slope_func, raw=True)
    features['first_diff'] = values.diff()
    return features

# ── Cell 6: Log-proxy features ──
def compute_log_proxy_features(values, window_steps):
    w = max(window_steps, 2)
    features = pd.DataFrame(index=values.index)
    roll_mean = values.rolling(window=w, min_periods=w).mean()
    roll_std = values.rolling(window=w, min_periods=w).std(ddof=0)
    z_score = ((values - roll_mean) / roll_std.replace(0, np.nan)).fillna(0)
    z_spike = (z_score.abs() > 3).astype(float)
    features['error_rate'] = z_spike.rolling(window=w, min_periods=w).mean()
    diff = values.diff().abs()
    large_jump = (diff > 2 * roll_std).astype(float)
    features['warn_rate'] = large_jump.rolling(window=w, min_periods=w).mean()
    err_prev = features['error_rate'].shift(w)
    warn_prev = features['warn_rate'].shift(w)
    err_change = (features['error_rate'] - err_prev).abs() / err_prev.replace(0, np.nan)
    warn_change = (features['warn_rate'] - warn_prev).abs() / warn_prev.replace(0, np.nan)
    features['severity_change_flag'] = (
        (err_change.fillna(0) > 0.5) | (warn_change.fillna(0) > 0.5)
    ).astype(int)
    return features

# ── Cell 7: Build feature matrices ──
feature_data = {}
for H in HORIZONS:
    print(f'\nBuilding features for H={H}...')
    label_col = f'label_H{H}'
    all_kpi_features = []
    for kpi_id, grp in df.groupby('KPI ID'):
        grp = grp.copy()
        interval = kpi_interval[kpi_id]
        window_steps = H * 60 // interval
        kpi_feats = compute_kpi_features(grp['value'], window_steps)
        log_feats = compute_log_proxy_features(grp['value'], window_steps)
        feat_df = pd.concat([kpi_feats, log_feats], axis=1)
        feat_df['label_fwd'] = grp[label_col].values
        feat_df['label_orig'] = grp['label'].values
        feat_df['timestamp'] = grp['timestamp'].values
        feat_df['KPI_ID'] = kpi_id
        feat_df['interval_sec'] = interval
        feat_df = feat_df.dropna(subset=KPI_PLUS_LOGS_COLS)
        n = len(feat_df)
        split_idx = int(n * TRAIN_FRAC)
        feat_df['split'] = 'test'
        feat_df.iloc[:split_idx, feat_df.columns.get_loc('split')] = 'train'
        train_mask = feat_df['split'] == 'train'
        for col in KPI_PLUS_LOGS_COLS:
            mu = feat_df.loc[train_mask, col].mean()
            sigma = feat_df.loc[train_mask, col].std()
            if sigma == 0 or np.isnan(sigma):
                sigma = 1.0
            feat_df[col] = (feat_df[col] - mu) / sigma
        all_kpi_features.append(feat_df)
    combined = pd.concat(all_kpi_features, ignore_index=True)
    train = combined[combined['split'] == 'train']
    test = combined[combined['split'] == 'test']
    for fset, cols in [('KPI_PLUS_LOGS', KPI_PLUS_LOGS_COLS)]:
        feature_data[(H, fset)] = {
            'X_train': train[cols].values.astype(np.float32),
            'y_train': train['label_fwd'].values.astype(int),
            'X_test': test[cols].values.astype(np.float32),
            'y_test': test['label_fwd'].values.astype(int),
            'meta_train': train[['timestamp', 'KPI_ID', 'label_orig', 'interval_sec']].reset_index(drop=True),
            'meta_test': test[['timestamp', 'KPI_ID', 'label_orig', 'interval_sec']].reset_index(drop=True),
        }
    print(f'  Train: {len(train):,} | Test: {len(test):,}')

# ── Cell 8+9: Train GBC models ──
MODEL_TEMPLATE = GradientBoostingClassifier(
    n_estimators=100, max_depth=3, learning_rate=0.1, random_state=RANDOM_STATE
)

trained_models = {}
predictions = {}
calibrated_thresholds = {}

for H in HORIZONS:
    fset = 'KPI_PLUS_LOGS'
    fd = feature_data[(H, fset)]
    X_train, y_train = fd['X_train'], fd['y_train']
    X_test = fd['X_test']

    print(f'\nTraining GBC H={H}...', end=' ')
    model = clone(MODEL_TEMPLATE)
    t0 = time.time()
    model.fit(X_train, y_train)
    print(f'{time.time()-t0:.1f}s')

    train_scores = model.predict_proba(X_train)[:, 1]
    test_scores = model.predict_proba(X_test)[:, 1]

    key = (H, fset, 'GBC')
    trained_models[key] = model
    predictions[key] = {'train_scores': train_scores, 'test_scores': test_scores}

    # ── Cell 10+11: Calibrate thresholds ──
    meta_train = fd['meta_train']
    thresholds = {}
    for kpi_id in meta_train['KPI_ID'].unique():
        mask = (meta_train['KPI_ID'].values == kpi_id)
        normal_mask = mask & (y_train == 0)
        normal_scores = train_scores[normal_mask]
        interval = meta_train.loc[mask, 'interval_sec'].iloc[0]
        steps_per_day = 24 * 3600 / interval
        target_fpr = 1.0 / steps_per_day
        if len(normal_scores) > 0:
            threshold = float(np.quantile(normal_scores, 1.0 - target_fpr))
        else:
            threshold = 0.5
        thresholds[kpi_id] = threshold
    calibrated_thresholds[H] = thresholds

# ── Export ──
print('\n=== Exporting artifacts ===')

for H in HORIZONS:
    path = f'{OUTPUT_DIR}/model_h{H}.pkl'
    joblib.dump(trained_models[(H, 'KPI_PLUS_LOGS', 'GBC')], path)
    size = os.path.getsize(path) / 1024
    print(f'  {path}: {size:.1f} KB')

# Thresholds
thresholds_export = {}
for H in HORIZONS:
    thresholds_export[str(H)] = {k: round(v, 6) for k, v in calibrated_thresholds[H].items()}
with open(f'{OUTPUT_DIR}/thresholds.json', 'w') as f:
    json.dump(thresholds_export, f, indent=2)
print(f'  thresholds.json written')

# Feature importances
model_best = trained_models[(15, 'KPI_PLUS_LOGS', 'GBC')]
importances = model_best.feature_importances_
fi_data = [
    {'feature': name, 'importance': round(float(imp), 4),
     'type': 'log' if name in LOG_PROXY_COLS else 'kpi'}
    for name, imp in sorted(zip(FEATURE_ORDER, importances), key=lambda x: -x[1])
]
with open(f'{OUTPUT_DIR}/feature_importances.json', 'w') as f:
    json.dump(fi_data, f, indent=2)
print(f'  feature_importances.json written')

import sklearn
print(f'\nsklearn version: {sklearn.__version__}')
print(f'numpy version: {np.__version__}')
print('DONE. All artifacts in /output/')
