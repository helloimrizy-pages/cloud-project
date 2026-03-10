# Project Specification: CloudWatch AI

**Real-Time AIOps Platform for Predictive Incident Detection in Cloud Services**

---

**Course:** CS6905 – Cloud Information Management Systems  
**Instructor:** Dr. Shadi Aljendi  
**Team:** Alfarizy Alfarizy (3810253), Akinbobola Akin (3784664), Ishimwe Pacis Hanyurwimfura (3787234)  
**Date:** February 25, 2026

---

## 1. Overview

CloudWatch AI is a real-time AIOps platform that predicts cloud service incidents before they impact users. Instead of relying on reactive threshold-based alerts, the system uses a trained Gradient Boosting classifier on streaming KPI metrics and log-derived signals to issue early warnings with high precision and actionable lead times. The platform runs entirely within AWS free-tier constraints.

### 1.1 Core Objective

Deliver at least **15 minutes of warning** before an incident occurs, with **prediction precision > 0.85**, while keeping false alarms below **one per KPI per 24 hours**.

### 1.2 Key Results (from Paper)

| Metric | Value |
|---|---|
| Best precision (GBC KPI+Logs, H=15) | 0.91 |
| Baseline precision (Static threshold) | 0.63 |
| Mean lead time (operational window) | ~36 minutes |
| Median lead time range | 31–38 minutes |
| False alarm budget | ≤1 per KPI per 24h |

---

## 2. Problem Statement

Cloud systems generate continuous streams of event logs and performance metrics. Most organizations still manage incidents reactively—monitoring tools alert only after degradation has begun. This leads to two compounding problems:

1. **No warning time** — operators cannot intervene before outages begin.
2. **Alert fatigue** — static threshold alerts generate excessive false alarms, causing operators to ignore warnings.

CloudWatch AI addresses both by shifting from reactive detection to **lead-time-aware predictive detection**, where the system anticipates incidents and issues reliable, early warnings.

---

## 3. System Architecture

### 3.1 High-Level Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌───────────────────┐    ┌──────────────┐    ┌────────────┐
│ Data         │───▶│ DynamoDB     │───▶│ Feature           │───▶│ ML Inference  │───▶│ Dashboard  │
│ Simulator    │    │ Ingestion    │    │ Engineering       │    │ + Alerting    │    │ + Alerts   │
└─────────────┘    └──────────────┘    └───────────────────┘    └──────────────┘    └────────────┘
   5 service          KPIMetrics         Rolling stats +          GBC classifier      Real-time
   types              ServiceLogs        log-proxy features       multi-horizon        web UI
```

### 3.2 Component Breakdown

#### Stage 1: Data Simulator
- Generates realistic metrics and logs from **5 cloud service types**:
  - Web API (URL paths, response times, HTTP status codes)
  - Database Pool (connection counts, query durations, pool utilization)
  - Message Queue (queue depth, throughput, consumer lag)
  - Authentication Service (login events, MFA flags, failure rates)
  - ML Pipeline (inference latency, batch throughput, model accuracy drift)
- Each service emits data continuously at configurable intervals.
- Simulates both normal operation and incident scenarios (gradual degradation, sudden spikes, cascading failures).

#### Stage 2: Data Ingestion & Storage (DynamoDB)
- Receives streaming data via AWS Lambda.
- Stores heterogeneous log schemas as JSON documents in a single table design.
- Supports high-frequency time-series writes via horizontal scalability.
- TTL-based automatic data expiration for cost management.

#### Stage 3: Feature Engineering Pipeline
- Triggered automatically by **DynamoDB Streams** (no polling or cron jobs).
- Computes rolling window features aligned with prediction horizon.
- Window size formula: `w = (H × 60) / Δ` where H = horizon (min), Δ = sampling interval (sec).
- Outputs stored in **FeatureStore** table.

#### Stage 4: ML Inference & Alerting
- Gradient Boosting classifier deployed via **AWS Lambda** or **SageMaker endpoint**.
- Multi-horizon prediction at **H = 5, 10, 15 minutes**.
- Per-KPI calibrated alert thresholds (training-data quantile method).
- Alert grouping: related warnings aggregated into incident records.
- Notifications via **Amazon SNS**.

#### Stage 5: Dashboard
- Static frontend hosted on **Amazon S3**.
- Connected to backend via **Amazon API Gateway** (REST).
- Displays: real-time data streams, active alerts, incident history, model performance metrics.

---

## 4. Data Model (DynamoDB)

### 4.1 Table Schema

| Table | Partition Key | Sort Key | Purpose |
|---|---|---|---|
| `KPIMetrics` | `service_id` | `timestamp` | Raw KPI time-series values |
| `ServiceLogs` | `service_id` | `timestamp` | Variable-schema log documents per service type |
| `FeatureStore` | `service_id` | `timestamp` | Computed feature vectors (8 features per record) |
| `Alerts` | `alert_id` | `timestamp` | Individual alert records with confidence scores |
| `Incidents` | `incident_id` | `created_at` | Grouped incidents with affected services, remarks |

### 4.2 Why DynamoDB

- **Schema flexibility** — each service type has a different log structure (response times vs. connection counts vs. MFA flags). A document model avoids wide sparse tables or per-service relational tables.
- **Time-series writes** — horizontal scalability handles high-frequency ingestion.
- **TTL** — automatic expiration of old metrics without manual cleanup.
- **Streams** — native change-data-capture triggers the feature engineering pipeline.

---

## 5. Machine Learning Component

### 5.1 Dataset

**AIOps KPI Anomaly Detection Dataset** (2018 AIOps Challenge):
- 2.4 million timesteps across 26 cloud service KPI metrics.
- Expert-annotated binary anomaly labels.
- Six real-world KPI series from large-scale production systems.
- Sampling intervals vary per KPI (typically every minute).

### 5.2 Problem Formulation

Incident detection is framed as a **horizon-aware supervised learning task**:

Given KPI observations up to time *t*, predict whether an incident will begin within the next *h* minutes.

Forward-looking label:

```
y_t^(h) = 1  if ∃ t' ∈ [t, t+h] such that label(t') = 1
         0  otherwise
```

Three independent horizons: **h ∈ {5, 10, 15}** minutes.

### 5.3 Feature Engineering

**KPI Statistical Features (5):**

| Feature | Description |
|---|---|
| `roll_mean` | Rolling mean within window |
| `roll_max` | Rolling maximum within window |
| `roll_std` | Rolling standard deviation (ddof=0) |
| `roll_slope` | OLS slope within window |
| `first_diff` | First difference of KPI values |

**Log-Proxy Features (3):**

| Feature | Description |
|---|---|
| `error_rate` | Fraction of timesteps with |z-score| > 3 |
| `warn_rate` | Large jumps exceeding 2× rolling std dev |
| `severity_change_flag` | Activates when either rate shifts >50% vs. previous window |

Total: **8 features** per KPI per timestep (KPI+Logs configuration).

### 5.4 Models Trained

18 models total (3 horizons × 2 feature sets × 3 classifiers):

| Classifier | Config |
|---|---|
| Gradient Boosting (GBC) | 100 trees, depth 3, learning rate 0.1 |
| Random Forest (RF) | 100 trees, depth 3 |
| Logistic Regression (LR) | max 1000 iterations |

All models trained on pooled data from 26 KPIs with per-KPI z-score normalization (train stats frozen, applied to test).

### 5.5 Alert Threshold Calibration

- Target: ≤1 false alert per KPI per 24 hours.
- Target FPR: `1 / (24 × 3600 / Δ)` where Δ = sampling interval.
- Threshold set to `(1 - FPR_target)` quantile of normal training scores.
- Per-KPI calibration (score distributions vary across services).
- Thresholds fixed during testing — no data leakage.

### 5.6 Evaluation Framework

**Dual-window approach:**

| Window | Range | Purpose |
|---|---|---|
| Strict | `[T−H, T)` | Tests genuine anticipatory behavior within trained horizon |
| Operational | `[T−60min, T)` | Reflects real deployment — any warning within past hour counts |

**Lead time** = `(T − t_alert) / 60` in minutes, where T = incident onset, t_alert = earliest alert in window.

---

## 6. AWS Infrastructure

All services operate within **AWS Free Tier** limits.

| Service | Free Tier Limit | Role |
|---|---|---|
| Amazon DynamoDB | 25 GB, 25 RCU/WCU | Primary NoSQL database for all tables |
| AWS Lambda | 1M requests/month | Data intake, feature computation, ML inference |
| Amazon API Gateway | 1M calls/month | REST API connecting dashboard to backend |
| Amazon S3 | 5 GB | Model artifacts + static frontend hosting |
| Amazon SageMaker | 250 hrs t2.medium | Model training + optional endpoint hosting |
| Amazon SNS | 1M publishes/month | Alert notifications to operators |
| DynamoDB Streams | Included | Triggers feature engineering on new data |

---

## 7. Dashboard Requirements

### 7.1 Views

1. **Real-Time Stream** — live KPI values per service with anomaly highlighting.
2. **Active Alerts** — current alerts with confidence scores, horizon, affected service.
3. **Incident History** — grouped incidents with timeline, affected services, resolution status, operator remarks.
4. **Model Performance** — precision, recall, lead time distributions, false alarm rates per KPI.

### 7.2 Interactions

- Filter by service type, time range, alert severity.
- Acknowledge/dismiss alerts.
- Add operator remarks to incidents.
- Toggle prediction horizon (5 / 10 / 15 min).

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| DynamoDB over relational DB | Variable log schemas per service; high-frequency time-series writes; TTL; Streams for event-driven pipeline |
| Lambda over EC2 | Event-driven, intermittent workload; no need for always-on compute |
| Gradient Boosting over deep learning | Competitive performance with simpler deployment; interpretable feature importance; lightweight for Lambda inference |
| Log-proxy features over raw logs | Dataset lacks raw logs; synthetic proxies (error rate, warn rate, severity change) demonstrably improve precision from 0.63 → 0.91 |
| Per-KPI threshold calibration | Score distributions differ across services; uniform threshold would be suboptimal |
| Dual-window evaluation | Strict window validates genuine prediction; operational window validates practical usefulness |

---

## 9. Known Limitations

1. **Synthetic log-proxy features** — the AIOps dataset does not contain raw logs, so log features are derived from KPI behavior. Real log data would likely improve detection.
2. **Degenerate windows** — six KPIs sampled every 300 seconds at H=5 reduce to single-timestep windows, producing degenerate rolling statistics.
3. **Low recall** — the best configuration detects 6.88–9.06% of incidents under the operational window. Precision is prioritized to keep alerts trustworthy.
4. **Fixed hyperparameters** — no hyperparameter search was performed. Tuning could improve results.
5. **Single-KPI prediction** — the model predicts per-KPI independently. Cross-service correlation modeling could capture cascading failures.

---

## 10. Future Work

- Integrate **real log data** and additional observability signals (traces, topology).
- Implement **cross-service correlation** for cascading failure detection.
- Explore **attention-based or transformer models** for longer-horizon prediction.
- Add **root cause analysis** to accompany alerts with probable failure source.
- Conduct **hyperparameter optimization** and model selection on a validation set.
- Evaluate on **live production data** beyond the AIOps benchmark dataset.

---

## 11. Project Timeline

| Phase | Deliverable | Target |
|---|---|---|
| Phase 1 | Data simulator + DynamoDB schema + ingestion pipeline | Week 3–4 |
| Phase 2 | Feature engineering pipeline + FeatureStore | Week 5–6 |
| Phase 3 | ML model training + threshold calibration + Lambda deployment | Week 7–8 |
| Phase 4 | Dashboard + API Gateway + SNS integration | Week 9–10 |
| Phase 5 | End-to-end testing + evaluation + final report | Week 11–12 |

---

## 12. References

- Li, Z. et al. (2022). Constructing large-scale real-world benchmark datasets for AIOps. *arXiv:2208.03938*.
- Notaro, P. et al. (2021). A survey of AIOps methods for failure management. *ACM TOIT*.
- Soldani, J. & Brogi, A. (2022). Anomaly detection and failure root cause analysis in (micro)service-based cloud applications. *ACM Computing Surveys*.
- Full reference list available in the accompanying research paper.
