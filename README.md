# GlanceFive — Amazon Seller Dashboard

A professional analytics dashboard for Indian Amazon sellers. Connects to the Amazon Advertising API to show Sponsored Products / Brands / Display campaign performance with KPI cards, spend vs sales charts, search term analysis, and product-level ACOS tracking.

---

## What You'll See

- **Live KPIs** — Ad Spend, Sales, ACOS, ROAS, CTR, CPC, Orders with trend arrows
- **Spend vs Sales chart** — daily performance across 7 / 14 / 30 / 90 day windows
- **Top Campaigns** — sortable table with ACOS chips and share-of-voice
- **Search Terms** — find what's converting vs what's wasting money
- **Products / ASINs** — per-product spend and returns
- **Smart Actions** — actionable daily recommendations

---

## Before You Start — Install These Once

### 1. Python 3.11

Download: https://www.python.org/downloads/

> On Windows: during install, check **"Add Python to PATH"**

Verify in Terminal / Command Prompt:
```
python --version
```
Should print: `Python 3.11.x`

---

### 2. Node.js 18 or higher

Download the **LTS** version: https://nodejs.org/en/download

Verify:
```
node --version
npm --version
```

---

### 3. Git

Download: https://git-scm.com/downloads

---

## Setup (do this once)

Open Terminal (Mac/Linux) or Command Prompt (Windows) and follow each step.

---

### Step 1 — Get the code

```bash
git clone https://github.com/sbind29893/GlanceFive.git
cd GlanceFive
```

---

### Step 2 — Create your config file

```bash
# Mac / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Open the `.env` file in any text editor and set these two values (just make up any long random string):

```
JWT_SECRET=pick-any-long-random-string-at-least-32-characters-long
ENCRYPTION_KEY=pick-another-different-long-random-string-here-32chars
```

Leave everything else as-is.

---

### Step 3 — Install Python packages

```bash
pip install -r backend/requirements.txt
```

> Takes 2–3 minutes. If you see a `psycopg2` error, see Troubleshooting below.

---

### Step 4 — Create the database

```bash
cd backend
python setup_fresh.py
cd ..
```

When it finishes you'll see your login credentials:
```
Login at http://localhost:5173 with:
  Email:    demo@glancefive.com
  Password: Demo123!
```

---

### Step 5 — Install frontend packages

```bash
cd frontend
npm install
cd ..
```

> Takes 2–3 minutes the first time.

---

## Running the App

You need **two terminal windows** open simultaneously.

---

### Terminal 1 — Start the backend

```bash
cd GlanceFive/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Leave this running. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

---

### Terminal 2 — Start the frontend

```bash
cd GlanceFive/frontend
npm run dev
```

Leave this running too. You should see:
```
  VITE v5.x.x  ready
  ➜  Local:   http://localhost:5173/
```

---

## Open the Dashboard

Go to: **http://localhost:5173**

Login:
- **Email:** `demo@glancefive.com`
- **Password:** `Demo123!`

The demo account comes with 30 days of sample data so you can explore the dashboard right away.

---

## Connect Your Amazon Account (Optional)

To see your own real ad data:

1. Log in to the dashboard
2. Click **Settings** in the left sidebar
3. Enter your Amazon Advertising API credentials (Client ID, Client Secret, Refresh Token)
4. Save — then go to **Fetch History** → **Fetch Reports**

> To get API credentials: log in to advertising.amazon.in → go to **Apps & Services** → **Manage your apps** → create a new app

---

## Troubleshooting

**`psycopg2` error during pip install**

This package is for PostgreSQL (not needed locally). Either:
```bash
pip install psycopg2-binary
```
Or open `backend/requirements.txt`, delete the `psycopg2-binary` line, and re-run `pip install -r backend/requirements.txt`.

---

**"Port 8000 already in use"**

```bash
# Mac / Linux
lsof -ti:8000 | xargs kill

# Windows — find the process ID
netstat -ano | findstr :8000
# then kill it (replace 1234 with the PID shown)
taskkill /PID 1234 /F
```

---

**"Port 5173 already in use"**

Close other terminal windows and try again, or restart your computer.

---

**Dashboard loads but shows no data**

1. Make sure the backend (Terminal 1) is still running
2. Check that http://localhost:8000/api/docs opens in your browser
3. Log out and log back in

---

**`ModuleNotFoundError` when starting backend**

```bash
pip install -r backend/requirements.txt
```

---

## Project Structure

```
GlanceFive/
├── backend/                    ← Python API server (FastAPI)
│   ├── app/
│   │   ├── models/             ← Database table definitions
│   │   ├── routes/v1/          ← API endpoints
│   │   ├── services/           ← Business logic
│   │   └── schemas/            ← Data shapes
│   ├── alembic/                ← Database version migrations
│   ├── setup_fresh.py          ← First-time database setup
│   └── requirements.txt        ← Python dependencies
│
├── frontend/                   ← React dashboard (TypeScript)
│   ├── src/
│   │   ├── features/dashboard/ ← Main dashboard page
│   │   └── store/api.ts        ← All API calls
│   ├── package.json            ← Node dependencies
│   └── vite.config.ts          ← Build config
│
├── .env.example                ← Copy to .env and fill in
└── README.md                   ← This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy |
| Database | SQLite (local) |
| Frontend | React 18, TypeScript, Vite |
| UI | Material UI (MUI) v5 |
| State / Data fetching | Redux Toolkit, RTK Query |
| Charts | Recharts, SVG sparklines |
