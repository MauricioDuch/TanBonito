import { useState } from 'react';
import { money } from '../api';

export interface MonthRow { month: string; revenue: number; units: number }

type Metric = 'revenue' | 'units';

const W = 760, H = 260, PAD = { top: 28, right: 8, bottom: 30, left: 64 };
const PLOT_W = W - PAD.left - PAD.right, PLOT_H = H - PAD.top - PAD.bottom;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const shortLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
export const longLabel = (m: string) => `${MONTHS_LONG[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

// Escala "linda" para el eje: 1, 2 o 5 × 10^n
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 5, 10].find((s) => v <= s * exp)!;
  return step * exp;
};

const compactMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${n}`;

// Barra con las esquinas de arriba redondeadas (4px) y la base recta sobre el eje
const bar = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
};

export default function MonthlyChart({ rows }: { rows: MonthRow[] }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [hover, setHover] = useState<number | null>(null);

  const values = rows.map((r) => r[metric]);
  const max = niceMax(Math.max(...values));
  const best = values.some((v) => v > 0) ? values.indexOf(Math.max(...values)) : -1;
  const fmt = (n: number) => (metric === 'revenue' ? money(n).replace(/,00$/, '') : `${n} u.`);
  const axisFmt = (n: number) => (metric === 'revenue' ? compactMoney(n) : String(n));

  const slot = PLOT_W / rows.length;
  const barW = Math.min(36, slot * 0.62);
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const shown = hover ?? best;

  return (
    <div className="card monthly-card">
      <div className="toolbar" style={{ marginBottom: '.5rem' }}>
        <h2 style={{ margin: 0 }}>Ventas por mes</h2>
        <span className="muted">últimos 12 meses</span>
        <div className="spacer" />
        <div className="segmented" role="group" aria-label="Medida">
          <button className={metric === 'revenue' ? 'on' : ''} onClick={() => setMetric('revenue')}>Ingresos</button>
          <button className={metric === 'units' ? 'on' : ''} onClick={() => setMetric('units')}>Unidades</button>
        </div>
      </div>

      {best < 0 ? (
        <p className="muted">Sin ventas en los últimos 12 meses.</p>
      ) : (
        <>
          <p className="monthly-summary">
            {hover === null ? <>Mejor mes: </> : null}
            <strong>{longLabel(rows[shown].month)}</strong> · {fmt(values[shown])}
            {hover === null && <span className="muted"> ({metric === 'revenue' ? `${rows[best].units} u.` : money(rows[best].revenue).replace(/,00$/, '')})</span>}
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="monthly-chart" role="img"
            aria-label={`Ventas por mes: ${rows.map((r, i) => `${longLabel(r.month)} ${fmt(values[i])}`).join(', ')}`}
            onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="tick">{axisFmt(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const v = values[i];
              const x = PAD.left + slot * i + (slot - barW) / 2;
              const h = (v / max) * PLOT_H;
              const cls = i === best ? 'best' : hover === i ? 'hover' : '';
              return (
                <g key={r.month} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)}>
                  {/* Zona de toque de todo el alto de la columna, más grande que la barra */}
                  <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={PLOT_H} fill="transparent" />
                  {v > 0 && <path d={bar(x, y(v), barW, h)} className={`bar-mark ${cls}`} />}
                  {(i === best || hover === i) && v > 0 && (
                    <text x={x + barW / 2} y={y(v) - 8} textAnchor="middle" className="bar-label">{axisFmt(v)}</text>
                  )}
                  <text x={x + barW / 2} y={H - 10} textAnchor="middle" className={`tick ${i === best ? 'tick-best' : ''}`}>
                    {shortLabel(r.month)}
                  </text>
                </g>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
