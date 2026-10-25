import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getCanteenOrders,
  updateOrderStatus,
  verifyPickupAtCanteen,
  type OrderRecord,
} from '../api/ordering.api';
import { connectOrderSocket } from '../api/orderSocket';
import './orders.css';
import './staff-orders.css';

const PickupScanner = lazy(() => import('../components/PickupScanner'));

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
  const [pickupToken, setPickupToken] = useState('');
  const [pickupBusy, setPickupBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  async function verifyPickup(token: string) {
    setPickupBusy(true);
    setError('');
    setMessage('');
    try {
      const order = await verifyPickupAtCanteen(canteenId, token.trim().toUpperCase());
      setMessage(`Order ${order.pickupToken} marked as picked up.`);
      setPickupToken('');
      try {
        await refreshOrders();
      } catch (reason) {
        setError(
          `Pickup was verified, but the queue could not refresh: ${
            reason instanceof Error ? reason.message : 'Unknown error'
          }`
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not verify pickup token');
    } finally {
      setPickupBusy(false);
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
        <section className="pickup-verification">
          <h2>Verify pickup</h2>
          <p>Scan the QR code shown on a ready order or enter its pickup token.</p>
          <button
            disabled={pickupBusy}
            onClick={() => {
              setError('');
              setShowScanner((visible) => !visible);
            }}
            type="button"
          >
            {showScanner ? 'Close scanner' : 'Scan pickup QR'}
          </button>
          {showScanner && (
            <Suspense fallback={<p>Loading camera scanner…</p>}>
              <PickupScanner
                onError={setError}
                onToken={(token) => {
                  setPickupToken(token.toUpperCase());
                  setShowScanner(false);
                  void verifyPickup(token);
                }}
              />
            </Suspense>
          )}
          <form
            className="pickup-token-form"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyPickup(pickupToken);
            }}
          >
            <label>
              Pickup token
              <input
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={10}
                minLength={10}
                onChange={(event) => setPickupToken(event.target.value.toUpperCase())}
                required
                value={pickupToken}
              />
            </label>
            <button disabled={pickupBusy} type="submit">
              {pickupBusy ? 'Verifying…' : 'Confirm pickup'}
            </button>
          </form>
        </section>
        {message && <p className="order-hint" role="status">{message}</p>}
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
                {order.paymentMethod === 'razorpay' && order.paymentStatus === 'unpaid' && (
                  <p>
                    {order.paymentAttemptExists
                      ? 'Payment was initiated. Staff actions are locked while Razorpay may still capture it.'
                      : 'Waiting for the student to start payment; staff may cancel this order.'}
                  </p>
                )}
                <div className="staff-order-actions">
                  {(statusOptions[order.status] ?? [])
                    .filter((status) => (
                      order.paymentMethod !== 'razorpay' ||
                      order.paymentStatus !== 'unpaid' ||
                      (status === 'cancelled' && !order.paymentAttemptExists)
                    ))
                    .map((status) => (
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
