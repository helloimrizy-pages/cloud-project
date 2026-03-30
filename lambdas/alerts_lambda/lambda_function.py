import os
import json
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource("dynamodb")
alerts_table = dynamodb.Table(os.environ.get("ALERTS_TABLE", "Alerts"))


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


def get_path_param(event, key):
    return event.get("pathParameters", {}).get(key)


def format_alert(item):
    return {
        "id": item.get("alert_id", ""),
        "serviceId": item.get("service_id", ""),
        "serviceName": item.get("service_name", ""),
        "severity": item.get("severity", "WARNING"),
        "predictionScore": item.get("prediction_score", item.get("confidence_score", 0)),
        "threshold": item.get("threshold", 0),
        "horizon": item.get("horizon_minutes", 15),
        "leadTime": item.get("lead_time_minutes", 0),
        "firedAt": item.get("created_at", item.get("timestamp", "")),
        "minute": item.get("simulation_tick", 0),
        "acknowledged": item.get("acknowledged", False),
        "description": item.get("description", ""),
    }


def lambda_handler(event, context):
    try:
        method, path = get_method_and_path(event)
        owner_id = get_owner_id(event)

        if not owner_id:
            return response(401, {
                "error": "Unauthorized",
                "message": "Missing authenticated user identity"
            })

        if method == "GET" and path.endswith("/alerts/active"):
            result = alerts_table.query(
                KeyConditionExpression=Key("owner_id").eq(owner_id),
                FilterExpression=Attr("status").eq("active") & Attr("acknowledged").eq(False)
            )
            items = result.get("Items", [])
            return response(200, [format_alert(a) for a in items])

        if method == "GET" and path.endswith("/alerts/history"):
            result = alerts_table.query(
                KeyConditionExpression=Key("owner_id").eq(owner_id)
            )
            items = result.get("Items", [])
            history = [a for a in items if a.get("acknowledged", True) or a.get("status") != "active"]
            return response(200, [format_alert(a) for a in history])

        if method == "POST" and "/alerts/" in path and path.endswith("/acknowledge"):
            alert_id = get_path_param(event, "id")
            if not alert_id:
                return response(400, {"error": "BadRequest", "message": "Missing alert id"})
            result = alerts_table.query(
                KeyConditionExpression=Key("owner_id").eq(owner_id),
                FilterExpression=Attr("alert_id").eq(alert_id)
            )
            items = result.get("Items", [])
            for item in items:
                alerts_table.update_item(
                    Key={"owner_id": owner_id, "created_at": item["created_at"]},
                    UpdateExpression="SET acknowledged = :t, #s = :ack",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":t": True, ":ack": "acknowledged"}
                )
            return response(200, {"acknowledged": True})

        return response(404, {"error": "NotFound", "message": "Route not found"})
    except Exception as e:
        print("ALERTS_LAMBDA_ERROR", str(e))
        return response(500, {"error": "InternalServerError", "message": str(e)})
