import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import type { KPIDataPoint } from '../data/types';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import { chartColors } from '../lib/chartColors';

const serviceColors: Record<string, string> = {
  'web-api-001': '#e74c3c',
  'db-pool-001': '#f39c12',
  'msg-queue-001': '#2ecc71',
  'auth-svc-001': '#3498db',
  'ml-pipeline-001': '#9b59b6',
  'mq-001': '#2ecc71',
  'auth-001': '#3498db',
};

export default function KPITimeline() {
  useTheme(); // subscribe to theme changes so chartColors() reads fresh CSS vars
  const c = chartColors();

  const { data: services, loading: svcLoading } = useApi(() => api.getServices());
  const { data: rawThresholds, loading: threshLoading } = useApi(() => api.getThresholds());

  const [selectedService, setSelectedService] = useState('web-api-001');
  const [horizon, setHorizon] = useState(15);
  const [kpiData, setKpiData] = useState<Record<string, KPIDataPoint[]>>({});
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const isAllView = selectedService === 'all';

  useEffect(() => {
    if (!services) return;

    const fetchKpi = () => {
      let cancelled = false;
      setKpiLoading(prev => kpiData[selectedService] ? false : prev);
      setKpiError(null);

      const promise = isAllView
        ? Promise.all(services.map(svc => api.getKPI(svc.id).then(d => [svc.id, d] as const)))
            .then(entries => { if (!cancelled) setKpiData(Object.fromEntries(entries)); })
        : api.getKPI(selectedService)
            .then(d => { if (!cancelled) setKpiData(prev => ({ ...prev, [selectedService]: d })); });

      promise
        .catch((err: Error) => { if (!cancelled) setKpiError(err.message); })
        .finally(() => { if (!cancelled) setKpiLoading(false); });

      return () => { cancelled = true; };
    };

    const cancel = fetchKpi();
    const id = setInterval(fetchKpi, 15000);
    return () => { cancel(); clearInterval(id); };
  }, [selectedService, services]);

  const allData = useMemo(() => {
    if (!isAllView || kpiLoading || !services) return [];
    const maxLen = Math.max(...services.map(svc => kpiData[svc.id]?.length ?? 0), 0);
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number | string> = { minute: i, timestamp: kpiData[services[0]?.id]?.[i]?.timestamp ?? '' };
      for (const svc of services) {
        const dp = kpiData[svc.id]?.[i];
        if (dp) {
          point[`${svc.id}_value`] = dp.value;
          point[`${svc.id}_score`] = dp.predictionScore;
        }
      }
      return point;
    });
  }, [isAllView, kpiLoading, services, kpiData]);

  if (svcLoading || threshLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-7 w-40 bg-bg-card rounded-lg" />
        <div className="h-10 w-full bg-bg-card rounded-xl" />
        <div className="h-72 bg-bg-card rounded-xl" />
      </div>
    );
  }

  if (!services || !rawThresholds) return null;

  const data = kpiData[selectedService] ?? [];
  const service = services.find(s => s.id === selectedService);
  const threshold = rawThresholds[String(horizon)];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">KPI Timeline</h2>
        <p className="text-sm text-text-muted mt-1">Real-time service metrics and prediction scores</p>
      </div>

      {/* Service Tabs */}
      <div className="flex gap-1 bg-bg-card rounded-xl p-1 border border-border">
        {services.map(svc => (
          <button
            key={svc.id}
            onClick={() => setSelectedService(svc.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all duration-150 ${
              selectedService === svc.id
                ? 'text-white font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            style={selectedService === svc.id ? { backgroundColor: (serviceColors[svc.id] ?? '#8892b0') + '33', color: serviceColors[svc.id] ?? '#8892b0' } : {}}
          >
            {svc.name}
          </button>
        ))}
        <button
          onClick={() => setSelectedService('all')}
          className={`px-4 py-2 rounded text-sm transition-colors ${
            isAllView ? 'bg-bg-active text-accent font-medium' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All Services
        </button>
      </div>

      {/* Horizon Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted">Horizon:</span>
        {[5, 10, 15].map(h => (
          <button
            key={h}
            onClick={() => setHorizon(h)}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              horizon === h
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-secondary hover:border-text-muted'
            }`}
          >
            {h}m
          </button>
        ))}
        <span className="text-xs text-text-muted ml-3">Threshold: {threshold?.toFixed(3) ?? '—'}</span>
      </div>

      {kpiLoading ? (
        <div className="text-text-muted p-8">Loading KPI data...</div>
      ) : kpiError ? (
        <div className="text-danger p-8">Failed to load KPI data: {kpiError}</div>
      ) : (
        <>
          {/* KPI Value Chart */}
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              {isAllView ? 'All Services — KPI Values' : `${service?.name ?? ''} — ${service?.metricName ?? ''} (${service?.metricUnit ?? ''})`}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={(isAllView ? allData : data) as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis dataKey="timestamp" stroke={c.axis} tick={{ fontSize: 12 }} />
                <YAxis stroke={c.axis} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, boxShadow: c.tooltipShadow }}
                  labelStyle={{ color: c.textPrimary }}
                  itemStyle={{ color: c.textPrimary }}
                />
                {!isAllView && data.length > 12 && (
                  <>
                    <ReferenceArea x1={data[4]?.timestamp} x2={data[7]?.timestamp} fill={c.warning} fillOpacity={0.1} />
                    <ReferenceArea x1={data[7]?.timestamp} x2={data[12]?.timestamp} fill={c.danger} fillOpacity={0.1} />
                  </>
                )}
                {isAllView ? (
                  services.map(svc => (
                    <Line
                      key={svc.id}
                      type="monotone"
                      dataKey={`${svc.id}_value`}
                      stroke={serviceColors[svc.id] ?? '#8892b0'}
                      strokeWidth={2}
                      dot={false}
                      name={svc.name}
                    />
                  ))
                ) : (
                  <Line type="monotone" dataKey="value" stroke={serviceColors[selectedService] ?? '#8892b0'} strokeWidth={2} dot={{ r: 3 }} />
                )}
                {isAllView && <Legend />}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Prediction Score Chart */}
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              {isAllView ? 'All Services — Prediction Scores' : `${service?.name ?? ''} — Prediction Score`}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={(isAllView ? allData : data) as Record<string, unknown>[]}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
                <XAxis dataKey="timestamp" stroke={c.axis} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 1]} stroke={c.axis} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, boxShadow: c.tooltipShadow }}
                  labelStyle={{ color: c.textPrimary }}
                  itemStyle={{ color: c.textPrimary }}
                />
                {threshold != null && (
                  <ReferenceLine y={threshold} stroke={c.danger} strokeDasharray="5 5" label={{ value: `Threshold (${threshold})`, fill: c.danger, fontSize: 11, position: 'right' }} />
                )}
                <ReferenceLine y={0.5} stroke={c.axis} strokeDasharray="3 3" label={{ value: 'p=0.5', fill: c.axis, fontSize: 11, position: 'right' }} />
                {isAllView ? (
                  services.map(svc => (
                    <Line
                      key={svc.id}
                      type="monotone"
                      dataKey={`${svc.id}_score`}
                      stroke={serviceColors[svc.id] ?? '#8892b0'}
                      strokeWidth={2}
                      dot={false}
                      name={svc.name}
                    />
                  ))
                ) : (
                  <Line type="monotone" dataKey="predictionScore" stroke={c.accent} strokeWidth={2} dot={{ r: 3 }} />
                )}
                {isAllView && <Legend />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
