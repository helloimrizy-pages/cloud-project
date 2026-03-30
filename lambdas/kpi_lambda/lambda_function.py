import os
import json
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
kpi_table = dynamodb.Table(os.environ["KPI_TABLE"])

SERVICE_METRIC_KEY = {
    "web-api-001": "response_time_ms",
    "db-pool-001": "query_duration_avg_ms",
    "mq-001": "queue_depth",
    "auth-001": "auth_latency_ms",
    "ml-pipeline-001": "inference_latency_ms",
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


def get_path_param(event, key):
    return event.get("pathParameters", {}).get(key)


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


def lambda_handler(event, context):
    try:
        method, path = get_method_and_path(event)

        if method == "GET" and path.startswith("/kpi/"):
            owner_id = get_owner_id(event)
            if not owner_id:
                return response(401, {
                    "error": "Unauthorized",
                    "message": "Missing authenticated user identity",
                })

            service_id = get_path_param(event, "serviceId")
            if not service_id:
                return response(400, {
                    "error": "BadRequest",
                    "message": "Missing serviceId",
                })

            metric_key = SERVICE_METRIC_KEY.get(service_id)
            if not metric_key:
                return response(404, {
                    "error": "NotFound",
                    "message": "Unknown serviceId",
                })

            owner_service = build_owner_service(owner_id, service_id)

            result = kpi_table.query(
                KeyConditionExpression=Key("owner_service").eq(owner_service),
                ScanIndexForward=True,
            )
            items = result.get("Items", [])

            series = []
            for item in items:
                metrics = item.get("metrics", {})
                value = metrics.get(metric_key)
                if value is None:
                    continue

                series.append({
                    "minute": int(item.get("simulator_tick", 0)),
                    "timestamp": item.get("timestamp"),
                    "value": value,
                    "predictionScore": item.get("predictionScore", 0),
                })

            series.sort(key=lambda x: x["minute"])
            return response(200, series)

        return response(404, {
            "error": "NotFound",
            "message": "Route not found",
        })

    except Exception as e:
        return response(500, {
            "error": "InternalServerError",
            "message": str(e),
        })