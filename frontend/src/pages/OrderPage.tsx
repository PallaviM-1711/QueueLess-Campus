import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { createRazorpayOrder, verifyRazorpayCheckout } from '../api/razorpay.api';
import { loadRazorpayCheckout, openRazorpayCheckout } from '../api/razorpayCheckout';
import { getOrder, type OrderRecord } from '../api/ordering.api';
import { connectOrderSocket } from '../api/orderSocket';
import './orders.css';

export default function OrderPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState(() => {
    const state = location.state as { paymentMessage?: unknown } | null;
    return typeof state?.paymentMessage === 'string' ? state.paymentMessage : '';
  });
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOrder(orderId)
      .then((result) => {
        if (mounted) setOrder(result);
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message);
      });
    return () => {
      mounted = false;
    };
  }, [orderId]);

  async function retryOnlinePayment() {
    setPaymentBusy(true);
    setPaymentMessage('');
    try {
      if (!order) throw new Error('Order details are not loaded');
      const payment = await createRazorpayOrder(order._id);
      await loadRazorpayCheckout();
      openRazorpayCheckout(payment, `Order ${order.pickupToken}`, {
        onSuccess: (response) => {
          void verifyRazorpayCheckout(order._id, response)
            .then(setOrder)
            .then(() => setPaymentMessage('Payment captured successfully.'))
            .catch((reason: Error) => setPaymentMessage(reason.message));
        },
        onFailure: (message) => setPaymentMessage(message),
        onDismiss: () => setPaymentMessage(
          'Payment was not completed. Your pickup slot remains reserved until staff review.'
        ),
      });
    } catch (reason) {
      setPaymentMessage(reason instanceof Error ? reason.message : 'Could not start Razorpay Checkout');
    } finally {
      setPaymentBusy(false);
    }
  }

  useEffect(() => {
    const socket = connectOrderSocket();
    if (!socket) return;

    socket.on('connect', () => {
      socket.emit(
        'order:subscribe',
        { orderId },
        (result: { success: boolean; message?: string }) => {
          if (!result.success) setRealtimeError(result.message ?? 'Live updates unavailable');
        }
      );
    });
    socket.on('connect_error', (reason: Error) => setRealtimeError(reason.message));
    socket.on('order:changed', (event: { orderId: string }) => {
      if (event.orderId === orderId) {
        getOrder(orderId)
          .then(setOrder)
          .catch((reason: Error) => setError(reason.message));
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  return (
    <main className="order-page">
      <Link to="/">← Home</Link>
      <section className="order-card">
        <h1>Order details</h1>
        {error && <p className="order-error" role="alert">{error}</p>}
        {!order && !error && <p>Loading order…</p>}
        {order && (
          <>
            <p className="order-status">Status: {order.status.replaceAll('_', ' ')}</p>
            {realtimeError && <p className="order-hint">Live updates unavailable: {realtimeError}</p>}
            {paymentMessage && <p className="order-hint" role="status">{paymentMessage}</p>}
            {order.paymentMethod === 'razorpay' &&
              order.paymentStatus === 'unpaid' &&
              order.status === 'pending' && (
                <div>
                  <p className="order-hint">
                    Online payment must be confirmed before the canteen starts preparation.
                    The pickup slot remains reserved until staff review.
                  </p>
                  <button
                    className="order-submit"
                    disabled={paymentBusy}
                    onClick={() => void retryOnlinePayment()}
                    type="button"
                  >
                    {paymentBusy ? 'Opening payment…' : 'Pay online'}
                  </button>
                </div>
              )}
            <p>Pickup token</p>
            <p className="pickup-token">{order.pickupToken}</p>
            <p>Show this token to canteen staff when you collect your order.</p>
            <dl className="order-details">
              <div><dt>Canteen</dt><dd>{order.canteen.name}</dd></div>
              <div>
                <dt>Pickup time</dt>
                <dd>{new Date(order.pickupSlot.date).toLocaleDateString()} · {order.pickupSlot.startTime}–{order.pickupSlot.endTime}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{order.paymentMethod === 'razorpay' ? 'Razorpay' : 'Pay at pickup'} · {order.paymentStatus}</dd>
              </div>
            </dl>
            <ul className="order-summary">
              {order.items.map((item) => (
                <li key={item.menuItem}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
              <li className="order-total"><strong>Total</strong><strong>₹{order.totalAmount.toFixed(2)}</strong></li>
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
