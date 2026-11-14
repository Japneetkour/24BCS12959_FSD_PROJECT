import { useTheme } from '../../context/ThemeContext';
import { CHART_DARK, CHART_LIGHT, seriesOf } from '../../utils/constants';

/** Theme-selected chart colors (dark mode uses its own validated steps, not a flip). */
export function useChartColors() {
  const { isDark } = useTheme();
  const c = isDark ? CHART_DARK : CHART_LIGHT;
  return { ...c, series: seriesOf(c) };
}

/** Shared axis props: recessive ticks, no axis lines. */
export const axisProps = (c) => ({
  tick: { fill: c.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

export function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs shadow-pop dark:border-ink-700 dark:bg-ink-850">
      {label !== undefined && <p className="mb-1 font-semibold text-ink-900 dark:text-white">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-mono font-medium text-ink-900 dark:text-white">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

/** Legend rendered in HTML (text uses ink tokens; color swatch carries identity). */
export function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, legend, children, className = '', action }) {
  return (
    <div className={`card card-pad ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="muted text-xs">{subtitle}</p>}
        </div>
        {legend && <Legend items={legend} />}
        {action}
      </div>
      {children}
    </div>
  );
}
