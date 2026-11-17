import { FormEvent, useEffect, useState } from 'react';
import { api, money, qty, Supplier, Supply } from '../api';

const UNITS = ['g', 'kg', 'ml', 'l', 'unidad', 'cm', 'm'];
const empty = { name: '', unit: 'g', package_qty: '', package_price: '', supplier_id: '', stock: '' };

type Form = typeof empty;

const toBody = (f: Form) => ({
  ...f,
  package_qty: Number(f.package_qty),
  package_price: Number(f.package_price),
  stock: Number(f.stock || 0),
  supplier_id: f.supplier_id ? Number(f.supplier_id) : null
});

export default function Supplies() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<Supply[]>('/supplies').then(setSupplies);
  useEffect(() => {
    load();
    api.get<Supplier[]>('/suppliers').then(setSuppliers);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.put(`/supplies/${editingId}`, toBody(form));
      else await api.post('/supplies', toBody(form));
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const edit = (s: Supply) => {
    setEditingId(s.id);
    setForm({ name: s.name, unit: s.unit, package_qty: String(s.package_qty), package_price: String(s.package_price), supplier_id: s.supplier_id ? String(s.supplier_id) : '', stock: String(s.stock) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (s: Supply) => {
    if (!confirm(`¿Borrar "${s.name}"?`)) return;
    try {
      await api.del(`/supplies/${s.id}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unitPrice = Number(form.package_qty) > 0 ? Number(form.package_price) / Number(form.package_qty) : null;

  return (
    <div>
      <h1>Insumos</h1>
      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <label>Insumo<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cera de soja" /></label>
          <label>
            Unidad
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label>Cantidad del envase<input type="number" step="any" value={form.package_qty} onChange={(e) => setForm({ ...form, package_qty: e.target.value })} placeholder="1000" /></label>
          <label>Precio del envase<input type="number" step="any" value={form.package_price} onChange={(e) => setForm({ ...form, package_price: e.target.value })} placeholder="8500" /></label>
          <label>
            Proveedor
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Stock actual ({form.unit})<input type="number" min="0" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" /></label>
          <button disabled={!form.name || !form.package_qty || !form.package_price}>{editingId ? 'Guardar cambios' : 'Agregar'}</button>
          {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</button>}
        </div>
        {unitPrice !== null && (
          <p className="muted" style={{ marginBottom: 0 }}>Precio unitario: <strong>{money(unitPrice)}</strong> por {form.unit}</p>
        )}
        {error && <div className="error">{error}</div>}
      </form>

      <h2>Lista de insumos</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th className="num">Envase</th><th className="num">Precio envase</th><th className="num">Precio unitario</th><th className="num">Stock</th><th>Proveedor</th><th /></tr></thead>
          <tbody>
            {supplies.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">{s.package_qty} {s.unit}</td>
                <td className="num">{money(s.package_price)}</td>
                <td className="num"><strong>{money(s.unit_price)}</strong> / {s.unit}</td>
                <td className={`num ${s.stock <= 0 ? 'negative' : ''}`}>{qty(s.stock)} {s.unit}</td>
                <td>{s.supplier_name ?? '—'}</td>
                <td className="actions">
                  <button className="small secondary" onClick={() => edit(s)}>Editar</button>
                  <button className="small danger" onClick={() => remove(s)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!supplies.length && <tr><td colSpan={7} className="muted">Todavía no hay insumos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
