import os
import time
import uuid
import random
from decimal import Decimal
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")

SIMCONFIG_TABLE = os.environ["SIMCONFIG_TABLE"]
KPI_TABLE = os.environ["KPI_TABLE"]
LOG_TABLE = os.environ["LOG_TABLE"]

SIMULATION_CONFIG_KEY = "simulation"

simconfig_table = dynamodb.Table(SIMCONFIG_TABLE)
kpi_table = dynamodb.Table(KPI_TABLE)
log_table = dynamodb.Table(LOG_TABLE)


def to_dynamodb_value(value):
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_dynamodb_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_dynamodb_value(v) for v in value]
    return value


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ttl_24h():
    return int(time.time()) + 86400


def jitter(base, pct=0.1):
    return base + base * random.uniform(-pct, pct)


SCENARIOS = {
    "web_api_degradation": {
        "name": "Web API Degradation",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 5},
            {"label": "Degrading", "start": 5, "end": 8},
            {"label": "Incident", "start": 8, "end": 12},
            {"label": "Recovery", "start": 12, "end": 15},
        ],
        "affected": ["web-api-001", "db-pool-001"],
    },
    "db_cascade_failure": {
        "name": "DB Cascade Failure",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 5},
            {"label": "Degrading", "start": 5, "end": 8},
            {"label": "Incident", "start": 8, "end": 12},
            {"label": "Recovery", "start": 12, "end": 15},
        ],
        "affected": ["db-pool-001", "web-api-001", "mq-001"],
    },
    "mq_backlog": {
        "name": "Message Queue Backlog",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 5},
            {"label": "Degrading", "start": 5, "end": 8},
            {"label": "Incident", "start": 8, "end": 12},
            {"label": "Recovery", "start": 12, "end": 15},
        ],
        "affected": ["mq-001", "web-api-001"],
    },
    "auth_service_failure": {
        "name": "Auth Service Failure",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 5},
            {"label": "Degrading", "start": 5, "end": 8},
            {"label": "Incident", "start": 8, "end": 12},
            {"label": "Recovery", "start": 12, "end": 15},
        ],
        "affected": ["auth-001", "web-api-001"],
    },
    "ml_pipeline_drift": {
        "name": "ML Pipeline Drift",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 5},
            {"label": "Degrading", "start": 5, "end": 8},
            {"label": "Incident", "start": 8, "end": 12},
            {"label": "Recovery", "start": 12, "end": 15},
        ],
        "affected": ["ml-pipeline-001"],
    },
    "baseline": {
        "name": "Normal Operations",
        "total_ticks": 15,
        "phases": [
            {"label": "Normal", "start": 0, "end": 15},
        ],
        "affected": [],
    },
}


def get_phase(scenario_key, tick):
    scenario = SCENARIOS.get(scenario_key, SCENARIOS["baseline"])
    for phase in scenario["phases"]:
        if phase["start"] <= tick < phase["end"]:
            return phase["label"]
    return "Normal"


def is_affected(scenario_key, service_id):
    scenario = SCENARIOS.get(scenario_key, SCENARIOS["baseline"])
    return service_id in scenario["affected"]


def generate_metrics(service_id, service_type, scenario_key, tick):
    phase = get_phase(scenario_key, tick)
    affected = is_affected(scenario_key, service_id)

    if service_type == "web_api":
        if affected and phase == "Degrading":
            progress = (tick - 5) / 3.0
            return {
                "response_time_ms": int(jitter(120 + 180 * progress)),
                "requests_per_second": int(jitter(400 - 100 * progress)),
                "error_rate": round(jitter(0.02 + 0.06 * progress), 4),
                "http_5xx_count": int(jitter(2 + 8 * progress)),
            }
        elif affected and phase == "Incident":
            return {
                "response_time_ms": int(jitter(380 + random.randint(0, 80))),
                "requests_per_second": int(jitter(200)),
                "error_rate": round(jitter(0.12), 4),
                "http_5xx_count": int(jitter(15)),
            }
        elif affected and phase == "Recovery":
            progress = (tick - 12) / 3.0
            return {
                "response_time_ms": int(jitter(380 - 260 * progress)),
                "requests_per_second": int(jitter(200 + 200 * progress)),
                "error_rate": round(jitter(0.12 - 0.10 * progress), 4),
                "http_5xx_count": int(max(0, jitter(15 - 13 * progress))),
            }
        else:
            return {
                "response_time_ms": int(jitter(95)),
                "requests_per_second": int(jitter(450)),
                "error_rate": round(jitter(0.01), 4),
                "http_5xx_count": random.randint(0, 2),
            }

    elif service_type == "database_pool":
        if affected and phase == "Degrading":
            progress = (tick - 5) / 3.0
            return {
                "active_connections": int(jitter(30 + 40 * progress)),
                "query_duration_avg_ms": int(jitter(25 + 100 * progress)),
                "deadlock_count": random.randint(0, int(1 + 3 * progress)),
            }
        elif affected and phase == "Incident":
            return {
                "active_connections": int(jitter(85)),
                "query_duration_avg_ms": int(jitter(180 + random.randint(0, 60))),
                "deadlock_count": random.randint(2, 6),
            }
        elif affected and phase == "Recovery":
            progress = (tick - 12) / 3.0
            return {
                "active_connections": int(jitter(85 - 55 * progress)),
                "query_duration_avg_ms": int(jitter(180 - 150 * progress)),
                "deadlock_count": random.randint(0, max(1, int(4 - 3 * progress))),
            }
        else:
            return {
                "active_connections": int(jitter(28)),
                "query_duration_avg_ms": int(jitter(22)),
                "deadlock_count": 0,
            }

    elif service_type == "message_queue":
        if affected and phase == "Degrading":
            progress = (tick - 5) / 3.0
            return {
                "queue_depth": int(jitter(30 + 150 * progress)),
                "consumer_lag": int(jitter(5 + 30 * progress)),
                "dead_letter_queue_size": random.randint(0, int(2 * progress)),
            }
        elif affected and phase == "Incident":
            return {
                "queue_depth": int(jitter(250 + random.randint(0, 80))),
                "consumer_lag": int(jitter(45)),
                "dead_letter_queue_size": random.randint(2, 8),
            }
        elif affected and phase == "Recovery":
            progress = (tick - 12) / 3.0
            return {
                "queue_depth": int(jitter(250 - 210 * progress)),
                "consumer_lag": int(jitter(45 - 38 * progress)),
                "dead_letter_queue_size": random.randint(0, max(1, int(5 - 4 * progress))),
            }
        else:
            return {
                "queue_depth": int(jitter(25)),
                "consumer_lag": int(jitter(3)),
                "dead_letter_queue_size": 0,
            }

    elif service_type == "auth_service":
        if affected and phase == "Degrading":
            progress = (tick - 5) / 3.0
            return {
                "login_success_rate": round(jitter(0.97 - 0.05 * progress), 4),
                "auth_latency_ms": int(jitter(55 + 60 * progress)),
                "mfa_challenge_rate": round(jitter(0.20 + 0.08 * progress), 4),
            }
        elif affected and phase == "Incident":
            return {
                "login_success_rate": round(jitter(0.88), 4),
                "auth_latency_ms": int(jitter(160)),
                "mfa_challenge_rate": round(jitter(0.35), 4),
            }
        elif affected and phase == "Recovery":
            progress = (tick - 12) / 3.0
            return {
                "login_success_rate": round(jitter(0.88 + 0.09 * progress), 4),
                "auth_latency_ms": int(jitter(160 - 105 * progress)),
                "mfa_challenge_rate": round(jitter(0.35 - 0.15 * progress), 4),
            }
        else:
            return {
                "login_success_rate": round(jitter(0.97), 4),
                "auth_latency_ms": int(jitter(55)),
                "mfa_challenge_rate": round(jitter(0.2), 4),
            }

    elif service_type == "ml_pipeline":
        if affected and phase == "Degrading":
            progress = (tick - 5) / 3.0
            return {
                "inference_latency_ms": int(jitter(90 + 60 * progress)),
                "model_accuracy": round(jitter(0.94 - 0.05 * progress), 4),
                "data_drift_score": round(jitter(0.05 + 0.08 * progress), 4),
            }
        elif affected and phase == "Incident":
            return {
                "inference_latency_ms": int(jitter(190)),
                "model_accuracy": round(jitter(0.85), 4),
                "data_drift_score": round(jitter(0.2), 4),
            }
        elif affected and phase == "Recovery":
            progress = (tick - 12) / 3.0
            return {
                "inference_latency_ms": int(jitter(190 - 100 * progress)),
                "model_accuracy": round(jitter(0.85 + 0.09 * progress), 4),
                "data_drift_score": round(jitter(0.2 - 0.15 * progress), 4),
            }
        else:
            return {
                "inference_latency_ms": int(jitter(90)),
                "model_accuracy": round(jitter(0.94), 4),
                "data_drift_score": round(jitter(0.05), 4),
            }

    return {}


SERVICES = [
    {"service_id": "web-api-001", "service_type": "web_api", "log_level": "INFO", "event_type": "request_summary"},
    {"service_id": "db-pool-001", "service_type": "database_pool", "log_level": "INFO", "event_type": "db_health"},
    {"service_id": "mq-001", "service_type": "message_queue", "log_level": "INFO", "event_type": "queue_health"},
    {"service_id": "auth-001", "service_type": "auth_service", "log_level": "INFO", "event_type": "auth_health"},
    {"service_id": "ml-pipeline-001", "service_type": "ml_pipeline", "log_level": "INFO", "event_type": "pipeline_health"},
]


def scan_active_simulations():
    items = []
    response = simconfig_table.scan(
        FilterExpression=Attr("config_key").eq(SIMULATION_CONFIG_KEY) & Attr("running").eq(True)
    )
    items.extend(response.get("Items", []))

    while "LastEvaluatedKey" in response:
        response = simconfig_table.scan(
            FilterExpression=Attr("config_key").eq(SIMULATION_CONFIG_KEY) & Attr("running").eq(True),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    return items


def stop_user_simulation(owner_id):
    simconfig_table.update_item(
        Key={"owner_id": owner_id, "config_key": SIMULATION_CONFIG_KEY},
        UpdateExpression="SET running = :r, updated_at = :u",
        ExpressionAttributeValues={
            ":r": False,
            ":u": now_iso(),
        },
    )


def increment_user_tick(owner_id, next_tick):
    simconfig_table.update_item(
        Key={"owner_id": owner_id, "config_key": SIMULATION_CONFIG_KEY},
        UpdateExpression="SET tick = :t, updated_at = :u",
        ExpressionAttributeValues={
            ":t": next_tick,
            ":u": now_iso(),
        },
    )


def build_owner_service(owner_id, service_id):
    return f"{owner_id}#{service_id}"


def write_kpi_item(owner_id, service, timestamp, phase, current_tick, metrics, ttl):
    item = {
        "owner_service": build_owner_service(owner_id, service["service_id"]),
        "owner_id": owner_id,
        "service_id": service["service_id"],
        "timestamp": timestamp,
        "service_type": service["service_type"],
        "metrics": metrics,
        "scenario_phase": phase,
        "simulator_tick": current_tick,
        "ttl": ttl,
    }
    kpi_table.put_item(Item=to_dynamodb_value(item))


def write_log_item(owner_id, service, timestamp, phase, current_tick, metrics, ttl):
    log_level = "WARN" if phase == "Degrading" else "ERROR" if phase == "Incident" else "INFO"
    item = {
        "owner_service": build_owner_service(owner_id, service["service_id"]),
        "owner_id": owner_id,
        "service_id": service["service_id"],
        "timestamp": timestamp,
        "log_level": log_level,
        "event_type": service["event_type"],
        "payload": {
            "message": f"{service['service_type']} metrics generated",
            "phase": phase,
            "tick": current_tick,
            "metrics_snapshot": metrics,
            "trace_id": str(uuid.uuid4()),
        },
        "ttl": ttl,
    }
    log_table.put_item(Item=to_dynamodb_value(item))


def lambda_handler(event, context):
    try:
        active_configs = scan_active_simulations()
        if not active_configs:
            return {
                "statusCode": 200,
                "body": {
                    "message": "No active simulations",
                    "users_processed": 0,
                    "services_written": 0,
                },
            }

        users_processed = 0
        services_written = 0
        completed_users = []

        for config in active_configs:
            owner_id = config.get("owner_id")
            if not owner_id:
                continue

            current_tick = int(config.get("tick", 0))
            active_scenario = config.get("active_scenario", "baseline")
            total_ticks = SCENARIOS.get(active_scenario, SCENARIOS["baseline"])["total_ticks"]

            if current_tick >= total_ticks:
                stop_user_simulation(owner_id)
                completed_users.append(owner_id)
                continue

            phase = get_phase(active_scenario, current_tick)
            timestamp = now_iso()
            ttl = ttl_24h()

            for service in SERVICES:
                metrics = generate_metrics(
                    service["service_id"],
                    service["service_type"],
                    active_scenario,
                    current_tick,
                )
                metrics = to_dynamodb_value(metrics)

                write_kpi_item(
                    owner_id=owner_id,
                    service=service,
                    timestamp=timestamp,
                    phase=phase,
                    current_tick=current_tick,
                    metrics=metrics,
                    ttl=ttl,
                )

                write_log_item(
                    owner_id=owner_id,
                    service=service,
                    timestamp=timestamp,
                    phase=phase,
                    current_tick=current_tick,
                    metrics=metrics,
                    ttl=ttl,
                )

                services_written += 1

            increment_user_tick(owner_id, current_tick + 1)
            users_processed += 1

        return {
            "statusCode": 200,
            "body": {
                "message": "Simulation tick completed",
                "users_processed": users_processed,
                "services_written": services_written,
                "completed_users": completed_users,
            },
        }

    except ClientError as e:
        return {"statusCode": 500, "body": f"AWS error: {str(e)}"}
    except Exception as e:
        return {"statusCode": 500, "body": f"Unexpected error: {str(e)}"}
