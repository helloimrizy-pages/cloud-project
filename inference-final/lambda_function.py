import json, os, time, uuid
from decimal import Decimal
import boto3
import joblib
import numpy as np

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
alerts_table = dynamodb.Table(os.environ.get('ALERTS_TABLE', 'Alerts'))
incidents_table = dynamodb.Table(os.environ.get('INCIDENTS_TABLE', 'Incidents'))
kpi_table = dynamodb.Table(os.environ.get('KPI_TABLE', 'KPIMetrics'))
sim_table = dynamodb.Table(os.environ.get('SIM_TABLE', 'SimConfig'))

BUCKET = os.environ.get('MODEL_BUCKET', 'cloud-project-dashboard1')
HORIZONS = [5, 10, 15]

FEATURE_ORDER = [
    'roll_mean', 'roll_max', 'roll_std', 'roll_slope',
    'first_diff', 'error_rate', 'warn_rate',
    'severity_change_flag'
]

SERVICE_INFO = {
    'web-api-001': {'name': 'Web API', 'metric': 'response time'},
    'db-pool-001': {'name': 'DB Pool', 'metric': 'query duration'},
    'mq-001': {'name': 'Message Queue', 'metric': 'queue depth'},
    'auth-001': {'name': 'Auth Service', 'metric': 'auth latency'},
    'ml-pipeline-001': {'name': 'ML Pipeline', 'metric': 'inference latency'},
}

_models = {}
_thresholds = {}


def load_model(horizon):
    if horizon not in _models:
        path = f'/tmp/model_h{horizon}.pkl'
        s3.download_file(BUCKET, f'models/model_h{horizon}.pkl', path)
        _models[horizon] = joblib.load(path)
    return _models[horizon]


def load_thresholds():
    if not _thresholds:
        path = '/tmp/thresholds.json'
        s3.download_file(BUCKET, 'models/thresholds.json', path)
        with open(path) as f:
            data = json.load(f)
        for h_str, kpi_map in data.items():
            _thresholds[int(h_str)] = {
                k: float(v) for k, v in kpi_map.items()
            }
    return _thresholds


def get_sim_tick():
    try:
        resp = sim_table.get_item(Key={'config_key': 'simulation'})
        item = resp.get('Item', {})
        val = item.get('value', {})
        if isinstance(val, str):
            val = json.loads(val)
        return int(val.get('tick', 0))
    except Exception:
        return 0


def get_default_threshold(horizon):
    return {5: 0.912, 10: 0.867, 15: 0.847}.get(horizon, 0.85)


def determine_severity(score, threshold):
    ratio = score / threshold if threshold > 0 else 1.0
    if ratio >= 1.1:
        return 'CRITICAL'
    elif ratio >= 1.0:
        return 'WARNING'
    else:
        return 'INFO'


def update_kpi_prediction_score(service_id, timestamp, score):
    try:
        kpi_table.update_item(
            Key={'service_id': service_id, 'timestamp': timestamp},
            UpdateExpression='SET predictionScore = :s',
            ExpressionAttributeValues={':s': Decimal(str(round(score, 4)))}
        )
    except Exception as e:
        print(f'Warning: could not update KPI score: {e}')


def create_alert(service_id, timestamp, score, threshold, horizon, tick):
    info = SERVICE_INFO.get(service_id, {'name': service_id, 'metric': 'metric'})
    alert_id = f'ALT-{uuid.uuid4().hex[:6].upper()}'
    severity = determine_severity(score, threshold)
    alert_item = {
        'alert_id': alert_id,
        'timestamp': timestamp,
        'service_id': service_id,
        'service_name': info['name'],
        'severity': severity,
        'prediction_score': Decimal(str(round(score, 4))),
        'threshold': Decimal(str(round(threshold, 4))),
        'horizon_minutes': horizon,
        'status': 'active',
        'acknowledged': False,
        'confidence_score': Decimal(str(round(score, 4))),
        'description': f'Predicted incident: {info["metric"]} degradation within {horizon} minutes',
        'simulation_tick': tick,
        'ttl': int(time.time()) + 86400,
    }
    alerts_table.put_item(Item=alert_item)
    print(f'ALERT CREATED: {alert_id} | {service_id} | H={horizon} | score={score:.3f} > thresh={threshold:.3f}')
    return alert_item


def try_group_into_incident(alert_item):
    service_id = alert_item['service_id']
    timestamp = alert_item['timestamp']
    resp = alerts_table.scan(
        FilterExpression='#s = :active AND #ts > :cutoff',
        ExpressionAttributeNames={'#s': 'status', '#ts': 'timestamp'},
        ExpressionAttributeValues={
            ':active': 'active',
            ':cutoff': timestamp[:16].replace(timestamp[13:16],
                str(max(0, int(timestamp[14:16])-5)).zfill(2)),
        }
    )
    related_alerts = resp.get('Items', [])
    if len(related_alerts) >= 2:
        affected = list(set(a['service_id'] for a in related_alerts))
        affected_names = [SERVICE_INFO.get(s, {}).get('name', s) for s in affected]
        incident_id = f'INC-{uuid.uuid4().hex[:6].upper()}'
        tick = int(alert_item.get('simulation_tick', 0))
        incident = {
            'incident_id': incident_id,
            'created_at': timestamp,
            'title': f'{"/".join(affected_names)} Degradation',
            'affected_services': affected_names,
            'alert_ids': [a['alert_id'] for a in related_alerts],
            'severity': 'CRITICAL',
            'status': 'active',
            'lead_time_minutes': 0,
            'remarks': '',
            'ttl': int(time.time()) + 86400,
        }
        incidents_table.put_item(Item=incident)
        print(f'INCIDENT CREATED: {incident_id}')


def handler(event, context):
    thresholds = load_thresholds()
    tick = get_sim_tick()
    for record in event.get('Records', []):
        if record['eventName'] not in ('INSERT', 'MODIFY'):
            continue
        new_image = record['dynamodb'].get('NewImage', {})
        service_id = new_image.get('service_id', {}).get('S', '')
        timestamp = new_image.get('timestamp', {}).get('S', '')
        features_raw = new_image.get('features', {}).get('M', {})
        if not service_id or not features_raw:
            continue
        feature_vector = []
        for fname in FEATURE_ORDER:
            val = features_raw.get(fname, {}).get('N', '0')
            feature_vector.append(float(val))
        X = np.array([feature_vector])
        best_score = 0.0
        for H in HORIZONS:
            model = load_model(H)
            score = float(model.predict_proba(X)[0, 1])
            threshold = get_default_threshold(H)
            best_score = max(best_score, score)
            if score > threshold:
                alert = create_alert(service_id, timestamp, score, threshold, H, tick)
                try_group_into_incident(alert)
        update_kpi_prediction_score(service_id, timestamp, best_score)
    return {'statusCode': 200}
