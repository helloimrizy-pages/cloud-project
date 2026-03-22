import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, ResponsiveContainer, Legend, ZAxis,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';
import { chartColors } from '../lib/chartColors';

export default function Analytics() {
  useTheme(); // subscribe to theme changes so chartColors() reads fresh CSS vars
  const c = chartColors();

  const { data: summaryStats, loading: summaryLoading } = useApi(() => api.getSummary());
  const { data: analyticsMethods, loading: methodsLoading } = useApi(() => api.getMethods());
  const { data: featureImportances, loading: featuresLoading } = useApi(() => api.getFeatures());
  const { data: leadTimeDistributions, loading: leadTimesLoading } = useApi(() => api.getLeadTimes());

  if (summaryLoading || methodsLoading || featuresLoading || leadTimesLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-7 w-48 bg-bg-card rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-bg-card rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-72 bg-bg-card rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = summaryStats ? [
    { label: 'Best Precision', value: summaryStats.bestPrecision.toFixed(2), sub: 'GBC + Logs, H=15' },
    { label: 'Mean Lead Time', value: `${summaryStats.meanLeadTime}m`, sub: 'H=15 horizon' },
    { label: 'False Alarm Rate', value: summaryStats.falseAlarmRate, sub: 'Per day' },
    { label: 'Detection Rate', value: `${summaryStats.detectionRate}%`, sub: 'GBC + Logs' },
  ] : [];

  const scatterByMethod = (analyticsMethods ?? []).map(method => ({
    name: method.name,
    color: method.color,
    data: [5, 10, 15].map(h => ({
      precision: method.precision[h],
      detectionRate: method.detectionRate[h],
      horizon: h,
    })),
  }));

  const leadTimeBarData = (leadTimeDistributions ?? []).map(d => ({
    name: `H=${d.horizon}`,
    min: d.min,
    q1: d.q1 - d.min,
    median: d.median - d.q1,
    q3: d.q3 - d.median,
    max: d.max - d.q3,
    rawMin: d.min,
    rawQ1: d.q1,
    rawMedian: d.median,
    rawQ3: d.q3,
    rawMax: d.max,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Model Analytics</h2>
        <p className="text-sm text-text-muted mt-1">Performance metrics and feature analysis</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">{card.label}</p>
            <p className="text-2xl font-semibold text-accent font-mono tracking-tight">{card.value}</p>
            <p className="text-[11px] text-text-secondary mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Precision vs Detection Rate */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Precision vs Detection Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis type="number" dataKey="detectionRate" name="Detection Rate" unit="%" stroke={c.axis} tick={{ fontSize: 12 }} label={{ value: 'Detection Rate (%)', position: 'bottom', offset: -5, style: { fill: c.labelFill, fontSize: 11 } }} />
              <YAxis type="number" dataKey="precision" name="Precision" domain={[0.3, 1]} stroke={c.axis} tick={{ fontSize: 12 }} label={{ value: 'Precision', angle: -90, position: 'insideLeft', style: { fill: c.labelFill, fontSize: 11 } }} />
              <ZAxis range={[80, 80]} />
              <Tooltip
                contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, boxShadow: c.tooltipShadow }}
                labelStyle={{ color: c.textPrimary }}
                itemStyle={{ color: c.textPrimary }}
                formatter={(value: unknown, name: unknown) => [name === 'Precision' ? Number(value).toFixed(2) : `${value}%`, String(name)]}
              />
              <Legend />
              {scatterByMethod.map(method => (
                <Scatter key={method.name} name={method.name} data={method.data} fill={method.color} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Time Distribution */}
        <div className="bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Lead Time Distribution (GBC + Logs)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadTimeBarData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
              <XAxis dataKey="name" stroke={c.axis} tick={{ fontSize: 12 }} />
              <YAxis stroke={c.axis} tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: c.labelFill, fontSize: 11 } }} />
              <Tooltip
                cursor={{ fill: c.info, fillOpacity: 0.06 }}
                contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, boxShadow: c.tooltipShadow }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Record<string, number | string>;
                  return (
                    <div style={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, padding: '10px 14px', boxShadow: c.tooltipShadow }}>
                      <p style={{ color: c.textPrimary, fontSize: 12, fontWeight: 600, margin: '0 0 6px' }}>{p.name}</p>
                      <p style={{ color: c.labelFill, fontSize: 12, margin: 2 }}>Min: <span style={{ color: c.textPrimary }}>{p.rawMin}m</span></p>
                      <p style={{ color: c.labelFill, fontSize: 12, margin: 2 }}>Q1: <span style={{ color: c.textPrimary }}>{p.rawQ1}m</span></p>
                      <p style={{ color: c.labelFill, fontSize: 12, margin: 2, fontWeight: 600 }}>Median: <span style={{ color: c.info, fontWeight: 700 }}>{p.rawMedian}m</span></p>
                      <p style={{ color: c.labelFill, fontSize: 12, margin: 2 }}>Q3: <span style={{ color: c.textPrimary }}>{p.rawQ3}m</span></p>
                      <p style={{ color: c.labelFill, fontSize: 12, margin: 2 }}>Max: <span style={{ color: c.textPrimary }}>{p.rawMax}m</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="min" stackId="box" fill="transparent" />
              <Bar dataKey="q1" stackId="box" fill={c.info} fillOpacity={0.4} />
              <Bar dataKey="median" stackId="box" fill={c.info} fillOpacity={0.7} />
              <Bar dataKey="q3" stackId="box" fill={c.info} fillOpacity={0.4} />
              <Bar dataKey="max" stackId="box" fill="transparent" stroke={c.info} strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Importance */}
        <div className="bg-bg-card border border-border rounded-xl p-4 col-span-2">
          <h3 className="text-sm font-semibold text-text-secondary mb-1">Feature Importance (H=15, GBC + Logs)</h3>
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-sm bg-info" />
              KPI Feature
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-sm bg-danger" />
              Log-Proxy Feature
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={featureImportances ?? []} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
              <XAxis type="number" stroke={c.axis} tick={{ fontSize: 12 }} domain={[0, 0.35]} />
              <YAxis type="category" dataKey="feature" stroke={c.axis} tick={{ fontSize: 12 }} width={90} />
              <Tooltip
                cursor={{ fill: c.info, fillOpacity: 0.06 }}
                contentStyle={{ backgroundColor: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, boxShadow: c.tooltipShadow }}
                labelStyle={{ color: c.textPrimary }}
                itemStyle={{ color: c.textPrimary }}
                formatter={(value: unknown) => [Number(value).toFixed(2), 'Importance']}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {(featureImportances ?? []).map((entry, index) => (
                  <Cell key={index} fill={entry.type === 'kpi' ? c.info : c.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
