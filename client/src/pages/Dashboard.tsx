import { useEffect, useState } from 'react';
import { api, CHANNEL_LABELS, money, PAYMENT_LABELS } from '../api';
import DateRange, { defaultRange } from '../components/DateRange';
import PieChart, { PIE_COLORS } from '../components/PieChart';
import MonthlyChart, { MonthRow } from '../components/MonthlyChart';

interface Group { name: string; units: number; revenue: number }
interface Stats {
  revenue: number; units: number; sales: number; purchases: number;
  topProducts: Group[]; topScents: Group[]; byChannel: Group[]; byPayment: Group[];
}

// Canales y medios de pago son fijos: cada uno tiene siempre el mismo color
const CHANNEL_COLORS: Record<string, string> = { feria: PIE_COLORS[0], online: PIE_COLORS[2] };
const PAYMENT_COLORS: Record<string, string> = {
  efectivo: PIE_COLORS[0], mercadopago: PIE_COLORS[4], tarjeta: PIE_COLORS[2], transferencia: PIE_COLORS[1]
};

const units = (n: number) => `${n} u.`;

const toSlices = (rows: Group[], by: 'units' | 'revenue', labels?: Record<string, string>) =>
  rows.map((r) => ({ key: r.name, label: labels?.[r.name] ?? r.name, value: Number(r[by]) }));

export default function Dashboard() {
  const [range, setRange] = useState(defaultRange());
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthly, setMonthly] = useState<MonthRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Stats>(`/stats?from=${range.from}&to=${range.to}`).then(setStats).catch((e) => setError(e.message));
  }, [range]);

  // Los 12 meses que terminan en la fecha "Hasta" (no depende de "Desde")
  useEffect(() => {
    api.get<MonthRow[]>(`/stats/monthly?to=${range.to}`).then(setMonthly).catch((e) => setError(e.message));
  }, [range.to]);

  return (
    <div>
      <h1>Estadísticas</h1>
      <div className="toolbar"><DateRange value={range} onChange={setRange} /></div>
      {error && <div className="error">{error}</div>}
      {stats && (
        <>
          <div className="grid">
            <div className="card stat"><div className="label">Ingresos</div><div className="value">{money(stats.revenue)}</div></div>
            <div className="card stat"><div className="label">Unidades vendidas</div><div className="value">{stats.units}</div></div>
            <div className="card stat"><div className="label">Ventas registradas</div><div className="value">{stats.sales}</div></div>
            <div className="card stat"><div className="label">Compras de insumos</div><div className="value">{money(stats.purchases)}</div></div>
          </div>
          <div className="grid pie-grid" style={{ marginTop: '1rem' }}>
            <PieChart title="Productos más vendidos" slices={toSlices(stats.topProducts, 'units')} format={units} />
            <PieChart title="Aromas más vendidos" slices={toSlices(stats.topScents, 'units')} format={units} />
            <PieChart title="Ingresos por canal" slices={toSlices(stats.byChannel, 'revenue', CHANNEL_LABELS)} format={money}
              colorFor={(k) => CHANNEL_COLORS[k]} />
            <PieChart title="Ingresos por medio de pago" slices={toSlices(stats.byPayment, 'revenue', PAYMENT_LABELS)} format={money}
              colorFor={(k) => PAYMENT_COLORS[k]} />
          </div>
          {monthly && <MonthlyChart rows={monthly} />}
        </>
      )}
    </div>
  );
}
