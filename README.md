# QueueLess Campus 🍽️

**A Smart Canteen Pre-Ordering and Queue Management System**

Students can browse canteen menus, pre-order food, book pickup slots, pay at pickup or with Razorpay, and track their orders in real time — eliminating physical queues at university canteens.

---

## Project Structure

```
QueueLess Campus/
├── frontend/                 # React + Vite + TypeScript (Port 5173)
│   └── src/
│       ├── api/              # Axios client, payment and other API wrappers
│       ├── components/       # Shared QR pickup scanner
│       ├── pages/            # Authentication, menu, orders and admin screens
│       └── routes/           # React Router configuration
└── backend/                  # Node.js + Express + TypeScript (Port 5000)
    └── src/
        ├── config/           # Environment and MongoDB connection
        ├── middleware/       # Authentication and error handling
        ├── models/           # Mongoose schemas
        ├── realtime/         # Socket.IO authentication and room subscriptions
        ├── routes/           # Health, auth, admin, menu, booking, order and payment endpoints
        ├── services/         # Authentication, ordering, analytics and payment logic
        ├── types/            # Shared backend enums and types
        └── utils/            # JWT, OTP, email, and token helpers
```

Future feature work can add backend `controllers/` and request validators,
plus frontend `features/` and `types/` as needed.

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | v20.19+ or v22.12+ |
| npm | v9+ |
| Git | any recent version |
| MongoDB Atlas | Free tier cluster |

---

## Local Setup

### 1. Clone / open the project

```bash
cd "QueueLess Campus"
```

### 2. Configure the Backend

PowerShell:

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

macOS/Linux:

```bash
test -e backend/.env || cp backend/.env.example backend/.env
```

Edit `backend/.env` and set valid values:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A random secret of at least 64 characters |
| `CLIENT_ORIGIN` | Frontend URL — `http://localhost:5173` for local dev |

Generate a local JWT secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then install dependencies, build the backend tools, and register the approved
university email domain:

```bash
cd backend
npm ci
npm run build
npm run university:create -- --name "Your University" --email-domain college.edu
```

The university domain must match the part after `@` in student email addresses.
Use a domain your institution controls. Configure SMTP in `backend/.env` before
registering students or inviting staff; email-dependent actions fail visibly if
delivery is unavailable. The university-creation command prints its record ID.
After building the backend, bootstrap that university's first super admin with:

```bash
npm run super-admin:create -- --name "University Admin" --email admin@college.edu --university-id YOUR_UNIVERSITY_ID
```

Then start the backend:

```bash
npm run dev
```

The CLI prompts for the password without echoing it, requires the email domain
to match the university, and allows only one bootstrap super admin per
university. Sign in with that account and use **University admin** to create
canteens and send one-time staff invitations. Invitation links expire after
24 hours; staff set their own password when accepting.

Order placement uses MongoDB transactions to reserve slot capacity and create an
order atomically; configure MongoDB Atlas or another replica-set deployment.
Pickup slot dates and times are currently interpreted as UTC.
Razorpay is optional: set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` together
in `backend/.env` to enable Checkout, and use test-mode keys during development.
For server notifications, set `RAZORPAY_WEBHOOK_SECRET` and configure the
Razorpay webhook endpoint at `/api/payments/razorpay/webhook` for
`payment.authorized` and `payment.captured`. Do not put the API secret or webhook
secret in frontend environment variables.

The backend starts on **http://localhost:5000**.  
Health/readiness check: **http://localhost:5000/api/health** (returns HTTP 503
when MongoDB is disconnected).

### 3. Configure the Frontend

PowerShell:

```powershell
if (-not (Test-Path frontend\.env.local)) { Copy-Item frontend\.env.example frontend\.env.local }
```

macOS/Linux:

```bash
test -e frontend/.env.local || cp frontend/.env.example frontend/.env.local
```

The `VITE_API_URL` can stay empty for local development — the Vite dev server proxies `/api/*` to `localhost:5000` automatically.

```bash
cd frontend
npm ci
npm run dev
```

The frontend starts on **http://localhost:5173**.

---

## Available Scripts

### Backend (`/backend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run university:create -- --name "University" --email-domain college.edu` | Add an approved college email domain |
| `npm run super-admin:create -- --name "Admin" --email admin@college.edu --university-id YOUR_UNIVERSITY_ID` | Bootstrap the university's first super-admin account |
| `npm run type-check` | Type-check without emitting |

### Frontend (`/frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | Type-check without emitting |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server readiness and DB connection status (503 if DB is unavailable) |
| `POST` | `/api/auth/register` | Register a student for an approved university email domain (SMTP required) |
| `POST` | `/api/auth/verify-email` | Verify the email code and issue a JWT |
| `POST` | `/api/auth/resend-otp` | Resend a verification code |
| `POST` | `/api/auth/accept-invitation` | Accept a staff invitation and set a password |
| `POST` | `/api/auth/login` | Log in a verified student |
| `GET` | `/api/auth/me` | Return the authenticated user's profile |
| `GET` | `/api/canteens` | List active canteens at the authenticated user's university |
| `GET` | `/api/canteens/:canteenId/menu` | Browse/search a canteen menu (supports `search`, `category`, `isVeg`) |
| `POST` | `/api/canteens/:canteenId/menu` | Add a menu item (assigned canteen staff/admin or university super admin) |
| `PATCH` | `/api/canteens/:canteenId/menu/:itemId` | Update a menu item or its availability |
| `DELETE` | `/api/canteens/:canteenId/menu/:itemId` | Deactivate a menu item without removing order history |
| `GET` | `/api/canteens/:canteenId/pickup-slots?date=YYYY-MM-DD` | List future slots with remaining capacity |
| `POST` | `/api/canteens/:canteenId/pickup-slots` | Create a capacity-limited pickup slot (canteen manager) |
| `PATCH` | `/api/canteens/:canteenId/pickup-slots/:slotId` | Activate or deactivate a pickup slot (canteen manager) |
| `POST` | `/api/orders` | Place a pay-at-pickup or Razorpay order; server checks prices, availability and slot capacity |
| `GET` | `/api/orders/me` | List the authenticated student's orders |
| `GET` | `/api/orders/:orderId` | Read an order owned by the authenticated student |
| `GET` | `/api/payments/razorpay/config` | Return whether online payment is configured and its public key ID |
| `POST` | `/api/payments/razorpay/orders/:orderId` | Create/reuse a server-side Razorpay order for an owned order |
| `POST` | `/api/payments/razorpay/verify` | Verify the Checkout signature and confirm/capture payment server-side |
| `POST` | `/api/payments/razorpay/webhook` | Process signed `payment.authorized` and `payment.captured` events |
| `GET` | `/api/canteens/:canteenId/orders` | List a canteen's orders (assigned staff/admin or university super admin) |
| `PATCH` | `/api/canteens/:canteenId/orders/:orderId/status` | Advance an order through allowed staff statuses |
| `POST` | `/api/canteens/:canteenId/orders/verify-pickup` | Verify a ready order's QR/token and mark it picked up (assigned staff/admin) |
| `GET` | `/api/admin/canteens` | List university canteens (super admin only) |
| `POST` | `/api/admin/canteens` | Create a university canteen (super admin only) |
| `PATCH` | `/api/admin/canteens/:canteenId` | Update canteen details or open status (super admin only) |
| `GET` | `/api/admin/staff` | List university staff accounts (super admin only) |
| `GET` | `/api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | University-scoped order, paid revenue, popular-item and preparation-time analytics (super admin only; up to 366 days) |
| `POST` | `/api/admin/staff` | Invite assigned canteen staff/admin by university email |
| `POST` | `/api/admin/staff/:staffId/resend-invitation` | Resend an unaccepted staff invitation |
| `PATCH` | `/api/admin/staff/:staffId` | Reassign or activate/deactivate a staff account |

Authenticated Socket.IO clients can subscribe to `order:subscribe` with an
`orderId` or, for authorized managers, `canteen:subscribe` with a `canteenId`.
The server checks the account and ownership/assignment before joining rooms.
`order:changed` events are sent after an order status transaction succeeds.

---

## Environment Variables

### Backend (`backend/.env`)

See [`backend/.env.example`](./backend/.env.example) for the full list and descriptions.

### Frontend (`frontend/.env.local`)

See [`frontend/.env.example`](./frontend/.env.example). All variables must be prefixed with `VITE_` to be exposed to the browser.

> ⚠️ **Never commit real `.env` files.** They are listed in `.gitignore`.

---

## Phase Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| 1 | ✅ **Foundation** | App scaffolds, environment validation, MongoDB lifecycle, health/readiness check, setup docs |
| 2 | ✅ **Implemented** | Student registration, college-domain validation, email verification, login, profile endpoint (requires MongoDB and SMTP for end-to-end use) |
| 3 | ✅ **Implemented** | Menu catalog, cart, checkout, pickup-slot capacity booking, pickup token and student order history |
| 4 | ✅ **Implemented** | Staff order queue, validated order status changes and live Socket.IO updates |
| 5 | ✅ **Implemented** | Super-admin canteen management, staff invitations, assignment and account activation |
| 6 | ✅ **Implemented** | Pay at pickup and optional Razorpay Checkout with server-side capture, signature verification and webhooks |
| 7 | ✅ **Implemented** | University-scoped super-admin analytics for order activity, paid revenue, popular items and preparation times |
| 8 | ✅ **Implemented** | Student pickup QR codes and canteen-scoped staff verification; manual token entry remains available |
| 9 | ✅ **Configured** | Vercel SPA routing and a free-tier Render API blueprint; hosting accounts and credentials remain operator-managed |

Core Mongoose schemas and authentication service helpers are already present.
Phase 2 wires student authentication. Phase 3 adds scoped menu management,
student menu browsing, local cart, pickup-slot creation and capacity-enforced
order placement with pickup tokens. Phase 4 provides the staff order queue and
authorized real-time order status updates. Phase 5 adds scoped university
administration for canteens and staff, including one-time email invitations.
Phase 6 adds optional Razorpay payments; gateway keys and webhook secrets must
be configured by the project owner before online payments are enabled. Phase 7
adds university-scoped order, revenue, popular-item and preparation-time
analytics to the super-admin dashboard.
Phase 8 adds a QR code once an order is ready and a staff scanner/manual token
flow that verifies the canteen and order state on the backend.

---

## Security Notes

- All secrets are stored in `.env` files — **never in source code**.
- HTTP headers secured with [Helmet](https://helmetjs.github.io/).
- CORS restricted to the configured `CLIENT_ORIGIN`.
- JWT used for stateless auth; browser sessions currently store the token in `localStorage`.
- Verification codes are stored as hashes, expire after ten minutes and are invalidated after five incorrect attempts.
- Auth request throttling is in-memory per backend process; production multi-instance deployments need a shared rate-limit store.
- Set `TRUST_PROXY_HOPS` to the exact trusted proxy count for your host so per-IP throttling uses the client address.
- Menu writes verify the user's current active account, role, university, and assigned canteen on the backend. Staff/canteen-admin accounts are provisioned with canteen assignment by a verified super admin.
- Order prices are recalculated from active menu records on the server. Slot reservation and order creation run in a MongoDB transaction to prevent overbooking.
- Staff order updates enforce canteen assignment and valid status transitions on the server; cancellation releases the reserved slot in a transaction.
- Socket.IO connections authenticate with the same JWT and authorize order/canteen room subscriptions before joining. Keep the frontend API origin and backend CORS origin configured for the deployed domains.
- Public registration and email-code verification can only create/verify student accounts. Staff roles are provisioned by a database-verified super admin; invitation tokens are random, hashed at rest, single-use and expire after 24 hours. Invitation links carry the token in the URL fragment, which is removed from browser history after the page reads it. Staff accounts are deactivated/reassigned server-side and their live sockets are disconnected after changes.
- Razorpay's public key ID may be returned to the browser; the API secret and webhook secret remain server-side only. Checkout signatures are verified, payment details are fetched from Razorpay, and authorized payments are captured only for the server-calculated order amount.
- Unpaid online orders keep their pickup reservation until staff review. Staff may cancel before a Razorpay order is created; after Checkout has been initialized, cancellation is blocked to avoid releasing capacity while a payment can still complete. Refund workflows are not implemented.
- Razorpay Checkout is loaded from Razorpay's hosted script. Test keys should be used before any live configuration.
- Super-admin analytics are scoped to canteens in the administrator's university. Revenue includes non-cancelled orders marked paid; average preparation time is measured from staff marking an order as preparing until it is ready. Orders created before timestamp tracking was added are excluded from that average.
- Pickup QR codes contain only the existing pickup token. Staff authentication, active account status, canteen assignment, and the ready-to-picked-up transition are verified by the backend. Camera scanning requires browser camera permission and a secure context (HTTPS or localhost); staff can enter the token manually if camera access is unavailable.

---

## Deployment

### Backend on Render

1. Create a Blueprint from the repository root; Render reads [`render.yaml`](./render.yaml) and provisions a free Node web service. The repository pins Render to Node 22.12 through [`.node-version`](./.node-version).
2. Provide the requested `MONGODB_URI`, a random `JWT_SECRET` of at least 64 characters, and the final Vercel origin for `CLIENT_ORIGIN`. Configure SMTP values to enable registration and email verification.
3. Restrict the MongoDB Atlas network access list to the backend host's published outbound addresses where possible; do not use a broad `0.0.0.0/0` rule unless you understand and accept that exposure.
4. Confirm `https://<render-service>/api/health` returns HTTP 200. The free service may spin down when idle and take time to wake.

### Frontend on Vercel

1. Import the repository and set the project root directory to `frontend`.
2. Use `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. [`frontend/vercel.json`](./frontend/vercel.json) rewrites client-side routes to the SPA entry point.
   The frontend package range supports local Node 20.19+ and lets Vercel select its latest supported major (24.x).
3. Set `VITE_API_URL` to the backend origin, without a trailing slash, then redeploy. This variable is public in the browser bundle; never put secrets in a `VITE_` variable.
4. Set Render's `CLIENT_ORIGIN` to the exact deployed Vercel origin (including `https://` and any custom domain), then redeploy the backend so CORS and Socket.IO accept that origin.

Before enabling public sign-up, create the university email domain and first
super-admin using the backend CLI scripts documented above against the intended
database. Keep production database credentials and generated secrets in the
hosting provider's environment settings, never in Git.

Razorpay remains optional. If enabled, configure its API keys and webhook secret
only in the Render environment settings and register the deployed
`/api/payments/razorpay/webhook` endpoint in Razorpay.
