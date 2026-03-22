import { NavLink } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../hooks/useTheme';
import { api } from '../lib/api';

const navItems = [
  { to: '/', label: 'Live Controls', icon: '⊞' },
  { to: '/timeline', label: 'KPI Timeline', icon: '⊟' },
  { to: '/alerts', label: 'Alerts', icon: '⊡' },
  { to: '/analytics', label: 'Analytics', icon: '◈' },
];

export default function Sidebar() {
  const { data: alerts } = useApi(() => api.getActiveAlerts());
  const { data: simState } = useApi(() => api.getSimulationState());
  const { theme, toggleTheme } = useTheme();

  const activeAlertCount = alerts?.filter(a => !a.acknowledged).length;

  return (
    <aside className="w-60 h-screen bg-bg-card border-r border-border flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <h1 className="text-base font-semibold text-text-primary tracking-tight">CloudWatch AI</h1>
        </div>
        <p className="text-[11px] text-text-muted mt-1 ml-4">Predictive Incident Detection</p>
      </div>

      {/* Simulation Status */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${simState?.status === 'running' ? 'bg-healthy animate-pulse' : 'bg-text-muted'}`} />
          <span className={`font-medium uppercase tracking-wider ${simState?.status === 'running' ? 'text-healthy' : 'text-text-muted'}`}>
            {simState?.status === 'running' ? 'Running' : 'Stopped'}
          </span>
        </div>
        <p className="text-[11px] text-text-muted mt-1 font-mono">
          {simState ? `Tick ${simState.tick}/${simState.totalTicks} — ${simState.phase}` : '—'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 text-sm rounded-lg mb-0.5 transition-all duration-150 ${
                isActive
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-active'
              }`
            }
          >
            <span className="text-sm opacity-60">{item.icon}</span>
            <span>{item.label}</span>
            {item.to === '/alerts' && activeAlertCount != null && activeAlertCount > 0 && (
              <span className="ml-auto bg-danger/15 text-danger text-[10px] font-semibold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5">
                {activeAlertCount > 99 ? '99+' : activeAlertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick Stats */}
      <div className="mx-4 mb-3 p-3 rounded-lg bg-bg-active/50 text-[11px] text-text-muted space-y-1.5">
        <div className="flex justify-between"><span>Services</span><span className="text-text-secondary font-mono">5</span></div>
        <div className="flex justify-between"><span>Active Alerts</span><span className="text-danger font-mono">{activeAlertCount ?? '—'}</span></div>
        <div className="flex justify-between"><span>Predictions</span><span className="text-text-secondary font-mono">{simState?.predictionsProcessed ?? '—'}</span></div>
      </div>

      {/* Theme Toggle */}
      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-bg-active transition-all duration-150"
        >
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          <span className="text-sm">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </div>
    </aside>
  );
}
