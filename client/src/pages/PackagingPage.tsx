import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, Packaging, qty } from '../api';

const empty = { name: '', package_qty: '1', package_price: '' };
type Form = typeof empty;

// Artículos de packaging (caja, bolsa, moño, etiqueta...). Cada producto elige cuáles lleva en Productos.
export default function PackagingPage() {
  const [items, setItems] = useState<Packaging[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<Packaging[]>('/packaging').then(setItems);
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const body = { name: form.name, package_qty: Number(form.package_qty), package_price: Number(form.package_price) };
    try {
      if (editingId) await api.put(`/packaging/${editingId}`, body);
      else await api.post('/packaging', body);
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const edit = (p: Packaging) => {
    setEditingId(p.id);
    setError('');
    setForm({ name: p.name, package_qty: String(p.package_qty), package_price: String(p.package_price) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (p: Packaging) => {
    if (!confirm(`¿Borrar "${p.name}"?`)) return;
    setError('');
    try {
      await api.del(`/packaging/${p.id}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unitPrice = Number(form.package_qty) > 0 && form.package_price !== '' ? Number(form.package_price) / Number(form.package_qty) : null;

  return (
    <div>
      <h1>Packaging</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Cargá cada cosa que usás para presentar o entregar (cajas, bolsas, moños, etiquetas, tarjetas).
        Después, en <Link to="/productos">Productos</Link>, elegís qué lleva cada uno y su costo se suma solo.
      </p>

      <form className="card" onSubmit={submit}>
        <div className="form-grid">
          <label>Packaging<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Caja kraft chica" /></label>
          <label>Unidades del pack<input type="number" min="0" step="any" value={form.package_qty} onChange={(e) => setForm({ ...form, package_qty: e.target.value })} placeholder="50" /></label>
          <label>Precio del pack<input type="number" min="0" step="any" value={form.package_price} onChange={(e) => setForm({ ...form, package_price: e.target.value })} placeholder="25000" /></label>
          <button disabled={!form.name.trim() || !(Number(form.package_qty) > 0) || form.package_price === ''}>{editingId ? 'Guardar cambios' : 'Agregar'}</button>
          {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</button>}
        </div>
        {unitPrice !== null && (
          <p className="muted" style={{ marginBottom: 0 }}>Costo por unidad: <strong>{money(unitPrice)}</strong></p>
        )}
        {error && <div className="error">{error}</div>}
      </form>

      <h2>Lista de packaging</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Packaging</th><th className="num">Pack</th><th className="num">Precio pack</th><th className="num">Costo unidad</th><th>Lo usan</th><th /></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="num">{qty(p.package_qty)} u.</td>
                <td className="num">{money(p.package_price)}</td>
                <td className="num"><strong>{money(p.unit_price)}</strong></td>
                <td>{p.used_in ?? <span className="muted">Ningún producto</span>}</td>
                <td className="actions">
                  <button className="small secondary" onClick={() => edit(p)}>Editar</button>
                  <button className="small danger" onClick={() => remove(p)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted">Todavía no hay packaging.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
