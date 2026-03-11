import type { ServiceInfo } from '../data/mockData';

const statusColors: Record<string, string> = {
  healthy: 'border-healthy',
  warning: 'border-warning',
  critical: 'border-danger',
};

const statusBg: Record<string, string> = {
  healthy: 'bg-healthy/10',
  warning: 'bg-warning/10',
  critical: 'bg-danger/10',
};

const statusText: Record<string, string> = {
  healthy: 'text-healthy',
  warning: 'text-warning',
  critical: 'text-danger',
};

export default function ServiceHealthCard({ service }: { service: ServiceInfo }) {
  return (
    <div className={`bg-bg-card rounded-lg border-l-4 ${statusColors[service.status]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">{service.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg[service.status]} ${statusText[service.status]}`}>
          {service.status.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-1">{service.type}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${statusText[service.status]}`}>
          {service.currentValue}
        </span>
        <span className="text-xs text-text-muted">{service.metricUnit}</span>
      </div>
      <p className="text-xs text-text-secondary mt-1">{service.metricName}</p>
    </div>
  );
}
