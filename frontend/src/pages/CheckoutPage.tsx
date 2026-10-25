import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { readCart, saveCart, type StoredCart } from '../api/cartStorage';
import { getPickupSlots, placeOrder, type PickupSlot } from '../api/ordering.api';
import {
  createRazorpayOrder,
  getRazorpayConfiguration,
  verifyRazorpayCheckout,
  type RazorpayConfiguration,
} from '../api/razorpay.api';
import { loadRazorpayCheckout, openRazorpayCheckout } from '../api/razorpayCheckout';
import './orders.css';

const TODAY_UTC = new Date().toISOString().slice(0, 10);

export default function CheckoutPage() {
  const { canteenId = '' } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState<StoredCart | null>(() => readCart());
  const [date, setDate] = useState(TODAY_UTC);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_pickup' | 'razorpay'>('pay_at_pickup');
  const [paymentConfiguration, setPaymentConfiguration] = useState<RazorpayConfiguration | null>(null);
  const [paymentConfigurationError, setPaymentConfigurationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getRazorpayConfiguration()
      .then(setPaymentConfiguration)
      .catch((reason: Error) => setPaymentConfigurationError(reason.message));
  }, []);

  useEffect(() => {
    if (!date || !canteenId) return;
    let mounted = true;
    getPickupSlots(canteenId, date)
      .then((result) => {
        if (mounted) setSlots(result);
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message);
      });
    return () => {
      mounted = false;
    };
  }, [canteenId, date]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || cart.canteenId !== canteenId || cart.items.length === 0) {
      setError('Your cart is empty. Return to the menu and add items.');
      return;
    }
    setBusy(true);
    setError('');
    let createdOrderId = '';
    try {
      const order = await placeOrder({
        canteenId,
        pickupSlotId: slotId,
        paymentMethod,
        items: cart.items.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
        ...(notes.trim() && { notes: notes.trim() }),
      });
      createdOrderId = order._id;
      saveCart(null);
      setCart(null);
      if (paymentMethod === 'pay_at_pickup') {
        navigate(`/orders/${order._id}`, { replace: true });
        return;
      }

      const payment = await createRazorpayOrder(order._id);
      await loadRazorpayCheckout();
      openRazorpayCheckout(payment, `Order ${order.pickupToken}`, {
        onSuccess: (response) => {
          void verifyRazorpayCheckout(order._id, response)
            .then(() => navigate(`/orders/${order._id}`, { replace: true }))
            .catch((reason: Error) => navigate(`/orders/${order._id}`, {
              replace: true,
              state: { paymentMessage: reason.message },
            }));
        },
        onFailure: (message) => navigate(`/orders/${order._id}`, {
          replace: true,
          state: { paymentMessage: message },
        }),
        onDismiss: () => navigate(`/orders/${order._id}`, {
          replace: true,
          state: { paymentMessage: 'Payment was not completed. Your order remains reserved until staff review.' },
        }),
      });
    } catch (reason) {
      if (createdOrderId) {
        navigate(`/orders/${createdOrderId}`, {
          replace: true,
          state: {
            paymentMessage: reason instanceof Error
              ? reason.message
              : 'Online payment could not be started',
          },
        });
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not place order');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="order-page">
      <Link to={`/canteens/${canteenId}/menu`}>← Back to menu</Link>
      <section className="order-card">
        <h1>Checkout</h1>
        {!cart || cart.canteenId !== canteenId || cart.items.length === 0 ? (
          <p>Your cart is empty. <Link to={`/canteens/${canteenId}/menu`}>Browse the menu</Link>.</p>
        ) : (
          <>
            <ul className="order-summary">
              {cart.items.map((item) => (
                <li key={item.menuItemId}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
              <li className="order-total">
                <strong>Estimated total</strong>
                <strong>₹{cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</strong>
              </li>
            </ul>
            <p className="order-hint">Final prices and availability are checked by the server when you place the order.</p>

            <form className="order-form" onSubmit={handleSubmit}>
              <label>
                Pickup date
                <input
                  type="date"
                  min={TODAY_UTC}
                  required
                  value={date}
                  onChange={(event) => {
                    setSlots([]);
                    setSlotId('');
                    setError('');
                    setDate(event.target.value);
                  }}
                />
              </label>
              <label>
                Pickup time
                <select required value={slotId} onChange={(event) => setSlotId(event.target.value)}>
                  <option value="">Choose an available slot</option>
                  {slots.map((slot) => (
                    <option key={slot._id} value={slot._id}>
                      {slot.startTime}–{slot.endTime} · {slot.capacity - slot.booked} left
                    </option>
                  ))}
                </select>
              </label>
              {slots.length === 0 && <p>No available pickup slots on this date.</p>}
              <label>
                Notes (optional)
                <textarea maxLength={200} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <label>
                Payment method
                <select
                  onChange={(event) => {
                    if (event.target.value === 'pay_at_pickup' || event.target.value === 'razorpay') {
                      setPaymentMethod(event.target.value);
                    }
                  }}
                  value={paymentMethod}
                >
                  <option value="pay_at_pickup">Pay at pickup</option>
                  {paymentConfiguration?.enabled && <option value="razorpay">Pay online with Razorpay</option>}
                </select>
              </label>
              {paymentConfigurationError && (
                <p className="order-hint">Payment options could not be loaded: {paymentConfigurationError}</p>
              )}
              {paymentConfiguration && !paymentConfiguration.enabled && (
                <p className="order-hint">Online payments are not configured. Pay at pickup is available.</p>
              )}
              {error && <p className="order-error" role="alert">{error}</p>}
              <button className="order-submit" disabled={busy || slots.length === 0} type="submit">
                {busy ? 'Placing order…' : paymentMethod === 'razorpay' ? 'Continue to payment' : 'Place order'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
