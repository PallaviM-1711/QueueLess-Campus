# QueueLess Campus 🍽️

**A Smart Canteen Pre-Ordering and Queue Management System**

Students can browse canteen menus, pre-order food, book pickup slots, and track their orders in real time — eliminating physical queues at university canteens.

---

## Project Structure

```
QueueLess Campus/
├── frontend/                 # React + Vite + TypeScript (Port 5173)
│   └── src/
│       ├── api/              # Axios client and API wrappers
│       ├── pages/            # Route-level UI (auth screens are placeholders)
│       └── routes/           # React Router configuration
└── backend/                  # Node.js + Express + TypeScript (Port 5000)
    └── src/
        ├── config/           # Environment and MongoDB connection
        ├── middleware/       # Authentication and error handling
        ├── models/           # Mongoose schemas
        ├── realtime/         # Socket.IO authentication and room subscriptions
        ├── routes/           # Health, auth, menu, booking and order endpoints
        ├── services/         # Authentication, ordering and staff-order logic
        ├── types/            # Shared backend enums and types
        └── utils/            # JWT, OTP, email, and token helpers
```

Future feature work can add backend `controllers/` and request validators, plus
frontend `components/`, `features/`, and `types/` when needed. These folders are
not scaffolded before they have a concrete use.

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
npm run dev
```

The university domain must match the part after `@` in student email addresses.
Use a domain your institution controls. Configure SMTP in `backend/.env` before
registering students; signup will fail visibly if email delivery is unavailable.
Order placement uses MongoDB transactions to reserve slot capacity and create an
order atomically; configure MongoDB Atlas or another replica-set deployment.
Pickup slot dates and times are currently interpreted as UTC.

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
| `POST` | `/api/orders` | Place a pay-at-pickup order; server checks prices, availability and slot capacity |
| `GET` | `/api/orders/me` | List the authenticated student's orders |
| `GET` | `/api/orders/:orderId` | Read an order owned by the authenticated student |
| `GET` | `/api/canteens/:canteenId/orders` | List a canteen's orders (assigned staff/admin or university super admin) |
| `PATCH` | `/api/canteens/:canteenId/orders/:orderId/status` | Advance an order through allowed staff statuses |

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
| 5 | ⏳ Pending | Staff account and canteen provisioning |
| 6 | ⏳ Pending | Razorpay payment integration |
| 7 | ⏳ Pending | Super-admin dashboard, analytics |
| 8 | ⏳ Pending | QR-code pickup, deployment configs |

Core Mongoose schemas and authentication service helpers are already present.
Phase 2 wires student authentication. Phase 3 adds scoped menu management,
student menu browsing, local cart, pickup-slot creation and capacity-enforced
order placement with pickup tokens. Phase 4 provides the staff order queue and
authorized real-time order status updates. Staff accounts and canteen
assignments still require database provisioning; a self-service administration
screen has not been implemented.

---

## Security Notes

- All secrets are stored in `.env` files — **never in source code**.
- HTTP headers secured with [Helmet](https://helmetjs.github.io/).
- CORS restricted to the configured `CLIENT_ORIGIN`.
- JWT used for stateless auth; browser sessions currently store the token in `localStorage`.
- Verification codes are stored as hashes, expire after ten minutes and are invalidated after five incorrect attempts.
- Auth request throttling is in-memory per backend process; production multi-instance deployments need a shared rate-limit store.
- Set `TRUST_PROXY_HOPS` to the exact trusted proxy count for your host so per-IP throttling uses the client address.
- Menu writes verify the user's current active account, role, university, and assigned canteen on the backend. Staff/canteen-admin accounts must be provisioned with their canteen assignment by an administrator; account management UI is not implemented yet.
- Order prices are recalculated from active menu records on the server. Slot reservation and order creation run in a MongoDB transaction to prevent overbooking.
- Staff order updates enforce canteen assignment and valid status transitions on the server; cancellation releases the reserved slot in a transaction.
- Socket.IO connections authenticate with the same JWT and authorize order/canteen room subscriptions before joining. Keep the frontend API origin and backend CORS origin configured for the deployed domains.
- Checkout currently supports pay-at-pickup only; Razorpay is not implemented.
- Razorpay payments verified server-side (Phase 6+).

---

## Deployment

- **Frontend** → Vercel (set `VITE_API_URL` to the deployed backend URL)
- **Backend** → Render (set all env vars in the Render dashboard)

> Deployment guides will be added in Phase 8.
