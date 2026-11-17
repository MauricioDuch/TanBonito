import { FormEvent, useEffect, useState } from 'react';
import { api, money } from '../api';

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'money';
  default?: string | number;
}

type Row = Record<string, any> & { id: number };

const emptyForm = (fields: Field[]) =>
  Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'checkbox' ? 0 : '')]));

const Input = ({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) =>
  field.type === 'checkbox' ? (
    <input type="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
  ) : (
    <input
      type={field.type === 'number' || field.type === 'money' ? 'number' : 'text'}
      step="any"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );

// ABM de tablas simples con edición en la misma fila (aromas, proveedores, gastos fijos)
export default function SimpleCrud({ title, endpoint, fields, onChange }: {
  title: string;
  endpoint: string;
  fields: Field[];
  onChange?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState(emptyForm(fields));
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<Row[]>(endpoint).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [endpoint]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await load();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post(endpoint, form);
      setForm(emptyForm(fields));
    });
  };

  const save = () => run(async () => {
    await api.put(`${endpoint}/${editing!.id}`, editing);
    setEditing(null);
  });

  const remove = (row: Row) => {
    if (!confirm(`¿Borrar "${row[fields[0].name]}"?`)) return;
    run(() => api.del(`${endpoint}/${row.id}`));
  };

  const display = (f: Field, v: any) =>
    f.type === 'checkbox' ? (Number(v) ? 'Sí' : '—') : f.type === 'money' ? money(v) : v || <span className="muted">—</span>;

  return (
    <div>
      <h1>{title}</h1>
      <form className="card form-grid" onSubmit={create} style={{ marginBottom: '1rem' }}>
        {fields.map((f) => (
          <label key={f.name}>
            {f.label}
            <Input field={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />
          </label>
        ))}
        <button disabled={!form[fields[0].name]}>Agregar</button>
      </form>
      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {fields.map((f) => <th key={f.name} className={f.type === 'money' ? 'num' : ''}>{f.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {fields.map((f) => (
                  <td key={f.name} className={f.type === 'money' ? 'num' : ''}>
                    {editing?.id === row.id
                      ? <Input field={f} value={editing[f.name]} onChange={(v) => setEditing({ ...editing, [f.name]: v })} />
                      : display(f, row[f.name])}
                  </td>
                ))}
                <td className="actions">
                  {editing?.id === row.id ? (
                    <>
                      <button className="small" onClick={save}>Guardar</button>
                      <button className="small secondary" onClick={() => setEditing(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="small secondary" onClick={() => setEditing(row)}>Editar</button>
                      <button className="small danger" onClick={() => remove(row)}>Borrar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={fields.length + 1} className="muted">Todavía no hay registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
