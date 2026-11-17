import { useSearchParams } from 'react-router-dom';
import { Category } from '../api';

export const CATEGORY_LABELS: Record<Category, { plural: string; singular: string; nuevo: string; placeholder: string }> = {
  vela: { plural: 'Velas', singular: 'Vela', nuevo: 'Nueva vela', placeholder: 'Vela en frasco 200 g' },
  aroma: { plural: 'Aromas', singular: 'Aroma', nuevo: 'Nuevo aroma', placeholder: 'Difusor de vainilla 100 ml' }
};

// La solapa elegida queda en la URL: sobrevive a recargar y pasa de Productos a Recetas con un link
export const useCategory = () => {
  const [params, setParams] = useSearchParams();
  const category: Category = params.get('tipo') === 'aroma' ? 'aroma' : 'vela';
  const setCategory = (c: Category) => setParams(c === 'aroma' ? { tipo: 'aroma' } : {}, { replace: true });
  return [category, setCategory] as const;
};

interface Props {
  value: Category;
  onChange: (c: Category) => void;
  counts: Record<Category, number>;
}

export default function CategoryTabs({ value, onChange, counts }: Props) {
  return (
    <div className="tabs" role="tablist">
      {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={value === c}
          className={value === c ? 'tab active' : 'tab'}
          onClick={() => onChange(c)}
        >
          {CATEGORY_LABELS[c].plural} <span className="tab-count">{counts[c]}</span>
        </button>
      ))}
    </div>
  );
}
