import { monthStart, today } from '../api';

export interface Range { from: string; to: string }

export const defaultRange = (): Range => ({ from: monthStart(), to: today() });

const shift = (days: number): Range => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return { from: d.toISOString().slice(0, 10), to: today() };
};

export default function DateRange({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <>
      <label>
        Desde
        <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </label>
      <label>
        Hasta
        <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </label>
      <button type="button" className="secondary" onClick={() => onChange(shift(7))}>7 días</button>
      <button type="button" className="secondary" onClick={() => onChange(defaultRange())}>Este mes</button>
      <button type="button" className="secondary" onClick={() => onChange({ from: today().slice(0, 4) + '-01-01', to: today() })}>Este año</button>
    </>
  );
}
