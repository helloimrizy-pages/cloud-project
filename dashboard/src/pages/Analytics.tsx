import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, ResponsiveContainer, Legend, ZAxis,
} from 'recharts';
import {
  summaryStats, analyticsMethods, featureImportances, leadTimeDistributions,
} from '../data/mockData';

const statCards = [
  { label: 'Best Precision', value: summaryStats.bestPrecision.toFixed(2), sub: 'GBC + Logs, H=15' },
  { label: 'Mean Lead Time', value: `${summaryStats.meanLeadTime}m`, sub: 'H=15 horizon' },
  { label: 'False Alarm Rate', value: summaryStats.falseAlarmRate, sub: 'Per day' },
  { label: 'Detection Rate', value: `${summaryStats.detectionRate}%`, sub: 'GBC + Logs' },
];

export default function Analytics() {
  // Group scatter data by method for multiple Scatter components
  const scatterByMethod = analyticsMethods.map(method => ({
    name: method.name,
    color: method.color,
    data: [5, 10, 15].map(h => ({
      precision: method.precision[h],
      detectionRate: method.detectionRate[h],
      horizon: h,
    })),
  }));

  // Lead time box plot proxy: grouped bars
  const leadTimeBarData = leadTimeDistributions.map(d => ({
    name: `H=${d.horizon}`,
    min: d.min,
    q1: d.q1 - d.min,
    median: d.median - d.q1,
    q3: d.q3 - d.median,
    max: d.max - d.q3,
    // raw values for tooltip
    rawMin: d.min,
    rawQ1: d.q1,
    rawMedian: d.median,
    rawQ3: d.q3,
    rawMax: d.max,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Model Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-text-muted mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-accent">{card.value}</p>
            <p className="text-xs text-text-secondary mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Precision vs Detection Rate */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Precision vs Detection Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis type="number" dataKey="detectionRate" name="Detection Rate" unit="%" stroke="#4a4a6a" tick={{ fontSize: 12 }} label={{ value: 'Detection Rate (%)', position: 'bottom', offset: -5, style: { fill: '#8892b0', fontSize: 11 } }} />
              <YAxis type="number" dataKey="precision" name="Precision" domain={[0.3, 1]} stroke="#4a4a6a" tick={{ fontSize: 12 }} label={{ value: 'Precision', angle: -90, position: 'insideLeft', style: { fill: '#8892b0', fontSize: 11 } }} />
              <ZAxis range={[80, 80]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
                labelStyle={{ color: '#8892b0' }}
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
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Lead Time Distribution (GBC + Logs)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={leadTimeBarData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="name" stroke="#4a4a6a" tick={{ fontSize: 12 }} />
              <YAxis stroke="#4a4a6a" tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: '#8892b0', fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
                formatter={(_value: unknown, name: unknown, props: unknown) => {
                  const p = (props as { payload: Record<string, number> }).payload;
                  const n = String(name);
                  if (n === 'min') return [`${p.rawMin}m`, 'Min'];
                  if (n === 'q1') return [`${p.rawQ1}m`, 'Q1'];
                  if (n === 'median') return [`${p.rawMedian}m`, 'Median'];
                  if (n === 'q3') return [`${p.rawQ3}m`, 'Q3'];
                  if (n === 'max') return [`${p.rawMax}m`, 'Max'];
                  return [String(_value), n];
                }}
              />
              <Bar dataKey="min" stackId="box" fill="#1a1a2e" />
              <Bar dataKey="q1" stackId="box" fill="#3498db" fillOpacity={0.4} />
              <Bar dataKey="median" stackId="box" fill="#3498db" fillOpacity={0.7} />
              <Bar dataKey="q3" stackId="box" fill="#3498db" fillOpacity={0.4} />
              <Bar dataKey="max" stackId="box" fill="#1a1a2e" stroke="#3498db" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Importance */}
        <div className="bg-bg-card border border-border rounded-lg p-4 col-span-2">
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
            <BarChart data={featureImportances} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" horizontal={false} />
              <XAxis type="number" stroke="#4a4a6a" tick={{ fontSize: 12 }} domain={[0, 0.35]} />
              <YAxis type="category" dataKey="feature" stroke="#4a4a6a" tick={{ fontSize: 12 }} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8 }}
                formatter={(value: unknown) => [Number(value).toFixed(2), 'Importance']}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {featureImportances.map((entry, index) => (
                  <Cell key={index} fill={entry.type === 'kpi' ? '#3498db' : '#e74c3c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
