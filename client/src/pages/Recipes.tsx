import { useEffect, useState } from 'react';
import { api, money, Product, qty, Supply } from '../api';
import CategoryTabs, { CATEGORY_LABELS, useCategory } from '../components/CategoryTabs';

const NEW_PRODUCT = 'new';

interface Draft {
  product_id: string;          // id existente, o NEW_PRODUCT para crear uno
  new_name: string;
  editing: boolean;            // true = editar una receta existente (el producto no se cambia)
  items: { supply_id: string; quantity: string }[];
}

const emptyLine = () => ({ supply_id: '', quantity: '' });

export default function Recipes() {
  const [category, setCategory] = useCategory();
  const [recipes, setRecipes] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get<Product[]>('/recipes').then(setRecipes);
    api.get<Product[]>('/products').then(setProducts);
  };
  useEffect(() => {
    load();
    api.get<Supply[]>('/supplies').then(setSupplies);
  }, []);

  const labels = CATEGORY_LABELS[category];
  const visible = recipes.filter((r) => r.category === category);
  const counts = {
    vela: recipes.filter((r) => r.category === 'vela').length,
    aroma: recipes.filter((r) => r.category === 'aroma').length
  };

  // Para una receta nueva solo se ofrecen productos de esta solapa que todavía no tienen
  const withoutRecipe = products.filter((p) => p.category === category && !p.recipe.length);

  const openNew = () => {
    setError('');
    setDraft({ product_id: withoutRecipe[0] ? String(withoutRecipe[0].id) : NEW_PRODUCT, new_name: '', editing: false, items: [emptyLine()] });
  };

  const openEdit = (r: Product) => {
    setError('');
    setDraft({
      product_id: String(r.id), new_name: '', editing: true,
      items: r.recipe.map((i) => ({ supply_id: String(i.supply_id), quantity: String(i.quantity) }))
    });
  };

  const setLine = (i: number, patch: Partial<Draft['items'][number]>) =>
    setDraft({ ...draft!, items: draft!.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  const lines = (draft?.items ?? []).map((l) => {
    const s = supplies.find((x) => x.id === Number(l.supply_id));
    return { supply: s, cost: s ? Number(l.quantity || 0) * s.unit_price : 0 };
  });
  const draftCost = lines.reduce((sum, l) => sum + l.cost, 0);

  const save = async () => {
    if (!draft) return;
    setError('');
    try {
      let productId = draft.product_id;
      if (productId === NEW_PRODUCT) {
        const created = await api.post<Product>('/products', { name: draft.new_name.trim(), category });
        productId = String(created.id);
      }
      await api.put(`/recipes/${productId}`, {
        items: draft.items.map((l) => ({ supply_id: Number(l.supply_id), quantity: Number(l.quantity) }))
      });
      setDraft(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (r: Product) => {
    if (!confirm(`¿Borrar la receta de "${r.name}"? El producto queda, pero sin receta no se puede fabricar.`)) return;
    await api.del(`/recipes/${r.id}`);
    load();
  };

  const canSave = draft
    && (draft.product_id !== NEW_PRODUCT || draft.new_name.trim())
    && draft.items.some((l) => l.supply_id && Number(l.quantity) > 0);

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Recetas</h1>
        <div className="spacer" />
        <button onClick={openNew} disabled={!supplies.length}>+ Nueva receta</button>
      </div>
      <CategoryTabs value={category} onChange={setCategory} counts={counts} />
      {!supplies.length && <p className="muted">Cargá primero los insumos para poder armar recetas.</p>}

      <div className="grid recipes-grid">
        {visible.map((r) => (
          <div className="card recipe-card" key={r.id}>
            <div className="recipe-head">
              <h2>{r.name}</h2>
              <div className="recipe-actions">
                <button className="small secondary" onClick={() => openEdit(r)}>Editar</button>
                <button className="small danger" onClick={() => remove(r)}>Borrar</button>
              </div>
            </div>
            <table>
              <tbody>
                {r.recipe.map((i) => (
                  <tr key={i.supply_id}>
                    <td>{i.supply_name}</td>
                    <td className="num">{qty(i.quantity)} {i.unit}</td>
                    <td className="num muted">{money(i.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>Costo de insumos</td><td className="num">{money(r.supplies_cost)}</td></tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
      {!visible.length && <p className="muted">Todavía no hay recetas de {labels.plural.toLowerCase()}.</p>}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{draft.editing ? 'Editar receta' : `Nueva receta de ${labels.singular.toLowerCase()}`}</h2>
            <div className="form-grid">
              <label>
                {labels.singular}
                <select value={draft.product_id} disabled={draft.editing} onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}>
                  {(draft.editing ? products.filter((p) => String(p.id) === draft.product_id) : withoutRecipe).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {!draft.editing && <option value={NEW_PRODUCT}>+ {labels.nuevo}…</option>}
                </select>
              </label>
              {draft.product_id === NEW_PRODUCT && (
                <label>
                  Nombre
                  <input value={draft.new_name} onChange={(e) => setDraft({ ...draft, new_name: e.target.value })} placeholder={labels.placeholder} autoFocus />
                </label>
              )}
            </div>

            <h2>Lleva</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Insumo</th><th>Cantidad</th><th className="num">Precio u.</th><th className="num">Costo</th><th /></tr></thead>
                <tbody>
                  {draft.items.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <select value={l.supply_id} onChange={(e) => setLine(i, { supply_id: e.target.value })}>
                          <option value="">Elegir…</option>
                          {supplies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder={lines[i].supply?.unit} />
                      </td>
                      <td className="num">{lines[i].supply ? `${money(lines[i].supply!.unit_price)}/${lines[i].supply!.unit}` : '—'}</td>
                      <td className="num">{money(lines[i].cost)}</td>
                      <td className="actions">
                        <button className="small danger" disabled={draft.items.length === 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="secondary small" style={{ marginTop: '.75rem' }} onClick={() => setDraft({ ...draft, items: [...draft.items, emptyLine()] })}>
              + Ingrediente
            </button>

            <p>Costo de insumos por unidad: <strong>{money(draftCost)}</strong></p>
            {error && <div className="error">{error}</div>}
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <div className="spacer" />
              <button className="secondary" onClick={() => setDraft(null)}>Cancelar</button>
              <button onClick={save} disabled={!canSave}>Guardar receta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
