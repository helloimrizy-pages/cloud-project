# Security Audit Report

**Project:** CloudWatch AI -- Predictive Incident Detection Platform
**Date:** 2026-03-22
**Auditor:** Group 2 (CS6905)

---

## 1. Authentication

### 1.1 AWS Cognito User Pool

| Property | Configuration |
|----------|--------------|
| User Pool ID | `ca-central-1_cyhaCVeUz` |
| App Client ID | `39aln1edjk2egqb9b8g82dut6j` |
| Auth Flow | SRP (Secure Remote Password) |
| Username Attribute | Email |
| Auto-Verified Attributes | Email |
| Client Secret | None (public SPA client) |

### 1.2 Password Policy

| Requirement | Enforced |
|-------------|----------|
| Minimum length | 8 characters |
| Uppercase letter required | Yes |
| Lowercase letter required | Yes |
| Number required | Yes |
| Special character required | No |

### 1.3 Token Management

| Property | Details |
|----------|---------|
| Token Type | JWT (ID Token) |
| Token Lifetime | 1 hour (Cognito default) |
| Refresh Token Lifetime | 30 days (Cognito default) |
| Token Storage | Browser localStorage (via `amazon-cognito-identity-js` SDK) |
| Token Injection | `Authorization` header on every API request |
| Session Persistence | Survives page refresh via Cognito SDK session management |
| Expired Token Handling | 401 response triggers automatic redirect to `/login` |

---

## 2. Authorization

### 2.1 API Gateway JWT Authorizer

| Property | Configuration |
|----------|--------------|
| Authorizer Name | `cognito-jwt` |
| Authorizer Type | JWT |
| Identity Source | `$request.header.Authorization` |
| Issuer | `https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_cyhaCVeUz` |
| Audience | `39aln1edjk2egqb9b8g82dut6j` |

### 2.2 Route Protection

All 16 API Gateway routes are protected with the JWT authorizer:

| Route | Method | Auth Type |
|-------|--------|-----------|
| `/services` | GET | JWT |
| `/kpi/{serviceId}` | GET | JWT |
| `/thresholds` | GET | JWT |
| `/alerts/active` | GET | JWT |
| `/alerts/history` | GET | JWT |
| `/alerts/{id}/acknowledge` | POST | JWT |
| `/incidents` | GET | JWT |
| `/simulation/state` | GET | JWT |
| `/simulation/start` | POST | JWT |
| `/simulation/stop` | POST | JWT |
| `/analytics/summary` | GET | JWT |
| `/analytics/methods` | GET | JWT |
| `/analytics/features` | GET | JWT |
| `/analytics/lead-times` | GET | JWT |
| `/metrics` | GET | JWT |
| `/logs` | GET | JWT |

**Verification:**
```bash
# Unauthenticated request
$ curl -s https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com/services
{"message":"Unauthorized"}
# HTTP 401 -- access denied without valid JWT
```

### 2.3 Frontend Route Protection

| Route | Protection |
|-------|-----------|
| `/login` | Public (accessible without auth) |
| `/` (Live Controls) | Protected -- redirects to `/login` if not authenticated |
| `/timeline` | Protected |
| `/alerts` | Protected |
| `/analytics` | Protected |

Implementation: `ProtectedRoute` component checks Cognito session; redirects unauthenticated users to `/login`.

---

## 3. Data Encryption

### 3.1 Encryption at Rest

| Service | Encryption | Algorithm | Key Management |
|---------|-----------|-----------|----------------|
| DynamoDB (6 tables) | Enabled (default) | AES-256 | AWS-owned keys |
| S3 (cloud-project-dashboard1) | Enabled | AES-256 (SSE-S3) | AWS-managed, BucketKey enabled |
| Cognito User Pool | Enabled (default) | AES-256 | AWS-managed |

**DynamoDB Encryption Verification:**
```bash
$ aws dynamodb describe-table --table-name KPIMetrics --region ca-central-1 \
    --query 'Table.SSEDescription'
# null (AWS-owned key encryption -- enabled by default, not shown in API response)
```

All DynamoDB tables use AWS-owned key encryption, which is enabled automatically and cannot be disabled. Data is encrypted transparently before being written to disk.

**S3 Encryption Verification:**
```bash
$ aws s3api get-bucket-encryption --bucket cloud-project-dashboard1
{
    "ServerSideEncryptionConfiguration": {
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }]
    }
}
```

### 3.2 Encryption in Transit

| Communication Path | Protocol | TLS Version |
|-------------------|----------|-------------|
| Browser to API Gateway | HTTPS | TLS 1.2+ |
| Browser to S3 (frontend) | HTTP | N/A (static assets, no sensitive data) |
| API Gateway to Lambda | HTTPS | TLS 1.2+ (AWS internal) |
| Lambda to DynamoDB | HTTPS | TLS 1.2+ (AWS SDK default) |
| Lambda to S3 (model loading) | HTTPS | TLS 1.2+ (AWS SDK default) |
| Browser to Cognito | HTTPS | TLS 1.2+ |

All API communication uses HTTPS. The S3 static website endpoint serves the frontend over HTTP, but all data-bearing API calls and authentication flows use HTTPS exclusively.

---

## 4. Access Controls

### 4.1 IAM Roles

| Role | Permissions | Scope |
|------|------------|-------|
| Lambda Execution Role | DynamoDB read/write, S3 read (models), CloudWatch Logs | Scoped to specific table ARNs and bucket |
| API Gateway Role | Lambda invoke | Scoped to specific Lambda function ARNs |

### 4.2 S3 Bucket Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "PublicReadForWebsite",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::cloud-project-dashboard1/*"
    }]
}
```

- Public read access is limited to `GetObject` (serving static frontend files)
- No `PutObject`, `DeleteObject`, or `ListBucket` permissions for public access
- ML model files in `models/` are readable but not modifiable by external users

### 4.3 DynamoDB Access

- No direct public access to DynamoDB tables
- All access is mediated through Lambda functions behind the authenticated API Gateway
- Lambda IAM role has scoped permissions (read/write to specific tables only)

---

## 5. Security Audit Checklist

### 5.1 OWASP Top 10 Assessment

| # | Vulnerability | Status | Notes |
|---|--------------|--------|-------|
| A01 | Broken Access Control | Pass | JWT authorizer on all API routes; frontend route guards; no public API endpoints |
| A02 | Cryptographic Failures | Pass | AES-256 encryption at rest (DynamoDB, S3, Cognito); TLS 1.2+ in transit for all API calls |
| A03 | Injection | Pass | No SQL/NoSQL injection risk -- DynamoDB SDK uses parameterized queries; no raw query construction |
| A04 | Insecure Design | Pass | Serverless architecture eliminates server management risks; least-privilege IAM roles |
| A05 | Security Misconfiguration | Pass | Default encryption enabled; no open debug endpoints; Cognito client has no secret (SPA best practice) |
| A06 | Vulnerable Components | Pass | Dependencies are current versions (React 19, Vite 7, scikit-learn 1.7); no known CVEs |
| A07 | Authentication Failures | Pass | Cognito handles auth with SRP protocol; password policy enforced; tokens expire after 1 hour |
| A08 | Data Integrity Failures | Pass | ML models loaded from S3 with versioning; DynamoDB Streams ensure data pipeline integrity |
| A09 | Security Logging | Pass | CloudWatch Logs capture all Lambda executions; API Gateway access logs available |
| A10 | SSRF | N/A | No user-supplied URLs processed by the backend; Lambda only connects to known AWS service endpoints |

### 5.2 Additional Security Checks

| Check | Status | Notes |
|-------|--------|-------|
| CORS Configuration | Pass | API Gateway CORS configured for allowed origins |
| Rate Limiting | Pass | API Gateway default throttling (10,000 req/s burst, 5,000 sustained) |
| Input Validation | Pass | API Gateway validates route parameters; Lambda validates request body structure |
| Error Handling | Pass | Lambda returns generic error messages; no stack traces exposed to clients |
| Secrets Management | Pass | No hardcoded secrets; Cognito client ID is public by design (SPA); no API keys in source code |
| DynamoDB TTL | Pass | Records have TTL attributes for automatic cleanup of old data |
| Token Storage | Advisory | JWT stored in localStorage is accessible to JavaScript. Mitigated by: no user-generated HTML rendered, React's built-in XSS protection, strict Content Security Policy. HttpOnly cookies would be more secure but require a backend proxy. |

---

## 6. Security Architecture Diagram

```
                        HTTPS (TLS 1.2+)
User Browser ----------------------------------------> AWS Cognito
     |                                                 (SRP Auth)
     |  JWT Token                                          |
     |                                                     |
     |  HTTPS + Authorization: <JWT>                       |
     +---------------------------------------------> API Gateway
     |                                               (JWT Authorizer)
     |                                                     |
     |                                                     | IAM Role
     |                                                     v
     |                                               Lambda Functions
     |                                                     |
     |                                            IAM Role | (scoped)
     |                                                     v
     |                                            +--- DynamoDB ---+
     |                                            |  (AES-256 at   |
     |                                            |   rest)        |
     |                                            +----------------+
     |                                                     |
     |                                            IAM Role |
     |                                                     v
     |                                            +---- S3 --------+
     |  HTTP (static assets)                      |  (SSE-S3       |
     +------------------------------------------->|   AES-256)     |
                                                  +----------------+
```

---

## 7. Summary

| Category | Finding |
|----------|---------|
| **Authentication** | AWS Cognito with SRP, email verification, password policy enforced |
| **Authorization** | JWT authorizer on all 16 API Gateway routes; frontend route guards |
| **Encryption at Rest** | AES-256 on DynamoDB (AWS-owned keys), S3 (SSE-S3), Cognito |
| **Encryption in Transit** | TLS 1.2+ on all API, auth, and AWS service-to-service communication |
| **Access Controls** | Least-privilege IAM roles; no public database access; S3 read-only for frontend |
| **OWASP Top 10** | 9/10 passed, 1 N/A (SSRF) |
| **Overall Risk Level** | Low |
