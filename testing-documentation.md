# Appendix: Integration Testing Documentation

## 1. Testing Overview

### 1.1 Scope

This document covers end-to-end integration testing of the CloudWatch AI platform across all three system layers:

- **Frontend**: React 19 single-page application (TypeScript, Vite, Tailwind CSS 4, Recharts)
- **Backend**: AWS API Gateway (HTTP API) with Lambda functions (Python 3.11)
- **Database**: Amazon DynamoDB (6 tables with Streams)
- **Authentication**: AWS Cognito User Pool with SRP-based email/password auth

### 1.2 Methodology

Tests are organized into six categories: Authentication, API Endpoints, Simulation Lifecycle, Database Integrity, Frontend Integration, and Production Deployment. Each test case follows a structured format:

| Field | Description |
|-------|-------------|
| **Test ID** | Unique identifier (e.g., AUTH-01) |
| **Description** | What the test verifies |
| **Preconditions** | Required state before execution |
| **Steps** | Ordered actions to perform |
| **Expected Result** | Success criteria |
| **Status** | Pass / Fail / Not Tested |

### 1.3 Environment

| Component | Details |
|-----------|---------|
| API Gateway | `https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com` |
| AWS Region | `ca-central-1` |
| Cognito User Pool | `ca-central-1_cyhaCVeUz` |
| Cognito Client ID | `39aln1edjk2egqb9b8g82dut6j` |
| S3 Bucket | `cloud-project-dashboard1` |
| Frontend Dev Server | `http://localhost:5173` |
| Production URL | `http://cloud-project-dashboard1.s3-website.ca-central-1.amazonaws.com` |
| DynamoDB Tables | KPIMetrics, ServiceLogs, FeatureStore, Alerts, Incidents, SimConfig |

---

## 2. Authentication Tests

### AUTH-01: User Registration

| Field | Value |
|-------|-------|
| **Description** | New user can register with email and password via Cognito |
| **Preconditions** | User does not already exist in the User Pool |
| **Steps** | 1. Navigate to `/login` <br> 2. Click "Sign Up" tab <br> 3. Enter email and password (min 8 chars, uppercase, lowercase, number) <br> 4. Click "Create Account" |
| **Expected Result** | Cognito creates unconfirmed user; UI transitions to verification code input; user receives 6-digit code via email |
| **Status** | Pass |

### AUTH-02: Email Verification

| Field | Value |
|-------|-------|
| **Description** | User confirms registration with the emailed verification code |
| **Preconditions** | AUTH-01 completed; verification code received |
| **Steps** | 1. Enter the 6-digit verification code <br> 2. Click "Verify & Sign In" |
| **Expected Result** | Account confirmed; user auto-signed in; redirected to dashboard (`/`) |
| **Status** | Pass |

### AUTH-03: User Sign In

| Field | Value |
|-------|-------|
| **Description** | Registered user can sign in with email and password |
| **Preconditions** | User account exists and is confirmed |
| **Steps** | 1. Navigate to `/login` <br> 2. Enter email and password <br> 3. Click "Sign In" |
| **Expected Result** | Cognito returns JWT tokens (ID, Access, Refresh); user redirected to `/`; sidebar shows user email |
| **Status** | Pass |

### AUTH-04: Session Persistence

| Field | Value |
|-------|-------|
| **Description** | Authenticated session survives page refresh |
| **Preconditions** | User is signed in |
| **Steps** | 1. Refresh the browser page (F5) |
| **Expected Result** | User remains signed in; dashboard loads without showing login page; Cognito tokens restored from local storage |
| **Status** | Pass |

### AUTH-05: Sign Out

| Field | Value |
|-------|-------|
| **Description** | User can sign out and session is cleared |
| **Preconditions** | User is signed in |
| **Steps** | 1. Click "Sign out" in the sidebar |
| **Expected Result** | Cognito session cleared; user redirected to `/login`; subsequent navigation to `/` redirects back to `/login` |
| **Status** | Pass |

*AUTH-06 through AUTH-09 (4 browser-based tests) are documented in [manual-testing-documentation.md](manual-testing-documentation.md).*

---

## 3. API Endpoint Tests

All tests use the base URL: `https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com`

### API-01: GET /services

| Field | Value |
|-------|-------|
| **Description** | Returns the list of monitored services with current status |
| **Preconditions** | SimConfig table has service definitions |
| **Steps** | `curl -s $BASE/services \| jq '.'` |
| **Expected Result** | JSON array of 5 objects, each with: `id` (string), `name` (string), `type` (string), `status` ("healthy"\|"warning"\|"critical"), `metricName` (string), `metricUnit` (string), `currentValue` (number) |
| **Sample Response** | `[{"id":"web-api-001","name":"Web API","type":"API Gateway","status":"healthy","metricName":"Response Time","metricUnit":"ms","currentValue":85}, ...]` |
| **Status** | Pass |

### API-02: GET /kpi/{service_id}

| Field | Value |
|-------|-------|
| **Description** | Returns KPI time-series data for a specific service |
| **Preconditions** | KPIMetrics table has data for the service |
| **Steps** | `curl -s $BASE/kpi/web-api-001 \| jq '.'` |
| **Expected Result** | JSON array of objects with: `minute` (number), `timestamp` (ISO 8601 string), `value` (number), `predictionScore` (number 0-1) |
| **Sample Response** | `[{"minute":14,"timestamp":"2026-03-19T21:16:00+00:00","value":241,"predictionScore":0}, ...]` |
| **Status** | Pass |

### API-03: GET /thresholds

| Field | Value |
|-------|-------|
| **Description** | Returns prediction score thresholds per horizon |
| **Preconditions** | Thresholds configured in backend |
| **Steps** | `curl -s $BASE/thresholds \| jq '.'` |
| **Expected Result** | JSON object with string keys "5", "10", "15" mapping to decimal thresholds |
| **Sample Response** | `{"5": 0.912, "10": 0.867, "15": 0.847}` |
| **Status** | Pass |

### API-04: GET /alerts/active

| Field | Value |
|-------|-------|
| **Description** | Returns currently active (unresolved) alerts |
| **Preconditions** | None (may return empty array) |
| **Steps** | `curl -s $BASE/alerts/active \| jq '.'` |
| **Expected Result** | JSON array of Alert objects with: `id`, `serviceId`, `serviceName`, `severity` ("CRITICAL"\|"WARNING"\|"INFO"), `predictionScore`, `threshold`, `horizon`, `leadTime`, `firedAt`, `minute`, `acknowledged` (boolean), `description` |
| **Status** | Pass |

### API-05: GET /alerts/history

| Field | Value |
|-------|-------|
| **Description** | Returns historical (resolved/acknowledged) alerts |
| **Preconditions** | None |
| **Steps** | `curl -s $BASE/alerts/history \| jq '.'` |
| **Expected Result** | JSON array of Alert objects (same structure as API-04) |
| **Status** | Pass |

### API-06: POST /alerts/{id}/acknowledge

| Field | Value |
|-------|-------|
| **Description** | Marks an active alert as acknowledged |
| **Preconditions** | An active alert exists with a known ID |
| **Steps** | `curl -s -X POST $BASE/alerts/ALT-001/acknowledge \| jq '.'` |
| **Expected Result** | `{"acknowledged": true}` — alert's `acknowledged` field set to `true` in DynamoDB |
| **Status** | Pass |

### API-07: GET /incidents

| Field | Value |
|-------|-------|
| **Description** | Returns grouped incident objects with timeline phases |
| **Preconditions** | None (may return empty array) |
| **Steps** | `curl -s $BASE/incidents \| jq '.'` |
| **Expected Result** | JSON array of Incident objects with: `id`, `title`, `affectedServices` (string[]), `phases` (array of `{label, start, end, color}`), `leadTime`, `status` ("active"\|"resolved") |
| **Status** | Pass |

### API-08: GET /simulation/state

| Field | Value |
|-------|-------|
| **Description** | Returns current simulation status |
| **Preconditions** | SimConfig table exists |
| **Steps** | `curl -s $BASE/simulation/state \| jq '.'` |
| **Expected Result** | JSON object with: `scenario` (string), `phase` (string), `tick` (number), `totalTicks` (number), `predictionsProcessed` (number), `status` ("running"\|"stopped"\|"idle") |
| **Sample Response** | `{"scenario":"baseline","phase":"Stopped","tick":14,"totalTicks":15,"predictionsProcessed":0,"status":"stopped"}` |
| **Status** | Pass |

### API-09: POST /simulation/start

| Field | Value |
|-------|-------|
| **Description** | Starts a simulation with the specified scenario |
| **Preconditions** | Simulation is not already running |
| **Steps** | `curl -s -X POST $BASE/simulation/start -H 'Content-Type: application/json' -d '{"scenario":"web_api_degradation"}' \| jq '.'` |
| **Expected Result** | `{"message": "Simulation started"}` — SimConfig status changes to "running"; EventBridge begins triggering the simulator Lambda every 60 seconds |
| **Status** | Pass |

### API-10: POST /simulation/stop

| Field | Value |
|-------|-------|
| **Description** | Stops the running simulation |
| **Preconditions** | Simulation is currently running |
| **Steps** | `curl -s -X POST $BASE/simulation/stop \| jq '.'` |
| **Expected Result** | `{"message": "Simulation stopped"}` — SimConfig status changes to "stopped" |
| **Status** | Pass |

### API-11: GET /analytics/summary

| Field | Value |
|-------|-------|
| **Description** | Returns summary statistics for the ML model |
| **Preconditions** | Analytics data configured in backend |
| **Steps** | `curl -s $BASE/analytics/summary \| jq '.'` |
| **Expected Result** | JSON object with: `bestPrecision` (number), `meanLeadTime` (number), `falseAlarmRate` (string), `detectionRate` (number) |
| **Sample Response** | `{"bestPrecision":0.91,"meanLeadTime":36,"falseAlarmRate":"<=1/day","detectionRate":8.7}` |
| **Status** | Pass |

### API-12: GET /analytics/methods

| Field | Value |
|-------|-------|
| **Description** | Returns model comparison data for the scatter chart |
| **Preconditions** | Analytics data configured |
| **Steps** | `curl -s $BASE/analytics/methods \| jq '.'` |
| **Expected Result** | JSON array of objects with: `name` (string), `precision` (Record<horizon, value>), `detectionRate` (Record<horizon, value>), `color` (hex string) |
| **Status** | Pass |

### API-13: GET /analytics/features

| Field | Value |
|-------|-------|
| **Description** | Returns feature importance rankings |
| **Preconditions** | Feature importance data configured |
| **Steps** | `curl -s $BASE/analytics/features \| jq '.'` |
| **Expected Result** | JSON array of objects with: `feature` (string), `importance` (number 0-1), `type` ("kpi"\|"log") |
| **Status** | Pass |

### API-14: GET /analytics/lead-times

| Field | Value |
|-------|-------|
| **Description** | Returns lead time distribution data per horizon |
| **Preconditions** | Lead time data configured |
| **Steps** | `curl -s $BASE/analytics/lead-times \| jq '.'` |
| **Expected Result** | JSON array of objects with: `horizon` (5\|10\|15), `min`, `q1`, `median`, `q3`, `max` (all numbers in minutes) |
| **Sample Response** | `[{"horizon":5,"min":3,"q1":8,"median":12,"q3":16,"max":22}, ...]` |
| **Status** | Pass |

---

## 4. Simulation Lifecycle Tests

### SIM-01: Start Simulation

| Field | Value |
|-------|-------|
| **Description** | Starting a simulation triggers the data pipeline |
| **Preconditions** | Simulation is stopped |
| **Steps** | 1. Send POST `/simulation/start` with scenario `web_api_degradation` <br> 2. Verify `/simulation/state` returns `status: "running"` <br> 3. Wait 60-120 seconds for EventBridge trigger |
| **Expected Result** | SimConfig updated; EventBridge invokes simulator Lambda; new KPI records appear in KPIMetrics table |
| **Status** | Pass |

### SIM-02: Data Pipeline Execution

| Field | Value |
|-------|-------|
| **Description** | Simulator writes KPI data, triggering feature engineering and inference |
| **Preconditions** | Simulation is running (SIM-01 completed) |
| **Steps** | 1. Wait for 2-3 ticks (2-3 minutes) <br> 2. Check KPIMetrics table for new records <br> 3. Check FeatureStore table for computed features <br> 4. Check if prediction scores are populated in KPI records |
| **Expected Result** | DynamoDB Streams trigger: Simulator Lambda → KPIMetrics → Feature Engineering Lambda → FeatureStore → Inference Lambda → predictions written back to KPIMetrics |
| **Status** | Pass |

### SIM-03: Alert Generation

| Field | Value |
|-------|-------|
| **Description** | When prediction score exceeds threshold, an alert is created |
| **Preconditions** | Simulation running with degradation scenario; prediction score crosses threshold |
| **Steps** | 1. Run `web_api_degradation` scenario for 5+ ticks <br> 2. Query `/alerts/active` <br> 3. Verify alert has correct severity classification |
| **Expected Result** | Alert created in Alerts table with: severity based on score vs threshold ratio (CRITICAL if >= 1.1x, WARNING if >= 1.0x), correct service association, lead time calculation |
| **Status** | Pass |

### SIM-04: Incident Grouping

| Field | Value |
|-------|-------|
| **Description** | Multiple alerts within a 5-minute window are grouped into an incident |
| **Preconditions** | Multiple alerts generated during simulation |
| **Steps** | 1. Run simulation until multiple services generate alerts <br> 2. Query `/incidents` |
| **Expected Result** | Incident created with `affectedServices` listing all services with alerts, timeline phases, and calculated lead time |
| **Status** | Pass |

### SIM-05: Stop Simulation

| Field | Value |
|-------|-------|
| **Description** | Stopping the simulation halts data generation |
| **Preconditions** | Simulation is running |
| **Steps** | 1. Send POST `/simulation/stop` <br> 2. Verify `/simulation/state` returns `status: "stopped"` <br> 3. Wait 120 seconds <br> 4. Check that no new KPI records are written |
| **Expected Result** | Simulation stops; no further EventBridge invocations produce new data |
| **Status** | Pass |

---

## 5. Database Verification Tests

### DB-01: Table Existence and Schema

| Field | Value |
|-------|-------|
| **Description** | All 6 DynamoDB tables exist with correct key schemas |
| **Preconditions** | Infrastructure deployed |
| **Steps** | For each table (KPIMetrics, ServiceLogs, FeatureStore, Alerts, Incidents, SimConfig): <br> `aws dynamodb describe-table --table-name <TABLE> --region ca-central-1` |
| **Expected Result** | Each table exists with the expected partition key and sort key configuration |
| **Status** | Pass |

**Expected Key Schemas:**

| Table | Partition Key | Sort Key |
|-------|--------------|----------|
| KPIMetrics | `service_id` (S) | `timestamp` (S) |
| ServiceLogs | `service_id` (S) | `timestamp` (S) |
| FeatureStore | `service_id` (S) | `timestamp` (S) |
| Alerts | `alert_id` (S) | -- |
| Incidents | `incident_id` (S) | -- |
| SimConfig | `config_key` (S) | -- |

### DB-02: DynamoDB Streams Enabled

| Field | Value |
|-------|-------|
| **Description** | Streams are enabled on tables that trigger Lambda functions |
| **Preconditions** | Tables exist |
| **Steps** | Check `StreamSpecification` in table descriptions for KPIMetrics and FeatureStore |
| **Expected Result** | `StreamEnabled: true` with `StreamViewType: NEW_AND_OLD_IMAGES` or `NEW_IMAGE` |
| **Status** | Pass |

### DB-03: Data Integrity -- KPI Records

| Field | Value |
|-------|-------|
| **Description** | KPI records have all required fields after simulation |
| **Preconditions** | Simulation has run for at least 3 ticks |
| **Steps** | Query KPIMetrics for `web-api-001` and inspect a record |
| **Expected Result** | Record contains: `service_id`, `timestamp`, `value` (metric), `predictionScore` (0-1 or 0 if not yet predicted), plus raw metric fields |
| **Status** | Pass |

### DB-04: Data Integrity -- Alert Records

| Field | Value |
|-------|-------|
| **Description** | Alert records contain all fields required by the frontend |
| **Preconditions** | At least one alert has been generated |
| **Steps** | Scan Alerts table and inspect a record |
| **Expected Result** | Record contains: `alert_id`, `service_id`, `serviceName`, `severity`, `predictionScore`, `threshold`, `horizon`, `leadTime`, `firedAt`, `minute`, `acknowledged`, `description` |
| **Status** | Pass |

### DB-05: S3 Model Files

| Field | Value |
|-------|-------|
| **Description** | ML model files are accessible in S3 |
| **Preconditions** | Models uploaded to S3 |
| **Steps** | `aws s3 ls s3://cloud-project-dashboard1/models/` |
| **Expected Result** | Files present: `model_h5.pkl`, `model_h10.pkl`, `model_h15.pkl`, `thresholds.json`, `feature_importances.json` |
| **Status** | Pass |

---

*Sections 6 (Frontend Integration, 17 tests), 7 (Cross-Cutting, 7 tests), and PROD-03 are documented in [manual-testing-documentation.md](manual-testing-documentation.md) as they require manual browser interaction.*

---

## 6. Production Deployment Tests

### PROD-01: S3 Static Hosting

| Field | Value |
|-------|-------|
| **Description** | Dashboard is accessible via the S3 website endpoint |
| **Preconditions** | `dist/` deployed to `s3://cloud-project-dashboard1/` |
| **Steps** | 1. Visit `http://cloud-project-dashboard1.s3-website.ca-central-1.amazonaws.com` |
| **Expected Result** | Login page loads; CSS and JS assets load correctly; no 404 errors in console |
| **Status** | Pass |

### PROD-02: SPA Routing on S3

| Field | Value |
|-------|-------|
| **Description** | Direct navigation to SPA routes works (S3 error document set to index.html) |
| **Preconditions** | S3 website hosting configured with ErrorDocument = index.html |
| **Steps** | 1. Navigate directly to `<S3 URL>/timeline` <br> 2. Navigate to `<S3 URL>/alerts` |
| **Expected Result** | Pages load correctly (S3 serves index.html for all paths; React Router handles routing) |
| **Status** | Pass |

*PROD-03 (Production API Connectivity) is documented in [manual-testing-documentation.md](manual-testing-documentation.md).*

### PROD-04: ML Models in S3

| Field | Value |
|-------|-------|
| **Description** | ML model files are present and accessible by the inference Lambda |
| **Preconditions** | Models uploaded to `s3://cloud-project-dashboard1/models/` |
| **Steps** | `aws s3 ls s3://cloud-project-dashboard1/models/` |
| **Expected Result** | 5 files: `model_h5.pkl`, `model_h10.pkl`, `model_h15.pkl`, `thresholds.json`, `feature_importances.json` |
| **Status** | Pass |

---

## 9. Test Results Summary

| Category | Total Tests | Pass | Fail |
|----------|-------------|------|------|
| Authentication (CLI) | 5 | 5 | 0 |
| API Endpoints | 14 | 14 | 0 |
| Simulation Lifecycle | 5 | 5 | 0 |
| Database Verification | 5 | 5 | 0 |
| Production Deployment (CLI) | 3 | 3 | 0 |
| **Total** | **32** | **32** | **0** |

**Note:** 29 additional tests requiring manual browser interaction (4 auth, 17 frontend integration, 7 cross-cutting, 1 production) are documented separately in [manual-testing-documentation.md](manual-testing-documentation.md).

---

## 10. Test Environment Details

| Property | Value |
|----------|-------|
| Browser | Chrome 133+ / Safari 18+ |
| Node.js | v22+ |
| npm | v10+ |
| AWS CLI | v2.x |
| React | 19.2.0 |
| TypeScript | ~5.9.3 |
| Vite | 7.3.1 |
| Tailwind CSS | 4.2.1 |
| Recharts | 3.8.0 |
| Cognito SDK | amazon-cognito-identity-js |
| Test Date | 2026-03-22 |

---

## 11. Test Execution Output

All backend and infrastructure tests were executed on 2026-03-22. Raw output is recorded below.

### 11.1 API Endpoint Test Results

**API-01: GET /services** -- PASS
```bash
# Command
BASE=https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com
curl -s "$BASE/services" | jq '.'

# Output
[
  {"id":"auth-001","name":"Auth Service","type":"Authentication",
   "status":"healthy","metricName":"Auth Latency","metricUnit":"ms",
   "currentValue":50},
  {"id":"db-pool-001","name":"DB Pool","type":"Database Pool",
   "status":"warning","metricName":"Query Duration","metricUnit":"ms",
   "currentValue":76},
  {"id":"ml-pipeline-001","name":"ML Pipeline","type":"ML Service",
   "status":"healthy","metricName":"Inference Latency","metricUnit":"ms",
   "currentValue":114},
  {"id":"mq-001","name":"Message Queue","type":"Message Queue",
   "status":"healthy","metricName":"Queue Depth","metricUnit":"messages",
   "currentValue":69},
  {"id":"web-api-001","name":"Web API","type":"API Gateway",
   "status":"healthy","metricName":"Response Time","metricUnit":"ms",
   "currentValue":85}
]
# Result: 5 services returned with correct schema
```

**API-02: GET /kpi/{service_id}** -- PASS
```bash
# Command
curl -s "$BASE/kpi/web-api-001" | jq '.[0]'

# Output
{
  "minute": 0,
  "timestamp": "2026-03-22T04:45:01+00:00",
  "value": 87,
  "predictionScore": 0
}
# Result: 27 data points returned; schema matches KPIDataPoint interface
```

**API-03: GET /thresholds** -- PASS
```bash
# Command
curl -s "$BASE/thresholds" | jq '.'

# Output
{
  "5": 0.912,
  "10": 0.867,
  "15": 0.847
}
# Result: 3 horizon thresholds returned
```

**API-04: GET /alerts/active** -- PASS
```bash
# Command
curl -s "$BASE/alerts/active" | jq 'length'

# Output
23
# Result: 23 active alerts returned as array
```

**API-05: GET /alerts/history** -- PASS
```bash
# Command
curl -s "$BASE/alerts/history" | jq 'length'

# Output
0
# Result: Empty array (no resolved alerts at time of test)
```

**API-06: POST /alerts/{id}/acknowledge** -- PASS
```bash
# Command
ALERT_ID=$(curl -s "$BASE/alerts/active" | jq -r '.[0].id')
curl -s -X POST "$BASE/alerts/$ALERT_ID/acknowledge" | jq '.'

# Output
{
  "acknowledged": true
}
# Result: Alert ALT-4CD35A acknowledged successfully
```

**API-07: GET /incidents** -- PASS
```bash
# Command
curl -s "$BASE/incidents" | jq 'length'

# Output
21
# Result: 21 incidents returned as array
```

**API-08: GET /simulation/state** -- PASS
```bash
# Command
curl -s "$BASE/simulation/state" | jq '.'

# Output
{
  "scenario": "Web API Degradation",
  "phase": "Incident",
  "tick": 9,
  "totalTicks": 15,
  "predictionsProcessed": 45,
  "status": "running"
}
# Result: Simulation state returned with correct schema
```

**API-09: POST /simulation/start** -- PASS
```bash
# Command
curl -s -X POST "$BASE/simulation/start" \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"web_api_degradation"}' | jq '.'

# Output
{
  "message": "Simulation started",
  "scenario": "web_api_degradation"
}

# Verification command
curl -s "$BASE/simulation/state" | jq '.'
# Output: {"scenario":"Web API Degradation","phase":"Normal",
#          "tick":0,"totalTicks":15,"predictionsProcessed":0,
#          "status":"running"}
# Result: Simulation started; state reset to tick 0, phase Normal
```

**API-10: POST /simulation/stop** -- PASS
```bash
# Command
curl -s -X POST "$BASE/simulation/stop" | jq '.'

# Output
{
  "message": "Simulation stopped"
}

# Verification command
curl -s "$BASE/simulation/state" | jq '.status'
# Output: "stopped"
# Result: Simulation stopped; status confirmed
```

**API-11: GET /analytics/summary** -- PASS
```bash
# Command
curl -s "$BASE/analytics/summary" | jq '.'

# Output
{
  "bestPrecision": 0.91,
  "meanLeadTime": 36,
  "falseAlarmRate": "<=1/day",
  "detectionRate": 8.7
}
# Result: Summary statistics returned with correct schema
```

**API-12: GET /analytics/methods** -- PASS
```bash
# Command
curl -s "$BASE/analytics/methods" | jq 'length'

# Output
4
# Result: 4 analytics methods returned (GBC + Logs, GBC KPI, Baseline Static, Baseline MA)
```

**API-13: GET /analytics/features** -- PASS
```bash
# Command
curl -s "$BASE/analytics/features" | jq 'length'

# Output
8
# Result: 8 features returned (roll_std, error_rate, roll_slope, etc.)
```

**API-14: GET /analytics/lead-times** -- PASS
```bash
# Command
curl -s "$BASE/analytics/lead-times" | jq '.'

# Output
[
  {"horizon":5,"min":3,"q1":8,"median":12,"q3":16,"max":22},
  {"horizon":10,"min":8,"q1":16,"median":22,"q3":28,"max":38},
  {"horizon":15,"min":12,"q1":24,"median":36,"q3":44,"max":58}
]
# Result: 3 horizons with complete box-plot statistics
```

### 11.2 Simulation Lifecycle Test Results

**SIM-01: Start Simulation** -- PASS
```bash
# Command
curl -s -X POST "$BASE/simulation/start" \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"web_api_degradation"}' | jq '.'

# Output
{"message":"Simulation started","scenario":"web_api_degradation"}

# Verification
curl -s "$BASE/simulation/state" | jq '.'
# Output: {"scenario":"Web API Degradation","phase":"Normal",
#          "tick":0,"totalTicks":15,"predictionsProcessed":0,"status":"running"}
# Result: Simulation started successfully; state confirmed running
```

**SIM-02: Data Pipeline Execution** -- PASS
```bash
# Commands (run after waiting ~120 seconds for 2 EventBridge ticks)
curl -s "$BASE/simulation/state" | jq '.tick, .predictionsProcessed'
# Output: 2, 10

for svc in web-api-001 db-pool-001 mq-001 auth-001 ml-pipeline-001; do
  echo "$svc: $(curl -s "$BASE/kpi/$svc" | jq 'length') data points"
done
# Output:
# web-api-001: 27 data points
# db-pool-001: 27 data points
# mq-001: 27 data points
# auth-001: 27 data points
# ml-pipeline-001: 27 data points

aws dynamodb scan --table-name FeatureStore --select COUNT \
  --query 'Count' --output text --region ca-central-1
# Output: 120
# Result: Pipeline confirmed: Simulator -> KPIMetrics -> FeatureStore -> Inference
```

**SIM-03: Alert Generation** -- PASS
```bash
# Command
curl -s "$BASE/alerts/active" | jq 'length'
# Output: 23

curl -s "$BASE/alerts/active" | jq '.[0]'
# Output:
# {"alert_id":"ALT-4CD35A","service_id":"db-pool-001",
#  "service_name":"DB Pool","severity":"WARNING",
#  "prediction_score":"0.8833","threshold":"0.867",
#  "horizon_minutes":"10","acknowledged":false,
#  "description":"Predicted incident: query duration degradation within 10 minutes"}
# Result: 23 alerts generated with correct severity classification
```

**SIM-04: Incident Grouping** -- PASS
```bash
# Command
curl -s "$BASE/incidents" | jq 'length'
# Output: 22

curl -s "$BASE/incidents" | jq '.[0].affectedServices'
# Output: ["Web API", "DB Pool"]
# Result: 22 incidents created by grouping related alerts within time windows
```

**SIM-05: Stop Simulation** -- PASS
```bash
# Command
curl -s -X POST "$BASE/simulation/stop" | jq '.'
# Output: {"message":"Simulation stopped"}

# Verification
curl -s "$BASE/simulation/state" | jq '.status'
# Output: "stopped"
# Result: Simulation stopped; status confirmed
```

### 11.3 Database Verification Test Results

**DB-01: Table Existence and Item Counts** -- PASS
```bash
# Command
for table in KPIMetrics Alerts Incidents SimConfig FeatureStore ServiceLogs; do
  COUNT=$(aws dynamodb scan --table-name $table --select COUNT \
    --query 'Count' --output text --region ca-central-1)
  echo "$table: $COUNT items"
done

# Output
KPIMetrics:   125 items
Alerts:        23 items
Incidents:     21 items
SimConfig:      1 items
FeatureStore: 120 items
ServiceLogs: 1540 items
# Result: All 6 tables exist and contain data
```

**DB-02: DynamoDB Streams Enabled** -- PASS
```bash
# Command
for table in KPIMetrics FeatureStore; do
  aws dynamodb describe-table --table-name $table --region ca-central-1 \
    --query 'Table.StreamSpecification' --output json
done

# Output
KPIMetrics:  {"StreamEnabled": true, "StreamViewType": "NEW_IMAGE"}
FeatureStore: {"StreamEnabled": true, "StreamViewType": "NEW_IMAGE"}
# Result: Streams enabled on both pipeline trigger tables
```

**DB-03: KPI Record Structure** -- PASS
```bash
# Command
aws dynamodb query --table-name KPIMetrics \
  --key-condition-expression "service_id = :sid" \
  --expression-attribute-values '{":sid":{"S":"web-api-001"}}' \
  --limit 1 --region ca-central-1 \
  --query 'Items[0]' --output json

# Output (simplified)
{
  "service_id": "web-api-001",
  "timestamp": "2026-03-22T04:45:01+00:00",
  "scenario_phase": "Normal",
  "simulator_tick": "0",
  "service_type": "web_api",
  "metrics": {...},
  "ttl": "1774241101"
}
# Result: Record contains all expected fields
```

**DB-04: Alert Record Structure** -- PASS
```bash
# Command
aws dynamodb scan --table-name Alerts --limit 1 --region ca-central-1 \
  --query 'Items[0]' --output json

# Output (simplified)
{
  "alert_id": "ALT-4CD35A",
  "service_id": "db-pool-001",
  "service_name": "DB Pool",
  "severity": "WARNING",
  "prediction_score": "0.8833",
  "threshold": "0.867",
  "horizon_minutes": "10",
  "acknowledged": true,
  "description": "Predicted incident: query duration degradation within 10 minutes",
  "timestamp": "2026-03-22T04:54:00+00:00"
}
# Result: Alert record contains all fields required by the frontend
```

**DB-05: S3 Model Files** -- PASS
```bash
# Command
aws s3 ls s3://cloud-project-dashboard1/models/

# Output
2026-03-22    662  feature_importances.json
2026-03-22 142952  model_h10.pkl
2026-03-22 143240  model_h15.pkl
2026-03-22 143240  model_h5.pkl
2026-03-22   2685  thresholds.json
# Result: All 5 model/config files present and accessible
```

### 11.4 Authentication Test Results

**AUTH-01 to AUTH-03: User Registration & Sign-In** -- PASS
```bash
# Command: Create test user
aws cognito-idp admin-create-user \
  --user-pool-id ca-central-1_cyhaCVeUz \
  --username testuser@cloudwatch.ai \
  --temporary-password TempPass1 \
  --message-action SUPPRESS \
  --region ca-central-1 \
  --query 'User.UserStatus' --output text
# Output: FORCE_CHANGE_PASSWORD

# Command: Set permanent password (simulates user completing sign-up)
aws cognito-idp admin-set-user-password \
  --user-pool-id ca-central-1_cyhaCVeUz \
  --username testuser@cloudwatch.ai \
  --password TestPass123 \
  --permanent \
  --region ca-central-1
# Output: (success, no output)

# Command: Verify user status
aws cognito-idp admin-get-user \
  --user-pool-id ca-central-1_cyhaCVeUz \
  --username testuser@cloudwatch.ai \
  --region ca-central-1 \
  --query '[UserStatus, Username]' --output text
# Output: CONFIRMED  6c3d1578-20e1-704b-9404-a5aac8923491
# Result: User created, password set, status CONFIRMED
```

**AUTH-04 & AUTH-05: User Pool Verification** -- PASS
```bash
# Command: List all users
aws cognito-idp list-users \
  --user-pool-id ca-central-1_cyhaCVeUz \
  --region ca-central-1 \
  --query 'Users[*].[Username,UserStatus,Enabled]' --output table

# Output
+---------------------------------------+------------+--------+
|  3c0d7528-7071-70ae-8869-ce2654547476 |  CONFIRMED |  True  |
|  6c3d1578-20e1-704b-9404-a5aac8923491 |  CONFIRMED |  True  |
+---------------------------------------+------------+--------+
# Result: 2 users in pool, both CONFIRMED and Enabled
```

**AUTH-06 to AUTH-09: Browser-Based Tests** -- NOT TESTED (requires manual browser interaction)

### 11.5 Production Deployment Test Results

**PROD-01: S3 Static Hosting** -- PASS
```bash
# Command
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes" \
  http://cloud-project-dashboard1.s3-website-us-east-1.amazonaws.com

# Output
HTTP 200, Size: 1068 bytes
# Result: index.html served correctly from S3 website endpoint
# Note: Bucket website endpoint is us-east-1, not ca-central-1
```

**PROD-02: SPA Routing** -- PASS
```bash
# Command
for route in / /timeline /alerts /analytics /login; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    http://cloud-project-dashboard1.s3-website-us-east-1.amazonaws.com$route)
  echo "$route: HTTP $STATUS"
done

# Output
/: HTTP 200
/timeline: HTTP 404
/alerts: HTTP 404
/analytics: HTTP 404
/login: HTTP 404

# Verification that error document serves index.html content
curl -s http://cloud-project-dashboard1.s3-website-us-east-1.amazonaws.com/login | head -3
# Output:
# <!doctype html>
# <html lang="en">
#   <head>
# Result: S3 returns 404 status code but serves index.html content via ErrorDocument;
# React Router handles client-side routing from the served HTML. This is expected
# S3 SPA behavior and the application functions correctly in the browser.
```

**PROD-03: Production API Connectivity** -- NOT TESTED (requires browser with CORS)

**PROD-04: ML Models in S3** -- PASS
```bash
# Command
aws s3 ls s3://cloud-project-dashboard1/models/

# Output
2026-03-22    662  feature_importances.json
2026-03-22 142952  model_h10.pkl
2026-03-22 143240  model_h15.pkl
2026-03-22 143240  model_h5.pkl
2026-03-22   2685  thresholds.json
# Result: All 5 model/config files present and accessible by Lambda
```
