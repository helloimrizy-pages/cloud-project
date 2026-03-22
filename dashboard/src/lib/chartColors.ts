function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chartColors() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  return {
    grid: cssVar('--color-border'),
    axis: cssVar('--color-text-muted'),
    tooltipBg: cssVar('--color-bg-card'),
    tooltipBorder: cssVar('--color-border'),
    tooltipShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.1)',
    textPrimary: cssVar('--color-text-primary'),
    labelFill: cssVar('--color-text-secondary'),
    bgCard: cssVar('--color-bg-card'),
    accent: cssVar('--color-accent'),
    info: cssVar('--color-info'),
    warning: cssVar('--color-warning'),
    danger: cssVar('--color-danger'),
    healthy: cssVar('--color-healthy'),
  };
}
