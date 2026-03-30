import os
import json
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
incidents_table = dynamodb.Table(os.environ.get("INCIDENTS_TABLE", "Incidents"))


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
        "body": json.dumps(to_json_safe(body))
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


def format_incident(item):
    return {
        "id": item.get("incident_id", ""),
        "title": item.get("title", ""),
        "affectedServices": item.get("affected_services", []),
        "phases": [
            {"label": "Normal", "start": 0, "end": 4, "color": "#2ecc71"},
            {"label": "Alert Fired", "start": 4, "end": 7, "color": "#f39c12"},
            {"label": "Degrading", "start": 7, "end": 9, "color": "#e67e22"},
            {"label": "Incident", "start": 9, "end": 12, "color": "#e74c3c"},
            {"label": "Recovery", "start": 12, "end": 15, "color": "#3498db"},
        ],
        "leadTime": item.get("lead_time_minutes", 38),
        "status": item.get("status", "active"),
        "createdAt": item.get("created_at", ""),
    }


def lambda_handler(event, context):
    try:
        owner_id = get_owner_id(event)
        if not owner_id:
            return response(401, {
                "error": "Unauthorized",
                "message": "Missing authenticated user identity"
            })

        method, path = get_method_and_path(event)

        if method == "GET" and path.endswith("/incidents"):
            result = incidents_table.query(
                KeyConditionExpression=Key("owner_id").eq(owner_id),
                ScanIndexForward=False
            )
            items = result.get("Items", [])
            return response(200, [format_incident(i) for i in items])

        return response(404, {
            "error": "NotFound",
            "message": "Route not found"
        })

    except Exception as e:
        return response(500, {
            "error": "InternalServerError",
            "message": str(e)
        })