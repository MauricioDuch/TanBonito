import { FormEvent, useEffect, useState } from 'react';
import { api, money, Purchase, Supplier, Supply, today } from '../api';
import DateRange, { defaultRange } from '../components/DateRange';

const empty = () => ({ purchase_date: today(), supply_id: '', quantity: '', price: '', supplier_id: '', update_supply: true });

export default function Purchases() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [range, setRange] = useState(defaultRange());
  const [form, setForm] = useState(empty());
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const load = () => api.get<Purchase[]>(`/purchases?from=${range.from}&to=${range.to}`).then(setPurchases);

  useEffect(() => {
    api.get<Supply[]>('/supplies').then(setSupplies);
    api.get<Supplier[]>('/suppliers').then(setSuppliers);
  }, []);
  useEffect(() => { load(); }, [range]);

  const selected = supplies.find((s) => s.id === Number(form.supply_id));

  const pickSupply = (id: string) => {
    const s = supplies.find((x) => x.id === Number(id));
    setForm({ ...form, supply_id: id, supplier_id: s?.supplier_id ? String(s.supplier_id) : form.supplier_id });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/purchases', {
        ...form,
        supply_id: Number(form.supply_id),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        quantity: Number(form.quantity),
        price: Number(form.price)
      });
      setForm(empty());
      load();
      if (form.update_supply) api.get<Supply[]>('/supplies').then(setSupplies);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (p: Purchase) => {
    if (!confirm(`¿Borrar la compra de ${p.supply_name}?`)) return;
    setListError('');
    try {
      await api.del(`/purchases/${p.id}`);
      load();
    } catch (e) {
      setListError((e as Error).message);
    }
  };

  const total = purchases.reduce((s, p) => s + Number(p.price), 0);

  return (
    <div>
      <h1>Compras</h1>
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <label>Fecha<input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></label>
          <label>
            Insumo
            <select value={form.supply_id} onChange={(e) => pickSupply(e.target.value)}>
              <option value="">Elegir…</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            Cantidad {selected && `(${selected.unit})`}
            <input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </label>
          <label>Precio total<input type="number" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>
            Proveedor
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button disabled={!form.supply_id || !form.quantity || !form.price}>Registrar compra</button>
        </div>
        <label style={{ flexDirection: 'row', alignItems: 'center', marginTop: '.75rem', color: 'var(--text)' }}>
          <input type="checkbox" checked={form.update_supply} onChange={(e) => setForm({ ...form, update_supply: e.target.checked })} />
          Actualizar el precio del insumo con esta compra
          {selected && form.quantity && form.price && (
            <span className="muted"> — nuevo precio unitario: {money(Number(form.price) / Number(form.quantity))} / {selected.unit}</span>
          )}
        </label>
        {error && <div className="error">{error}</div>}
      </form>

      <h2>Historial</h2>
      <div className="toolbar"><DateRange value={range} onChange={setRange} /></div>
      {listError && <div className="error">{listError}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Insumo</th><th className="num">Cantidad</th><th className="num">Precio</th><th>Proveedor</th><th /></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td className="date">{p.purchase_date}</td><td>{p.supply_name}</td><td className="num">{p.quantity} {p.unit}</td>
                <td className="num">{money(p.price)}</td><td>{p.supplier_name ?? '—'}</td>
                <td className="actions"><button className="small danger" onClick={() => remove(p)}>Borrar</button></td>
              </tr>
            ))}
            {!purchases.length && <tr><td colSpan={6} className="muted">Sin compras en el período.</td></tr>}
          </tbody>
          {!!purchases.length && <tfoot><tr><td colSpan={3}>Total del período</td><td className="num">{money(total)}</td><td colSpan={2} /></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
