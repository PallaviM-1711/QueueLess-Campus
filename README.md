# QueueLess Campus 🍽️

**A Smart Canteen Pre-Ordering and Queue Management System**

Students can browse canteen menus, pre-order food, book pickup slots, and track their orders in real time — eliminating physical queues at university canteens.

---

## Project Structure

```
QueueLess Campus/
├── frontend/    # React + Vite + TypeScript (Port 5173)
└── backend/     # Node.js + Express + TypeScript (Port 5000)
```

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | v18+ (v24 recommended) |
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

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A long random string (≥ 64 chars) — generate with `openssl rand -hex 64` |
| `CLIENT_ORIGIN` | Frontend URL — `http://localhost:5173` for local dev |

Install dependencies and start:

```bash
npm install
npm run dev      # starts with ts-node-dev, auto-restarts on changes
```

The backend starts on **http://localhost:5000**.  
Health check: **http://localhost:5000/api/health**

### 3. Configure the Frontend

```bash
cd frontend
cp .env.example .env.local
```

The `VITE_API_URL` can stay empty for local development — the Vite dev server proxies `/api/*` to `localhost:5000` automatically.

```bash
npm install
npm run dev      # starts Vite dev server
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
| `npm run type-check` | Type-check without emitting |

### Frontend (`/frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | Type-check without emitting |

---

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server liveness + DB connection status |

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
| 1 | ✅ **Done** | Scaffold, env config, DB connection, health check, README |
| 2 | ⏳ Pending | MongoDB models, auth (register / login / email verify) |
| 3 | ⏳ Pending | Menu API, cart, checkout, pickup-slot booking |
| 4 | ⏳ Pending | Socket.IO live order updates |
| 5 | ⏳ Pending | Staff dashboard, menu management |
| 6 | ⏳ Pending | Razorpay payment integration |
| 7 | ⏳ Pending | Super-admin dashboard, analytics |
| 8 | ⏳ Pending | QR-code pickup, deployment configs |

---

## Security Notes

- All secrets are stored in `.env` files — **never in source code**.
- HTTP headers secured with [Helmet](https://helmetjs.github.io/).
- CORS restricted to the configured `CLIENT_ORIGIN`.
- JWT used for stateless auth (Phase 2+).
- Razorpay payments verified server-side (Phase 6+).

---

## Deployment

- **Frontend** → Vercel (set `VITE_API_URL` to the deployed backend URL)
- **Backend** → Render (set all env vars in the Render dashboard)

> Deployment guides will be added in Phase 8.

