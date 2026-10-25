import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addMenuItemToCart,
  changeCartQuantity,
  readCart,
  saveCart,
  type StoredCart,
} from '../api/cartStorage';
import {
  createMenuItem,
  deactivateMenuItem,
  getMenu,
  type MenuItem,
  updateMenuItem,
} from '../api/menu.api';
import { createPickupSlot } from '../api/ordering.api';
import { getCurrentUser, type AuthUser } from '../api/auth.api';
import './menu.css';

interface ApiError extends Error {
  status?: number;
}

const emptyForm = {
  name: '',
  description: '',
  category: '',
  price: '',
  imageUrl: '',
  isVeg: true,
  preparationTimeMinutes: '10',
};

const emptySlotForm = {
  date: new Date().toISOString().slice(0, 10),
  startTime: '12:00',
  endTime: '12:15',
  capacity: '20',
};
const TODAY_UTC = new Date().toISOString().slice(0, 10);

export default function MenuPage() {
  const { canteenId = '' } = useParams();
  const [canteenName, setCanteenName] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [vegetarianOnly, setVegetarianOnly] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cart, setCart] = useState<StoredCart | null>(() => readCart());
  const [slotForm, setSlotForm] = useState(emptySlotForm);

  const canManage = Boolean(
    user &&
      (user.role === 'super_admin' ||
        ((user.role === 'staff' || user.role === 'canteen_admin') &&
          user.canteen === canteenId))
  );

  const loadMenu = useCallback(async () => {
    const result = await getMenu(canteenId, {
      ...(search.trim() && { search: search.trim() }),
      ...(category && { category }),
      ...(vegetarianOnly && { isVeg: true }),
    });
    setCanteenName(result.canteen.name);
    setItems(result.items);
    setCategories(result.categories);
  }, [canteenId, search, category, vegetarianOnly]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getCurrentUser(), getMenu(canteenId)])
      .then(([currentUser, result]) => {
        if (!mounted) return;
        setUser(currentUser);
        setCanteenName(result.canteen.name);
        setItems(result.items);
        setCategories(result.categories);
      })
      .catch((reason: ApiError) => {
        if (mounted) setError(reason.message);
      });
    return () => {
      mounted = false;
    };
  }, [canteenId]);

  async function refreshAfterChange(successMessage: string) {
    setMessage(successMessage);
    setError('');
    await loadMenu();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createMenuItem(canteenId, {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        price: Number(form.price),
        imageUrl: form.imageUrl || undefined,
        isVeg: form.isVeg,
        preparationTimeMinutes: Number(form.preparationTimeMinutes),
      });
      setForm(emptyForm);
      await refreshAfterChange('Menu item added.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setBusy(true);
    try {
      await updateMenuItem(canteenId, item._id, { isAvailable: !item.isAvailable });
      await refreshAfterChange(`${item.name} availability updated.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: MenuItem) {
    if (!window.confirm(`Remove ${item.name} from this menu?`)) return;
    setBusy(true);
    try {
      await deactivateMenuItem(canteenId, item._id);
      await refreshAfterChange(`${item.name} removed from the menu.`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addToCart(item: MenuItem) {
    if (cart && cart.canteenId !== canteenId &&
        !window.confirm('Your cart has items from another canteen. Replace it with this item?')) {
      return;
    }
    const updated = addMenuItemToCart(cart, canteenId, item);
    setCart(updated);
    saveCart(updated);
    setMessage(`${item.name} added to your cart.`);
    setError('');
  }

  function updateQuantity(menuItemId: string, delta: number) {
    if (!cart) return;
    const updated = changeCartQuantity(cart, menuItemId, delta);
    setCart(updated);
    saveCart(updated);
  }

  async function handleCreateSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createPickupSlot(canteenId, {
        ...slotForm,
        capacity: Number(slotForm.capacity),
      });
      setMessage('Pickup slot created.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="menu-page">
      <header className="menu-header">
        <Link to="/" className="menu-back">← Canteens</Link>
        <h1>{canteenName || 'Canteen menu'}</h1>
        <p>Browse the current menu and availability.</p>
      </header>

      {error && <p className="menu-notice menu-error" role="alert">{error}</p>}
      {message && <p className="menu-notice" role="status">{message}</p>}

      <section className="menu-filters" aria-label="Menu filters">
        <label>
          Search menu
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food" />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="menu-check">
          <input
            type="checkbox"
            checked={vegetarianOnly}
            onChange={(event) => setVegetarianOnly(event.target.checked)}
          />
          Vegetarian only
        </label>
      </section>

      {canManage && (
        <>
          <section className="menu-manage">
            <h2>Add menu item</h2>
            <form onSubmit={handleCreate}>
            <label>Item name<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Category<input required maxLength={50} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <label>Price (₹)<input required type="number" min="0" max="100000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label>Prep time (minutes)<input required type="number" min="1" max="240" value={form.preparationTimeMinutes} onChange={(event) => setForm({ ...form, preparationTimeMinutes: event.target.value })} /></label>
            <label className="menu-wide">Description<input maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className="menu-wide">Image URL<input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label>
            <label className="menu-check"><input type="checkbox" checked={form.isVeg} onChange={(event) => setForm({ ...form, isVeg: event.target.checked })} />Vegetarian</label>
            <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Add item'}</button>
            </form>
          </section>
          <section className="menu-manage">
            <h2>Create pickup slot</h2>
            <form onSubmit={handleCreateSlot}>
              <label>Date<input required type="date" min={TODAY_UTC} value={slotForm.date} onChange={(event) => setSlotForm({ ...slotForm, date: event.target.value })} /></label>
              <label>Starts<input required type="time" value={slotForm.startTime} onChange={(event) => setSlotForm({ ...slotForm, startTime: event.target.value })} /></label>
              <label>Ends<input required type="time" value={slotForm.endTime} onChange={(event) => setSlotForm({ ...slotForm, endTime: event.target.value })} /></label>
              <label>Order capacity<input required type="number" min="1" max="500" value={slotForm.capacity} onChange={(event) => setSlotForm({ ...slotForm, capacity: event.target.value })} /></label>
              <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Create slot'}</button>
            </form>
          </section>
        </>
      )}

      {cart?.canteenId === canteenId && cart.items.length > 0 && (
        <section className="menu-cart" aria-labelledby="cart-title">
          <div>
            <h2 id="cart-title">Your cart ({cart.items.reduce((sum, line) => sum + line.quantity, 0)})</h2>
            <ul>
              {cart.items.map((line) => (
                <li key={line.menuItemId}>
                  <span>{line.name} — ₹{(line.price * line.quantity).toFixed(2)}</span>
                  <span className="cart-quantity">
                    <button aria-label={`Remove one ${line.name}`} onClick={() => updateQuantity(line.menuItemId, -1)} type="button">−</button>
                    {line.quantity}
                    <button aria-label={`Add one ${line.name}`} onClick={() => updateQuantity(line.menuItemId, 1)} type="button">+</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="cart-checkout">
            <strong>Estimated total: ₹{cart.items.reduce((sum, line) => sum + line.price * line.quantity, 0).toFixed(2)}</strong>
            <Link to={`/checkout/${canteenId}`}>Choose pickup slot</Link>
          </div>
        </section>
      )}

      <section className="menu-grid" aria-live="polite">
        {items.length === 0 ? (
          <p className="menu-empty">No menu items match these filters.</p>
        ) : items.map((item) => (
          <article className={`menu-card${!item.isAvailable ? ' menu-card-unavailable' : ''}`} key={item._id}>
            {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" />}
            <div className="menu-card-body">
              <div className="menu-card-title">
                <h2>{item.name}</h2>
                <span className={item.isVeg ? 'veg-mark' : 'nonveg-mark'} aria-label={item.isVeg ? 'Vegetarian' : 'Non-vegetarian'} />
              </div>
              {item.description && <p>{item.description}</p>}
              <p className="menu-category">{item.category} · {item.preparationTimeMinutes} min</p>
              <div className="menu-card-footer">
                <strong>₹{item.price.toFixed(2)}</strong>
                <span>{item.isAvailable ? 'Available' : 'Unavailable'}</span>
              </div>
              <button
                className="menu-add-button"
                disabled={!item.isAvailable}
                onClick={() => addToCart(item)}
                type="button"
              >
                {item.isAvailable ? 'Add to cart' : 'Unavailable'}
              </button>
              {canManage && (
                <div className="menu-item-actions">
                  <button disabled={busy} onClick={() => void toggleAvailability(item)} type="button">
                    Mark {item.isAvailable ? 'unavailable' : 'available'}
                  </button>
                  <button disabled={busy} onClick={() => void removeItem(item)} type="button">Remove</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
