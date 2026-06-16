import { useState, useRef, useEffect } from 'react'
import '../features/dashboard/DashboardPage.css'

// ── Metric catalogue ──────────────────────────────────────────
export const METRIC_DEFS: {
  key: string
  label: string
  desc: string
  getValue: (m: any) => number | null
  getTrend: (m: any) => number | null  // % change vs prev period
  format: 'currency' | 'number' | 'percent' | 'multiplier'
  invertGood?: boolean  // true = lower is better (ACOS, CPC, cost)
}[] = [
  {
    key: 'sales',
    label: 'Sales',
    desc: 'Attributed ad sales within 14-day click window',
    getValue: m => m?.total_sales_14d ?? null,
    getTrend: m => m?.trend_sales_14d ?? null,
    format: 'currency',
  },
  {
    key: 'total_cost',
    label: 'Total cost',
    desc: 'Total advertising spend for the period',
    getValue: m => m?.total_cost ?? null,
    getTrend: m => m?.trend_cost ?? null,
    format: 'currency',
    invertGood: true,
  },
  {
    key: 'roas',
    label: 'ROAS',
    desc: 'Return on Ad Spend = Sales ÷ Cost. Higher is better.',
    getValue: m => m?.overall_roas ?? null,
    getTrend: m => m?.trend_roas ?? null,
    format: 'multiplier',
  },
  {
    key: 'acos',
    label: 'ACOS',
    desc: 'Advertising Cost of Sales = Cost ÷ Sales × 100. Lower is better.',
    getValue: m => m?.overall_acos != null ? m.overall_acos * 100 : null,
    getTrend: m => m?.trend_acos ?? null,
    format: 'percent',
    invertGood: true,
  },
  {
    key: 'impressions',
    label: 'Impressions',
    desc: 'Total number of times your ads were displayed',
    getValue: m => m?.total_impressions ?? null,
    getTrend: m => m?.trend_impressions ?? null,
    format: 'number',
  },
  {
    key: 'clicks',
    label: 'Clicks',
    desc: 'Total number of clicks on your ads',
    getValue: m => m?.total_clicks ?? null,
    getTrend: m => m?.trend_clicks ?? null,
    format: 'number',
  },
  {
    key: 'ctr',
    label: 'CTR',
    desc: 'Click-through Rate = Clicks ÷ Impressions × 100',
    getValue: m => m?.overall_ctr != null ? m.overall_ctr * 100 : null,
    getTrend: m => m?.trend_ctr ?? null,
    format: 'percent',
  },
  {
    key: 'cpc',
    label: 'CPC',
    desc: 'Cost Per Click = Total Cost ÷ Clicks. Lower is better.',
    getValue: m => m?.overall_cpc ?? null,
    getTrend: m => m?.trend_cpc ?? null,
    format: 'currency',
    invertGood: true,
  },
  {
    key: 'purchases',
    label: 'Purchases',
    desc: 'Total attributed purchases within 14-day click window',
    getValue: (m: any) => m?.total_purchases_14d ?? null,
    getTrend: (_m: any) => null,
    format: 'number',
  },
  {
    key: 'detail_page_views',
    label: 'Detail page views',
    desc: 'Product detail page views driven by ads. Requires SP-API.',
    getValue: (_m: any) => null,
    getTrend: (_m: any) => null,
    format: 'number',
  },
  {
    key: 'long_term_sales',
    label: 'Long-term sales',
    desc: 'Sales attributed over a longer window. Requires SP-API.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'currency',
  },
  {
    key: 'pct_purchases_ntb',
    label: 'Percent of purchases new to brand',
    desc: 'Share of purchases from customers new to your brand. Requires Brand reporting.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'percent',
  },
  {
    key: 'pct_sales_ntb',
    label: 'Percent of sales new to brand',
    desc: 'Share of sales from customers new to your brand. Requires Brand reporting.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'percent',
  },
  {
    key: 'purchases_ntb',
    label: 'Purchases (new to brand)',
    desc: 'Purchases from customers who have not bought your brand in the past 12 months.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'number',
  },
  {
    key: 'sales_ntb',
    label: 'Sales (new to brand)',
    desc: 'Sales value from customers new to your brand.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'currency',
  },
  {
    key: 'vcpm',
    label: 'Viewable CPM (vCPM)',
    desc: 'Cost per 1,000 viewable impressions. Available for Sponsored Display only.',
    getValue: _m => null,
    getTrend: _m => null,
    format: 'currency',
  },
]

// ── Metric accent colors ──────────────────────────────────────
const METRIC_ACCENT: Record<string, string> = {
  sales:              '#00dba4',
  total_cost:         '#f0b429',
  roas:               '#64a0f0',
  acos:               '#ff6b8a',
  impressions:        '#a78bfa',
  clicks:             '#06b6d4',
  ctr:                '#34d399',
  cpc:                '#fb923c',
  purchases:          '#00dba4',
  detail_page_views:  '#a78bfa',
  long_term_sales:    '#00dba4',
  pct_purchases_ntb:  '#64a0f0',
  pct_sales_ntb:      '#64a0f0',
  purchases_ntb:      '#34d399',
  sales_ntb:          '#34d399',
  vcpm:               '#fb923c',
}

// ── Formatters ────────────────────────────────────────────────
function fmtVal(v: number | null, format: string): string {
  if (v === null || v === undefined) return '—'
  switch (format) {
    case 'currency':
      if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr'
      if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L'
      if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K'
      return '₹' + v.toFixed(2)
    case 'number':
      if (v >= 1e6) return (v / 1e6).toFixed(2) + ' M'
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
      return Math.round(v).toLocaleString('en-IN')
    case 'percent':
      return v.toFixed(2) + '%'
    case 'multiplier':
      return v.toFixed(2) + '×'
    default:
      return String(v)
  }
}

function prevVal(curr: number | null, trend: number | null): number | null {
  if (curr === null || trend === null) return null
  return curr / (1 + trend / 100)
}

// ── Info icon ─────────────────────────────────────────────────
function InfoIcon({ tip }: { tip: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', marginLeft: 5, cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', width: 220, fontSize: 11,
          color: 'var(--text-2)', lineHeight: 1.5, zIndex: 100, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {tip}
        </div>
      )}
    </span>
  )
}

// ── Metric dropdown ───────────────────────────────────────────
function MetricDropdown({
  selected, onChange,
}: {
  selected: string
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const def = METRIC_DEFS.find(d => d.key === selected) ?? METRIC_DEFS[0]

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-2)', padding: 0,
        }}
      >
        {def.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 200,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
          minWidth: 260, maxHeight: 340, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {METRIC_DEFS.map(d => (
            <button
              key={d.key}
              onClick={() => { onChange(d.key); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', border: 'none', background: 'none',
                cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12,
                color: d.key === selected ? 'var(--accent)' : 'var(--text-1)',
                borderLeft: d.key === selected ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single tile ───────────────────────────────────────────────
function ScoreTile({
  metricKey, metrics, onChangeMetric,
}: {
  metricKey: string
  metrics: any
  onChangeMetric: (key: string) => void
}) {
  const def = METRIC_DEFS.find(d => d.key === metricKey)!
  const accentColor = METRIC_ACCENT[metricKey] ?? 'var(--accent)'
  const curr = def.getValue(metrics)
  const trend = def.getTrend(metrics)
  const prev = prevVal(curr, trend)
  const isUp = trend !== null && trend >= 0
  const good = def.invertGood ? !isUp : isUp
  const trendClass = trend === null ? 'muted' : good ? 'good' : 'bad'

  return (
    <div className="gf-score-tile">
      {/* Colored accent line — dimmed to border when no data */}
      <div className="gf-score-accent" style={{ background: curr !== null ? accentColor : 'var(--border)' }} />

      {/* Metric selector + info */}
      <div className="gf-score-label-row">
        <MetricDropdown selected={metricKey} onChange={onChangeMetric} />
        <InfoIcon tip={def.desc} />
      </div>

      {/* Current value */}
      <div className="gf-score-value">
        {curr !== null
          ? fmtVal(curr, def.format)
          : <span className="gf-score-null">—</span>
        }
      </div>

      {/* Previous period + trend pill */}
      <div className="gf-score-footer">
        {prev !== null && (
          <span className="gf-score-prev">{fmtVal(prev, def.format)}</span>
        )}
        {trend !== null ? (
          <span className={`gf-trend-pill ${trendClass}`}>
            {isUp ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        ) : curr !== null ? (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>no prev data</span>
        ) : (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>requires integration</span>
        )}
      </div>
    </div>
  )
}

// ── Scoreboard ────────────────────────────────────────────────
interface ScoreboardProps {
  metrics: any
  dates: { start_date?: string; end_date?: string }
  defaultSlots?: string[]
  isLoading?: boolean
}

const DEFAULT_SLOTS = ['sales', 'total_cost', 'roas', 'acos', 'impressions', 'clicks']

export default function Scoreboard({ metrics, dates, defaultSlots, isLoading }: ScoreboardProps) {
  const [slots, setSlots] = useState<string[]>(defaultSlots ?? DEFAULT_SLOTS)

  function changeSlot(idx: number, key: string) {
    setSlots(s => s.map((v, i) => i === idx ? key : v))
  }

  // Compute comparison period label
  const compPeriod = (() => {
    if (!dates.start_date || !dates.end_date) return null
    const start = new Date(dates.start_date)
    const end = new Date(dates.end_date)
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
    return `${fmt(prevStart)} – ${fmt(prevEnd)}`
  })()

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25), 0 6px 24px rgba(0,0,0,0.12)',
    }}>
      {/* Header bar */}
      <div style={{
        padding: '9px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 9.5, fontFamily: 'var(--mono)', letterSpacing: '0.16em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
            Key Metrics
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            · click label to change metric
          </div>
        </div>
        {compPeriod && (
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', letterSpacing: '0.02em' }}>
            vs {compPeriod}
          </div>
        )}
      </div>

      {/* Tiles row */}
      <div className="gf-scoreboard-tiles" style={{ display: 'flex' }}>
        {(isLoading && !metrics) ? (
          (defaultSlots ?? DEFAULT_SLOTS).map((_, idx, arr) => (
            <div key={idx} className="gf-scoreboard-tile" style={{ flex: '1 1 0', minWidth: 0, borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : 'none', padding: '16px 18px' }}>
              <div style={{ height: 10, borderRadius: 4, background: 'rgba(100,160,240,0.09)', width: '55%', marginBottom: 14, animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${idx * 0.08}s` }} />
              <div style={{ height: 28, borderRadius: 4, background: 'rgba(100,160,240,0.06)', marginBottom: 12, animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${idx * 0.08}s` }} />
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(100,160,240,0.05)', width: '38%', animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${idx * 0.08}s` }} />
            </div>
          ))
        ) : (
          slots.map((key, idx) => (
            <div key={idx} className="gf-scoreboard-tile" style={{ flex: '1 1 0', minWidth: 0, borderRight: idx < slots.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <ScoreTile
                metricKey={key}
                metrics={metrics}
                onChangeMetric={k => changeSlot(idx, k)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
