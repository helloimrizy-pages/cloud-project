import { NavLink } from 'react-router-dom';
import { alerts } from '../data/mockData';

const navItems = [
  { to: '/', label: 'Live Controls', icon: '⊞' },
  { to: '/timeline', label: 'KPI Timeline', icon: '⊟' },
  { to: '/alerts', label: 'Alerts', icon: '⊡' },
  { to: '/analytics', label: 'Analytics', icon: '◈' },
];

const activeAlertCount = alerts.filter(a => !a.acknowledged).length;

export default function Sidebar() {
  return (
    <aside className="w-60 h-screen bg-bg-card border-r border-border flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <h1 className="text-lg font-bold text-accent tracking-wide">CloudWatch AI</h1>
        <p className="text-xs text-text-secondary mt-0.5">Predictive Incident Detection</p>
      </div>

      {/* Simulation Status */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-healthy animate-pulse" />
          <span className="text-healthy font-medium">Running</span>
        </div>
        <p className="text-xs text-text-muted mt-1">Tick 6 / 15 — Degrading</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-bg-active text-accent border-r-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-active/50'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
            {item.label === 'Alerts' && activeAlertCount > 0 && (
              <span className="ml-auto bg-danger text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeAlertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick Stats */}
      <div className="px-5 py-4 border-t border-border text-xs text-text-muted space-y-1">
        <div className="flex justify-between"><span>Services</span><span className="text-text-secondary">5</span></div>
        <div className="flex justify-between"><span>Active Alerts</span><span className="text-danger">{activeAlertCount}</span></div>
        <div className="flex justify-between"><span>Predictions</span><span className="text-text-secondary">42</span></div>
      </div>
    </aside>
  );
}
