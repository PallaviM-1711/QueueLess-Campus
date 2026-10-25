import type { MenuItem } from './menu.api';

export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface StoredCart {
  canteenId: string;
  items: CartLine[];
}

const CART_STORAGE_KEY = 'qlc_cart';

export function readCart(): StoredCart | null {
  const stored = localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) return null;

  try {
    const value: unknown = JSON.parse(stored);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('canteenId' in value) ||
      typeof value.canteenId !== 'string' ||
      !('items' in value) ||
      !Array.isArray(value.items)
    ) {
      throw new Error('Saved cart has an invalid format');
    }
    const items = value.items.filter(
      (item): item is CartLine =>
        typeof item === 'object' &&
        item !== null &&
        'menuItemId' in item &&
        typeof item.menuItemId === 'string' &&
        'name' in item &&
        typeof item.name === 'string' &&
        'price' in item &&
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        'quantity' in item &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 50
    );
    return { canteenId: value.canteenId, items };
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    return null;
  }
}

export function saveCart(cart: StoredCart | null): void {
  if (!cart || cart.items.length === 0) {
    localStorage.removeItem(CART_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function addMenuItemToCart(
  cart: StoredCart | null,
  canteenId: string,
  item: MenuItem
): StoredCart {
  const current = cart?.canteenId === canteenId ? cart : { canteenId, items: [] };
  const existing = current.items.find((line) => line.menuItemId === item._id);
  const items = existing
    ? current.items.map((line) =>
        line.menuItemId === item._id
          ? { ...line, quantity: Math.min(line.quantity + 1, 50) }
          : line
      )
    : [
        ...current.items,
        { menuItemId: item._id, name: item.name, price: item.price, quantity: 1 },
      ];
  return { ...current, items };
}

export function changeCartQuantity(
  cart: StoredCart,
  menuItemId: string,
  delta: number
): StoredCart | null {
  const items = cart.items
    .map((line) =>
      line.menuItemId === menuItemId
        ? { ...line, quantity: line.quantity + delta }
        : line
    )
    .filter((line) => line.quantity > 0);
  return items.length ? { ...cart, items } : null;
}
