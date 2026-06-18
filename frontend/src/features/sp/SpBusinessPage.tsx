import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import '../dashboard/DashboardPage.css'
import {
  useGetSpSummaryQuery,
  useGetSpProfitabilityQuery,
  useGetSpProductDailyQuery,
  useTriggerSpFetchMutation,
  useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import { getDateRange } from '../../shared/utils'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'

const DATE_PRESETS = [
  { value: '7d',  label: '7D'  },
  { value: '30d', label: '30D' },
  { value: 'mtd', label: 'MTD' },
  { value: '90d', label: '90D' },
]

function fmtCur(v: number) {
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr'
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L'
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K'
  return '₹' + v.toFixed(0)
}
function fmtNum(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return String(Math.round(v))
}
function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return (v * 100).toFixed(1) + '%'
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#6c8cff' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', flex: 1, minWidth: 140 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ── ASIN Daily Chart ─────────────────────────────────────────
function AsinDailyChart({ asin, dates }: { asin: string; dates: { start_date: string; end_date: string } }) {
  const { data = [] } = useGetSpProductDailyQuery({ asin, ...dates })
  const series = data.map((d: any) => ({
    date: String(d.report_date).slice(5),
    sessions: d.sessions_total ?? 0,
    units: d.units_ordered ?? 0,
    sales: parseFloat(d.ordered_product_sales ?? 0),
  }))

  return (
    <div style={{ marginTop: 10 }}>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6c8cff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6c8cff" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00dba4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00dba4" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 9 }} tickLine={false} axisLine={false}
            interval={Math.max(0, Math.ceil(series.length / 6) - 1)} />
          <YAxis tick={{ fill: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 9 }} tickLine={false} axisLine={false} width={36}
            tickFormatter={v => v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v)} />
          <Tooltip
            contentStyle={{ background: '#0a1628', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)' }}
            formatter={(v: number, name: string) => [name === 'sales' ? fmtCur(v) : fmtNum(v), name]}
          />
          <Area type="monotone" dataKey="sessions" stroke="#6c8cff" strokeWidth={1.5} fill="url(#gSessions)" name="sessions" />
          <Area type="monotone" dataKey="sales"    stroke="#00dba4" strokeWidth={1.5} fill="url(#gSales)"    name="sales"    yAxisId={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Profitability Table ───────────────────────────────────────
function ProfitabilityTable({ rows, dates }: { rows: any[]; dates: { start_date: string; end_date: string } }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [sortKey, setSortKey]   = useState<string>('organic_sales')
  const [sortAsc, setSortAsc]   = useState(false)

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [rows, sortKey, sortAsc])

  function handleSort(k: string) {
    if (k === sortKey) setSortAsc(a => !a)
    else { setSortKey(k); setSortAsc(false) }
  }

  const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: '#0d1f38' }

  const cols = [
    { key: 'asin',                  label: 'ASIN',       right: false },
    { key: 'organic_sessions',      label: 'Sessions',   right: true  },
    { key: 'organic_page_views',    label: 'Page Views', right: true  },
    { key: 'organic_units_ordered', label: 'Units',      right: true  },
    { key: 'organic_sales',         label: 'Org. Sales', right: true  },
    { key: 'conversion_rate',       label: 'CVR',        right: true  },
    { key: 'ad_spend',              label: 'Ad Spend',   right: true  },
    { key: 'ad_sales',              label: 'Ad Sales',   right: true  },
    { key: 'acos',                  label: 'ACoS',       right: true  },
    { key: 'total_sales',           label: 'Total Sales',right: true  },
  ]

  function renderCell(row: any, key: string) {
    switch (key) {
      case 'asin': return (
        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '10px 14px', cursor: 'pointer', color: 'var(--accent)', whiteSpace: 'nowrap' }}
          onClick={() => setSelected(selected === row.asin ? null : row.asin)}>
          <div style={{ fontWeight: 700 }}>{row.asin}</div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{row.title ?? ''}</div>
        </td>
      )
      case 'organic_sessions':      return <td className="gf-num gf-col-r">{row.organic_sessions != null ? fmtNum(row.organic_sessions) : '—'}</td>
      case 'organic_page_views':    return <td className="gf-num gf-col-r">{row.organic_page_views != null ? fmtNum(row.organic_page_views) : '—'}</td>
      case 'organic_units_ordered': return <td className="gf-num gf-col-r">{row.organic_units_ordered != null ? fmtNum(row.organic_units_ordered) : '—'}</td>
      case 'organic_sales':         return <td className="gf-num gf-col-r" style={{ color: '#00dba4', fontWeight: 700 }}>{row.organic_sales != null ? fmtCur(row.organic_sales) : '—'}</td>
      case 'conversion_rate':       return <td className="gf-num gf-col-r">{pct(row.conversion_rate)}</td>
      case 'ad_spend':              return <td className="gf-num gf-col-r" style={{ color: '#f0b429' }}>{row.ad_spend != null ? fmtCur(row.ad_spend) : '—'}</td>
      case 'ad_sales':              return <td className="gf-num gf-col-r">{row.ad_sales != null ? fmtCur(row.ad_sales) : '—'}</td>
      case 'acos': {
        const v = row.acos
        const clr = v == null ? '' : v < 30 ? 'var(--good)' : v < 55 ? 'var(--accent)' : 'var(--bad)'
        return <td className="gf-num gf-col-r" style={{ color: clr }}>{v != null ? v.toFixed(1) + '%' : '—'}</td>
      }
      case 'total_sales': return <td className="gf-num gf-col-r" style={{ fontWeight: 800 }}>{row.total_sales != null ? fmtCur(row.total_sales) : '—'}</td>
      default: return <td className="gf-num gf-col-r">—</td>
    }
  }

  return (
    <div className="gf-card" style={{ padding: 0, marginTop: 16 }}>
      <div className="gf-card-header" style={{ padding: '16px 20px 14px' }}>
        <div>
          <div className="gf-card-title">Product Profitability</div>
          <div className="gf-card-sub">Organic (SP-API) + Paid (Ads API) · click ASIN to expand daily trend</div>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>{rows.length} products</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="gf-table">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} className={c.right ? 'gf-col-r' : ''}
                  style={{ cursor: 'pointer', userSelect: 'none', ...stickyTh }}
                  onClick={() => handleSort(c.key)}>
                  {c.label}{sortKey === c.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No product data for this period</td></tr>
            )}
            {sorted.map((row) => (
              <>
                <tr key={row.asin} style={{ background: selected === row.asin ? 'rgba(108,140,255,0.07)' : undefined }}>
                  {cols.map(c => renderCell(row, c.key))}
                </tr>
                {selected === row.asin && (
                  <tr key={row.asin + '_chart'}>
                    <td colSpan={cols.length} style={{ padding: '0 20px 16px', background: 'rgba(108,140,255,0.04)' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', marginBottom: 4, paddingTop: 10 }}>
                        Sessions & Sales — {row.asin}
                      </div>
                      <AsinDailyChart asin={row.asin} dates={dates} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function SpBusinessPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [datePreset, setDatePreset] = useState('30d')
  const [fetching, setFetching]     = useState(false)
  const [fetchMsg, setFetchMsg]     = useState('')
  const [navOpen, setNavOpen]       = useState(false)

  const dates = useMemo(() => getDateRange(datePreset), [datePreset])
  const skip  = !user?.client_id

  const { data: summary, isLoading: loadingSummary } = useGetSpSummaryQuery(dates, { skip })
  const { data: profitability = [], isLoading: loadingProfit, refetch } = useGetSpProfitabilityQuery({ ...dates, limit: 50 }, { skip })
  const { data: unreadData }  = useGetUnreadCountQuery(undefined, { pollingInterval: 60000 })
  const [triggerSpFetch]      = useTriggerSpFetchMutation()

  const unread = unreadData?.count ?? 0

  async function handleFetch() {
    setFetching(true)
    setFetchMsg('')
    try {
      await triggerSpFetch({ start_date: dates.start_date, end_date: dates.end_date }).unwrap()
      setFetchMsg('Fetch queued — data will update in ~2 minutes')
      setTimeout(() => refetch(), 90000)
    } catch (e: any) {
      setFetchMsg('Error: ' + (e?.data?.detail ?? 'fetch failed'))
    } finally {
      setFetching(false)
    }
  }

  const isLoading = loadingSummary || loadingProfit

  return (
    <div className={`gf-dash${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar
          crumb="Business Reports"
          subtitle={`${dates.start_date} — ${dates.end_date} · SP-API`}
          unread={unread}
          onRefresh={refetch}
          onMenuToggle={() => setNavOpen(o => !o)}
        />
        <div className="gf-content">

          {/* Filter + Fetch bar */}
          <div className="gf-filterbar">
            <div className="gf-chip-row">
              {DATE_PRESETS.map(p => (
                <button key={p.value} className={`gf-date-chip${datePreset === p.value ? ' active' : ''}`}
                  onClick={() => setDatePreset(p.value)}>{p.label}</button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {fetchMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: fetchMsg.startsWith('Error') ? 'var(--bad)' : '#00dba4' }}>{fetchMsg}</span>}
              <button
                onClick={handleFetch}
                disabled={fetching}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(0,219,164,0.4)',
                  background: 'rgba(0,219,164,0.08)', color: '#00dba4', cursor: fetching ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, opacity: fetching ? 0.6 : 1,
                }}>
                {fetching ? 'Queuing…' : '↻ Fetch SP Data'}
              </button>
            </div>
          </div>

          {/* Summary cards */}
          {isLoading && !summary ? (
            <div style={{ display: 'flex', gap: 14, marginBottom: 0 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ flex: 1, height: 88, borderRadius: 12, background: 'rgba(100,160,240,0.06)', animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <StatCard
                label="Products (ASINs)"
                value={String(summary?.asin_count ?? 0)}
                color="#6c8cff"
              />
              <StatCard
                label="Total Sessions"
                value={fmtNum(summary?.total_sessions ?? 0)}
                sub="organic traffic"
                color="#60a5fa"
              />
              <StatCard
                label="Page Views"
                value={fmtNum(summary?.total_page_views ?? 0)}
                color="#a78bfa"
              />
              <StatCard
                label="Units Ordered"
                value={fmtNum(summary?.total_units_ordered ?? 0)}
                sub="organic + B2B"
                color="#f0b429"
              />
              <StatCard
                label="Ordered Sales"
                value={fmtCur(summary?.total_ordered_sales ?? 0)}
                sub="organic revenue"
                color="#00dba4"
              />
              <StatCard
                label="Avg Conversion"
                value={pct(summary?.avg_conversion_rate)}
                sub={`Buy Box: ${pct(summary?.avg_buy_box_pct)}`}
                color="#fb923c"
              />
            </div>
          )}

          {/* Profitability table */}
          {!isLoading && profitability.length === 0 ? (
            <div className="gf-card" style={{ marginTop: 16, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>No SP-API data for this period</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                Click <span style={{ color: '#00dba4' }}>↻ Fetch SP Data</span> to pull from Amazon, or switch to a wider date range.
              </div>
            </div>
          ) : (
            <ProfitabilityTable rows={profitability} dates={dates} />
          )}

          <footer style={{ padding: '16px 0 4px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
            <span>GLANCEFIVE · BUSINESS REPORTS · v1.0</span>
            <span>Amazon SP-API · Data source: product_business_daily</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
