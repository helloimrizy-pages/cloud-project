import os
import json
import boto3

sns = boto3.client('sns')
cognito = boto3.client('cognito-idp')

SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
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
    rc = event.get("requestContext", {})
    if "http" in rc:
        return rc["http"].get("method", ""), event.get("rawPath", "")
    return event.get("httpMethod", ""), event.get("path", "")


def get_user_email(owner_id):
    resp = cognito.list_users(
        UserPoolId=USER_POOL_ID,
        Filter=f'sub = "{owner_id}"',
        Limit=1,
    )
    users = resp.get("Users", [])
    if not users:
        return None
    for attr in users[0].get("Attributes", []):
        if attr["Name"] == "email":
            return attr["Value"]
    return None


def find_subscription(email):
    paginator = sns.get_paginator('list_subscriptions_by_topic')
    for page in paginator.paginate(TopicArn=SNS_TOPIC_ARN):
        for sub in page.get("Subscriptions", []):
            if sub.get("Protocol") == "email" and sub.get("Endpoint") == email:
                return sub.get("SubscriptionArn")
    return None


def lambda_handler(event, context):
    try:
        method, path = get_method_and_path(event)
        owner_id = get_owner_id(event)

        if not owner_id:
            return response(401, {
                "error": "Unauthorized",
                "message": "Missing authenticated user identity",
            })

        email = get_user_email(owner_id)
        if not email:
            return response(404, {
                "error": "NotFound",
                "message": "Could not find email for user",
            })

        if method == "GET" and path.endswith("/notifications/status"):
            sub_arn = find_subscription(email)
            subscribed = sub_arn is not None and sub_arn != "PendingConfirmation"
            pending = sub_arn == "PendingConfirmation"
            return response(200, {
                "email": email,
                "subscribed": subscribed,
                "pending": pending,
            })

        if method == "POST" and path.endswith("/notifications/subscribe"):
            existing = find_subscription(email)
            if existing and existing != "PendingConfirmation":
                # Ensure filter policy is up to date
                try:
                    sns.set_subscription_attributes(
                        SubscriptionArn=existing,
                        AttributeName="FilterPolicy",
                        AttributeValue=json.dumps({"owner_id": [owner_id]}),
                    )
                except Exception:
                    pass
                return response(200, {
                    "message": "Already subscribed",
                    "email": email,
                })
            resp = sns.subscribe(
                TopicArn=SNS_TOPIC_ARN,
                Protocol="email",
                Endpoint=email,
                Attributes={
                    "FilterPolicy": json.dumps({"owner_id": [owner_id]}),
                },
            )
            return response(200, {
                "message": "Subscription requested. Check your email to confirm.",
                "email": email,
            })

        if method == "POST" and path.endswith("/notifications/unsubscribe"):
            sub_arn = find_subscription(email)
            if sub_arn and sub_arn != "PendingConfirmation":
                sns.unsubscribe(SubscriptionArn=sub_arn)
                return response(200, {
                    "message": "Unsubscribed",
                    "email": email,
                })
            return response(200, {
                "message": "Not currently subscribed",
                "email": email,
            })

        return response(404, {
            "error": "NotFound",
            "message": "Route not found",
        })

    except Exception as e:
        print("NOTIFICATIONS_LAMBDA_ERROR", str(e))
        return response(500, {
            "error": "InternalServerError",
            "message": str(e),
        })
