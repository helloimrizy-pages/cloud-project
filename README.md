# CloudWatch AI

Real-time AIOps platform for predictive incident detection in cloud services. Uses Gradient Boosting models to predict service degradation up to 15 minutes in advance, achieving 0.91 precision with ~36-minute lead time and fewer than 1 false alarm per service per day.

**Course:** CS6905 -- Cloud Information Management Systems, University of New Brunswick

## Architecture

```
React Dashboard (S3)
        |
   API Gateway
        |
  Lambda Functions
        |
   +-----------+-----------+
   |           |           |
Simulator   Feature     Inference
(EventBridge  Engineering  (loads models
 1/min)      (DynamoDB     from S3)
              Streams)
   |           |           |
   +-----+-----+-----+----+
         |           |
      DynamoDB      S3
      (6 tables)   (models,
                    configs)
```

**Services monitored:** Web API, DB Pool, Message Queue, Auth Service, ML Pipeline

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Recharts |
| API | AWS API Gateway (HTTP API) |
| Compute | AWS Lambda (Python 3.11, Docker) |
| Database | DynamoDB (6 tables with Streams) |
| Storage | S3 (models, frontend, configs) |
| Scheduler | EventBridge (1-min interval) |
| ML | scikit-learn Gradient Boosting Classifier |

## Project Structure

```
.
├── dashboard/                  # Frontend application
│   ├── src/
│   │   ├── components/         # Layout, Sidebar, ServiceHealthCard
│   │   ├── pages/              # LiveControls, KPITimeline, Alerts, Analytics
│   │   ├── hooks/              # useApi, useTheme
│   │   ├── lib/                # API client, chart colors
│   │   └── data/               # TypeScript type definitions
│   └── vite.config.ts
├── inference-final/            # Lambda inference function
│   ├── lambda_function.py      # Prediction handler
│   ├── Dockerfile              # Lambda container image
│   ├── data/
│   │   └── retrain_and_export.py  # Model training script
│   └── output/                 # Trained models + thresholds
│       ├── model_h5.pkl
│       ├── model_h10.pkl
│       ├── model_h15.pkl
│       ├── thresholds.json
│       └── feature_importances.json
├── work.ipynb                  # Analysis notebook
├── project_spec.md             # Project specification
└── Backend.postman_collection.json  # API documentation
```

## ML Pipeline

**Models:** 3 Gradient Boosting Classifiers (one per prediction horizon: 5, 10, 15 minutes)

**Training:** 100 trees, max depth 3, learning rate 0.1, trained on the AIOps KPI dataset (2.4M timesteps across 26 cloud services).

**Features (8):**

| Feature | Type | Importance |
|---------|------|-----------|
| roll_mean | KPI | 31.1% |
| error_rate | Log | 26.6% |
| roll_max | KPI | 19.8% |
| roll_std | KPI | 12.9% |
| severity_change_flag | Log | 4.6% |
| first_diff | KPI | 3.5% |
| roll_slope | KPI | 1.0% |
| warn_rate | Log | 0.4% |

**Performance:**

| Metric | Value |
|--------|-------|
| Precision | 0.91 |
| Mean Lead Time | ~36 min |
| False Alarm Rate | <=1/day per service |
| Detection Rate | 8.7% |

## API Endpoints

Base URL: `https://p9fpx4nhh6.execute-api.ca-central-1.amazonaws.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services` | List monitored services |
| GET | `/kpi/{service_id}` | KPI time series for a service |
| GET | `/thresholds` | Alert thresholds per horizon |
| GET | `/alerts/active` | Active alerts |
| GET | `/alerts/history` | Historical alerts |
| POST | `/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/incidents` | Grouped incidents |
| GET | `/simulation/state` | Simulation status |
| POST | `/simulation/start` | Start simulation (body: `{ scenario }`) |
| POST | `/simulation/stop` | Stop simulation |
| GET | `/analytics/summary` | Summary statistics |
| GET | `/analytics/methods` | Model comparison |
| GET | `/analytics/features` | Feature importance |
| GET | `/analytics/lead-times` | Lead time distribution |

## Getting Started

### Frontend

```bash
cd dashboard
npm install
npm run dev
```

The dev server proxies `/api` requests to the API Gateway. Open `http://localhost:5173`.

### Retrain Models

```bash
cd inference-final/data
python retrain_and_export.py
```

Outputs `.pkl` models and `thresholds.json` to `inference-final/output/`.

### Deploy Lambda

```bash
cd inference-final
docker build -t cloudwatch-inference .
# Push to ECR, update Lambda function
```

## Dashboard Pages

- **Live Controls** -- Start/stop simulation scenarios, monitor service health in real time
- **KPI Timeline** -- Time-series charts with prediction score overlays and threshold lines
- **Alerts** -- Active and historical alerts with severity badges, incident timelines
- **Analytics** -- Model precision vs detection rate, lead time distributions, feature importance

Supports dark and light themes with persistent preference.

## DynamoDB Tables

| Table | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| KPIMetrics | service_id | timestamp | Raw service metrics |
| ServiceLogs | service_id | timestamp | Event logs |
| FeatureStore | service_id | timestamp | Computed features |
| Alerts | alert_id | -- | Prediction alerts |
| Incidents | incident_id | -- | Grouped alerts |
| SimConfig | config_id | -- | Simulation state |

## Team

- Alfarizy Alfarizy (3810253)
- Akinbobola Akin (3784664)
- Ishimwe Pacis Hanyurwimfura (3787234)
