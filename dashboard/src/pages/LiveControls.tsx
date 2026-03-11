import { services, simulationState } from '../data/mockData';
import ServiceHealthCard from '../components/ServiceHealthCard';

const summaryCards = [
  { label: 'Scenario', value: simulationState.scenario },
  { label: 'Current Phase', value: simulationState.phase },
  { label: 'Tick Progress', value: `${simulationState.tick} / ${simulationState.totalTicks}` },
  { label: 'Predictions', value: String(simulationState.predictionsProcessed) },
];

export default function LiveControls() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Live Controls</h2>

      {/* Controls Row */}
      <div className="flex items-center gap-4">
        <div className="bg-bg-card border border-border rounded-lg px-4 py-2">
          <label className="text-xs text-text-muted block mb-1">Scenario</label>
          <select
            className="bg-bg-active text-text-primary text-sm rounded px-3 py-1.5 border border-border outline-none"
            defaultValue="web-api-degradation"
          >
            <option value="web-api-degradation">Web API Degradation</option>
            <option value="db-cascade">DB Cascade Failure</option>
            <option value="normal">Normal Operations</option>
          </select>
        </div>
        <button
          className="px-5 py-2 rounded-lg bg-bg-active text-text-muted border border-border text-sm cursor-not-allowed opacity-60"
          disabled
        >
          Start
        </button>
        <button className="px-5 py-2 rounded-lg bg-danger/20 text-danger border border-danger/30 text-sm hover:bg-danger/30 transition-colors">
          Stop
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="w-2 h-2 rounded-full bg-healthy animate-pulse" />
          <span className="text-sm text-healthy font-medium">Running</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-text-muted mb-1">{card.label}</p>
            <p className="text-lg font-semibold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Service Health Grid */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3">Service Health</h3>
        <div className="grid grid-cols-5 gap-4">
          {services.map(svc => (
            <ServiceHealthCard key={svc.id} service={svc} />
          ))}
        </div>
      </div>
    </div>
  );
}
