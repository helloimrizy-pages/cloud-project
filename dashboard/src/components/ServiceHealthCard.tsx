import type { ServiceInfo } from '../data/types';

const statusColors: Record<string, string> = {
  healthy: 'border-healthy/40',
  warning: 'border-warning/40',
  critical: 'border-danger/40',
};

const statusBg: Record<string, string> = {
  healthy: 'bg-healthy/15',
  warning: 'bg-warning/15',
  critical: 'bg-danger/15',
};

const statusText: Record<string, string> = {
  healthy: 'text-healthy',
  warning: 'text-warning',
  critical: 'text-danger',
};

export default function ServiceHealthCard({ service }: { service: ServiceInfo }) {
  return (
    <div className={`bg-bg-card rounded-xl border border-border border-l-[3px] ${statusColors[service.status]} p-4 hover:bg-bg-active/50 transition-all duration-150`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-primary">{service.name}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${statusBg[service.status]} ${statusText[service.status]}`}>
          {service.status}
        </span>
      </div>
      <p className="text-[11px] text-text-muted mb-2">{service.type}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold font-mono tracking-tight ${statusText[service.status]}`}>
          {service.currentValue}
        </span>
        <span className="text-[11px] text-text-muted">{service.metricUnit}</span>
      </div>
      <p className="text-[11px] text-text-secondary mt-1.5">{service.metricName}</p>
    </div>
  );
}
