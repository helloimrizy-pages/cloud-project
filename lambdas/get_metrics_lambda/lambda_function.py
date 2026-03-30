import os
import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
kpi_table = dynamodb.Table(os.environ["KPI_TABLE"])


def to_json_safe(value):
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, dict):
        return {k: to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json_safe(v) for v in value]
    return value


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(to_json_safe(body))
    }


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
        owner_id = get_owner_id(event)
        if not owner_id:
            return response(401, {
                "error": "Unauthorized",
                "message": "Missing authenticated user identity"
            })

        query_params = event.get("queryStringParameters") or {}

        service_id = query_params.get("service_id")
        limit_str = query_params.get("limit", "10")

        if not service_id:
            return response(400, {
                "error": "Missing required query parameter: service_id"
            })

        try:
            limit = int(limit_str)
            if limit <= 0:
                raise ValueError
        except ValueError:
            return response(400, {
                "error": "limit must be a positive integer"
            })

        owner_service = build_owner_service(owner_id, service_id)

        result = kpi_table.query(
            KeyConditionExpression=Key("owner_service").eq(owner_service),
            ScanIndexForward=False,
            Limit=limit
        )

        items = [to_json_safe(item) for item in result.get("Items", [])]

        return response(200, {
            "owner_id": owner_id,
            "service_id": service_id,
            "count": len(items),
            "items": items
        })

    except Exception as e:
        return response(500, {
            "error": "Internal server error",
            "message": str(e)
        })