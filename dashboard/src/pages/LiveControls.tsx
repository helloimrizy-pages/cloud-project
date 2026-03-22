import { useState } from 'react';
import ServiceHealthCard from '../components/ServiceHealthCard';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';

const scenarios = [
  { label: 'Web API Degradation', value: 'web_api_degradation' },
  { label: 'DB Cascade Failure', value: 'db_cascade_failure' },
  { label: 'Normal Operations', value: 'baseline' },
];

export default function LiveControls() {
  const { data: services, loading: svcLoading } = useApi(() => api.getServices());
  const { data: simState, loading: simLoading, refetch: refetchSim } = useApi(() => api.getSimulationState());
  const [selectedScenario, setSelectedScenario] = useState('web_api_degradation');

  if (svcLoading || simLoading) {
    return <div className="text-text-muted p-8">Loading...</div>;
  }

  const isRunning = simState?.status === 'running';

  const summaryCards = simState ? [
    { label: 'Scenario', value: simState.scenario },
    { label: 'Current Phase', value: simState.phase },
    { label: 'Tick Progress', value: `${simState.tick} / ${simState.totalTicks}` },
    { label: 'Predictions', value: String(simState.predictionsProcessed) },
  ] : [];

  const handleStart = async () => {
    try {
      await api.startSimulation({ scenario: selectedScenario });
      refetchSim();
    } catch (err) {
      console.error('Failed to start simulation:', err);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopSimulation();
      refetchSim();
    } catch (err) {
      console.error('Failed to stop simulation:', err);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Live Controls</h2>

      {/* Controls Row */}
      <div className="flex items-center gap-4">
        <div className="bg-bg-card border border-border rounded-lg px-4 py-2">
          <label className="text-xs text-text-muted block mb-1">Scenario</label>
          <select
            className="bg-bg-active text-text-primary text-sm rounded px-3 py-1.5 border border-border outline-none"
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value)}
          >
            {scenarios.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          className={`px-5 py-2 rounded-lg text-sm transition-colors ${
            isRunning
              ? 'bg-bg-active text-text-muted border border-border cursor-not-allowed opacity-60'
              : 'bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30'
          }`}
          disabled={isRunning}
          onClick={handleStart}
        >
          Start
        </button>
        <button
          className={`px-5 py-2 rounded-lg text-sm transition-colors ${
            isRunning
              ? 'bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30'
              : 'bg-bg-active text-text-muted border border-border cursor-not-allowed opacity-60'
          }`}
          disabled={!isRunning}
          onClick={handleStop}
        >
          Stop
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-healthy animate-pulse' : 'bg-text-muted'}`} />
          <span className={`text-sm font-medium ${isRunning ? 'text-healthy' : 'text-text-muted'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
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
          {(services ?? []).map(svc => (
            <ServiceHealthCard key={svc.id} service={svc} />
          ))}
        </div>
      </div>
    </div>
  );
}
