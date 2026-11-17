import { FormEvent, useEffect, useState } from 'react';
import { api, Product, qty, Scent, StockSection, Supply } from '../api';

interface StockData { products: StockSection[]; supplies: Supply[] }

// Ajuste manual: solo para inventario inicial o correcciones (roturas, regalos)
const Adjust = ({ value, step, onSave }: { value: number; step: string; onSave: (v: number) => Promise<void> }) => {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  if (!editing) {
    return <button className="small secondary" onClick={() => { setV(String(value)); setEditing(true); }}>Ajustar</button>;
  }
  return (
    <span className="inline-edit">
      <input type="number" min="0" step={step} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <button className="small" onClick={async () => { await onSave(Number(v)); setEditing(false); }}>OK</button>
      <button className="small secondary" onClick={() => setEditing(false)}>×</button>
    </span>
  );
};

export default function Stock() {
  const [data, setData] = useState<StockData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [scents, setScents] = useState<Scent[]>([]);
  const [form, setForm] = useState({ product_id: '', scent_id: '', quantity: '' });
  const [error, setError] = useState('');

  const load = () => api.get<StockData>('/stock').then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get<Product[]>('/products').then(setProducts);
    api.get<Scent[]>('/scents').then(setScents);
  }, []);

  const setProductStock = async (product_id: number, scent_id: number, quantity: number) => {
    setError('');
    try {
      await api.put('/stock/products', { product_id, scent_id, quantity });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setSupplyStock = async (id: number, stock: number) => {
    setError('');
    try {
      await api.put(`/stock/supplies/${id}`, { stock });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addManual = async (e: FormEvent) => {
    e.preventDefault();
    await setProductStock(Number(form.product_id), Number(form.scent_id || 0), Number(form.quantity));
    setForm({ product_id: '', scent_id: '', quantity: '' });
  };

  if (!data) return error ? <div className="error">{error}</div> : null;

  const sections = data.products.filter((p) => p.active || p.total !== 0);
  const totalUnits = sections.reduce((s, p) => s + p.total, 0);

  return (
    <div>
      <h1>Stock</h1>
      {error && <div className="error">{error}</div>}

      <h2>Productos terminados <span className="muted">· {totalUnits} unidades</span></h2>
      <div className="grid">
        {sections.map((p) => (
          <section className="card stock-section" key={p.product_id}>
            <header>
              <h3>{p.name}</h3>
              <span className={`stock-total ${p.total <= 0 ? 'negative' : ''}`}>{p.total} u.</span>
            </header>
            {p.scents.length ? (
              <table>
                <tbody>
                  {p.scents.map((s) => (
                    <tr key={s.scent_id}>
                      <td>{s.name}</td>
                      <td className={`num ${s.quantity < 0 ? 'negative' : ''}`}><strong>{s.quantity}</strong></td>
                      <td className="actions"><Adjust value={s.quantity} step="1" onSave={(v) => setProductStock(p.product_id, s.scent_id, v)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Sin stock. Crealo desde Productos.</p>
            )}
          </section>
        ))}
      </div>
      {!sections.length && <p className="muted">Todavía no hay productos.</p>}

      <details className="card" style={{ marginTop: '1rem' }}>
        <summary>Cargar stock a mano (inventario inicial o corrección)</summary>
        <form className="form-grid" onSubmit={addManual} style={{ marginTop: '.75rem' }}>
          <label>
            Producto
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Elegir…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            Aroma
            <select value={form.scent_id} onChange={(e) => setForm({ ...form, scent_id: e.target.value })}>
              <option value="">Sin aroma</option>
              {scents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Cantidad total<input type="number" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          <button disabled={!form.product_id || form.quantity === ''}>Guardar</button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>Reemplaza la cantidad de ese producto y aroma. Lo normal es usar “Crear” en Productos.</p>
      </details>

      <h2>Insumos</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Insumo</th><th className="num">Stock</th><th>Proveedor</th><th /></tr></thead>
          <tbody>
            {data.supplies.map((s) => (
              <tr key={s.id} className={s.stock <= 0 ? 'row-missing' : ''}>
                <td>{s.name}</td>
                <td className="num"><strong>{qty(s.stock)}</strong> {s.unit}</td>
                <td>{s.supplier_name ?? '—'}</td>
                <td className="actions"><Adjust value={s.stock} step="any" onSave={(v) => setSupplyStock(s.id, v)} /></td>
              </tr>
            ))}
            {!data.supplies.length && <tr><td colSpan={4} className="muted">Todavía no hay insumos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
