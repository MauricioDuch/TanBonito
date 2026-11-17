import { useState } from 'react';

// Paleta categórica validada (luminosidad, croma, daltonismo). Orden fijo: no reordenar.
// Los colores claros (dorado, rosa) no llegan a 3:1 contra el blanco: por eso la leyenda siempre muestra valores.
export const PIE_COLORS = ['#9b1b30', '#dda02c', '#4a3baa', '#ee85ae', '#0f76a8'];
const OTHER_COLOR = '#a39a97';
const MAX_SLICES = PIE_COLORS.length;

export interface Slice { key: string; label: string; value: number }

interface Props {
  title: string;
  slices: Slice[];
  format: (n: number) => string;
  // Color fijo por clave (p. ej. medios de pago), así no cambia al filtrar fechas
  colorFor?: (key: string) => string | undefined;
}

const SIZE = 180, R = 86, INNER = 54, C = SIZE / 2;

const point = (angle: number, r: number) => [C + r * Math.sin(angle), C - r * Math.cos(angle)];

// Porción de dona entre dos ángulos (0 = arriba, sentido horario)
const arc = (start: number, end: number) => {
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = point(start, R), [x2, y2] = point(end, R);
  const [x3, y3] = point(end, INNER), [x4, y4] = point(start, INNER);
  return `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${INNER} ${INNER} 0 ${large} 0 ${x4} ${y4} Z`;
};

export default function PieChart({ title, slices, format, colorFor }: Props) {
  const [active, setActive] = useState<number | null>(null);

  // Más de 5 porciones no se leen: el resto se agrupa en "Otros"
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const shown = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted;
  const rest = sorted.slice(shown.length);
  const data = rest.length
    ? [...shown, { key: '__other', label: `Otros (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0) }]
    : shown;
  const total = data.reduce((s, d) => s + d.value, 0);

  const colors = data.map((d, i) => (d.key === '__other' ? OTHER_COLOR : colorFor?.(d.key) ?? PIE_COLORS[i]));
  const pct = (v: number) => `${Math.round((v / total) * 1000) / 10}%`;

  let angle = 0;
  const arcs = data.map((d) => {
    const start = angle;
    angle += (d.value / total) * Math.PI * 2;
    return { start, end: angle };
  });

  const focus = active !== null ? data[active] : null;
  // El centro mide ~100px: sin centavos y con letra más chica si el número es largo
  const centerText = focus ? pct(focus.value) : format(total).replace(/,00$/, '');
  const centerSize = Math.min(17, 150 / centerText.length);

  return (
    <div className="card pie-card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {!total ? (
        <div className="muted">Sin ventas en el período.</div>
      ) : (
        <div className="pie-body">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="pie" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${pct(d.value)}`).join(', ')}`}>
            {data.length === 1 ? (
              // Una sola porción: anillo completo (un arco de 360° no se puede dibujar)
              <circle cx={C} cy={C} r={(R + INNER) / 2} fill="none" stroke={colors[0]} strokeWidth={R - INNER}
                onMouseEnter={() => setActive(0)} onMouseLeave={() => setActive(null)} />
            ) : (
              arcs.map((a, i) => (
                <path
                  key={data[i].key}
                  d={arc(a.start, a.end)}
                  fill={colors[i]}
                  className={active !== null && active !== i ? 'pie-dim' : ''}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                />
              ))
            )}
            <text x={C} y={C - 4} textAnchor="middle" className="pie-center-value" style={{ fontSize: centerSize }}>
              {centerText}
            </text>
            <text x={C} y={C + 16} textAnchor="middle" className="pie-center-label">
              {focus ? (focus.label.length > 16 ? focus.label.slice(0, 15) + '…' : focus.label) : 'Total'}
            </text>
          </svg>

          <ul className="pie-legend">
            {data.map((d, i) => (
              <li key={d.key} className={active === i ? 'active' : ''}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                <span className="swatch" style={{ background: colors[i] }} />
                <span className="name">{d.label}</span>
                <span className="value">{format(d.value)}</span>
                <span className="pct">{pct(d.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
