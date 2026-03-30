import os
import json
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")

simconfig_table = dynamodb.Table(os.environ["SIMCONFIG_TABLE"])
kpi_table = dynamodb.Table(os.environ["KPI_TABLE"])
log_table = dynamodb.Table(os.environ["LOG_TABLE"])
feature_table = dynamodb.Table(os.environ["FEATURE_TABLE"])
alerts_table = dynamodb.Table(os.environ["ALERTS_TABLE"])
incidents_table = dynamodb.Table(os.environ["INCIDENTS_TABLE"])

CONFIG_KEY = "simulation"

SERVICES = [
    "web-api-001",
    "db-pool-001",
    "mq-001",
    "auth-001",
    "ml-pipeline-001",
]

SCENARIOS = {
    "web_api_degradation": {"name": "Web API Degradation", "total_ticks": 15},
    "db_cascade_failure": {"name": "DB Cascade Failure", "total_ticks": 15},
    "mq_backlog": {"name": "Message Queue Backlog", "total_ticks": 15},
    "auth_service_failure": {"name": "Auth Service Failure", "total_ticks": 15},
    "ml_pipeline_drift": {"name": "ML Pipeline Drift", "total_ticks": 15},
    "baseline": {"name": "Normal Operations", "total_ticks": 15},
}

PHASE_MAP = {
    "web_api_degradation": [
        (0, 5, "Normal"),
        (5, 8, "Degrading"),
        (8, 12, "Incident"),
        (12, 15, "Recovery"),
    ],
    "db_cascade_failure": [
        (0, 5, "Normal"),
        (5, 8, "Degrading"),
        (8, 12, "Incident"),
        (12, 15, "Recovery"),
    ],
    "mq_backlog": [
        (0, 5, "Normal"),
        (5, 8, "Degrading"),
        (8, 12, "Incident"),
        (12, 15, "Recovery"),
    ],
    "auth_service_failure": [
        (0, 5, "Normal"),
        (5, 8, "Degrading"),
        (8, 12, "Incident"),
        (12, 15, "Recovery"),
    ],
    "ml_pipeline_drift": [
        (0, 5, "Normal"),
        (5, 8, "Degrading"),
        (8, 12, "Incident"),
        (12, 15, "Recovery"),
    ],
    "baseline": [
        (0, 15, "Normal"),
    ],
}

SCENARIO_ALIASES = {
    "web-api-degradation": "web_api_degradation",
    "db-cascade-failure": "db_cascade_failure",
    "mq-backlog": "mq_backlog",
    "auth-service-failure": "auth_service_failure",
    "ml-pipeline-drift": "ml_pipeline_drift",
    "baseline": "baseline",
    "web_api_degradation": "web_api_degradation",
    "db_cascade_failure": "db_cascade_failure",
    "mq_backlog": "mq_backlog",
    "auth_service_failure": "auth_service_failure",
    "ml_pipeline_drift": "ml_pipeline_drift",
}


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


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


def get_owner_id(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return claims.get("sub")


def get_method_and_path(event):
    request_context = event.get("requestContext", {})
    if "http" in request_context:
        return (
            request_context["http"].get("method", ""),
            event.get("rawPath", "")
        )
    return (
        event.get("httpMethod", ""),
        event.get("path", "")
    )


def normalize_scenario(raw_scenario):
    if not raw_scenario:
        return "web_api_degradation"
    return SCENARIO_ALIASES.get(raw_scenario, raw_scenario)


def get_phase(scenario, tick):
    phases = PHASE_MAP.get(scenario, PHASE_MAP["baseline"])
    for start, end, label in phases:
        if start <= tick < end:
            return label
    return "Completed"


def delete_partition(table, pk_name, pk_value):
    key_attribute_names = [entry["AttributeName"] for entry in table.key_schema]

    with table.batch_writer() as batch:
        result = table.query(
            KeyConditionExpression=Key(pk_name).eq(pk_value)
        )
        while True:
            for item in result.get("Items", []):
                delete_key = {
                    attr_name: item[attr_name]
                    for attr_name in key_attribute_names
                }
                batch.delete_item(Key=delete_key)

            if "LastEvaluatedKey" not in result:
                break

            result = table.query(
                KeyConditionExpression=Key(pk_name).eq(pk_value),
                ExclusiveStartKey=result["LastEvaluatedKey"]
            )


def reset_user_data(owner_id):
    print(f"RESETTING DATA FOR {owner_id}")

    for service_id in SERVICES:
        owner_service = f"{owner_id}#{service_id}"
        delete_partition(kpi_table, "owner_service", owner_service)
        delete_partition(log_table, "owner_service", owner_service)
        delete_partition(feature_table, "owner_service", owner_service)

    delete_partition(alerts_table, "owner_id", owner_id)
    delete_partition(incidents_table, "owner_id", owner_id)


def get_config(owner_id):
    result = simconfig_table.get_item(
        Key={"owner_id": owner_id, "config_key": CONFIG_KEY}
    )
    return result.get("Item")


def build_state_response(item):
    running = bool(item.get("running", False))
    tick = int(item.get("tick", 0))
    scenario_key = item.get("active_scenario", "baseline")
    scenario_info = SCENARIOS.get(scenario_key, SCENARIOS["baseline"])
    phase = get_phase(scenario_key, tick) if running else "Stopped"

    return {
        "scenario": scenario_info["name"],
        "phase": phase,
        "tick": tick,
        "totalTicks": scenario_info["total_ticks"],
        "predictionsProcessed": tick * 5,
        "status": "running" if running else "stopped"
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

        if method == "POST" and path.endswith("/simulation/start"):
            body = {}
            raw_body = event.get("body")
            if raw_body:
                try:
                    body = json.loads(raw_body)
                except json.JSONDecodeError:
                    return response(400, {
                        "error": "BadRequest",
                        "message": "Request body must be valid JSON"
                    })

            requested_scenario = body.get("scenario", "web-api-degradation")
            scenario = normalize_scenario(requested_scenario)

            if scenario not in SCENARIOS:
                return response(400, {
                    "error": "BadRequest",
                    "message": f"Unsupported scenario: {requested_scenario}"
                })

            reset_user_data(owner_id)

            simconfig_table.put_item(
                Item={
                    "owner_id": owner_id,
                    "config_key": CONFIG_KEY,
                    "running": True,
                    "tick": 0,
                    "active_scenario": scenario,
                    "updated_at": now_iso(),
                }
            )

            return response(200, {
                "scenario": requested_scenario
            })

        if method == "POST" and path.endswith("/simulation/stop"):
            simconfig_table.update_item(
                Key={"owner_id": owner_id, "config_key": CONFIG_KEY},
                UpdateExpression="SET running = :r, updated_at = :u",
                ExpressionAttributeValues={
                    ":r": False,
                    ":u": now_iso(),
                }
            )

            return response(200, {})

        if method == "GET" and (
            path.endswith("/simulation/state") or path.endswith("/simulation/status")
        ):
            item = get_config(owner_id)
            if not item:
                return response(404, {
                    "error": "NotFound",
                    "message": "Simulation config not found"
                })

            return response(200, build_state_response(item))

        return response(404, {
            "error": "NotFound",
            "message": "Route not found"
        })

    except Exception as e:
        print("CONTROL_SIMULATION_ERROR", str(e))
        return response(500, {
            "error": "InternalServerError",
            "message": str(e)
        })
