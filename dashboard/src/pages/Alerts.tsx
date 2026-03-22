import { useState } from 'react';
import type { Alert } from '../data/types';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';

const severityColors: Record<string, { border: string; bg: string; text: string }> = {
  CRITICAL: { border: 'border-danger', bg: 'bg-danger/10', text: 'text-danger' },
  WARNING: { border: 'border-warning', bg: 'bg-warning/10', text: 'text-warning' },
  INFO: { border: 'border-info', bg: 'bg-info/10', text: 'text-info' },
};

function AlertCard({ alert, onAcknowledge, onDismiss }: { alert: Alert; onAcknowledge?: () => void; onDismiss?: () => void }) {
  const colors = severityColors[alert.severity];
  return (
    <div className={`bg-bg-card border-l-4 ${colors.border} rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text-primary">{alert.serviceName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-xs text-text-secondary">{alert.description}</p>
        </div>
        <span className="text-xs text-text-muted">{alert.id}</span>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
        <div>
          <span className="text-text-muted">Score</span>
          <p className={`font-mono font-bold ${colors.text}`}>{alert.predictionScore.toFixed(3)}</p>
        </div>
        <div>
          <span className="text-text-muted">Threshold</span>
          <p className="font-mono text-text-secondary">{alert.threshold.toFixed(3)}</p>
        </div>
        <div>
          <span className="text-text-muted">Horizon</span>
          <p className="text-text-secondary">{alert.horizon}m</p>
        </div>
        <div>
          <span className="text-text-muted">Lead Time</span>
          <p className="text-text-secondary">{alert.leadTime > 0 ? `${alert.leadTime}m` : '—'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-muted">Fired at {alert.firedAt}</span>
        {!alert.acknowledged && onAcknowledge && onDismiss && (
          <div className="flex gap-2">
            <button onClick={onAcknowledge} className="text-xs px-3 py-1 rounded border border-accent text-accent hover:bg-accent/10 transition-colors">
              Acknowledge
            </button>
            <button onClick={onDismiss} className="text-xs px-3 py-1 rounded border border-border text-text-muted hover:border-danger hover:text-danger transition-colors">
              Dismiss
            </button>
          </div>
        )}
        {alert.acknowledged && (
          <span className="text-xs text-text-muted italic">Acknowledged</span>
        )}
      </div>
    </div>
  );
}

export default function Alerts() {
  const { data: fetchedAlerts, loading: alertsLoading } = useApi(() => api.getActiveAlerts());
  const { data: pastAlerts, loading: historyLoading } = useApi(() => api.getAlertHistory());
  const { data: incidents, loading: incidentsLoading } = useApi(() => api.getIncidents());

  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  if (alertsLoading || historyLoading || incidentsLoading) {
    return <div className="text-text-muted p-8">Loading alerts...</div>;
  }

  const activeAlerts = (fetchedAlerts ?? [])
    .filter(a => !dismissed.has(a.id))
    .map(a => acknowledged.has(a.id) ? { ...a, acknowledged: true } : a);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeAlert(id);
      setAcknowledged(prev => new Set(prev).add(id));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const incident = incidents?.[0];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Alerts & Incidents</h2>

      {/* Active Alerts */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          Active Alerts ({activeAlerts.filter(a => !a.acknowledged).length})
        </h3>
        <div className="space-y-3">
          {activeAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={() => handleAcknowledge(alert.id)}
              onDismiss={() => handleDismiss(alert.id)}
            />
          ))}
          {activeAlerts.length === 0 && (
            <p className="text-sm text-text-muted bg-bg-card rounded-lg p-4 border border-border">No active alerts</p>
          )}
        </div>
      </div>

      {/* Incident Groups */}
      {incident && (
        <div>
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Incident Groups</h3>
          <div className="bg-bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs text-text-muted">{incident.id}</span>
                <h4 className="text-sm font-semibold text-text-primary">{incident.title}</h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
                {incident.status.toUpperCase()}
              </span>
            </div>

            {/* Timeline Bar */}
            <div className="mb-3">
              {(() => {
                const totalSpan = Math.max(...incident.phases.map(p => p.end));
                return (
                  <>
                    <div className="flex rounded-full overflow-hidden h-6">
                      {incident.phases.map(phase => {
                        const width = ((phase.end - phase.start) / totalSpan) * 100;
                        return (
                          <div
                            key={phase.label}
                            className="flex items-center justify-center text-xs font-medium text-white/90"
                            style={{ width: `${width}%`, backgroundColor: phase.color }}
                            title={`${phase.label}: min ${phase.start}–${phase.end}`}
                          >
                            {width > 15 && phase.label}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>0m</span>
                      <span>{totalSpan}m</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-6 text-xs">
              <div>
                <span className="text-text-muted">Lead Time</span>
                <p className="text-text-primary font-semibold">{incident.leadTime} min</p>
              </div>
              <div>
                <span className="text-text-muted">Affected Services</span>
                <p className="text-text-primary">{incident.affectedServices.join(', ')}</p>
              </div>
            </div>

            {/* Phase Legend */}
            <div className="flex gap-3 mt-3">
              {incident.phases.map(phase => (
                <div key={phase.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: phase.color }} />
                  {phase.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alert History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}>▶</span>
          Alert History ({pastAlerts?.length ?? 0})
        </button>
        {showHistory && (
          <div className="space-y-3 mt-3">
            {(pastAlerts ?? []).map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
