import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createAdminCanteen,
  getAdminCanteens,
  getAdminStaff,
  inviteStaff,
  resendStaffInvite,
  setCanteenOpen,
  updateStaff,
  type AdminCanteen,
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

export default function AdminPage() {
  const [canteens, setCanteens] = useState<AdminCanteen[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
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
