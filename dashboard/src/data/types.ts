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

export interface SimulationState {
  scenario: string;
  phase: string;
  tick: number;
  totalTicks: number;
  predictionsProcessed: number;
  status: 'running' | 'stopped' | 'idle';
}

export interface SummaryStats {
  bestPrecision: number;
  meanLeadTime: number;
  falseAlarmRate: string;
  detectionRate: number;
}
