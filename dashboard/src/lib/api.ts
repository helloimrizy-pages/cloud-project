import type {
  ServiceInfo, KPIDataPoint, Alert, Incident,
  AnalyticsMethod, FeatureImportance, LeadTimeDistribution,
  SimulationState, SummaryStats,
} from '../data/types';

import { getIdToken } from './auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: token } : {}),
    },
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  getServices:        ()                               => apiFetch<ServiceInfo[]>('/services'),
  getKPI:             (serviceId: string)               => apiFetch<KPIDataPoint[]>(`/kpi/${serviceId}`),
  getThresholds:      ()                               => apiFetch<Record<string, number>>('/thresholds'),
  getActiveAlerts:    ()                               => apiFetch<Alert[]>('/alerts/active'),
  getAlertHistory:    ()                               => apiFetch<Alert[]>('/alerts/history'),
  getIncidents:       ()                               => apiFetch<Incident[]>('/incidents'),
  getSummary:         ()                               => apiFetch<SummaryStats>('/analytics/summary'),
  getMethods:         ()                               => apiFetch<AnalyticsMethod[]>('/analytics/methods'),
  getFeatures:        ()                               => apiFetch<FeatureImportance[]>('/analytics/features'),
  getLeadTimes:       ()                               => apiFetch<LeadTimeDistribution[]>('/analytics/lead-times'),
  getSimulationState: ()                               => apiFetch<SimulationState>('/simulation/state'),
  startSimulation:    (body: { scenario: string })     => apiFetch<{ message: string }>('/simulation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  stopSimulation:     ()                               => apiFetch<{ message: string }>('/simulation/stop', { method: 'POST' }),
  acknowledgeAlert:   (id: string)                     => apiFetch<{ acknowledged: boolean }>(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  getNotificationStatus: ()                            => apiFetch<{ email: string; subscribed: boolean; pending: boolean }>('/notifications/status'),
  subscribe:          ()                               => apiFetch<{ message: string; email: string }>('/notifications/subscribe', { method: 'POST' }),
  unsubscribe:        ()                               => apiFetch<{ message: string; email: string }>('/notifications/unsubscribe', { method: 'POST' }),
};
