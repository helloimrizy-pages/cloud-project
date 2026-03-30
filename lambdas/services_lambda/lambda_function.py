import os
import json
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
kpi_table = dynamodb.Table(os.environ["KPI_TABLE"])


SERVICE_METADATA = {
    "web-api-001": {
        "name": "Web API",
        "type": "API Gateway",
        "metricName": "Response Time",
        "metricUnit": "ms",
        "metricKey": "response_time_ms",
    },
    "db-pool-001": {
        "name": "DB Pool",
        "type": "Database Pool",
        "metricName": "Query Duration",
        "metricUnit": "ms",
        "metricKey": "query_duration_avg_ms",
    },
    "mq-001": {
        "name": "Message Queue",
        "type": "Message Queue",
        "metricName": "Queue Depth",
        "metricUnit": "messages",
        "metricKey": "queue_depth",
    },
    "auth-001": {
        "name": "Auth Service",
        "type": "Authentication",
        "metricName": "Auth Latency",
        "metricUnit": "ms",
        "metricKey": "auth_latency_ms",
    },
    "ml-pipeline-001": {
        "name": "ML Pipeline",
        "type": "ML Service",
        "metricName": "Inference Latency",
        "metricUnit": "ms",
        "metricKey": "inference_latency_ms",
    },
}


def to_json_safe(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {k: to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json_safe(v) for v in value]
    return value


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(to_json_safe(body)),
    }


def get_method_and_path(event):
    rc = event.get("requestContext", {})
    if "http" in rc:
        return rc["http"].get("method", ""), event.get("rawPath", "")
    return event.get("httpMethod", ""), event.get("path", "")


def get_owner_id(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return claims.get("sub")


def build_owner_service(owner_id, service_id):
    return f"{owner_id}#{service_id}"


def derive_status(service_id, metric_value):
    if service_id == "web-api-001":
        return "critical" if metric_value >= 300 else "warning" if metric_value >= 200 else "healthy"
    if service_id == "db-pool-001":
        return "critical" if metric_value >= 100 else "warning" if metric_value >= 70 else "healthy"
    if service_id == "mq-001":
        return "critical" if metric_value >= 150 else "warning" if metric_value >= 80 else "healthy"
    if service_id == "auth-001":
        return "critical" if metric_value >= 140 else "warning" if metric_value >= 90 else "healthy"
    if service_id == "ml-pipeline-001":
        return "critical" if metric_value >= 180 else "warning" if metric_value >= 120 else "healthy"

    return "healthy"


def get_latest_for_service(owner_id, service_id):
    owner_service = build_owner_service(owner_id, service_id)

    result = kpi_table.query(
        KeyConditionExpression=Key("owner_service").eq(owner_service),
        ScanIndexForward=False,  # newest first
        Limit=1
    )

    items = result.get("Items", [])
    return items[0] if items else None


def build_service_card(service_id, item):
    metadata = SERVICE_METADATA.get(service_id)
    if metadata is None or item is None:
        return None

    metrics = item.get("metrics", {})
    value = metrics.get(metadata["metricKey"], 0)

    return {
        "id": service_id,
        "name": metadata["name"],
        "type": metadata["type"],
        "status": derive_status(service_id, float(value)),
        "metricName": metadata["metricName"],
        "metricUnit": metadata["metricUnit"],
        "currentValue": value,
    }


def fetch_services(owner_id):
    services = []

    for service_id in SERVICE_METADATA.keys():
        latest_item = get_latest_for_service(owner_id, service_id)
        card = build_service_card(service_id, latest_item)
        if card:
            services.append(card)

    services.sort(key=lambda s: s["name"])
    return services


def lambda_handler(event, context):
    try:
        method, path = get_method_and_path(event)

        if method == "GET" and path.endswith("/services"):
            owner_id = get_owner_id(event)
            if not owner_id:
                return response(401, {
                    "error": "Unauthorized",
                    "message": "Missing authenticated user identity"
                })

            services = fetch_services(owner_id)
            return response(200, services)

        return response(404, {
            "error": "NotFound",
            "message": "Route not found"
        })

    except Exception as e:
        return response(500, {
            "error": "InternalServerError",
            "message": str(e)
        })