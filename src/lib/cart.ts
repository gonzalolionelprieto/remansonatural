/**
 * Carrito client-side con persistencia en localStorage.
 * Módulo con estado propio + pub/sub. Sobrevive a las navegaciones con
 * ClientRouter (el módulo se ejecuta una sola vez y persiste).
 */
export interface CartItem {
  slug: string;
  nombre: string;
  precio: number;
  linea: string;
  qty: number;
}

const KEY = 'remanso-cart-v1';
export const ENVIO_GRATIS_DESDE = 80000;

type Listener = (items: CartItem[]) => void;
const listeners = new Set<Listener>();

function load(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let items: CartItem[] = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos en memoria */
  }
  listeners.forEach((l) => l(items));
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(items);
  return () => listeners.delete(l);
}

export const getItems = (): CartItem[] => items;
export const count = (): number => items.reduce((s, i) => s + i.qty, 0);
export const total = (): number => items.reduce((s, i) => s + i.precio * i.qty, 0);

export function add(item: Omit<CartItem, 'qty'>, qty = 1): void {
  const found = items.find((i) => i.slug === item.slug);
  if (found) found.qty += qty;
  else items.push({ ...item, qty });
  persist();
}

export function setQty(slug: string, qty: number): void {
  if (qty <= 0) return remove(slug);
  const found = items.find((i) => i.slug === slug);
  if (found) {
    found.qty = Math.min(99, qty);
    persist();
  }
}

export function remove(slug: string): void {
  items = items.filter((i) => i.slug !== slug);
  persist();
}

export function clear(): void {
  items = [];
  persist();
}

// Sincronizar entre pestañas.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      items = load();
      listeners.forEach((l) => l(items));
    }
  });
}
