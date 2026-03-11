// ── Types ──────────────────────────────────────────────────────────────────

export interface ServiceInfo {
  id: string;
  name: string;
  type: string;
  status: 'healthy' | 'warning' | 'critical';
  metricName: string;
  metricUnit: string;
  currentValue: number;
}

export interface KPIDataPoint {
  minute: number;
  timestamp: string;
  value: number;
  predictionScore: number;
}

export interface Alert {
  id: string;
  serviceId: string;
  serviceName: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  predictionScore: number;
  threshold: number;
  horizon: number;
  leadTime: number;
  firedAt: string;
  minute: number;
  acknowledged: boolean;
  description: string;
}

export interface Incident {
  id: string;
  title: string;
  affectedServices: string[];
  phases: { label: string; start: number; end: number; color: string }[];
  leadTime: number;
  status: 'active' | 'resolved';
}

export interface AnalyticsMethod {
  name: string;
  precision: Record<number, number>;
  detectionRate: Record<number, number>;
  color: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  type: 'kpi' | 'log';
}

export interface LeadTimeDistribution {
  horizon: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

// ── Services ───────────────────────────────────────────────────────────────

export const services: ServiceInfo[] = [
  { id: 'web-api-001', name: 'Web API', type: 'API Gateway', status: 'critical', metricName: 'Response Time', metricUnit: 'ms', currentValue: 387 },
  { id: 'db-pool-001', name: 'DB Pool', type: 'Database', status: 'warning', metricName: 'Query Duration', metricUnit: 'ms', currentValue: 245 },
  { id: 'msg-queue-001', name: 'Message Queue', type: 'Queue', status: 'healthy', metricName: 'Queue Depth', metricUnit: 'msgs', currentValue: 42 },
  { id: 'auth-svc-001', name: 'Auth Service', type: 'Authentication', status: 'healthy', metricName: 'Auth Latency', metricUnit: 'ms', currentValue: 18 },
  { id: 'ml-pipeline-001', name: 'ML Pipeline', type: 'Compute', status: 'healthy', metricName: 'Inference Time', metricUnit: 'ms', currentValue: 95 },
];

// ── KPI Time-Series Data ───────────────────────────────────────────────────

function makeTimestamp(minute: number): string {
  const base = new Date('2026-03-10T14:00:00Z');
  base.setMinutes(base.getMinutes() + minute);
  return base.toISOString().slice(11, 16);
}

const webApiValues = [118, 125, 132, 148, 195, 267, 342, 421, 448, 452, 438, 412, 356, 278, 165];
const webApiScores = [0.08, 0.10, 0.14, 0.22, 0.41, 0.63, 0.81, 0.923, 0.94, 0.92, 0.88, 0.78, 0.52, 0.31, 0.12];

const dbPoolValues = [45, 48, 52, 58, 89, 145, 198, 256, 278, 265, 234, 189, 142, 98, 62];
const dbPoolScores = [0.05, 0.07, 0.09, 0.15, 0.32, 0.54, 0.72, 0.871, 0.89, 0.85, 0.74, 0.56, 0.34, 0.18, 0.08];

const msgQueueValues = [38, 42, 40, 44, 41, 39, 43, 42, 45, 41, 38, 40, 42, 39, 41];
const msgQueueScores = [0.03, 0.04, 0.05, 0.04, 0.06, 0.05, 0.07, 0.06, 0.08, 0.05, 0.04, 0.05, 0.03, 0.04, 0.03];

const authSvcValues = [15, 17, 16, 18, 19, 17, 18, 20, 19, 18, 17, 16, 18, 17, 16];
const authSvcScores = [0.02, 0.03, 0.02, 0.04, 0.03, 0.05, 0.04, 0.06, 0.05, 0.04, 0.03, 0.04, 0.02, 0.03, 0.02];

const mlPipeValues = [92, 95, 91, 98, 94, 96, 93, 97, 95, 92, 94, 96, 91, 93, 95];
const mlPipeScores = [0.04, 0.05, 0.03, 0.06, 0.05, 0.04, 0.07, 0.05, 0.06, 0.04, 0.05, 0.03, 0.04, 0.05, 0.04];

function buildKPI(values: number[], scores: number[]): KPIDataPoint[] {
  return values.map((v, i) => ({
    minute: i,
    timestamp: makeTimestamp(i),
    value: v,
    predictionScore: scores[i],
  }));
}

export const kpiData: Record<string, KPIDataPoint[]> = {
  'web-api-001': buildKPI(webApiValues, webApiScores),
  'db-pool-001': buildKPI(dbPoolValues, dbPoolScores),
  'msg-queue-001': buildKPI(msgQueueValues, msgQueueScores),
  'auth-svc-001': buildKPI(authSvcValues, authSvcScores),
  'ml-pipeline-001': buildKPI(mlPipeValues, mlPipeScores),
};

// ── Thresholds per horizon ─────────────────────────────────────────────────

export const thresholds: Record<number, number> = {
  5: 0.912,
  10: 0.867,
  15: 0.847,
};

// ── Alerts ─────────────────────────────────────────────────────────────────

export const alerts: Alert[] = [
  {
    id: 'ALT-001',
    serviceId: 'web-api-001',
    serviceName: 'Web API',
    severity: 'CRITICAL',
    predictionScore: 0.923,
    threshold: 0.847,
    horizon: 15,
    leadTime: 38,
    firedAt: '14:07',
    minute: 7,
    acknowledged: false,
    description: 'Predicted incident: response time degradation exceeding SLA threshold within 15 minutes',
  },
  {
    id: 'ALT-002',
    serviceId: 'db-pool-001',
    serviceName: 'DB Pool',
    severity: 'WARNING',
    predictionScore: 0.871,
    threshold: 0.852,
    horizon: 15,
    leadTime: 34,
    firedAt: '14:08',
    minute: 8,
    acknowledged: false,
    description: 'Predicted incident: query duration increase indicating connection pool saturation',
  },
];

export const pastAlerts: Alert[] = [
  {
    id: 'ALT-098',
    serviceId: 'web-api-001',
    serviceName: 'Web API',
    severity: 'WARNING',
    predictionScore: 0.862,
    threshold: 0.847,
    horizon: 10,
    leadTime: 22,
    firedAt: '12:45',
    minute: 0,
    acknowledged: true,
    description: 'Predicted latency spike — resolved after auto-scaling',
  },
  {
    id: 'ALT-097',
    serviceId: 'msg-queue-001',
    serviceName: 'Message Queue',
    severity: 'INFO',
    predictionScore: 0.512,
    threshold: 0.847,
    horizon: 15,
    leadTime: 0,
    firedAt: '11:30',
    minute: 0,
    acknowledged: true,
    description: 'Elevated queue depth detected — false positive, returned to normal',
  },
  {
    id: 'ALT-096',
    serviceId: 'db-pool-001',
    serviceName: 'DB Pool',
    severity: 'CRITICAL',
    predictionScore: 0.934,
    threshold: 0.847,
    horizon: 15,
    leadTime: 41,
    firedAt: '09:15',
    minute: 0,
    acknowledged: true,
    description: 'Connection pool exhaustion predicted — mitigated by pool expansion',
  },
];

// ── Incidents ──────────────────────────────────────────────────────────────

export const incidents: Incident[] = [
  {
    id: 'INC-001',
    title: 'Web API / DB Pool Cascading Degradation',
    affectedServices: ['Web API', 'DB Pool'],
    phases: [
      { label: 'Normal', start: 0, end: 4, color: '#2ecc71' },
      { label: 'Alert Fired', start: 4, end: 7, color: '#f39c12' },
      { label: 'Degrading', start: 7, end: 9, color: '#e67e22' },
      { label: 'Incident', start: 9, end: 12, color: '#e74c3c' },
      { label: 'Recovery', start: 12, end: 15, color: '#3498db' },
    ],
    leadTime: 38,
    status: 'active',
  },
];

// ── Analytics Data ─────────────────────────────────────────────────────────

export const analyticsMethods: AnalyticsMethod[] = [
  {
    name: 'GBC + Logs',
    precision: { 5: 0.88, 10: 0.90, 15: 0.91 },
    detectionRate: { 5: 5.2, 10: 7.1, 15: 8.7 },
    color: '#64ffda',
  },
  {
    name: 'GBC KPI',
    precision: { 5: 0.84, 10: 0.86, 15: 0.88 },
    detectionRate: { 5: 4.1, 10: 5.8, 15: 7.2 },
    color: '#3498db',
  },
  {
    name: 'Baseline Static',
    precision: { 5: 0.42, 10: 0.44, 15: 0.45 },
    detectionRate: { 5: 1.8, 10: 2.2, 15: 2.5 },
    color: '#8892b0',
  },
  {
    name: 'Baseline MA',
    precision: { 5: 0.49, 10: 0.51, 15: 0.52 },
    detectionRate: { 5: 2.1, 10: 2.6, 15: 3.0 },
    color: '#4a4a6a',
  },
];

export const featureImportances: FeatureImportance[] = [
  { feature: 'roll_std', importance: 0.32, type: 'kpi' },
  { feature: 'error_rate', importance: 0.27, type: 'log' },
  { feature: 'roll_slope', importance: 0.18, type: 'kpi' },
  { feature: 'warn_rate', importance: 0.08, type: 'log' },
  { feature: 'roll_mean', importance: 0.06, type: 'kpi' },
  { feature: 'roll_max', importance: 0.04, type: 'kpi' },
  { feature: 'first_diff', importance: 0.03, type: 'kpi' },
  { feature: 'severity_change_flag', importance: 0.02, type: 'log' },
];

export const leadTimeDistributions: LeadTimeDistribution[] = [
  { horizon: 5, min: 3, q1: 8, median: 12, q3: 16, max: 22 },
  { horizon: 10, min: 8, q1: 16, median: 22, q3: 28, max: 38 },
  { horizon: 15, min: 12, q1: 24, median: 36, q3: 44, max: 58 },
];

// ── Summary Stats ──────────────────────────────────────────────────────────

export const summaryStats = {
  bestPrecision: 0.91,
  meanLeadTime: 36,
  falseAlarmRate: '≤1/day',
  detectionRate: 8.7,
};

export const simulationState = {
  scenario: 'Web API Degradation',
  phase: 'Degrading',
  tick: 6,
  totalTicks: 15,
  predictionsProcessed: 42,
  status: 'running' as const,
};
