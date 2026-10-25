import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getCanteenOrders,
  updateOrderStatus,
  type OrderRecord,
} from '../api/ordering.api';
import { connectOrderSocket } from '../api/orderSocket';
import './orders.css';
import './staff-orders.css';

const statusOptions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['picked_up'],
};

const filterOptions = ['all', ...Object.keys(statusOptions), 'picked_up', 'cancelled'];

export default function StaffOrdersPage() {
  const { canteenId = '' } = useParams();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [busyOrder, setBusyOrder] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshOrders = useCallback(async () => {
    try {
      const result = await getCanteenOrders(canteenId, filter === 'all' ? undefined : filter);
      setOrders(result);
      setError('');
    } finally {
      setLoading(false);
    }
  }, [canteenId, filter]);

  useEffect(() => {
    refreshOrders().catch((reason: Error) => setError(reason.message));
  }, [refreshOrders]);

  useEffect(() => {
    const socket = connectOrderSocket();
    if (!socket) return;
    socket.on('connect', () => {
      socket.emit(
        'canteen:subscribe',
        { canteenId },
        (result: { success: boolean; message?: string }) => {
          if (!result.success) setError(result.message ?? 'Live order updates are unavailable');
        }
      );
    });
    socket.on('connect_error', (reason: Error) => setError(reason.message));
    socket.on('order:changed', () => {
      refreshOrders().catch((reason: Error) => setError(reason.message));
    });
    return () => {
      socket.disconnect();
    };
  }, [canteenId, refreshOrders]);

  async function changeStatus(order: OrderRecord, status: string) {
    if (status === 'cancelled' &&
        !window.confirm(`Cancel order ${order.pickupToken}? Its pickup-slot booking will be released.`)) {
      return;
    }
    setBusyOrder(order._id);
    setError('');
    try {
      await updateOrderStatus(canteenId, order._id, status);
      await refreshOrders();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update order status');
    } finally {
      setBusyOrder('');
    }
  }

  return (
    <main className="order-page">
      <Link to={`/canteens/${canteenId}/menu`}>← Canteen menu</Link>
      <section className="order-card">
        <header className="staff-orders-header">
          <div>
            <h1>Order queue</h1>
            <p>Update each order as it moves through preparation.</p>
          </div>
          <label>
            Filter
            <select
              value={filter}
              onChange={(event) => {
                setLoading(true);
                setFilter(event.target.value);
              }}
            >
              {filterOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All orders' : status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </header>
        {error && <p className="order-error" role="alert">{error}</p>}
        {loading ? (
          <p>Loading orders…</p>
        ) : orders.length === 0 ? (
          <p>No orders in this view.</p>
        ) : (
          <div className="staff-order-list">
            {orders.map((order) => (
              <article className="staff-order" key={order._id}>
                <div className="staff-order-heading">
                  <div>
                    <strong>{order.student?.name ?? 'Student'}</strong>
                    <p>{order.pickupToken} · {order.status.replaceAll('_', ' ')}</p>
                  </div>
                  <strong>₹{order.totalAmount.toFixed(2)}</strong>
                </div>
                <p>
                  Pickup {new Date(order.pickupSlot.date).toLocaleDateString()} ·{' '}
                  {order.pickupSlot.startTime}–{order.pickupSlot.endTime}
                </p>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.menuItem}>{item.name} × {item.quantity}</li>
                  ))}
                </ul>
                {order.notes && <p>Note: {order.notes}</p>}
                <p>Payment: {order.paymentMethod.replaceAll('_', ' ')} · {order.paymentStatus}</p>
                <div className="staff-order-actions">
                  {(statusOptions[order.status] ?? []).map((status) => (
                    <button
                      disabled={busyOrder === order._id}
                      key={status}
                      onClick={() => void changeStatus(order, status)}
                      type="button"
                    >
                      {busyOrder === order._id ? 'Updating…' : status.replaceAll('_', ' ')}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
