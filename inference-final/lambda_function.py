import json, os, time, uuid
from decimal import Decimal
import boto3
import joblib
import numpy as np

s3 = boto3.client('s3')
sns = boto3.client('sns')
dynamodb = boto3.resource('dynamodb')
alerts_table = dynamodb.Table(os.environ.get('ALERTS_TABLE', 'Alerts'))
incidents_table = dynamodb.Table(os.environ.get('INCIDENTS_TABLE', 'Incidents'))
kpi_table = dynamodb.Table(os.environ.get('KPI_TABLE', 'KPIMetrics'))

SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

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


def get_default_threshold(horizon):
    return {5: 0.912, 10: 0.867, 15: 0.847}.get(horizon, 0.85)


def determine_severity(score, threshold):
    if score >= 0.92:
        return 'CRITICAL'
    elif score >= threshold:
        return 'WARNING'
    else:
        return 'INFO'


def update_kpi_prediction_score(owner_service, timestamp, score):
    try:
        kpi_table.update_item(
            Key={'owner_service': owner_service, 'timestamp': timestamp},
            UpdateExpression='SET predictionScore = :s',
            ExpressionAttributeValues={':s': Decimal(str(round(score, 4)))}
        )
    except Exception as e:
        print(f'Warning: could not update KPI score: {e}')


def create_alert(owner_id, service_id, timestamp, score, threshold, horizon, tick):
    info = SERVICE_INFO.get(service_id, {'name': service_id, 'metric': 'metric'})
    alert_id = f'ALT-{uuid.uuid4().hex[:6].upper()}'
    severity = determine_severity(score, threshold)
    now = timestamp
    owner_status = f'{owner_id}#{severity}'
    alert_item = {
        'owner_id': owner_id,
        'created_at': now,
        'alert_id': alert_id,
        'owner_status': owner_status,
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

    if SNS_TOPIC_ARN and owner_id:
        try:
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=f'[{severity}] CloudWatch AI Alert - {info["name"]}',
                Message=(
                    f'CloudWatch AI Alert\n'
                    f'-------------------\n'
                    f'Service: {info["name"]}\n'
                    f'Severity: {severity}\n'
                    f'Prediction Score: {score:.4f} (threshold: {threshold:.4f})\n'
                    f'Horizon: {horizon} minutes\n'
                    f'Description: Predicted incident: {info["metric"]} degradation within {horizon} minutes\n'
                    f'Alert ID: {alert_id}\n'
                    f'Time: {timestamp}\n'
                ),
                MessageAttributes={
                    'owner_id': {
                        'DataType': 'String',
                        'StringValue': owner_id,
                    },
                },
            )
        except Exception as e:
            print(f'SNS publish failed: {e}')

    return alert_item


def try_group_into_incident(owner_id, alert_item):
    timestamp = alert_item['created_at']
    from boto3.dynamodb.conditions import Key, Attr
    resp = alerts_table.query(
        KeyConditionExpression=Key('owner_id').eq(owner_id),
        FilterExpression=Attr('status').eq('active')
    )
    related_alerts = resp.get('Items', [])
    if len(related_alerts) >= 2:
        affected = list(set(a['service_id'] for a in related_alerts))
        affected_names = [SERVICE_INFO.get(s, {}).get('name', s) for s in affected]
        incident_id = f'INC-{uuid.uuid4().hex[:6].upper()}'
        incident = {
            'owner_id': owner_id,
            'created_at': timestamp,
            'incident_id': incident_id,
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
    for record in event.get('Records', []):
        if record['eventName'] not in ('INSERT', 'MODIFY'):
            continue
        new_image = record['dynamodb'].get('NewImage', {})
        owner_service = new_image.get('owner_service', {}).get('S', '')
        service_id = new_image.get('service_id', {}).get('S', '')
        owner_id = new_image.get('owner_id', {}).get('S', '')
        timestamp = new_image.get('timestamp', {}).get('S', '')
        features_raw = new_image.get('features', {}).get('M', {})
        if not service_id or not features_raw or not owner_id:
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
                alert = create_alert(owner_id, service_id, timestamp, score, threshold, H, 0)
                try_group_into_incident(owner_id, alert)
        update_kpi_prediction_score(owner_service, timestamp, best_score)
    return {'statusCode': 200}
