# GlanceFive — Laptop Setup Guide

Run the full stack on your laptop. Clients access it at your own domain.
Zero monthly cost until you move to a server.

## Final URLs when done

| URL | What clients see |
|---|---|
| `glancefive.com` | Your existing website — untouched |
| `app.glancefive.com` | GlanceFive login page (Netlify — always up) |
| `api.glancefive.com` | Backend API (Cloudflare → your laptop) |

---

## What you need before starting

- [ ] Docker Desktop installed on this laptop
- [ ] A free Cloudflare account (cloudflare.com)
- [ ] A free Netlify account (netlify.com)
- [ ] Your code pushed to a GitHub repository

---

## Part 1 — Move DNS to Cloudflare (15 min, one-time)

Your domain is at Hostinger. You do NOT need to transfer the domain —
just change where DNS is managed. The domain stays registered at Hostinger.

**Why:** Cloudflare Tunnel requires Cloudflare to manage your DNS.
**Risk:** Zero — Cloudflare imports all existing records so your website keeps working.

### 1A — Add your domain to Cloudflare

1. Go to https://cloudflare.com → Log in → **Add a Site**
2. Enter `glancefive.com` → click **Continue**
3. Select the **Free plan** → click **Continue**
4. Cloudflare scans your existing DNS and imports all records automatically
5. Review the imported records — your existing Hostinger hosting IP should be there
6. Click **Continue to nameservers**
7. Cloudflare gives you 2 nameservers like:
   ```
   aida.ns.cloudflare.com
   brad.ns.cloudflare.com
   ```
   Copy both.

### 1B — Update nameservers at Hostinger

1. Log in to Hostinger → **Domains** → click `glancefive.com`
2. Find **Nameservers** → click **Change**
3. Select **Custom nameservers**
4. Replace existing nameservers with the two Cloudflare ones
5. Save

Propagation takes 10–30 minutes. You can check at https://dnschecker.org/#NS/glancefive.com

**Your existing website continues to work throughout this process.**

---

## Part 2 — Create Cloudflare Tunnel (10 min, one-time)

Once DNS is on Cloudflare:

1. In Cloudflare dashboard → left sidebar → **Zero Trust**
2. Left menu → **Networks** → **Tunnels**
3. Click **Create a tunnel** → name it `glancefive-laptop` → **Save tunnel**
4. On the next screen, choose **Docker** as the environment
5. You will see a command like:
   ```
   docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhI...
   ```
   **Copy only the token part** (the long string after `--token`) — save it somewhere

6. Click **Next: Configure public hostname**

7. Add this hostname:

   | Field | Value |
   |---|---|
   | Subdomain | `api` |
   | Domain | `glancefive.com` |
   | Service Type | `HTTP` |
   | URL | `api:8000` |

   > **Important:** The URL is `api:8000` not `localhost:8000`.
   > Both `cloudflared` and the API run inside Docker together,
   > so they talk to each other by container name.

8. Click **Save tunnel**

9. Open `.env.local` → paste your token:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=eyJhI...your-full-token-here...
   ```

---

## Part 3 — Fill in .env.local

Open `.env.local` in Notepad and fill in every `REPLACE_ME` value:

### JWT_SECRET
Open PowerShell and run:
```powershell
-join ((1..64) | ForEach {'{0:x}' -f (Get-Random -Max 16)})
```
Copy the output and paste it.

### ENCRYPTION_KEY
Open Command Prompt in the `backend` folder and run:
```cmd
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Paste the output (ends with `=`).

### POSTGRES_PASSWORD
Choose any strong password, e.g. `GlanceFive2026!Secure`
Avoid `@`, `#`, `$`, `%` characters.

### CLOUDFLARE_TUNNEL_TOKEN
Already done in Part 2 Step 9.

### SMTP_PASSWORD (Gmail App Password)
1. Go to https://myaccount.google.com/apppasswords
2. App name: `GlanceFive` → click **Create**
3. Copy the 16-character password shown (no spaces)
4. Paste into `SMTP_PASSWORD`
5. Fill `SMTP_USER` with your Gmail address

### FLOWER_PASSWORD
Choose any password for the Celery task monitor.

---

## Part 4 — Start the backend stack

Open PowerShell in the project root folder:

```powershell
docker compose -f docker-compose.local.yml up -d --build
```

First run: 5–10 minutes (downloads images, builds the app).
After that: under 60 seconds.

**Check all services are running:**
```powershell
docker compose -f docker-compose.local.yml ps
```

You should see these services all `running` or `healthy`:
- `db` (PostgreSQL)
- `redis`
- `api` (FastAPI)
- `worker` (Celery)
- `beat` (Celery scheduler)
- `flower` (Task monitor)
- `cloudflared` (Tunnel)

**Test the tunnel is working:**
Open https://api.glancefive.com/api/health in your browser.
You should see: `{"status":"ok"}`

If it shows a Cloudflare error, wait 2 minutes and try again — tunnel needs a moment to connect.

---

## Part 5 — Deploy frontend to Netlify with app.glancefive.com

### 5A — Deploy to Netlify

1. Go to https://netlify.com → **Add new site** → **Import from Git**
2. Select your GitHub repository
3. Netlify auto-detects settings from `netlify.toml`:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site** — Netlify gives you a URL like `random-name-123.netlify.app`

### 5B — Set the API URL environment variable

1. In Netlify → **Site settings** → **Environment variables**
2. Click **Add a variable**:
   - Key: `VITE_API_URL`
   - Value: `https://api.glancefive.com`
3. Click **Save**
4. Go to **Deploys** → **Trigger deploy** → **Deploy site**

### 5C — Add custom domain app.glancefive.com

1. In Netlify → **Domain management** → **Add custom domain**
2. Enter `app.glancefive.com` → **Verify** → **Add domain**
3. Netlify shows you a CNAME record to add. Copy the **value** (looks like `random-name-123.netlify.app`)

4. Go to Cloudflare dashboard → **DNS** → **Add record**:
   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | CNAME | `app` | `random-name-123.netlify.app` | **DNS only** (grey cloud) |

   > Set proxy to **DNS only** (NOT orange cloud) for Netlify custom domains.

5. Back in Netlify → click **Verify DNS configuration** → wait a few minutes
6. Netlify issues a free SSL certificate automatically

**Test:** Open https://app.glancefive.com — you should see the GlanceFive login page.

---

## Part 6 — First login

1. Open https://app.glancefive.com
2. Log in with the credentials you set in `.env.local`:
   - Email: whatever you set as `ADMIN_EMAIL` (default: `admin@glancefive.com`)
   - Password: whatever you set as `ADMIN_PASSWORD`
3. **Change your password immediately** after first login
4. To confirm the admin was created:
   ```powershell
   docker compose -f docker-compose.local.yml logs api | Select-String "seed"
   ```

---

## Daily use

**Morning — start everything:**
```powershell
docker compose -f docker-compose.local.yml up -d
```

The Cloudflare tunnel starts automatically as part of the stack.
No separate tunnel command needed.

**Evening — stop everything:**
```powershell
docker compose -f docker-compose.local.yml down
```

Data is safe — PostgreSQL stores everything in a Docker volume on your disk.

> **Note:** `app.glancefive.com` (Netlify) stays up even when your laptop is off.
> Clients can reach the login page anytime.
> They only get errors when trying to log in if your laptop is off.
> Schedule downtime during off-hours (e.g. 2–6am).

---

## Useful commands

```powershell
# Live logs from all services
docker compose -f docker-compose.local.yml logs -f

# Logs from one service
docker compose -f docker-compose.local.yml logs -f api
docker compose -f docker-compose.local.yml logs -f worker
docker compose -f docker-compose.local.yml logs -f cloudflared

# Restart API after changing .env.local
docker compose -f docker-compose.local.yml restart api

# Rebuild after code changes
docker compose -f docker-compose.local.yml up -d --build api

# Open a shell inside the API container
docker compose -f docker-compose.local.yml exec api bash

# Run database migration manually
docker compose -f docker-compose.local.yml exec api alembic upgrade head

# Stop and delete all data (careful!)
docker compose -f docker-compose.local.yml down -v
```

---

## Monitoring

| Tool | URL | What it shows |
|---|---|---|
| Celery task monitor | http://localhost:5555 | All report fetch jobs — pending, running, failed |
| API docs | http://localhost:8000/api/docs | Swagger UI to test any API endpoint |
| Tunnel status | Cloudflare dashboard → Zero Trust → Tunnels | Whether tunnel is connected |
| PostgreSQL | localhost:5432 | Use TablePlus or DBeaver (both free) |

---

## Troubleshooting

**`cloudflared` shows "tunnel not found" or "invalid token"**
The token in `.env.local` is wrong. Go to Cloudflare → Zero Trust → Tunnels →
click your tunnel → **Configure** → re-copy the token.

**API returns 502 at api.glancefive.com**
The `api` container isn't healthy yet. Wait 60 seconds after starting, then try again.
Check: `docker compose -f docker-compose.local.yml logs api`

**app.glancefive.com shows "Page not found"**
The CNAME in Cloudflare DNS is wrong or still propagating.
Check: https://dnschecker.org/#CNAME/app.glancefive.com

**app.glancefive.com loads but API calls fail (network error)**
`VITE_API_URL` is not set in Netlify environment variables, or the deploy after
setting it wasn't triggered. Go to Netlify → Deploys → Trigger deploy.

**"Port 5432 already in use"**
You have PostgreSQL installed directly on Windows. Stop it:
Services (Win+R → services.msc) → find PostgreSQL → Stop.

**Laptop restarts / Docker Desktop not running**
Start Docker Desktop from Start menu → wait for whale icon in system tray →
then run `docker compose -f docker-compose.local.yml up -d`

---

## When you're ready to move to a server

When you have 3–5 paying clients (~₹15,000–25,000/month revenue):

1. Get **Hetzner CX22** (~€4/month ≈ ₹370) at https://www.hetzner.com/cloud
2. Install Docker on the server (one command)
3. Copy `.env.local` to the server (rename to `.env.local`)
4. Copy the project — `git clone` your repo
5. Run `docker compose -f docker-compose.local.yml up -d --build`
6. In Cloudflare Zero Trust → edit the tunnel → change URL from `api:8000` to `api:8000`
   (same, because Docker Compose service name stays the same)
7. Done — your data migrates automatically (it's in Docker volumes)

Total migration time: ~30 minutes.
