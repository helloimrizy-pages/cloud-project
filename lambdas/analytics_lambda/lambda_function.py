import json

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body)
    }

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

def lambda_handler(event, context):
    try:
        method, path = get_method_and_path(event)

        if method == "GET" and path.endswith("/analytics/summary"):
            return response(200, {
                "bestPrecision": 0.91,
                "meanLeadTime": 36,
                "falseAlarmRate": "\u22641/day",
                "detectionRate": 8.7
            })

        if method == "GET" and path.endswith("/analytics/methods"):
            return response(200, [
                {
                    "name": "GBC + Logs",
                    "precision": {"5": 0.88, "10": 0.90, "15": 0.91},
                    "detectionRate": {"5": 5.2, "10": 7.1, "15": 8.7},
                    "color": "#64ffda"
                },
                {
                    "name": "GBC KPI",
                    "precision": {"5": 0.84, "10": 0.86, "15": 0.88},
                    "detectionRate": {"5": 4.1, "10": 5.8, "15": 7.2},
                    "color": "#3498db"
                },
                {
                    "name": "Baseline Static",
                    "precision": {"5": 0.42, "10": 0.44, "15": 0.45},
                    "detectionRate": {"5": 1.8, "10": 2.2, "15": 2.5},
                    "color": "#8892b0"
                },
                {
                    "name": "Baseline MA",
                    "precision": {"5": 0.49, "10": 0.51, "15": 0.52},
                    "detectionRate": {"5": 2.1, "10": 2.6, "15": 3.0},
                    "color": "#4a4a6a"
                }
            ])

        if method == "GET" and path.endswith("/analytics/features"):
            return response(200, [
                {"feature": "roll_std", "importance": 0.32, "type": "kpi"},
                {"feature": "error_rate", "importance": 0.27, "type": "log"},
                {"feature": "roll_slope", "importance": 0.18, "type": "kpi"},
                {"feature": "warn_rate", "importance": 0.08, "type": "log"},
                {"feature": "roll_mean", "importance": 0.06, "type": "kpi"},
                {"feature": "roll_max", "importance": 0.04, "type": "kpi"},
                {"feature": "first_diff", "importance": 0.03, "type": "kpi"},
                {"feature": "severity_change_flag", "importance": 0.02, "type": "log"}
            ])

        if method == "GET" and path.endswith("/analytics/lead-times"):
            return response(200, [
                {"horizon": 5, "min": 3, "q1": 8, "median": 12, "q3": 16, "max": 22},
                {"horizon": 10, "min": 8, "q1": 16, "median": 22, "q3": 28, "max": 38},
                {"horizon": 15, "min": 12, "q1": 24, "median": 36, "q3": 44, "max": 58}
            ])

        return response(404, {"error": "NotFound", "message": "Route not found"})

    except Exception as e:
        return response(500, {"error": "InternalServerError", "message": str(e)})
