import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createAdminCanteen,
  getAdminAnalytics,
  getAdminCanteens,
  getAdminStaff,
  inviteStaff,
  resendStaffInvite,
  setCanteenOpen,
  updateStaff,
  type AdminCanteen,
  type AdminAnalytics,
  type AdminStaff,
} from '../api/admin.api';
import { getCurrentUser } from '../api/auth.api';
import './admin.css';

const emptyCanteen = { name: '', location: '', openingTime: '08:00', closingTime: '20:00' };
const emptyInvitation = {
  name: '',
  email: '',
  role: 'staff' as AdminStaff['role'],
  canteenId: '',
};
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
});

export default function AdminPage() {
  const [canteens, setCanteens] = useState<AdminCanteen[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState('30');
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [canteenForm, setCanteenForm] = useState(emptyCanteen);
  const [invitationForm, setInvitationForm] = useState(emptyInvitation);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [canteenResult, staffResult] = await Promise.all([
      getAdminCanteens(),
      getAdminStaff(),
    ]);
    setCanteens(canteenResult);
    setStaff(staffResult);
  }, []);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (!mounted) return;
        if (user.role !== 'super_admin') {
          setError('Super-admin access is required.');
          setLoading(false);
          return;
        }
        setAllowed(true);
        return refresh();
      })
      .catch((reason: Error) => {
        if (mounted) setError(reason.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!allowed) return;
    let mounted = true;
    const end = new Date();
    const to = end.toISOString().slice(0, 10);
    const fromDate = new Date(Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate() - Number(analyticsDays) + 1
    ));
    getAdminAnalytics(fromDate.toISOString().slice(0, 10), to)
      .then((result) => {
        if (mounted) setAnalytics(result);
      })
      .catch((reason: Error) => {
        if (mounted) setAnalyticsError(reason.message);
      })
      .finally(() => {
        if (mounted) setAnalyticsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [allowed, analyticsDays]);

  async function submitCanteen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await createAdminCanteen(canteenForm);
      setCanteenForm(emptyCanteen);
      setMessage('Canteen created.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create canteen.');
    } finally {
      setBusy(false);
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await inviteStaff(invitationForm));
      setInvitationForm({ ...emptyInvitation, canteenId: invitationForm.canteenId });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send staff invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCanteen(canteen: AdminCanteen) {
    setBusy(true);
    setError('');
    try {
      await setCanteenOpen(canteen._id, !canteen.isOpen);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update canteen.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaffActive(user: AdminStaff) {
    setBusy(true);
    setError('');
    try {
      await updateStaff(user._id, { isActive: !user.isActive });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update staff account.');
    } finally {
      setBusy(false);
    }
  }

  async function resendInvitation(user: AdminStaff) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await resendStaffInvite(user._id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not resend staff invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function reassignStaff(user: AdminStaff, canteenId: string) {
    if (!canteenId) return;
    setBusy(true);
    setError('');
    try {
      await updateStaff(user._id, { canteenId });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reassign staff account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <Link to="/">← Home</Link>
          <h1>University administration</h1>
          <p>Manage campus canteens and assigned staff accounts.</p>
        </div>
      </header>
      {error && <p className="admin-notice admin-error" role="alert">{error}</p>}
      {message && <p className="admin-notice" role="status">{message}</p>}
      {loading && <p>Loading administration data…</p>}
      {!loading && !allowed && <p>Administration access is unavailable for this account.</p>}
      {!loading && allowed && (
        <>
          <section className="admin-card">
            <header className="admin-analytics-header">
              <div>
                <h2>University analytics</h2>
                <p>Order activity and paid revenue across your canteens.</p>
              </div>
              <label>
                Date range
                <select
                  onChange={(event) => {
                    setAnalyticsError('');
                    setAnalyticsLoading(true);
                    setAnalyticsDays(event.target.value);
                  }}
                  value={analyticsDays}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </label>
            </header>
            {analyticsLoading && <p>Loading analytics…</p>}
            {analyticsError && (
              <p className="admin-notice admin-error" role="alert">{analyticsError}</p>
            )}
            {analytics && !analyticsLoading && (
              <>
                <div className="admin-analytics-metrics">
                  <article>
                    <span>Orders</span>
                    <strong>{analytics.summary.totalOrders}</strong>
                  </article>
                  <article>
                    <span>Picked up</span>
                    <strong>{analytics.summary.completedOrders}</strong>
                  </article>
                  <article>
                    <span>Cancelled</span>
                    <strong>{analytics.summary.cancelledOrders}</strong>
                  </article>
                  <article>
                    <span>Unpaid</span>
                    <strong>{analytics.summary.unpaidOrders}</strong>
                  </article>
                  <article>
                    <span>Paid revenue</span>
                    <strong>{currencyFormatter.format(analytics.summary.revenue)}</strong>
                  </article>
                  <article>
                    <span>Average preparation</span>
                    <strong>
                      {analytics.summary.averagePreparationMinutes === null
                        ? 'Not available'
                        : `${analytics.summary.averagePreparationMinutes} min`}
                    </strong>
                  </article>
                </div>
                <p className="admin-analytics-note">
                  Preparation time covers orders with recorded preparation-start and ready timestamps.
                  Older orders without these timestamps are excluded.
                </p>
                <div className="admin-analytics-details">
                  <section>
                    <h3>Most ordered items</h3>
                    {analytics.popularItems.length === 0 ? (
                      <p>No non-cancelled orders in this range.</p>
                    ) : (
                      <ol className="admin-analytics-list">
                        {analytics.popularItems.map((item) => (
                          <li key={item.name}>
                            <span>{item.name} · {item.orderCount} orders</span>
                            <strong>{item.unitsOrdered} ordered</strong>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                  <section>
                    <h3>Canteen performance</h3>
                    {analytics.canteens.length === 0 ? (
                      <p>No canteens are configured yet.</p>
                    ) : (
                      <ul className="admin-analytics-list">
                        {analytics.canteens.map((canteen) => (
                          <li key={canteen.canteenId}>
                            <span>{canteen.name} · {canteen.orders} orders</span>
                            <strong>{currencyFormatter.format(canteen.revenue)}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}
          </section>
          <section className="admin-card">
            <h2>Canteens</h2>
            {canteens.length === 0 ? (
              <p>No canteens have been created yet.</p>
            ) : (
              <ul className="admin-canteen-list">
                {canteens.map((canteen) => (
                  <li key={canteen._id}>
                    <div>
                      <strong>{canteen.name}</strong>
                      <span>{canteen.location || 'Location not set'} · {canteen.isOpen ? 'Open' : 'Closed'}</span>
                    </div>
                    <button disabled={busy} onClick={() => void toggleCanteen(canteen)} type="button">
                      Mark {canteen.isOpen ? 'closed' : 'open'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3>Create a canteen</h3>
            <form className="admin-form" onSubmit={(event) => void submitCanteen(event)}>
              <label>
                Name
                <input
                  maxLength={80}
                  onChange={(event) => setCanteenForm({ ...canteenForm, name: event.target.value })}
                  required
                  value={canteenForm.name}
                />
              </label>
              <label>
                Location
                <input
                  maxLength={120}
                  onChange={(event) => setCanteenForm({ ...canteenForm, location: event.target.value })}
                  value={canteenForm.location}
                />
              </label>
              <label>
                Opens
                <input
                  onChange={(event) => setCanteenForm({ ...canteenForm, openingTime: event.target.value })}
                  required
                  type="time"
                  value={canteenForm.openingTime}
                />
              </label>
              <label>
                Closes
                <input
                  onChange={(event) => setCanteenForm({ ...canteenForm, closingTime: event.target.value })}
                  required
                  type="time"
                  value={canteenForm.closingTime}
                />
              </label>
              <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Create canteen'}</button>
            </form>
          </section>

          <section className="admin-card">
            <h2>Staff accounts</h2>
            {staff.length === 0 ? (
              <p>No staff accounts have been invited yet.</p>
            ) : (
              <ul className="admin-staff-list">
                {staff.map((user) => (
                  <li key={user._id}>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email} · {user.role.replace('_', ' ')}</span>
                      <span>{user.isEmailVerified ? 'Invitation accepted' : 'Invitation pending'} · {user.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <label>
                      Assigned canteen
                      <select
                        disabled={busy || !user.isActive}
                        onChange={(event) => void reassignStaff(user, event.target.value)}
                        value={
                          user.canteen && typeof user.canteen === 'object'
                            ? user.canteen._id
                            : typeof user.canteen === 'string'
                              ? user.canteen
                              : ''
                        }
                      >
                        <option value="" disabled>Select a canteen</option>
                        {canteens.map((canteen) => (
                          <option key={canteen._id} value={canteen._id}>{canteen.name}</option>
                        ))}
                      </select>
                    </label>
                    <button disabled={busy} onClick={() => void toggleStaffActive(user)} type="button">
                      {user.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    {user.isActive && !user.isEmailVerified && (
                      <button disabled={busy} onClick={() => void resendInvitation(user)} type="button">
                        Resend invitation
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h3>Invite staff</h3>
            {canteens.length === 0 ? (
              <p>Create a canteen before inviting staff.</p>
            ) : (
              <form className="admin-form" onSubmit={(event) => void submitInvitation(event)}>
                <label>
                  Name
                  <input
                    maxLength={60}
                    onChange={(event) => setInvitationForm({ ...invitationForm, name: event.target.value })}
                    required
                    value={invitationForm.name}
                  />
                </label>
                <label>
                  University email
                  <input
                    autoComplete="email"
                    onChange={(event) => setInvitationForm({ ...invitationForm, email: event.target.value })}
                    required
                    type="email"
                    value={invitationForm.email}
                  />
                </label>
                <label>
                  Role
                  <select
                    onChange={(event) => setInvitationForm({
                      ...invitationForm,
                      role: event.target.value as AdminStaff['role'],
                    })}
                    value={invitationForm.role}
                  >
                    <option value="staff">Staff</option>
                    <option value="canteen_admin">Canteen administrator</option>
                  </select>
                </label>
                <label>
                  Canteen
                  <select
                    onChange={(event) => setInvitationForm({ ...invitationForm, canteenId: event.target.value })}
                    required
                    value={invitationForm.canteenId}
                  >
                    <option value="" disabled>Select a canteen</option>
                    {canteens.filter((canteen) => canteen.isActive).map((canteen) => (
                      <option key={canteen._id} value={canteen._id}>{canteen.name}</option>
                    ))}
                  </select>
                </label>
                <button disabled={busy} type="submit">{busy ? 'Sending…' : 'Send invitation'}</button>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
