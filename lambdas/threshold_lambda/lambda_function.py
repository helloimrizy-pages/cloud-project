import json


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
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

        if method == "GET" and path.endswith("/thresholds"):
            return response(200, {
                "5": 0.912,
                "10": 0.867,
                "15": 0.847
            })

        return response(404, {
            "error": "NotFound",
            "message": "Route not found"
        })

    except Exception as e:
        return response(500, {
            "error": "InternalServerError",
            "message": str(e)
        })