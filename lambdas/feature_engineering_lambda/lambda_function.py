import json, os, time
from decimal import Decimal
import boto3
import numpy as np

dynamodb = boto3.resource('dynamodb')
kpi_table = dynamodb.Table(os.environ.get('KPI_TABLE', 'KPIMetrics'))
feature_table = dynamodb.Table(os.environ.get('FEATURE_TABLE', 'FeatureStore'))

PRIMARY_METRIC = {
    'web-api-001': 'response_time_ms',
    'db-pool-001': 'query_duration_avg_ms',
    'mq-001': 'queue_depth',
    'auth-001': 'auth_latency_ms',
    'ml-pipeline-001': 'inference_latency_ms',
}

WINDOW_SIZE = 10


def get_recent_values(owner_service, service_id, limit=20):
    resp = kpi_table.query(
        KeyConditionExpression='owner_service = :os',
        ExpressionAttributeValues={':os': owner_service},
        ScanIndexForward=False,
        Limit=limit
    )
    items = sorted(resp.get('Items', []), key=lambda x: x['timestamp'])
    metric_key = PRIMARY_METRIC.get(service_id)
    if not metric_key:
        return []
    values = []
    for item in items:
        metrics = item.get('metrics', {})
        if isinstance(metrics, str):
            metrics = json.loads(metrics)
        val = metrics.get(metric_key)
        if val is not None:
            values.append(float(val))
    return values


def compute_features(values):
    arr = np.array(values, dtype=float)
    w = min(WINDOW_SIZE, len(arr))
    if w < 2:
        return None
    window = arr[-w:]

    roll_mean = float(np.mean(window))
    roll_max = float(np.max(window))
    roll_std = float(np.std(window, ddof=0))

    x = np.arange(w, dtype=float)
    x_mean = x.mean()
    x_var = ((x - x_mean) ** 2).sum()
    roll_slope = float(np.sum((x - x_mean) *
        (window - window.mean())) / x_var) if x_var > 0 else 0.0

    first_diff = float(arr[-1] - arr[-2]) if len(arr) >= 2 else 0.0

    z_scores = (window - roll_mean) / (roll_std if roll_std > 0 else 1.0)
    error_rate = float(np.mean(np.abs(z_scores) > 3))

    diffs = np.abs(np.diff(arr[-w:]))
    warn_rate = float(np.mean(diffs > 2 * roll_std)) if roll_std > 0 else 0.0

    severity_change_flag = 0
    if len(arr) >= 2 * w:
        prev_window = arr[-(2*w):-w]
        prev_std = float(np.std(prev_window, ddof=0))
        prev_z = (prev_window - np.mean(prev_window)) / \
                 (prev_std if prev_std > 0 else 1.0)
        prev_err = float(np.mean(np.abs(prev_z) > 3))
        if prev_err > 0 and abs(error_rate - prev_err)/prev_err > 0.5:
            severity_change_flag = 1

    return {
        'roll_mean': roll_mean,
        'roll_max': roll_max,
        'roll_std': roll_std,
        'roll_slope': roll_slope,
        'first_diff': first_diff,
        'error_rate': error_rate,
        'warn_rate': warn_rate,
        'severity_change_flag': severity_change_flag,
    }


def lambda_handler(event, context):
    for record in event.get('Records', []):
        if record['eventName'] not in ('INSERT', 'MODIFY'):
            continue

        new_image = record['dynamodb'].get('NewImage', {})
        owner_service = new_image.get('owner_service', {}).get('S', '')
        service_id = new_image.get('service_id', {}).get('S', '')
        owner_id = new_image.get('owner_id', {}).get('S', '')
        timestamp = new_image.get('timestamp', {}).get('S', '')

        if not owner_service or not service_id or not timestamp:
            continue

        values = get_recent_values(owner_service, service_id, limit=WINDOW_SIZE*2+1)

        if len(values) < 2:
            print(f'Not enough data for {service_id}: {len(values)} pts')
            continue

        features = compute_features(values)
        if features is None:
            continue

        features_decimal = {
            k: Decimal(str(round(v, 6)))
            for k, v in features.items()
        }

        feature_table.put_item(Item={
            'owner_service': owner_service,
            'owner_id': owner_id,
            'service_id': service_id,
            'timestamp': timestamp,
            'features': features_decimal,
            'primary_metric_name': PRIMARY_METRIC.get(service_id, ''),
            'window_size': WINDOW_SIZE,
            'ttl': int(time.time()) + 86400,
        })

        print(f'Features written: {owner_service} @ {timestamp}')

    return {'statusCode': 200}
