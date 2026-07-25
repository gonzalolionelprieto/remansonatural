/**
 * Carrito client-side con persistencia en localStorage.
 * Módulo con estado propio + pub/sub. Sobrevive a las navegaciones con
 * ClientRouter (el módulo se ejecuta una sola vez y persiste).
 */
import {
  calcularPrecio,
  suscripcionOff,
  type Modalidad,
  type Frecuencia,
} from './pricing';

export interface CartItem {
  slug: string;
  nombre: string;
  /** Precio de LISTA del producto. El descuento se calcula, nunca se guarda. */
  precio: number;
  linea: string;
  /** Stock disponible al momento de agregar (tope suave en la UI del carrito). */
  stock: number;
  qty: number;
  /** Compra única o suscripción con 20% off. */
  modalidad: Modalidad;
  /** Cada cuántos días se repite el envío (sólo si es suscripción). */
  frecuencia?: Frecuencia;
}

/**
 * v2: la identidad del ítem pasó de `slug` a `slug::modalidad`, así una
 * suscripción y una compra única del mismo producto conviven como dos
 * líneas. Subir la versión de la clave descarta los carritos viejos en vez
 * de leerlos con una forma que ya no existe.
 */
const KEY = 'remanso-cart-v2';

// La regla de envío gratis vive en lib/shipping.ts (la comparten ficha,
// carrito, checkout y el copy del sitio).
export { envioGratisUnidades, tieneEnvioGratis } from './shipping';

type Listener = (items: CartItem[]) => void;
const listeners = new Set<Listener>();

/** Clave de línea: un mismo producto puede estar dos veces con modalidades distintas. */
export function lineKey(slug: string, modalidad: Modalidad): string {
  return `${slug}::${modalidad}`;
}

export const keyOf = (i: CartItem): string => lineKey(i.slug, i.modalidad);

/** Precio unitario ya con el descuento que corresponda a esa línea. */
export function unitPrice(i: CartItem): number {
  return calcularPrecio({ precio: i.precio, modalidad: i.modalidad, qty: i.qty })
    .unitario;
}

/** Total de una línea. */
export function lineTotal(i: CartItem): number {
  return unitPrice(i) * i.qty;
}

function load(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Normalizamos por las dudas: un item guardado sin modalidad (o tocado a
    // mano) no debe romper el render del carrito entero.
    return raw.map((i: CartItem) => ({
      ...i,
      modalidad: i.modalidad === 'suscripcion' ? 'suscripcion' : 'unica',
    }));
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

/** Total del carrito con los descuentos ya aplicados. */
export const total = (): number => items.reduce((s, i) => s + lineTotal(i), 0);

/** Total a precio de lista: sirve para mostrar cuánto se está ahorrando. */
export const totalLista = (): number =>
  items.reduce((s, i) => s + i.precio * i.qty, 0);

export const ahorro = (): number => totalLista() - total();

/** ¿Hay al menos una suscripción en el carrito? */
export const tieneSuscripcion = (): boolean =>
  items.some((i) => i.modalidad === 'suscripcion');

/** Total de lo que se repite en cada envío de la suscripción. */
export const totalSuscripcion = (): number =>
  items.filter((i) => i.modalidad === 'suscripcion').reduce((s, i) => s + lineTotal(i), 0);

/** Total de lo que se cobra una sola vez. */
export const totalUnica = (): number =>
  items.filter((i) => i.modalidad === 'unica').reduce((s, i) => s + lineTotal(i), 0);

/**
 * Si el carrito mezcla suscripción con compra única. Cuando pasa hay que
 * etiquetar TODAS las líneas: si sólo se marca la suscripción, las de al lado
 * se leen como si también se repitieran todos los meses.
 */
export const esMixto = (): boolean =>
  items.some((i) => i.modalidad === 'suscripcion') &&
  items.some((i) => i.modalidad === 'unica');

/**
 * Cuánto ahorraría una línea si pasara a suscripción. Es el número que hace
 * concreta la pregunta del carrito: sin él, "suscribite" es una abstracción.
 */
export function ahorroSiSuscribe(key: string): number {
  const linea = items.find((i) => keyOf(i) === key);
  if (!linea) return 0;
  return Math.round((linea.precio * suscripcionOff()) / 100) * 100;
}

/** Frecuencias distintas presentes en el carrito. */
export const frecuenciasEnCarrito = (): number[] => [
  ...new Set(
    items
      .filter((i) => i.modalidad === 'suscripcion')
      .map((i) => i.frecuencia ?? 30)
  ),
];

/** Contexto que necesita lib/shipping para decidir si el envío es gratis. */
export const contextoEnvio = () => ({
  unidades: count(),
  haySuscripcion: tieneSuscripcion(),
});

/** Tope de cantidad: el stock real del producto (si lo conocemos), si no 99. */
function maxFor(stock: number): number {
  return stock > 0 ? Math.min(99, stock) : 99;
}

export type ResultadoAdd = 'ok' | 'suscripcion-ocupada';

/**
 * Una sola suscripción por carrito.
 *
 * Es una restricción, no una limitación técnica: evita de raíz que alguien
 * termine con tres débitos automáticos de frecuencias distintas sin haberlo
 * entendido. Si ya hay una, el producto entra igual pero como compra única —
 * nunca se rechaza el agregado, que sería perder la venta por una regla
 * nuestra. La UI avisa qué pasó.
 */
export function add(item: Omit<CartItem, 'qty'>, qty = 1): ResultadoAdd {
  let resultado: ResultadoAdd = 'ok';
  let modalidad = item.modalidad;

  if (modalidad === 'suscripcion') {
    const yaHay = items.find(
      (i) => i.modalidad === 'suscripcion' && i.slug !== item.slug
    );
    if (yaHay) {
      modalidad = 'unica';
      resultado = 'suscripcion-ocupada';
    }
  }

  const entrada: Omit<CartItem, 'qty'> = { ...item, modalidad };
  const key = lineKey(entrada.slug, modalidad);
  const found = items.find((i) => keyOf(i) === key);
  const max = maxFor(entrada.stock);
  if (found) {
    found.stock = entrada.stock; // refrescar con el stock más reciente
    found.qty = Math.min(max, found.qty + qty);
    found.frecuencia = entrada.frecuencia ?? found.frecuencia;
  } else {
    items.push({ ...entrada, qty: Math.min(max, qty) });
  }
  persist();
  return resultado;
}

/**
 * Pasa una línea de compra única a suscripción (el "doble upsell" del
 * carrito). Sólo si no hay otra suscripción activa.
 */
export function convertirASuscripcion(key: string, frecuencia: Frecuencia = 30): boolean {
  const linea = items.find((i) => keyOf(i) === key);
  if (!linea || linea.modalidad === 'suscripcion') return false;
  if (items.some((i) => i.modalidad === 'suscripcion')) return false;

  // Al cambiar de modalidad cambia la clave: si ya existía una línea de
  // suscripción del mismo producto habría que fusionarlas, pero eso no puede
  // pasar acá porque recién descartamos que exista alguna suscripción.
  linea.modalidad = 'suscripcion';
  linea.frecuencia = frecuencia;
  // Una suscripción es de a una unidad por envío.
  linea.qty = 1;
  persist();
  return true;
}

export function setQty(key: string, qty: number): void {
  if (qty <= 0) return remove(key);
  const found = items.find((i) => keyOf(i) === key);
  if (found) {
    found.qty = Math.min(maxFor(found.stock), qty);
    persist();
  }
}

export function remove(key: string): void {
  items = items.filter((i) => keyOf(i) !== key);
  persist();
}

/**
 * Ajuste por falta de stock: el servidor sólo conoce el slug, y un slug puede
 * estar en el carrito dos veces (compra única + suscripción). Repartimos el
 * stock disponible entre esas líneas en orden y sacamos las que quedan en 0.
 */
export function ajustarPorStock(slug: string, disponible: number): void {
  let restante = Math.max(0, disponible);
  for (const i of items.filter((x) => x.slug === slug)) {
    i.stock = restante;
    i.qty = Math.min(i.qty, restante);
    restante -= i.qty;
  }
  items = items.filter((i) => i.slug !== slug || i.qty > 0);
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
