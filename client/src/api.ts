// Cliente HTTP mínimo: misma cookie de sesión, errores del server como Error(message)
export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any = {}) {
    super(message);
  }
}

const request = async <T>(method: string, url: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/auth')) {
    window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Error inesperado', data);
  return data as T;
};

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url)
};

export const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const monthStart = () => today().slice(0, 8) + '01';

export const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  mercadopago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia'
};

export const CHANNEL_LABELS: Record<string, string> = { feria: 'Feria', online: 'Online' };

export interface Supplier { id: number; name: string; contact: string | null; notes: string | null }
export interface Scent { id: number; name: string; seasonal: number; active: number }
export interface FixedExpense { id: number; name: string; monthly_amount: number }
export interface Supply {
  id: number; name: string; unit: string; package_qty: number; package_price: number; stock: number;
  supplier_id: number | null; supplier_name: string | null; unit_price: number;
}
export interface RecipeLine {
  supply_id: number; quantity: number; supply_name: string; unit: string; unit_price: number; cost: number; stock: number;
}
export type Category = 'vela' | 'aroma';
export interface Product {
  id: number; name: string; category: Category; labor_cost: number; packaging_cost: number; sale_price: number; active: number;
  recipe: RecipeLine[]; stock: number; supplies_cost: number; fixed_cost: number; total_cost: number;
  suggested_price: number; margin: number | null;
}
export interface Production {
  id: number; product_id: number; product_name: string; category: Category; scent_id: number; scent_name: string | null;
  quantity: number; created_at: string;
}
export interface Shortage { supply_id: number; name: string; unit: string; needed: number; available: number; missing: number }
export interface StockSection {
  product_id: number; name: string; active: number; total: number;
  scents: { scent_id: number; name: string; quantity: number }[];
}

// Cantidades de insumos: hasta 3 decimales, sin ceros de más
export const qty = (n: number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 });
export interface Sale {
  id: number; sale_date: string; product_id: number; product_name: string; scent_id: number | null;
  scent_name: string | null; quantity: number; unit_price: number; total: number; payment_method: string; channel: string;
}
export interface Purchase {
  id: number; purchase_date: string; supply_id: number; supply_name: string; unit: string;
  quantity: number; price: number; supplier_id: number | null; supplier_name: string | null;
}
