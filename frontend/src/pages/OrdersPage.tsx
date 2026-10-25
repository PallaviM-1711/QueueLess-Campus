import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders, type OrderRecord } from '../api/ordering.api';
import { connectOrderSocket } from '../api/orderSocket';
import './orders.css';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMyOrders()
      .then((result) => {
        if (mounted) setOrders(result);
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const socket = connectOrderSocket();
    if (!socket) return;
    socket.on('order:changed', () => {
      getMyOrders()
        .then(setOrders)
        .catch((reason: Error) => setError(reason.message));
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="order-page">
      <Link to="/">← Home</Link>
      <section className="order-card">
        <h1>My orders</h1>
        {error && <p className="order-error" role="alert">{error}</p>}
        {!error && orders.length === 0 && <p>No orders yet.</p>}
        <ul className="orders-list">
          {orders.map((order) => (
            <li key={order._id}>
              <Link to={`/orders/${order._id}`}>
                <strong>{order.canteen.name}</strong>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
                <span>{order.status.replaceAll('_', ' ')} · ₹{order.totalAmount.toFixed(2)}</span>
                <span>Pickup token: {order.pickupToken}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
