# GlanceFive — Project Status
**Last updated:** 2026-06-14  
**Platform:** Amazon Growth Intelligence Platform  
**Stack:** FastAPI + SQLAlchemy + SQLite (dev) · React 18 + Vite 5 · Celery + Redis (async jobs)

---

## Quick Summary

| Layer | Status |
|---|---|
| Auth / Users / RBAC | ✅ Complete |
| Amazon Ads API (18 report types) | ✅ Complete |
| Database schema (12 migrations) | ✅ Complete |
| Dashboard + Charts + Scoreboard | ✅ Complete |
| Campaigns view | ✅ Complete |
| Keywords view | ✅ Complete |
| Search Terms view | ✅ Complete |
| Products view | ✅ Complete |
| Smart Recommendations (rule-based) | ✅ Complete (frontend) |
| Media Plan page | ✅ Complete |
| Fetch History page | ✅ Complete |
| WebSocket live progress | ✅ Complete |
| SP-API Business Reports (model + service) | ✅ Code built · ❌ No credentials yet |
| sbCampaigns data | ❌ Never fetched |
| Backend Intelligence API | ❌ Not built |
| AI Recommendations (Claude API) | ❌ Not built |
| Change Tracking | ❌ Not built |
| System Health Monitor | ❌ Not built |

---

## Backend — What's Working

### Server
- **URL:** `http://localhost:8765`
- **Docs:** `http://localhost:8765/api/docs` (Swagger UI)
- **Start command:** `cd backend && uvicorn main:app --host 0.0.0.0 --port 8765 --reload`

### API Routes (all working)

| Route | Method | Description |
|---|---|---|
| `/health` | GET | Server health check |
| `/api/v1/auth/login` | POST | Login → access + refresh tokens |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/auth/signup` | POST | Create new user |
| `/api/v1/users/me` | GET | Current user profile |
| `/api/v1/clients/me` | GET | Current client details |
| `/api/v1/clients/me/credentials` | PUT | Save Amazon Ads API credentials |
| `/api/v1/clients/me/credentials/status` | GET | Check if credentials are set |
| `/api/v1/dashboard/metrics` | GET | Summary KPIs (impressions, clicks, spend, sales, ROAS, ACOS, trends) |
| `/api/v1/dashboard/charts` | GET | Daily time-series data + ad-type breakdown |
| `/api/v1/dashboard/summary` | GET | Top campaigns by cost / sales |
| `/api/v1/dashboard/search-terms` | GET | Search term performance table |
| `/api/v1/dashboard/keywords` | GET | Keyword performance table |
| `/api/v1/dashboard/campaigns` | GET | Campaign list with full metrics |
| `/api/v1/dashboard/products` | GET | Product (ASIN) performance |
| `/api/v1/dashboard/products/daily` | GET | Per-ASIN daily breakdown |
| `/api/v1/reports/fetch` | POST | Trigger Amazon Ads API fetch (needs Celery) |
| `/api/v1/reports/fetch-history` | GET | Paginated fetch log |
| `/api/v1/sp/fetch` | POST | Trigger SP-API Business Report fetch (needs Celery + SP creds) |
| `/api/v1/sp/summary` | GET | Aggregated organic business metrics |
| `/api/v1/sp/products` | GET | Product master list |
| `/api/v1/sp/products/{asin}/daily` | GET | Daily ASIN business metrics |
| `/api/v1/sp/profitability` | GET | Organic + paid unified view |
| `/api/v1/notifications` | GET | User notifications (paginated) |
| `/api/v1/notifications/unread-count` | GET | Unread badge count |
| `/api/v1/notifications/mark-all-read` | POST | Mark all as read |
| `/ws/events` | WebSocket | Real-time fetch progress events |

### Database (SQLite dev.db — 12 migrations applied)

| Table | Purpose | Rows (current) |
|---|---|---|
| `clients` | Multi-tenant client accounts | 1 |
| `users` | Auth users with RBAC | 3 |
| `client_amazon_credentials` | Encrypted Ads API + SP-API credentials | 1 |
| `subscription_tiers` | Subscription plans | - |
| `ad_metrics` | All Amazon Ads report data (wide table) | 2,647 |
| `report_fetches` | Fetch job history + status | 8 |
| `products_master` | ASIN catalog (populated via SP-API) | 0 (SP-API not fetched) |
| `product_business_daily` | Organic sessions/orders/sales per ASIN/day | 0 (SP-API not fetched) |
| `notifications` | In-app notification log | - |
| `exports` | CSV/export history | - |
| `audit_logs` | System audit trail | - |
| `refresh_tokens` | JWT refresh token store | - |

### Amazon Ads API — Report Types Implemented (18 total)

**Sponsored Products (7)**
| Report | Status in DB |
|---|---|
| `spCampaigns` | ✅ 104 rows · May 9 – Jun 7 |
| `spTargeting` | ✅ 456 rows · May 9 – Jun 7 |
| `spSearchTerm` | ✅ 1,084 rows · May 9 – Jun 7 |
| `spProductAds` | ✅ 999 rows · May 9 – Jun 7 |
| `spCampaignPlacement` | ✅ Implemented · ❌ Not fetched yet |
| `spPurchasedProduct` | ✅ Implemented · ❌ Not fetched yet |
| `spGrossAndInvalids` | ✅ Implemented · ❌ Not fetched yet |

**Sponsored Brands (5)**
| Report | Status in DB |
|---|---|
| `sbCampaigns` | ✅ Implemented · ❌ NOT FETCHED — CRITICAL GAP |
| `sbTargeting` | ✅ 4 rows (very sparse) |
| `sbSearchTerm` | ✅ Implemented · 0 rows (empty) |
| `sbCampaignPlacement` | ✅ Implemented · ❌ Not fetched yet |
| `sbGrossAndInvalids` | ✅ Implemented · ❌ Not fetched yet |

**Sponsored Display (6)**
| Report | Status in DB |
|---|---|
| `sdCampaigns` | ✅ Implemented · ❌ Not fetched yet |
| `sdTargeting` | ✅ Implemented · ❌ Not fetched yet |
| `sdMatchedTarget` | ✅ Implemented · ❌ Not fetched yet |
| `sdAdvertising` | ✅ Implemented · ❌ Not fetched yet |
| `sdPurchasedProduct` | ✅ Implemented · ❌ Not fetched yet |
| `sdGrossAndInvalids` | ✅ Implemented · ❌ Not fetched yet |

### Data Currently in DB
- **Date range:** May 9, 2026 – Jun 7, 2026 (30 days)
- **Campaigns with data:** 8 SP campaigns + 1 SBV (sparse)
- **Data gap:** Jun 8 – Jun 14 (7 days missing · today's date)
- **Amazon profile ID:** 937023249907447

---

## Frontend — What's Working

### Dev Server
- **URL:** `http://localhost:5173`
- **Start:** `cd frontend && npm run dev`
- **Proxy:** All `/api/` calls → backend `:8765`

### Pages & Routes

| Route | Page | Status |
|---|---|---|
| `/login` | Login | ✅ Working |
| `/overview` | Executive Overview (spend/sales/ROAS charts, ad-type breakdown) | ✅ Working |
| `/campaigns` | Campaign table with metrics, date filter, scoreboard | ✅ Working |
| `/keywords` | Keyword performance table | ✅ Working |
| `/products` | Product (ASIN) performance table | ✅ Working |
| `/recommendations` | Smart Recommendations (waste/scale/budget/risks) | ✅ Working (rule-based, no backend API) |
| `/media-plan` | Media planning tool | ✅ Working |
| `/fetch-history` | Report fetch log | ✅ Working |
| `/notifications` | In-app notifications | ✅ Working |
| `/settings` | Amazon credentials form | ✅ Working (Ads API only, no SP-API fields) |

### Frontend Features Working
- JWT auth with auto-refresh (15-min access tokens)
- Scoreboard with 15 configurable metric tiles + period-over-period trend arrows
- Date presets: Today, Yesterday, 7D, 30D, MTD, QTD, YTD, Max Available
- Data coverage badge `[DB] 09 May 26 – 07 Jun 26`
- Campaign table: Spend, Sales, ROAS, ACOS, Impressions, Clicks, CTR, CPC, Purchases, Budget
- Zero-activity campaign filtering (HAVING impressions > 0)
- SBV/SD campaigns shown via supplementary targeting-grain query
- Smart Recs: 10 section types (exec summary, scale, waste, risks, do-not-do, etc.)
- Real-time fetch progress via WebSocket

---

## Infrastructure — What's Ready vs Pending

### Working in Dev (no external services needed)
- FastAPI backend (SQLite, no Redis)
- React frontend (Vite dev server)
- Direct fetch script: `python fetch_sb_campaigns.py` (bypasses Celery)

### Requires Redis to be running
- `POST /api/v1/reports/fetch` → triggers Celery task
- `POST /api/v1/sp/fetch` → triggers Celery task
- WebSocket live events (Redis pub/sub)
- Daily scheduled fetch (Celery Beat: 02:00 UTC for Ads, 02:30 UTC for SP-API)

### Async / Celery
- **Start workers:** `cd backend && celery -A celery_app worker --loglevel=info`
- **Start scheduler:** `cd backend && celery -A celery_app beat --loglevel=info`
- **Monitor:** `cd backend && celery -A celery_app flower`

---

## What's Pending (Needs to be Built)

### P0 — Immediate (no new credentials needed)

| Task | What it does |
|---|---|
| Fetch `sbCampaigns` | Run: `cd backend && python fetch_sb_campaigns.py 2026-05-09 2026-06-14` |
| Fetch remaining SP reports | `spCampaignPlacement`, `spPurchasedProduct`, `spGrossAndInvalids` |
| Backend Intelligence API | `/api/v1/intelligence/` — campaign scores, waste signals, budget recommendations |
| `campaign_score` table (migration 013) | Efficiency, growth, waste, scale score per campaign |
| `waste_signals` table | Flagged search terms (spend > threshold, orders = 0) |
| `budget_recommendation` table | Per-campaign budget suggestions with reason |
| `change_logs` table | Track budget/bid/status changes over time |
| System health endpoint | `/api/v1/system/health` — last sync, failed reports, data delay |

### P1 — Needs SP-API Credentials

| Task | What's needed |
|---|---|
| SP-API Business Reports data | SP-API Refresh Token + Seller ID + Marketplace ID |
| `product_business_daily` populate | Sessions, page views, conversion rate, organic sales per ASIN |
| Product health score | Compute Traffic + Conversion + Sales + Ad Efficiency scores |
| Growth matrix (ASIN quadrant) | Star / Hidden Gem / Listing Problem / Dead Product |
| Unified profitability view | Organic + paid combined per ASIN |

**SP-API credentials needed (different from Ads API):**
- `SP-API Refresh Token` (from Seller Central OAuth)
- `SP-API Seller ID` (e.g. `A2Z6V4KMKRM2N0`)
- `SP-API Marketplace ID` (India = `A21TJRUUN4KGV`)
- Client ID + Secret can reuse Ads API ones IF LWA app has both scopes

### P2 — Needs Anthropic API Key

| Task | What's needed |
|---|---|
| AI Recommendation Layer | Claude API key for intelligent, context-aware recommendations |
| `ai_actions` table | Stores AI-generated actions with reason + confidence score |
| Smart Recs backend API | Replace client-side rule engine with server-computed AI actions |
| Natural language insights | "Why is ACOS high?" → AI analyzes data + responds |

### P3 — Future Features

| Feature | Notes |
|---|---|
| Historical backfill > 30 days | Fetch data before May 9, 2026 |
| Amazon Inventory integration | Stock levels vs ad spend correlation |
| Amazon Pricing intelligence | Price + conversion relationship |
| Competitor tracking | Share of voice, competitor keyword mapping |
| Google Ads / Meta Ads connectors | Cross-channel spend view |
| Automatic bid optimization | Rules engine + AI for keyword bids |
| Sales forecasting | Predict next 30/60/90 days |
| Multi-client admin panel | Client management, usage, billing |

---

## Known Data Accuracy Notes

| Issue | Detail |
|---|---|
| Sales lag (5–6%) | Amazon's 14-day attribution window updates retroactively — expected |
| Impressions/clicks variance (<0.2%) | Invalid traffic adjustments applied after our fetch — expected |
| SBV-Query-KT-Exact shows 9 impressions | `sbCampaigns` not fetched. Only `sbTargeting` sparse rows exist |
| Data ends Jun 7 (7 days stale) | Need daily Celery job running to stay current |
| SP metrics all zero | No SP-API credentials configured |

---

## Login Credentials (Dev)

| Email | Password | Role |
|---|---|---|
| `admin@glancefive.com` | `Admin1234!` | Admin |
| `demo@glancefive.com` | (unknown — check seed file) | Seller |
| `admin@test.com` | (unknown — check seed file) | Seller |

---

## File Map (Key Files)

```
backend/
├── main.py                              ← FastAPI app + router registration
├── celery_app.py                        ← Celery config + beat schedule
├── dev.db                               ← SQLite database (30 days data)
├── fetch_sb_campaigns.py                ← Direct fetch script (no Celery needed)
│
├── app/
│   ├── models/
│   │   ├── ad_metrics.py               ← Wide table: all 18 report types
│   │   ├── credentials.py              ← Ads API + SP-API credential storage
│   │   ├── sp_business.py              ← products_master + product_business_daily
│   │   ├── report_fetch.py             ← Fetch job tracking
│   │   ├── client.py / user.py         ← Multi-tenant core
│   │
│   ├── services/
│   │   ├── dashboard_service.py        ← All query logic (campaigns, metrics, charts)
│   │   ├── report_service.py           ← Amazon Ads API fetch pipeline (18 reports)
│   │   ├── metrics_parser.py           ← Amazon JSON → AdMetrics column mapping
│   │   ├── sp_api_service.py           ← SP-API auth + business report lifecycle
│   │   ├── amazon_auth_service.py      ← LWA token exchange + refresh
│   │
│   ├── tasks/
│   │   ├── fetch_reports.py            ← Celery task: Ads API (daily 02:00 UTC)
│   │   ├── fetch_sp_reports.py         ← Celery task: SP-API (daily 02:30 UTC)
│   │
│   ├── routes/v1/
│   │   ├── dashboard.py                ← /api/v1/dashboard/* endpoints
│   │   ├── reports.py                  ← /api/v1/reports/* endpoints
│   │   ├── sp_business.py              ← /api/v1/sp/* endpoints
│   │   ├── auth.py / users.py / clients.py / notifications.py
│   │
│   ├── schemas/
│   │   ├── dashboard.py                ← Pydantic models: MetricsSummary, CampaignRow, etc.
│
├── alembic/versions/
│   ├── 001–009                         ← Core schema (auth, ads, metrics)
│   ├── 010                             ← SP-API credential fields
│   ├── 011                             ← Extended ad_metrics columns
│   └── 012                             ← products_master + product_business_daily

frontend/
├── src/
│   ├── store/api.ts                    ← RTK Query: all API endpoint definitions
│   ├── features/
│   │   ├── overview/OverviewPage.tsx   ← Executive dashboard
│   │   ├── campaigns/CampaignPage.tsx  ← Campaign table + scoreboard
│   │   ├── keywords/KeywordsPage.tsx   ← Keyword performance
│   │   ├── products/ProductsPage.tsx   ← Product (ASIN) performance
│   │   ├── recommendations/SmartRecsPage.tsx  ← AI-style recommendations (rule-based)
│   │   ├── mediaplan/MediaPlanPage.tsx ← Media planning
│   │   ├── reports/FetchHistoryPage.tsx← Fetch job history
│   │   ├── settings/CredentialsPage.tsx← API credentials setup
│   │   ├── auth/LoginPage.tsx          ← Login
│   │   └── notifications/NotificationsPage.tsx
│   └── components/Scoreboard.tsx       ← Reusable 6-tile metric scoreboard
```

---

## Next Steps (Priority Order)

1. **Fetch sbCampaigns** — two ways:
   - **Proper (production):** Start Redis + Celery → use frontend `/fetch-history` page → click Fetch → select `sbCampaigns`
   - **Dev shortcut (no Redis):** `cd backend && python fetch_direct.py --client 1 --types sbCampaigns --start 2026-05-09 --end 2026-06-14`

2. **Build backend intelligence API** (migrations 013–015 + `/api/v1/intelligence/`):
   - `campaign_score`, `waste_signals`, `budget_recommendation`, `change_logs`

3. **Provide SP-API credentials** → populates sessions/conversion/organic sales

4. **Provide Claude API key** → true AI recommendations replacing rule-based engine

5. **Start Celery + Redis** → enables daily auto-fetch + WebSocket live updates
