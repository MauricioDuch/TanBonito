import { FormEvent, useEffect, useState } from 'react';
import { api, FixedExpense, money } from '../api';
import SimpleCrud from '../components/SimpleCrud';

export default function Settings() {
  const [form, setForm] = useState({ margin_percent: '', monthly_units: '' });
  const [fixedTotal, setFixedTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadFixed = () =>
    api.get<FixedExpense[]>('/fixed-expenses').then((rows) => setFixedTotal(rows.reduce((s, r) => s + Number(r.monthly_amount), 0)));

  useEffect(() => {
    api.get<{ margin_percent: number; monthly_units: number }>('/settings')
      .then((s) => setForm({ margin_percent: String(s.margin_percent), monthly_units: String(s.monthly_units) }));
    loadFixed();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.put('/settings', { margin_percent: Number(form.margin_percent), monthly_units: Number(form.monthly_units) });
      setMessage('Guardado. Los costos de los productos ya usan estos valores.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const units = Number(form.monthly_units);

  return (
    <div>
      <SimpleCrud
        title="Gastos fijos"
        endpoint="/fixed-expenses"
        onChange={loadFixed}
        fields={[
          { name: 'name', label: 'Gasto (luz, gas…)' },
          { name: 'monthly_amount', label: 'Monto mensual', type: 'money' }
        ]}
      />

      <h2>Cálculo de precios</h2>
      <form className="card" onSubmit={save}>
        <div className="form-grid">
          <label>
            Unidades que se fabrican por mes (aprox.)
            <input type="number" min="1" value={form.monthly_units} onChange={(e) => setForm({ ...form, monthly_units: e.target.value })} />
          </label>
          <label>
            Margen de ganancia sobre el costo (%)
            <input type="number" min="0" value={form.margin_percent} onChange={(e) => setForm({ ...form, margin_percent: e.target.value })} />
          </label>
          <button>Guardar</button>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Gastos fijos del mes: <strong>{money(fixedTotal)}</strong>
          {units > 0 && <> → se suman <strong>{money(fixedTotal / units)}</strong> al costo de cada unidad.</>}
        </p>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
      </form>
    </div>
  );
}
