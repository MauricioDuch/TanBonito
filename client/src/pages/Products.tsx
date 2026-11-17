import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, Category, money, Product, Production, qty, Scent, Shortage } from '../api';
import CategoryTabs, { CATEGORY_LABELS, useCategory } from '../components/CategoryTabs';

interface Draft {
  id?: number;
  name: string;
  category: Category;
  labor_cost: string;
  packaging_cost: string;
  sale_price: string;
  active: number;
}

const emptyDraft = (category: Category): Draft => ({ name: '', category, labor_cost: '', packaging_cost: '', sale_price: '', active: 1 });

const fromProduct = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  category: p.category,
  labor_cost: String(p.labor_cost),
  packaging_cost: String(p.packaging_cost),
  sale_price: String(p.sale_price),
  active: p.active
});

export default function Products() {
  const [category, setCategory] = useCategory();
  const [products, setProducts] = useState<Product[]>([]);
  const [scents, setScents] = useState<Scent[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  // Fabricación
  const [making, setMaking] = useState<Product | null>(null);
  const [makeQty, setMakeQty] = useState('1');
  const [makeScent, setMakeScent] = useState('');
  // Faltantes que confirmó el server, con la cantidad que se pidió (si la cantidad cambió, ya no aplican)
  const [serverShort, setServerShort] = useState<{ units: number; list: Shortage[] } | null>(null);
  const [makeError, setMakeError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    api.get<Product[]>('/products').then(setProducts);
    api.get<Production[]>('/products/productions').then(setProductions);
  };
  useEffect(() => {
    load();
    api.get<Scent[]>('/scents').then((s) => setScents(s.filter((x) => x.active)));
  }, []);

  const save = async () => {
    if (!draft) return;
    setError('');
    const body = {
      name: draft.name,
      category: draft.category,
      labor_cost: Number(draft.labor_cost || 0),
      packaging_cost: Number(draft.packaging_cost || 0),
      sale_price: Number(draft.sale_price || 0),
      active: draft.active
    };
    try {
      if (draft.id) await api.put(`/products/${draft.id}`, body);
      else await api.post('/products', body);
      setCategory(draft.category);
      setDraft(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Borrar "${p.name}"? Si tiene ventas, mejor desactivalo.`)) return;
    try {
      await api.del(`/products/${p.id}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openMake = (p: Product) => {
    setMaking(p);
    setMakeQty('1');
    setMakeScent('');
    setServerShort(null);
    setMakeError('');
    setMessage('');
  };

  // Vista previa: lo que necesita la receta × cantidad contra lo que hay
  const units = Math.max(0, Math.floor(Number(makeQty) || 0));
  const preview = (making?.recipe ?? []).map((i) => ({ ...i, needed: i.quantity * units, ok: i.stock >= i.quantity * units }));
  const previewShort = preview.filter((i) => !i.ok);
  const maxUnits = making?.recipe.length ? Math.floor(Math.min(...making.recipe.map((i) => i.stock / i.quantity))) : 0;
  const confirmedShort = serverShort?.units === units ? serverShort.list : [];
  const shortList = confirmedShort.length
    ? confirmedShort
    : previewShort.map((i) => ({ name: i.supply_name, unit: i.unit, missing: i.needed - i.stock }));

  const make = async () => {
    if (!making) return;
    const requested = units;
    setMakeError('');
    setServerShort(null);
    try {
      await api.post(`/products/${making.id}/produce`, { quantity: requested, scent_id: makeScent ? Number(makeScent) : null });
      const scent = scents.find((s) => s.id === Number(makeScent));
      setMessage(`Se crearon ${requested} × ${making.name}${scent ? ` (${scent.name})` : ''}. Insumos descontados y stock actualizado.`);
      setMaking(null);
      load();
    } catch (e) {
      // 409: el server confirma qué insumos faltan (puede haber cambiado desde que se abrió el formulario)
      if (e instanceof ApiError && e.data?.missing) setServerShort({ units: requested, list: e.data.missing });
      else setMakeError((e as Error).message);
    }
  };

  const undo = async (p: Production) => {
    if (!confirm(`¿Deshacer la fabricación de ${p.quantity} × ${p.product_name}? Se devuelven los insumos y se descuenta del stock.`)) return;
    setMessage('');
    setError('');
    try {
      await api.del(`/products/productions/${p.id}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const labels = CATEGORY_LABELS[category];
  const visible = products.filter((p) => p.category === category);
  const visibleProductions = productions.filter((p) => p.category === category);
  const counts = {
    vela: products.filter((p) => p.category === 'vela').length,
    aroma: products.filter((p) => p.category === 'aroma').length
  };

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Productos</h1>
        <div className="spacer" />
        <button className="secondary" onClick={() => { setError(''); setDraft(emptyDraft(category)); }}>+ {labels.nuevo}</button>
      </div>
      <CategoryTabs value={category} onChange={setCategory} counts={counts} />
      {message && <div className="success">{message}</div>}
      {error && !draft && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{labels.singular}</th><th className="num">Stock</th><th className="num">Costo</th><th className="num">Precio de venta</th>
              <th className="num">Margen</th><th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} style={p.active ? undefined : { opacity: 0.5 }}>
                <td>
                  {p.name} {!p.active && <span className="badge">inactivo</span>}
                  {!p.recipe.length && <span className="badge warn">sin receta</span>}
                </td>
                <td className={`num ${p.stock < 0 ? 'negative' : ''}`}><strong>{p.stock}</strong></td>
                <td className="num">{money(p.total_cost)}</td>
                <td className="num">{money(p.sale_price)}</td>
                <td className="num">{p.margin === null ? '—' : `${p.margin}%`}</td>
                <td className="actions">
                  <button className="small" onClick={() => openMake(p)} disabled={!p.recipe.length} title={p.recipe.length ? '' : 'Cargá la receta primero'}>
                    Crear
                  </button>
                  <button className="small secondary" onClick={() => { setError(''); setDraft(fromProduct(p)); }}>Editar</button>
                  <button className="small danger" onClick={() => remove(p)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={6} className="muted">Todavía no hay {labels.plural.toLowerCase()}.</td></tr>}
          </tbody>
        </table>
      </div>

      {!!visibleProductions.length && (
        <>
          <h2>Últimas fabricaciones</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Producto</th><th>Aroma</th><th className="num">Cantidad</th><th /></tr></thead>
              <tbody>
                {visibleProductions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.created_at.slice(0, 16)}</td><td>{p.product_name}</td><td>{p.scent_name ?? '—'}</td>
                    <td className="num">{p.quantity}</td>
                    <td className="actions"><button className="small secondary" onClick={() => undo(p)}>Deshacer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {making && (
        <div className="modal-backdrop" onClick={() => setMaking(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Crear {making.name}</h2>
            <div className="form-grid">
              <label>Cantidad<input type="number" min="1" step="1" value={makeQty} onChange={(e) => { setMakeQty(e.target.value); setMakeError(""); }} autoFocus /></label>
              <label>
                Aroma
                <select value={makeScent} onChange={(e) => setMakeScent(e.target.value)}>
                  <option value="">Sin aroma</option>
                  {scents.map((s) => <option key={s.id} value={s.id}>{s.name}{s.seasonal ? ' (temporada)' : ''}</option>)}
                </select>
              </label>
            </div>
            <p className="muted">Con los insumos actuales alcanza para <strong>{Math.max(0, maxUnits)}</strong> unidad(es).</p>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Insumo</th><th className="num">Necesita</th><th className="num">Hay</th><th className="num">Falta</th></tr></thead>
                <tbody>
                  {preview.map((i) => (
                    <tr key={i.supply_id} className={i.ok ? '' : 'row-missing'}>
                      <td>{i.supply_name}</td>
                      <td className="num">{qty(i.needed)} {i.unit}</td>
                      <td className="num">{qty(i.stock)} {i.unit}</td>
                      <td className="num">{i.ok ? '✓' : `${qty(i.needed - i.stock)} ${i.unit}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {shortList.length > 0 && (
              <div className="alert">
                <strong>Faltan insumos para crear {units} unidad(es):</strong>
                <ul>
                  {shortList.map((s) => (
                    <li key={s.name}>{s.name}: faltan {qty(s.missing)} {s.unit}</li>
                  ))}
                </ul>
                Registralos en <Link to="/compras">Compras</Link> o ajustá el stock en <Link to="/stock">Stock</Link>.
              </div>
            )}
            {makeError && <div className="error">{makeError}</div>}

            <div className="toolbar" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <div className="spacer" />
              <button className="secondary" onClick={() => setMaking(null)}>Cancelar</button>
              <button onClick={make} disabled={units < 1}>Crear {units > 0 ? units : ''}</button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{draft.id ? `Editar ${CATEGORY_LABELS[draft.category].singular.toLowerCase()}` : CATEGORY_LABELS[draft.category].nuevo}</h2>
            <div className="form-grid">
              <label>
                Tipo
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
                  <option value="vela">Vela</option>
                  <option value="aroma">Aroma</option>
                </select>
              </label>
              <label>Nombre<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={CATEGORY_LABELS[draft.category].placeholder} /></label>
              <label>Mano de obra<input type="number" step="any" value={draft.labor_cost} onChange={(e) => setDraft({ ...draft, labor_cost: e.target.value })} /></label>
              <label>Packaging<input type="number" step="any" value={draft.packaging_cost} onChange={(e) => setDraft({ ...draft, packaging_cost: e.target.value })} /></label>
              <label>Precio de venta<input type="number" step="any" value={draft.sale_price} onChange={(e) => setDraft({ ...draft, sale_price: e.target.value })} /></label>
              <label style={{ flexDirection: 'row', alignItems: 'center', color: 'var(--text)' }}>
                <input type="checkbox" checked={!!draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked ? 1 : 0 })} /> Activo
              </label>
            </div>
            {draft.id && (() => {
              const p = products.find((x) => x.id === draft.id)!;
              return (
                <p className="muted">
                  Costo actual: insumos {money(p.supplies_cost)} + mano de obra + packaging + fijos {money(p.fixed_cost)} = <strong>{money(p.total_cost)}</strong>.
                  {' '}Precio sugerido: <strong>{money(p.suggested_price)}</strong>{' '}
                  <button className="small secondary" onClick={() => setDraft({ ...draft, sale_price: String(Math.round(p.suggested_price)) })}>Usar</button>
                </p>
              );
            })()}
            {!draft.id && <p className="muted">Después cargá qué lleva en la solapa <Link to={draft.category === 'aroma' ? '/recetas?tipo=aroma' : '/recetas'}>Recetas</Link>.</p>}
            {error && <div className="error">{error}</div>}
            <div className="toolbar" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <div className="spacer" />
              <button className="secondary" onClick={() => setDraft(null)}>Cancelar</button>
              <button onClick={save} disabled={!draft.name}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
