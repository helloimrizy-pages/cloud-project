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
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-7 w-40 bg-bg-card rounded-lg" />
        <div className="h-12 w-96 bg-bg-card rounded-xl" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-bg-card rounded-xl" />)}
        </div>
      </div>
    );
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
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Live Controls</h2>
        <p className="text-sm text-text-muted mt-1">Manage simulation scenarios and monitor service health</p>
      </div>

      {/* Controls Row */}
      <div className="flex items-end gap-3">
        <div>
          <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Scenario</label>
          <select
            className="bg-bg-card text-text-primary text-sm rounded-lg px-3 py-2 border border-border outline-none focus:border-accent/50 transition-colors"
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value)}
          >
            {scenarios.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            isRunning
              ? 'bg-bg-active text-text-muted border border-border cursor-not-allowed opacity-50'
              : 'bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25 active:scale-[0.98]'
          }`}
          disabled={isRunning}
          onClick={handleStart}
        >
          Start
        </button>
        <button
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            isRunning
              ? 'bg-danger/15 text-danger border border-danger/20 hover:bg-danger/25 active:scale-[0.98]'
              : 'bg-bg-active text-text-muted border border-border cursor-not-allowed opacity-50'
          }`}
          disabled={!isRunning}
          onClick={handleStop}
        >
          Stop
        </button>
        <div className="flex items-center gap-2 ml-3 px-3 py-2 rounded-lg bg-bg-card border border-border">
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-healthy animate-pulse' : 'bg-text-muted'}`} />
          <span className={`text-xs font-medium uppercase tracking-wider ${isRunning ? 'text-healthy' : 'text-text-muted'}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">{card.label}</p>
            <p className="text-lg font-semibold text-text-primary tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Service Health Grid */}
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-3">Service Health</h3>
        <div className="grid grid-cols-5 gap-4">
          {(services ?? []).map(svc => (
            <ServiceHealthCard key={svc.id} service={svc} />
          ))}
        </div>
      </div>
    </div>
  );
}
