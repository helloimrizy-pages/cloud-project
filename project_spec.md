# Project Specification: CloudWatch AI

**Real-Time AIOps Platform for Predictive Incident Detection in Cloud Services**

**Course:** CS6905 – Cloud Information Management Systems
**Instructor:** Dr. Shadi Aljendi
**Team:** Alfarizy Alfarizy (3810253), Akinbobola Akin (3784664), Ishimwe Pacis Hanyurwimfura (3787234)

---

## 1. What This Project Does

CloudWatch AI predicts cloud service incidents before they happen. Instead of alerting operators after something breaks, the system uses machine learning to warn them early — giving them time to act.

The best model achieves **0.91 precision** with **~36 minutes of warning** before incidents, while keeping false alarms to at most one per service per day.

---

## 2. How It Works (Big Picture)

The platform simulates 5 cloud services running in real time. Every minute, a Lambda function generates fake KPI metrics and logs — as if real services are running. This data flows through the ML pipeline automatically, and the dashboard updates live so the user can watch the system detect incidents as they happen.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                              │
│                                                                      │
│   React + TypeScript + Vite (hosted on S3)                          │
│                                                                      │
│   ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌──────────────┐  │
│   │  Live       │  │  KPI       │  │  Alerts   │  │  Model       │  │
│   │  Controls   │  │  Timeline  │  │  Panel    │  │  Analytics   │  │
│   └─────┬──────┘  └─────▲──────┘  └─────▲─────┘  └──────▲───────┘  │
│         │               │               │                │          │
└─────────┼───────────────┼───────────────┼────────────────┼──────────┘
          │               │               │                │
          ▼               │               │                │
┌──────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (REST)                               │
│  POST /start  POST /stop  GET /metrics  GET /alerts  GET /analytics  │
└──┬───────────────────────────┬───────────────┬───────────────┬───────┘
   │                           │               │               │
   ▼                           ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        AWS LAMBDA (Python)                            │
│                                                                      │
│  ┌──────────────┐                                                    │
│  │  EventBridge  │ ─── triggers every 1 minute ──┐                   │
│  └──────────────┘                                │                   │
│                                                  ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Simulator    │  │  Feature Eng  │  │  Inference   │               │
│  │  Lambda       │  │  Lambda       │  │  Lambda      │               │
│  │               │  │               │  │              │               │
│  │  Generates    │  │  Computes 8   │  │  Loads model │               │
│  │  fake KPI +   │  │  rolling      │  │  from S3     │               │
│  │  logs for 5   │  │  features     │  │  Predicts    │               │
│  │  services     │  │               │  │              │               │
│  └──────┬────┘  └──▲────┬────┘  └──▲────┬────┘               │
│         │          │    │          │    │                      │
│         │     DynamoDB  │     DynamoDB  │                      │
│         │     Streams   │     Streams   │                      │
│         ▼          │    ▼          │    ▼                      │
│  ┌───────────────────────────────────────────┐                │
│  │           DynamoDB (5 tables)              │                │
│  │  KPIMetrics → FeatureStore → Alerts       │                │
│  │  ServiceLogs    Incidents                  │                │
│  └───────────────────────────────────────────┘                │
│                                                                │
│  ┌──────────────┐                                              │
│  │  S3 Bucket   │  trained_model.pkl + scenario_config.json    │
│  └──────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Where It Runs |
|---|---|---|
| Frontend | React + TypeScript + Vite | S3 (static website hosting) |
| API | Amazon API Gateway | AWS (managed) |
| Backend | Python Lambda functions | AWS Lambda |
| Scheduler | Amazon EventBridge | Triggers Simulator Lambda every 1 min |
| Database | Amazon DynamoDB | AWS (managed) |
| ML Model | scikit-learn (Gradient Boosting) | Trained locally, deployed as .pkl on S3 |
| Pipeline triggers | DynamoDB Streams | Automatic, event-driven |

Everything runs on AWS free tier. No servers to manage.

---

## 4. Data Flow

### Step 1: Simulator Generates Data (every 1 minute)

**Amazon EventBridge** triggers the **Simulator Lambda** every minute. This Lambda generates realistic KPI metrics and logs for all 5 cloud services — as if they're actually running. It writes the data directly to DynamoDB.

The simulator follows a **scenario schedule** that controls when incidents happen:

```
Minutes 0–5:    All services normal
Minutes 5–7:    Web API response times start creeping up
Minutes 7–8:    Error rate spikes, DB pool slows down
Minute 8:       Model fires alert (2 min before full incident)
Minutes 9–12:   Full incident across Web API + DB Pool
Minutes 12–15:  Recovery — metrics trend back to normal
Minutes 15+:    Normal operation resumes
```

This guarantees an incident happens within the demo window, so the audience can watch the model detect it live.

### Step 2: Feature Engineering (automatic)

When new records land in `KPIMetrics`, **DynamoDB Streams** triggers the **Feature Engineering Lambda**. For each service, it extracts the primary metric and computes 8 rolling features:

| # | Feature | What it captures |
|---|---|---|
| 1 | roll_mean | Average level in the window |
| 2 | roll_max | Peak value in the window |
| 3 | roll_std | Variability |
| 4 | roll_slope | Trend direction |
| 5 | first_diff | Short-term change |
| 6 | error_rate | Fraction of extreme spikes (z > 3) |
| 7 | warn_rate | Fraction of large jumps |
| 8 | severity_change_flag | Sudden shift in error/warn patterns |

These 8 numbers are written to the `FeatureStore` table.

### Step 3: Inference (automatic)

When new features land in `FeatureStore`, **DynamoDB Streams** triggers the **Inference Lambda**. It loads the trained Gradient Boosting model (cached from S3), runs prediction, and if the score exceeds the calibrated threshold → writes an alert to the `Alerts` table.

### Step 4: Dashboard Updates Live

The frontend polls `GET /metrics`, `GET /alerts`, and `GET /analytics` every few seconds. The KPI timeline scrolls forward in real time, and alerts appear the moment the model fires them.

---

## 5. Simulator Lambda

This is the data source for the entire platform. It runs as a Lambda function triggered by EventBridge every 1 minute.

### What It Generates

Each invocation produces one record per service containing rich JSON with different fields per service type (this justifies DynamoDB over a relational DB):

**Web API** — response_time_ms, requests_per_second, error_rate, http_5xx_count
**Database Pool** — active_connections, query_duration_avg_ms, deadlock_count
**Message Queue** — queue_depth, consumer_lag, dead_letter_queue_size
**Auth Service** — login_success_rate, auth_latency_ms, mfa_challenge_rate
**ML Pipeline** — inference_latency_ms, model_accuracy, data_drift_score

### Scenario Config

The simulator reads a `scenario_config.json` from S3 that defines when incidents occur. This keeps the scenario editable without redeploying the Lambda. Example:

```json
{
  "scenario_name": "web_api_degradation",
  "duration_minutes": 15,
  "phases": [
    { "start": 0, "end": 5, "state": "normal" },
    { "start": 5, "end": 8, "state": "degrading", "services": ["web-api-001", "db-pool-001"] },
    { "start": 8, "end": 12, "state": "incident", "services": ["web-api-001", "db-pool-001"] },
    { "start": 12, "end": 15, "state": "recovery" }
  ]
}
```

### How It Tracks Time

The Lambda stores a `simulation_tick` counter in a DynamoDB config table. Each invocation increments the tick by 1, checks the scenario config to determine the current phase, and generates metrics accordingly. The dashboard can call `POST /start` to reset the tick and begin a new scenario, or `POST /stop` to disable the EventBridge rule.

---

## 6. What the Model Actually Sees

The model doesn't see the rich JSON. The Feature Engineering Lambda extracts **one primary metric** per service and computes 8 features from it:

| Service | Primary Metric |
|---|---|
| Web API | response_time_ms |
| Database Pool | query_duration_avg_ms |
| Message Queue | queue_depth |
| Auth Service | auth_latency_ms |
| ML Pipeline | inference_latency_ms |

The rich JSON is for **storage and dashboard display**. The model gets a simple 8-number feature vector per timestep.

---

## 7. DynamoDB Tables

| Table | Partition Key | Sort Key | What It Stores |
|---|---|---|---|
| KPIMetrics | service_id | timestamp | Raw metrics from each service (variable schema) |
| ServiceLogs | service_id | timestamp | Event logs with different fields per service type |
| FeatureStore | service_id | timestamp | 8 computed features per timestep |
| Alerts | alert_id | timestamp | Predictions that crossed the threshold |
| Incidents | incident_id | created_at | Grouped alerts with operator remarks |
| SimConfig | config_key | — | Simulation tick counter, active scenario, running state |

**Why DynamoDB:** Each service type has a completely different log structure. A relational DB would need many nullable columns or separate tables. DynamoDB stores each record as a flexible JSON document in one table.

---

## 8. Backend (Lambda Functions)

All backend code is Python, deployed as Lambda functions.

### Scheduled Lambda (triggered by EventBridge)

| Trigger | Lambda | What It Does |
|---|---|---|
| EventBridge (every 1 min) | Simulator | Generates fake KPI + logs for 5 services, writes to DynamoDB |

### Stream-Triggered Lambdas (triggered by DynamoDB Streams)

| Trigger | Lambda | What It Does |
|---|---|---|
| New record in KPIMetrics | Feature Engineering | Computes 8 rolling features, writes to FeatureStore |
| New record in FeatureStore | Inference | Runs model, writes alerts if threshold exceeded |

### API-Facing Lambdas (triggered by API Gateway)

| Endpoint | Lambda | What It Does |
|---|---|---|
| POST /start | Start Simulation | Resets tick counter, enables EventBridge rule, begins new scenario |
| POST /stop | Stop Simulation | Disables EventBridge rule, stops data generation |
| GET /metrics | Metrics | Queries KPIMetrics, returns time-series for live charts |
| GET /alerts | Alerts | Returns active/historical alerts with scores |
| PATCH /alerts/{id} | Alert Update | Acknowledge or dismiss an alert |
| GET /incidents | Incidents | Returns grouped incidents |
| GET /analytics | Analytics | Returns model performance stats |

---

## 9. Frontend (Dashboard)

Built with **React + TypeScript + Vite**, hosted on **S3** as a static website. Uses **Recharts** for visualizations. Polls the backend every 3–5 seconds for live updates.

### Page 1: Live Controls

- **Start Simulation** / **Stop Simulation** buttons
- Scenario selector dropdown (pick which incident scenario to run)
- Live status indicator: running / stopped
- Elapsed time and current simulation phase
- Summary cards: services monitored, records generated, active alerts

### Page 2: KPI Timeline (live scrolling)

- Time-series line chart that scrolls forward as new data arrives
- One line per service (or tabbed per service)
- Incident regions shaded in red as they occur
- Prediction score overlay with threshold line
- Dropdown to switch horizons (5/10/15 min)

### Page 3: Alerts & Incidents

- Alerts table: timestamp, service, horizon, confidence, status
- Color-coded severity badges
- Incident groups: related alerts clustered with a timeline bar showing lead time
- Acknowledge/dismiss buttons

### Page 4: Model Analytics

- **Precision vs Detection Rate** scatter plot (GBC vs baselines)
- **Lead Time Distribution** box plot across horizons
- **Feature Importance** bar chart showing which features matter most
- Summary cards: precision, mean lead time, false alarm rate

---

## 10. ML Model Summary

**Training data:** AIOps KPI dataset — 2.4M timesteps across 26 cloud service metrics.

**Model:** Gradient Boosting Classifier (100 trees, depth 3, learning rate 0.1).

**How it predicts:** Given the past H minutes of a KPI, predict whether an incident will start in the next H minutes. Three horizons: 5, 10, 15 minutes.

**Alert calibration:** Each service gets its own threshold, tuned so that at most 1 false alert fires per 24 hours. Thresholds are set from training data and frozen for testing.

**Best result:** GBC with KPI+Log-proxy features at H=15 → precision 0.91, mean lead time ~36 minutes.

---

## 11. Deployment

Everything is serverless and deployed to AWS:

```
S3 Bucket A  →  React build files (npm run build → dist/ → upload)
S3 Bucket B  →  trained_model.pkl + scenario_config.json
Lambda       →  ~9 Python functions (the entire backend)
EventBridge  →  Triggers Simulator Lambda every 1 minute
API Gateway  →  REST routes pointing to each Lambda
DynamoDB     →  6 tables (5 data + 1 config) with Streams enabled
```

To access the app, anyone opens the S3 URL in their browser. No local setup needed.

**CORS:** API Gateway must allow requests from the S3 domain.

**Lambda Layers:** scikit-learn, numpy, pandas packaged as a Lambda Layer shared across functions.

**Free Tier Usage:** ~43,200 Lambda invocations/month for the simulator (1/min × 30 days) — well within the 1M free tier limit.

---

## 12. Demo Flow

This is how we'd present the project:

1. Open the dashboard URL in a browser
2. Select a scenario (e.g., "Web API Degradation")
3. Click **Start Simulation**
4. Watch the KPI Timeline — all services show normal behavior
5. After a few minutes, Web API response times start creeping up
6. The prediction score rises on the chart
7. An alert fires — the Alerts panel highlights it with a confidence score
8. The incident fully develops — dashboard shades the region red
9. Recovery begins — metrics trend back down
10. Switch to Model Analytics to show precision, lead time, feature importance
11. Click **Stop Simulation**

Total demo time: ~10–15 minutes.

---

## 13. Security Notes

In this prototype, all data is synthetic — no real user data or PII. In a production deployment:

- Data encrypted in transit (HTTPS via API Gateway) and at rest (DynamoDB default encryption)
- Access controlled via IAM policies
- S3 buckets private (no public access except the frontend bucket)
- Real logs would need anonymization before ingestion
- TTL on DynamoDB tables auto-deletes old records

---

## 14. Known Limitations

- **Synthetic log features** — log-proxy features are derived from KPI values, not actual logs
- **Low recall** — model detects ~7–9% of incidents, but precision is prioritized for trustworthiness
- **One metric per service** — model doesn't correlate across services for cascading failures
- **No hyperparameter tuning** — fixed model configs; tuning could improve results
- **Simulated data** — the simulator produces controlled scenarios, not real production traffic

---

## 15. Project Timeline

| Phase | What | When |
|---|---|---|
| 1 | Simulator Lambda + DynamoDB tables + EventBridge setup | Week 3–4 |
| 2 | Feature engineering Lambda + FeatureStore | Week 5–6 |
| 3 | ML model deployment + inference Lambda + alert calibration | Week 7–8 |
| 4 | React dashboard + API Gateway + live polling | Week 9–10 |
| 5 | End-to-end testing + demo scenarios + final report | Week 11–12 |
