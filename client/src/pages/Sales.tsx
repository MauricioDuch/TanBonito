import { useEffect, useState } from 'react';
import { api, CHANNEL_LABELS, money, PAYMENT_LABELS, Product, Sale, StockSection, today } from '../api';
import DateRange, { defaultRange } from '../components/DateRange';
import TrashButton from '../components/TrashButton';

interface Line { product_id: string; scent_id: string; quantity: string; unit_price: string; payment_method: string }

const newLine = (payment = 'efectivo'): Line => ({ product_id: '', scent_id: '', quantity: '1', unit_price: '', payment_method: payment });

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockSection[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [range, setRange] = useState(defaultRange());

  // Carga en lote: una fecha y canal para todas las filas (p. ej. el cuaderno de la feria del finde)
  const [date, setDate] = useState(today());
  const [channel, setChannel] = useState('feria');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSales = () => api.get<Sale[]>(`/sales?from=${range.from}&to=${range.to}`).then(setSales).catch((e) => setError(e.message));

  const loadStock = () => api.get<{ products: StockSection[] }>('/stock').then((d) => setStock(d.products));

  useEffect(() => {
    api.get<Product[]>('/products?active=1').then(setProducts);
    loadStock();
  }, []);
  useEffect(() => { loadSales(); }, [range]);

  // Solo se ofrece lo que hay: las variantes (aromas) con stock de cada producto
  const variantsOf = (productId: string) => stock.find((x) => x.product_id === Number(productId))?.scents.filter((s) => s.quantity > 0) ?? [];
  const totalOf = (productId: number) => variantsOf(String(productId)).reduce((sum, s) => sum + s.quantity, 0);

  const update = (i: number, patch: Partial<Line>) => {
    setLines(lines.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, ...patch };
      if (patch.product_id !== undefined) {
        // Al elegir producto se completa su precio, y el aroma si hay uno solo disponible
        const p = products.find((x) => x.id === Number(patch.product_id));
        if (p?.sale_price) next.unit_price = String(p.sale_price);
        const variants = variantsOf(patch.product_id);
        next.scent_id = variants.length === 1 ? String(variants[0].scent_id) : '';
      }
      return next;
    }));
  };

  const valid = lines.filter((l) => l.product_id && l.scent_id !== '' && Number(l.quantity) > 0 && l.unit_price !== '');
  const batchTotal = valid.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);

  // Se suma todo el lote: dos filas del mismo producto y aroma comparten el mismo stock
  const lineKey = (l: Line) => `${l.product_id}|${l.scent_id}`;
  const over = [...new Set(valid.map(lineKey))].flatMap((key) => {
    const same = valid.filter((l) => lineKey(l) === key);
    const wanted = same.reduce((sum, l) => sum + Number(l.quantity), 0);
    const variant = variantsOf(same[0].product_id).find((s) => s.scent_id === Number(same[0].scent_id));
    const available = variant?.quantity ?? 0;
    if (wanted <= available) return [];
    const product = products.find((p) => p.id === Number(same[0].product_id));
    return [{ key, name: `${product?.name} (${variant?.name ?? 'Sin aroma'})`, wanted, available }];
  });
  const isOver = (l: Line) => over.some((o) => o.key === lineKey(l));

  const save = async () => {
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const body = valid.map((l) => ({
        sale_date: date, channel, product_id: Number(l.product_id), scent_id: l.scent_id ? Number(l.scent_id) : null,
        quantity: Number(l.quantity), unit_price: Number(l.unit_price), payment_method: l.payment_method
      }));
      const { created } = await api.post<{ created: number }>('/sales', body);
      setMessage(`${created} venta(s) guardadas.`);
      setLines([newLine(lines.at(-1)?.payment_method)]);
      loadSales();
      loadStock();
    } catch (e) {
      setError((e as Error).message);
      loadStock(); // pudo haber cambiado desde que se abrió la pantalla
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Sale) => {
    if (!confirm(`¿Borrar la venta de ${s.quantity} × ${s.product_name}?`)) return;
    await api.del(`/sales/${s.id}`);
    loadSales();
    loadStock();
  };

  const listTotal = sales.reduce((s, x) => s + Number(x.total), 0);

  return (
    <div>
      <h1>Ventas</h1>

      <div className="card">
        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>
            Canal
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="sale-lines">
            <thead>
              <tr><th>Producto</th><th>Aroma</th><th>Cant.</th><th>Precio u.</th><th>Medio de pago</th><th className="num">Total</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className={isOver(l) ? 'row-missing' : ''}>
                  <td>
                    <select value={l.product_id} onChange={(e) => update(i, { product_id: e.target.value })}>
                      <option value="">Elegir…</option>
                      {products.map((p) => {
                        const total = totalOf(p.id);
                        return <option key={p.id} value={p.id} disabled={total <= 0}>{p.name} ({total > 0 ? total : 'sin stock'})</option>;
                      })}
                    </select>
                  </td>
                  <td>
                    <select value={l.scent_id} disabled={!l.product_id} onChange={(e) => update(i, { scent_id: e.target.value })}>
                      <option value="">{l.product_id ? 'Elegir…' : '—'}</option>
                      {variantsOf(l.product_id).map((s) => <option key={s.scent_id} value={s.scent_id}>{s.name} ({s.quantity})</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="1" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} /></td>
                  <td><input type="number" step="any" value={l.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} /></td>
                  <td>
                    <select value={l.payment_method} onChange={(e) => update(i, { payment_method: e.target.value })}>
                      {Object.entries(PAYMENT_LABELS).map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                    </select>
                  </td>
                  <td className="num">{money(Number(l.quantity) * Number(l.unit_price || 0))}</td>
                  <td className="actions">
                    <TrashButton label="Quitar fila" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, idx) => idx !== i))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="toolbar" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <button className="secondary" onClick={() => setLines([...lines, newLine(lines.at(-1)?.payment_method)])}>+ Otra fila</button>
          <div className="spacer" />
          <strong>Total: {money(batchTotal)}</strong>
          <button onClick={save} disabled={!valid.length || saving || over.length > 0}>Guardar {valid.length || ''} venta(s)</button>
        </div>
        {over.length > 0 && (
          <div className="alert">
            <strong>No alcanza el stock:</strong>
            <ul>
              {over.map((o) => <li key={o.key}>{o.name}: querés vender {o.wanted}, hay {o.available}</li>)}
            </ul>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        {!products.length && <div className="muted">Primero cargá productos en “Productos”.</div>}
        {!!products.length && !products.some((p) => totalOf(p.id) > 0) && (
          <div className="muted">No hay productos con stock. Fabricalos con “Crear” en Productos o cargalos en Stock.</div>
        )}
      </div>

      <h2>Historial</h2>
      <div className="toolbar"><DateRange value={range} onChange={setRange} /></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Producto</th><th>Aroma</th><th className="num">Cant.</th><th className="num">Precio u.</th><th className="num">Total</th><th>Pago</th><th>Canal</th><th /></tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="date">{s.sale_date}</td><td>{s.product_name}</td><td>{s.scent_name ?? '—'}</td>
                <td className="num">{s.quantity}</td><td className="num">{money(s.unit_price)}</td><td className="num">{money(s.total)}</td>
                <td>{PAYMENT_LABELS[s.payment_method]}</td><td><span className="badge">{CHANNEL_LABELS[s.channel]}</span></td>
                <td className="actions"><TrashButton label="Borrar venta" onClick={() => remove(s)} /></td>
              </tr>
            ))}
            {!sales.length && <tr><td colSpan={9} className="muted">Sin ventas en el período.</td></tr>}
          </tbody>
          {!!sales.length && (
            <tfoot><tr><td colSpan={5}>Total del período</td><td className="num">{money(listTotal)}</td><td colSpan={3} /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
