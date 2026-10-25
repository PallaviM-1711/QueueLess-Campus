import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, type OrderRecord } from '../api/ordering.api';
import { connectOrderSocket } from '../api/orderSocket';
import './orders.css';

export default function OrderPage() {
  const { orderId = '' } = useParams();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState('');

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
            <p>Pickup token</p>
            <p className="pickup-token">{order.pickupToken}</p>
            <p>Show this token to canteen staff when you collect your order.</p>
            <dl className="order-details">
              <div><dt>Canteen</dt><dd>{order.canteen.name}</dd></div>
              <div>
                <dt>Pickup time</dt>
                <dd>{new Date(order.pickupSlot.date).toLocaleDateString()} · {order.pickupSlot.startTime}–{order.pickupSlot.endTime}</dd>
              </div>
              <div><dt>Payment</dt><dd>Pay at pickup · {order.paymentStatus}</dd></div>
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
