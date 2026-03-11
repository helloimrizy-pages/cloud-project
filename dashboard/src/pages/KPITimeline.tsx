import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';
import { services, kpiData, thresholds } from '../data/mockData';

const serviceColors: Record<string, string> = {
  'web-api-001': '#e74c3c',
  'db-pool-001': '#f39c12',
  'msg-queue-001': '#2ecc71',
  'auth-svc-001': '#3498db',
  'ml-pipeline-001': '#9b59b6',
};

export default function KPITimeline() {
  const [selectedService, setSelectedService] = useState('web-api-001');
  const [horizon, setHorizon] = useState(15);

  const data = kpiData[selectedService];
  const service = services.find(s => s.id === selectedService)!;
  const threshold = thresholds[horizon];
  const isAllView = selectedService === 'all';

  // Build "all services" overlay data
  const allData = Array.from({ length: 15 }, (_, i) => {
    const point: Record<string, number | string> = { minute: i, timestamp: kpiData['web-api-001'][i].timestamp };
    for (const svc of services) {
      point[`${svc.id}_value`] = kpiData[svc.id][i].value;
      point[`${svc.id}_score`] = kpiData[svc.id][i].predictionScore;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">KPI Timeline</h2>

      {/* Service Tabs */}
      <div className="flex gap-1 bg-bg-card rounded-lg p-1 border border-border">
        {services.map(svc => (
          <button
            key={svc.id}
            onClick={() => setSelectedService(svc.id)}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              selectedService === svc.id
                ? 'text-white font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            style={selectedService === svc.id ? { backgroundColor: serviceColors[svc.id] + '33', color: serviceColors[svc.id] } : {}}
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
        <span className="text-xs text-text-muted ml-3">Threshold: {threshold.toFixed(3)}</span>
      </div>

      {/* KPI Value Chart */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          {isAllView ? 'All Services — KPI Values' : `${service.name} — ${service.metricName} (${service.metricUnit})`}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={(isAllView ? allData : data) as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="timestamp" stroke="#4a4a6a" tick={{ fontSize: 12 }} />
            <YAxis stroke="#4a4a6a" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
              labelStyle={{ color: '#8892b0' }}
            />
            {!isAllView && (
              <>
                <ReferenceArea x1="14:04" x2="14:07" fill="#f39c12" fillOpacity={0.1} />
                <ReferenceArea x1="14:07" x2="14:12" fill="#e74c3c" fillOpacity={0.1} />
              </>
            )}
            {isAllView ? (
              services.map(svc => (
                <Line
                  key={svc.id}
                  type="monotone"
                  dataKey={`${svc.id}_value`}
                  stroke={serviceColors[svc.id]}
                  strokeWidth={2}
                  dot={false}
                  name={svc.name}
                />
              ))
            ) : (
              <Line type="monotone" dataKey="value" stroke={serviceColors[selectedService]} strokeWidth={2} dot={{ r: 3 }} />
            )}
            {isAllView && <Legend />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Prediction Score Chart */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          {isAllView ? 'All Services — Prediction Scores' : `${service.name} — Prediction Score`}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={(isAllView ? allData : data) as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="timestamp" stroke="#4a4a6a" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 1]} stroke="#4a4a6a" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
              labelStyle={{ color: '#8892b0' }}
            />
            <ReferenceLine y={threshold} stroke="#e74c3c" strokeDasharray="5 5" label={{ value: `Threshold (${threshold})`, fill: '#e74c3c', fontSize: 11, position: 'right' }} />
            <ReferenceLine y={0.5} stroke="#4a4a6a" strokeDasharray="3 3" label={{ value: 'p=0.5', fill: '#4a4a6a', fontSize: 11, position: 'right' }} />
            {isAllView ? (
              services.map(svc => (
                <Line
                  key={svc.id}
                  type="monotone"
                  dataKey={`${svc.id}_score`}
                  stroke={serviceColors[svc.id]}
                  strokeWidth={2}
                  dot={false}
                  name={svc.name}
                />
              ))
            ) : (
              <Line type="monotone" dataKey="predictionScore" stroke="#64ffda" strokeWidth={2} dot={{ r: 3 }} />
            )}
            {isAllView && <Legend />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
