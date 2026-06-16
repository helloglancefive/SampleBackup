import { useState, useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  ComposedChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import '../dashboard/DashboardPage.css'
import {
  useGetMetricsQuery,
  useGetChartsQuery,
  useGetCampaignsQuery,
  useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import Scoreboard from '../../components/Scoreboard'
import { fmt, getDateRange } from '../../shared/utils'
import { Icon } from '../../shared/Icon'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'
import { AIBriefCard, FestivalCard, BudgetPacingCard, AnomalyCard, DayHeatmap } from './OverviewWidgets'


// ── Section 1: Filter Bar ────────────────────────────────────
const DATE_PRESETS = [
  { value: 'today',     label: 'Today'         },
  { value: 'yesterday', label: 'Yesterday'     },
  { value: '7d',        label: 'Last 7 Days'   },
  { value: '30d',       label: 'Last 30 Days'  },
  { value: 'mtd',       label: 'Month to Date' },
  { value: 'qtd',       label: 'Quarter to Date' },
  { value: 'ytd',       label: 'Year to Date'  },
  { value: 'custom',    label: 'Custom Range'  },
]
const CAMPAIGN_TYPES = [
  { value: '',              label: 'All Types' },
  { value: 'spCampaigns',   label: 'Sponsored Products' },
  { value: 'sbTargeting',   label: 'Sponsored Brands' },
  { value: 'sdTargeting',   label: 'Sponsored Display' },
]

const CHIP_LABELS: Record<string, string> = {
  today: 'Today', yesterday: 'Yesterday', '7d': '7D', '30d': '30D',
  mtd: 'MTD', qtd: 'QTD', ytd: 'YTD', custom: 'Custom',
}

function FilterBar({
  datePreset, setDatePreset,
  customStart, setCustomStart,
  customEnd, setCustomEnd,
  campaignType, setCampaignType,
}: {
  datePreset: string; setDatePreset: (v: string) => void
  customStart: string; setCustomStart: (v: string) => void
  customEnd: string; setCustomEnd: (v: string) => void
  campaignType: string; setCampaignType: (v: string) => void
}) {
  const dateInp: React.CSSProperties = {
    height: 28, padding: '0 8px', borderRadius: 6, background: 'var(--surface)',
    border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--mono)',
    fontSize: 11, letterSpacing: '0.04em', cursor: 'pointer', outline: 'none',
    minWidth: 118, colorScheme: 'dark',
  }
  return (
    <div className="gf-filterbar">
      {/* Date preset chips */}
      <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}>
        <Icon name="calendar" size={13} />
      </span>
      <div className="gf-chip-row">
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            className={`gf-date-chip${datePreset === p.value ? ' active' : ''}`}
            onClick={() => setDatePreset(p.value)}
          >
            {CHIP_LABELS[p.value] ?? p.label}
          </button>
        ))}
      </div>

      {datePreset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)} style={dateInp} />
          <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--mono)' }}>→</span>
          <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)} style={dateInp} />
        </div>
      )}

      <span className="gf-filterbar-divider" />

      {/* Campaign type */}
      <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}>
        <Icon name="filter" size={13} />
      </span>
      <select
        style={{
          height: 28, padding: '0 9px', borderRadius: 6, background: 'transparent',
          border: '1px solid var(--border)', color: 'var(--text-2)', fontFamily: 'var(--mono)',
          fontSize: 10.5, letterSpacing: '0.04em', cursor: 'pointer', outline: 'none', colorScheme: 'dark',
        }}
        value={campaignType}
        onChange={e => setCampaignType(e.target.value)}
      >
        {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
        <span className="gf-live-dot" />
        <span>Amazon IN · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</span>
      </div>
    </div>
  )
}

// ── Section 3: Performance Trend (multi-metric) ───────────────

// Positional colors — each slot always gets its own distinct color regardless of metric chosen
// Slot 0: purple bar | Slot 1: cyan | Slot 2: amber | Slot 3: green (distinct from cyan)
const SLOT_COLORS = ['#a78bfa', '#06b6d4', '#f0b429', '#00dba4']
// Slot 0 indicator shape: bar  |  slots 1-3: line (matches the Amazon Ads UI pattern)
const SLOT_SHAPES: ('bar' | 'line')[] = ['bar', 'line', 'line', 'line']

type TrendDef = { key: string; label: string; axis: 'left' | 'right'; fmt: (v: number) => string; noData?: boolean }
const TREND_CATALOG: TrendDef[] = [
  { key: 'impressions',       label: 'Impressions',                       axis: 'left',  fmt: v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':String(Math.round(v)) },
  { key: 'ctr_pct',           label: 'CTR',                               axis: 'right', fmt: v => v.toFixed(2)+'%' },
  { key: 'cost',              label: 'Spend',                             axis: 'left',  fmt: v => '₹'+(v>=1e5?(v/1e5).toFixed(1)+'L':v>=1e3?(v/1e3).toFixed(1)+'K':v.toFixed(0)) },
  { key: 'sales_14d',         label: 'Sales',                             axis: 'left',  fmt: v => '₹'+(v>=1e5?(v/1e5).toFixed(1)+'L':v>=1e3?(v/1e3).toFixed(1)+'K':v.toFixed(0)) },
  { key: 'acos_pct',          label: 'ACOS',                              axis: 'right', fmt: v => v.toFixed(2)+'%' },
  { key: 'clicks',            label: 'Clicks',                            axis: 'left',  fmt: v => v>=1e3?(v/1e3).toFixed(1)+'K':String(Math.round(v)) },
  { key: 'cpc',               label: 'CPC',                               axis: 'left',  fmt: v => '₹'+v.toFixed(2) },
  { key: 'purchases_14d',     label: 'Purchases',                         axis: 'left',  fmt: v => String(Math.round(v)) },
  { key: 'roas',              label: 'ROAS',                              axis: 'right', fmt: v => v.toFixed(2)+'×' },
  { key: 'detail_page_views', label: 'Detail page views',                 axis: 'left',  fmt: v => String(Math.round(v)), noData: true },
  { key: 'long_term_sales',   label: 'Long-term sales',                   axis: 'left',  fmt: v => '₹'+v.toFixed(0), noData: true },
  { key: 'pct_purchases_ntb', label: 'Percent of purchases new to brand', axis: 'right', fmt: v => v.toFixed(2)+'%', noData: true },
  { key: 'pct_sales_ntb',     label: 'Percent of sales new to brand',     axis: 'right', fmt: v => v.toFixed(2)+'%', noData: true },
  { key: 'purchases_ntb',     label: 'Purchases (new to brand)',          axis: 'left',  fmt: v => String(Math.round(v)), noData: true },
  { key: 'sales_ntb',         label: 'Sales (new to brand)',              axis: 'left',  fmt: v => '₹'+v.toFixed(0), noData: true },
  { key: 'vcpm',              label: 'Viewable CPM (vCPM)',               axis: 'left',  fmt: v => '₹'+v.toFixed(2), noData: true },
]

function TrendDropdown({ selected, onChange, slotIdx }: { selected: string; onChange: (k: string) => void; slotIdx: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const def = TREND_CATALOG.find(c => c.key === selected) ?? TREND_CATALOG[0]
  const color = SLOT_COLORS[slotIdx]
  const shape = SLOT_SHAPES[slotIdx]
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {/* Shape indicator: rect for bar, line-with-dot for line */}
      {shape === 'bar'
        ? <span style={{ width: 12, height: 12, borderRadius: 3, background: color, opacity: 0.85, display: 'inline-block', flexShrink: 0 }} />
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
            <span style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, marginLeft: -3, border: '2px solid var(--bg)' }} />
          </span>
      }
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)', padding: 0 }}
      >
        {def.label}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 300, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 260, maxHeight: 340, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}>
          {TREND_CATALOG.map(d => (
            <button key={d.key} onClick={() => { onChange(d.key); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12, color: d.key === selected ? 'var(--accent)' : 'var(--text)', borderLeft: d.key === selected ? '2px solid var(--accent)' : '2px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              {d.label}
              {d.noData && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>N/A</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.45)', minWidth: 180 }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 8, fontSize: 10 }}>{label}</div>
      {payload.map((p: any, i: number) => {
        const def = TREND_CATALOG.find(c => c.key === p.dataKey)
        const slotIdx = payload.length === 1 ? 0 : i
        const color = p.color ?? SLOT_COLORS[slotIdx % 4]
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 6 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', flex: 1 }}>{p.name}</span>
            <span style={{ color: color, fontWeight: 700 }}>{def ? def.fmt(p.value) : p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

function PerformanceTrend({ charts }: { charts: any }) {
  const [slots, setSlots] = useState<string[]>(['impressions', 'ctr_pct', 'cost', 'sales_14d'])
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [collapsed, setCollapsed] = useState(false)

  const rawSeries: any[] = charts?.series ?? []

  const series = useMemo(() => {
    const daily = rawSeries.map((d: any) => {
      const cost = d.cost ?? 0
      const sales = d.sales_14d ?? 0
      const clicks = d.clicks ?? 0
      const impr = d.impressions ?? 0
      return {
        date: d.date,
        label: String(d.date).slice(5).replace('-', '/'),
        cost, sales_14d: sales, clicks, impressions: impr,
        purchases_14d: d.purchases_14d ?? 0,
        acos_pct: sales > 0 ? (cost / sales) * 100 : 0,
        ctr_pct:  impr > 0 ? (clicks / impr) * 100 : 0,
        cpc:      clicks > 0 ? cost / clicks : 0,
        roas:     cost > 0 ? sales / cost : 0,
      }
    })
    if (granularity === 'daily') return daily
    if (granularity === 'weekly') {
      const buckets: Record<string, any> = {}
      daily.forEach(d => {
        const dt = new Date(d.date)
        const mon = new Date(dt); mon.setDate(dt.getDate() - dt.getDay() + 1)
        const key = mon.toISOString().slice(0, 10)
        if (!buckets[key]) buckets[key] = { label: 'W/' + key.slice(5), cost: 0, sales_14d: 0, clicks: 0, impressions: 0, purchases_14d: 0 }
        const b = buckets[key]
        b.cost += d.cost; b.sales_14d += d.sales_14d; b.clicks += d.clicks; b.impressions += d.impressions; b.purchases_14d += d.purchases_14d
      })
      return Object.values(buckets).map(b => ({ ...b, acos_pct: b.sales_14d > 0 ? (b.cost/b.sales_14d)*100 : 0, ctr_pct: b.impressions > 0 ? (b.clicks/b.impressions)*100 : 0, cpc: b.clicks > 0 ? b.cost/b.clicks : 0, roas: b.cost > 0 ? b.sales_14d/b.cost : 0 }))
    }
    const buckets: Record<string, any> = {}
    daily.forEach(d => {
      const key = String(d.date).slice(0, 7)
      if (!buckets[key]) buckets[key] = { label: key, cost: 0, sales_14d: 0, clicks: 0, impressions: 0, purchases_14d: 0 }
      const b = buckets[key]
      b.cost += d.cost; b.sales_14d += d.sales_14d; b.clicks += d.clicks; b.impressions += d.impressions; b.purchases_14d += d.purchases_14d
    })
    return Object.values(buckets).map(b => ({ ...b, acos_pct: b.sales_14d > 0 ? (b.cost/b.sales_14d)*100 : 0, ctr_pct: b.impressions > 0 ? (b.clicks/b.impressions)*100 : 0, cpc: b.clicks > 0 ? b.cost/b.clicks : 0, roas: b.cost > 0 ? b.sales_14d/b.cost : 0 }))
  }, [rawSeries, granularity])

  const totals = useMemo((): Record<string, number> => {
    if (!series.length) return {}
    const sumC = series.reduce((s, d) => s + d.cost, 0)
    const sumS = series.reduce((s, d) => s + d.sales_14d, 0)
    const sumCl = series.reduce((s, d) => s + d.clicks, 0)
    const sumIm = series.reduce((s, d) => s + d.impressions, 0)
    return {
      impressions:   sumIm,
      ctr_pct:       sumIm > 0 ? (sumCl / sumIm) * 100 : 0,
      cost:          sumC,
      sales_14d:     sumS,
      acos_pct:      sumS > 0 ? (sumC / sumS) * 100 : 0,
      clicks:        sumCl,
      cpc:           sumCl > 0 ? sumC / sumCl : 0,
      purchases_14d: series.reduce((s, d) => s + d.purchases_14d, 0),
      roas:          sumC > 0 ? sumS / sumC : 0,
    }
  }, [series])

  // Y-axis helpers — pick the first active left/right slot to drive tick formatting
  const activePairs = slots.map((key, idx) => ({ key, idx, def: TREND_CATALOG.find(c => c.key === key)! })).filter(p => !p.def.noData)
  const hasRight  = activePairs.some(p => p.def.axis === 'right')
  const leftGuide = activePairs.find(p => p.def.axis === 'left')?.def
  const rightGuide= activePairs.find(p => p.def.axis === 'right')?.def

  return (
    <div className="gf-card">
      {/* Header */}
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Performance Trend</div>
          <div className="gf-card-sub">{series.length} data points · {granularity}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="gf-seg">
            {(['daily', 'weekly', 'monthly'] as const).map(g => (
              <button key={g} className={g === granularity ? 'is-on' : ''} onClick={() => setGranularity(g)}>{g[0].toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Metric summary tiles */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {slots.map((key, idx) => {
          const def = TREND_CATALOG.find(c => c.key === key)!
          const val = totals[key]
          const accentColor = SLOT_COLORS[idx]
          return (
            <div key={idx} style={{ flex: 1, padding: '14px 20px', borderRight: idx < slots.length - 1 ? '1px solid var(--border)' : 'none', position: 'relative', overflow: 'hidden' }}>
              {/* Colored accent line matching the chart slot color */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accentColor, opacity: def.noData ? 0.25 : 0.7 }} />
              <TrendDropdown selected={key} slotIdx={idx} onChange={k => setSlots(s => s.map((v, i) => i === idx ? k : v))} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, marginTop: 10, lineHeight: 1.1, color: def.noData ? 'var(--text-3)' : 'var(--text)' }}>
                {def.noData ? '—' : val != null ? def.fmt(val) : '—'}
              </div>
              {def.noData && <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 4 }}>requires integration</div>}
            </div>
          )
        })}
      </div>

      {/* Chart — ComposedChart: slot 0 = bars, slots 1-3 = lines */}
      {!collapsed && (
        series.length === 0
          ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No data for this period</div>
          : (
            <div style={{ padding: '12px 0 4px' }}>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={series} margin={{ top: 4, right: hasRight ? 62 : 8, left: 0, bottom: 4 }}
                  barCategoryGap={series.length <= 6 ? '55%' : series.length <= 14 ? '40%' : '30%'}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(series.length / 7) - 1)} />
                  <YAxis yAxisId="left" tick={{ fill: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }} tickLine={false} axisLine={false} width={52}
                    tickFormatter={v => leftGuide ? leftGuide.fmt(v) : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : String(Math.round(v))} />
                  {hasRight && (
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10 }} tickLine={false} axisLine={false} width={50}
                      tickFormatter={v => rightGuide ? rightGuide.fmt(v) : v.toFixed(1)} />
                  )}
                  <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />

                  {/* Slot 0: bars — width shrinks dynamically for sparse weekly/monthly views */}
                  {!activePairs.find(p => p.idx === 0) ? null : (() => {
                    const p = activePairs.find(p => p.idx === 0)!
                    const barW = series.length <= 4 ? 32 : series.length <= 8 ? 22 : series.length <= 20 ? 16 : 12
                    return (
                      <Bar key={p.key} yAxisId={p.def.axis} dataKey={p.key} name={p.def.label}
                        fill={SLOT_COLORS[0]} opacity={0.38} radius={[3, 3, 0, 0]} maxBarSize={barW} />
                    )
                  })()}

                  {/* Slots 1-3: lines — show dots when data is sparse (≤8 points) */}
                  {activePairs.filter(p => p.idx > 0).map(p => (
                    <Line key={p.key} yAxisId={p.def.axis} type="monotone" dataKey={p.key} name={p.def.label}
                      stroke={SLOT_COLORS[p.idx]} strokeWidth={2.5}
                      dot={series.length <= 8 ? { r: 4, fill: SLOT_COLORS[p.idx], strokeWidth: 2, stroke: 'var(--bg)' } : false}
                      activeDot={{ r: 5, fill: SLOT_COLORS[p.idx], strokeWidth: 2, stroke: 'var(--bg)' }} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )
      )}
    </div>
  )
}

// ── Section 4a: Sales Funnel Card ────────────────────────────
const F_W      = 264
const F_RH     = 76
const F_GAP    = 6
const F_BOUNDS = [1.0, 0.76, 0.55, 0.38]
const F_SVG_H  = 4 * F_RH + 3 * F_GAP

const FUNNEL_STAGES = [
  { label: 'Impressions', color: '#60aef5', dimColor: 'rgba(96,174,245,0.15)' },
  { label: 'Clicks',      color: '#818cf8', dimColor: 'rgba(129,140,248,0.15)' },
  { label: 'Orders',      color: '#fbbf24', dimColor: 'rgba(251,191,36,0.15)'  },
  { label: 'Revenue',     color: '#f97316', dimColor: 'rgba(249,115,22,0.15)'  },
]

function SalesFunnelCard({ metrics }: { metrics: any }) {
  const impressions = metrics?.total_impressions   ?? 0
  const clicks      = metrics?.total_clicks        ?? 0
  const purchases   = metrics?.total_purchases_14d ?? 0
  const sales       = metrics?.total_sales_14d     ?? 0
  const cost        = metrics?.total_cost          ?? 0
  const roas = cost > 0 ? sales / cost : 0
  const ctr  = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cvr  = clicks > 0 ? (purchases / clicks) * 100 : 0
  const acos = sales > 0 ? (cost / sales) * 100 : 0

  const stageValues = [
    { val: fmt(impressions),                         note: 'Total reach' },
    { val: fmt(clicks),                              note: ctr > 0 ? `${ctr.toFixed(2)}% CTR` : 'No clicks yet' },
    { val: purchases > 0 ? fmt(purchases) : '—',    note: cvr > 0 ? `${cvr.toFixed(2)}% CVR` : 'No orders yet' },
    { val: fmt(sales, 'currency'),                   note: roas > 0 ? `${roas.toFixed(2)}× ROAS` : 'No revenue yet' },
  ]

  const kpiPills = [
    roas > 0  && { label: 'ROAS',  value: roas.toFixed(2) + '×',  bg: 'rgba(0,219,164,0.12)',  border: 'rgba(0,219,164,0.28)',  color: '#00dba4' },
    ctr > 0   && { label: 'CTR',   value: ctr.toFixed(2)  + '%',  bg: 'rgba(96,174,245,0.1)',  border: 'rgba(96,174,245,0.28)', color: '#60aef5' },
    acos > 0  && { label: 'ACoS',  value: acos.toFixed(2) + '%',  bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', color: '#f97316' },
    cvr > 0   && { label: 'CVR',   value: cvr.toFixed(2)  + '%',  bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.28)',color: '#818cf8' },
    cost > 0  && { label: 'SPEND', value: fmt(cost, 'currency'),   bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.1)', color: 'var(--text-2)' },
  ].filter(Boolean) as { label: string; value: string; bg: string; border: string; color: string }[]

  return (
    <div className="gf-card" style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="gf-card-header">
        <div style={{ flex: 1 }}>
          <div className="gf-card-title">Your Sales Funnel</div>
          <div className="gf-card-sub">Customer journey · conversion drop-off</div>
        </div>
        {sales > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Revenue</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: '#00dba4' }}>{fmt(sales, 'currency')}</div>
          </div>
        )}
      </div>

      {/* Funnel grows to fill all available vertical space */}
      <div style={{ flex: 1, padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* SVG trapezoid funnel */}
          <svg width={F_W} height={F_SVG_H} viewBox={`0 0 ${F_W} ${F_SVG_H}`} style={{ flexShrink: 0, overflow: 'visible' }}>
            {FUNNEL_STAGES.map((s, i) => {
              const topW = F_BOUNDS[i]   * F_W
              const botW = F_BOUNDS[i+1] * F_W
              const y    = i * (F_RH + F_GAP)
              const pts  = `${(F_W-topW)/2},${y} ${(F_W+topW)/2},${y} ${(F_W+botW)/2},${y+F_RH} ${(F_W-botW)/2},${y+F_RH}`
              return (
                <g key={i}>
                  <polygon points={pts} fill={s.color} />
                  <text x={F_W/2} y={y + F_RH/2} textAnchor="middle" dominantBaseline="middle"
                    fill="#0c1a2e" fontFamily="'Outfit',sans-serif" fontWeight="700" fontSize="15">
                    {s.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Values + notes aligned to each stage */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FUNNEL_STAGES.map((s, i) => (
              <div key={i} style={{ height: F_RH + (i < FUNNEL_STAGES.length - 1 ? F_GAP : 0), display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
                  {stageValues[i].val}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: s.color, marginTop: 4, whiteSpace: 'nowrap', opacity: 0.9 }}>
                  {stageValues[i].note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI pills pinned to bottom */}
      {kpiPills.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 20px 18px' }}>
          {kpiPills.map(k => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: k.color, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>{k.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: k.color }}>{k.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section 4b: Ad Type Contribution ─────────────────────────
function AdTypeXTick({ x, y, payload }: any) {
  const LINES: Record<string, string[]> = {
    SP: ['Sponsored', 'Products'],
    SB: ['Sponsored', 'Brands'],
    SD: ['Sponsored', 'Display'],
  }
  const lines = LINES[payload.value] ?? [payload.value]
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((ln: string, i: number) => (
        <text key={i} x={0} y={0} dy={15 + i * 14}
          textAnchor="middle"
          fill="var(--text-2)" fontFamily="var(--sans)" fontSize={11} fontWeight={600}>
          {ln}
        </text>
      ))}
    </g>
  )
}

function AdTypeCard({ charts }: { charts: any }) {
  const breakdown: any[] = charts?.ad_type_breakdown ?? []
  const totalSpend = breakdown.reduce((s, b) => s + (b.spend ?? 0), 0)
  const totalSales = breakdown.reduce((s, b) => s + (b.sales ?? 0), 0)
  const totalRoas  = totalSpend > 0 ? totalSales / totalSpend : 0
  const totalAcos  = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0

  const SPEND_CLR = '#4472c4'
  const REV_CLR   = '#70ad47'
  const TYPE_COLOR: Record<string, string> = { SP: '#60aef5', SB: '#818cf8', SD: '#f0b429' }
  const TYPE_FULL: Record<string, string>  = { SP: 'Sponsored Products', SB: 'Sponsored Brands', SD: 'Sponsored Display' }

  const chartData = breakdown.map(b => ({
    name:     b.ad_type,
    spendPct: totalSpend > 0 ? parseFloat(((b.spend / totalSpend) * 100).toFixed(1)) : 0,
    revPct:   totalSales > 0 ? parseFloat(((b.sales / totalSales) * 100).toFixed(1)) : 0,
    spend:    b.spend ?? 0,
    sales:    b.sales ?? 0,
    roas:     (b.spend ?? 0) > 0 ? (b.sales ?? 0) / (b.spend ?? 0) : 0,
    acos:     (b.sales ?? 0) > 0 ? ((b.spend ?? 0) / (b.sales ?? 0)) * 100 : 0,
  }))

  const isSingle = breakdown.length === 1
  const maxPct   = Math.max(...chartData.flatMap(d => [d.spendPct, d.revPct]), 10)
  const yMax     = Math.min(Math.ceil((maxPct + 10) / 10) * 10, 110)
  const yTicks   = Array.from({ length: Math.floor(yMax / 10) + 1 }, (_, i) => i * 10)

  return (
    <div className="gf-card" style={{ minWidth: 0 }}>
      <div className="gf-card-header">
        <div style={{ flex: 1 }}>
          <div className="gf-card-title">Amazon Ads: Spend vs Revenue Share (%)</div>
          <div className="gf-card-sub">Ad format contribution · Sponsored Products · Brands · Display</div>
        </div>
        {totalSpend > 0 && (
          <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Total Spend</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: SPEND_CLR }}>{fmt(totalSpend, 'currency')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Total Revenue</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: REV_CLR }}>{fmt(totalSales, 'currency')}</div>
            </div>
          </div>
        )}
      </div>

      {breakdown.length === 0 ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No ad type data available
        </div>
      ) : (
        <div style={{ padding: '4px 16px 12px' }}>
          {/* Bar chart */}
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData}
              margin={{ top: 22, right: 10, left: -8, bottom: 0 }}
              barGap={4}
              barCategoryGap={isSingle ? '55%' : '28%'}>
              <CartesianGrid vertical={false} stroke="rgba(100,160,240,0.07)" />
              <XAxis
                dataKey="name"
                tick={<AdTypeXTick />}
                tickLine={false}
                axisLine={{ stroke: 'rgba(100,160,240,0.14)' }}
                height={44}
              />
              <YAxis
                domain={[0, yMax]}
                ticks={yTicks}
                tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v + '%'}
                width={34}
              />
              <Tooltip
                cursor={{ fill: 'rgba(100,160,240,0.06)' }}
                contentStyle={{ background: '#0a1628', border: '1px solid rgba(100,160,240,0.22)', borderRadius: 10, fontSize: 11, fontFamily: 'var(--mono)', padding: '10px 14px' }}
                labelStyle={{ color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}
                formatter={(v: number, name: string, props: any) => {
                  const d = props.payload
                  const abs = name === 'Spend %' ? fmt(d.spend, 'currency') : fmt(d.sales, 'currency')
                  return [`${v.toFixed(1)}%  (${abs})`, name]
                }}
              />
              <Bar dataKey="spendPct" name="Spend %" fill={SPEND_CLR} radius={[3,3,0,0]} maxBarSize={52}>
                {chartData.map((_, i) => <Cell key={i} fill={SPEND_CLR} />)}
                <LabelList dataKey="spendPct" position="top"
                  formatter={(v: number) => v > 0 ? v.toFixed(1) + '%' : ''}
                  style={{ fontSize: 11, fill: SPEND_CLR, fontFamily: 'var(--mono)', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="revPct" name="Revenue %" fill={REV_CLR} radius={[3,3,0,0]} maxBarSize={52}>
                {chartData.map((_, i) => <Cell key={i} fill={REV_CLR} />)}
                <LabelList dataKey="revPct" position="top"
                  formatter={(v: number) => v > 0 ? v.toFixed(1) + '%' : ''}
                  style={{ fontSize: 11, fill: REV_CLR, fontFamily: 'var(--mono)', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 14 }}>
            {([[' Spend %', SPEND_CLR], ['Revenue %', REV_CLR]] as [string, string][]).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 14, height: 14, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--sans)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Per-type metric rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid var(--border)' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 56px 62px 68px', padding: '7px 12px 5px', gap: 6 }}>
              {['AD TYPE', 'ROAS', 'ACoS', 'SPEND', 'REVENUE'].map((h, i) => (
                <div key={h} style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>

            {chartData.map((d) => {
              const roasClr = d.roas >= 4 ? '#00dba4' : d.roas >= 2 ? '#f0b429' : d.roas > 0 ? '#ff6b8a' : 'var(--text-3)'
              const acosClr = d.acos > 0 && d.acos <= 25 ? '#00dba4' : d.acos <= 50 ? '#f0b429' : '#ff6b8a'
              const typeColor = TYPE_COLOR[d.name] ?? '#94a3b8'
              return (
                <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '1fr 58px 56px 62px 68px', padding: '9px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 26, borderRadius: 2, background: typeColor, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800, color: typeColor, lineHeight: 1 }}>{d.name}</div>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{(TYPE_FULL[d.name] ?? '').replace('Sponsored ', '')}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: roasClr }}>{d.roas > 0 ? d.roas.toFixed(2) + '×' : '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: acosClr }}>{d.acos > 0 ? d.acos.toFixed(2) + '%' : '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(d.spend, 'currency')}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmt(d.sales, 'currency')}</div>
                </div>
              )
            })}

            {/* Total row */}
            {chartData.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 56px 62px 68px', padding: '9px 12px 4px', borderTop: '1px solid var(--border)', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TOTAL</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, color: '#00dba4' }}>{totalRoas > 0 ? totalRoas.toFixed(2) + '×' : '—'}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, color: totalAcos <= 30 ? '#00dba4' : totalAcos <= 50 ? '#f0b429' : '#ff6b8a' }}>{totalAcos > 0 ? totalAcos.toFixed(2) + '%' : '—'}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{fmt(totalSpend, 'currency')}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{fmt(totalSales, 'currency')}</div>
              </div>
            )}
          </div>

          {isSingle && (
            <div style={{ marginTop: 14, background: 'rgba(68,114,196,0.05)', border: '1px solid rgba(68,114,196,0.16)', borderRadius: 10, padding: '11px 13px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: SPEND_CLR, marginBottom: 9 }}>💡 Unlock Full Ad Mix</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { type: 'SB', color: '#818cf8', desc: 'Sponsored Brands — brand awareness & new-to-brand customers' },
                  { type: 'SD', color: '#f0b429', desc: 'Sponsored Display — retarget visitors & compete on rival pages' },
                ].map(s => (
                  <div key={s.type} style={{ flex: 1, background: `${s.color}10`, borderRadius: 7, padding: '9px 11px', border: `1px solid ${s.color}26` }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.type}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.45 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section 5: Performance Table ─────────────────────────────
type SortKey = 'date' | 'cost' | 'sales_14d' | 'clicks' | 'impressions' | 'purchases_14d' | 'acos' | 'roas' | 'ctr' | 'cpc'

type PerfRow = {
  date: string
  cost: number; sales_14d: number; clicks: number; impressions: number; purchases_14d: number
  acos: number | null; roas: number | null; ctr: number | null; cpc: number | null; cvr: number | null
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt2 = (dt: Date) => dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return `${fmt2(mon)} – ${fmt2(sun)}`
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return mon.toISOString().slice(0, 10)
}

const PERF_COLS = [
  { key: 'sales_14d',     label: 'Ad Sales',     sortK: 'sales_14d'     as SortKey, defaultOn: true  },
  { key: 'organic',       label: 'Organic Sales', sortK: null,                       defaultOn: false },
  { key: 'total_sales',   label: 'Total Sales',   sortK: null,                       defaultOn: false },
  { key: 'cost',          label: 'Ad Spend',      sortK: 'cost'          as SortKey, defaultOn: true  },
  { key: 'clicks',        label: 'Clicks',        sortK: 'clicks'        as SortKey, defaultOn: true  },
  { key: 'ctr',           label: 'CTR',           sortK: 'ctr'           as SortKey, defaultOn: true  },
  { key: 'cvr',           label: 'CVR',           sortK: null,                       defaultOn: false },
  { key: 'roas',          label: 'ROAS',          sortK: 'roas'          as SortKey, defaultOn: true  },
  { key: 'acos',          label: 'ACoS',          sortK: 'acos'          as SortKey, defaultOn: true  },
  { key: 'tacos',         label: 'TACoS',         sortK: null,                       defaultOn: false },
  { key: 'purchases_14d', label: 'Purchases',     sortK: 'purchases_14d' as SortKey, defaultOn: false },
  { key: 'impressions',   label: 'Impressions',   sortK: 'impressions'   as SortKey, defaultOn: true  },
]
const PERF_COLS_LS = 'gf_perf_cols_v1'

function PerformanceTable({ charts }: { charts: any }) {
  const [view, setView]           = useState<'daily' | 'weekly'>('daily')
  const [sortKey, setSortKey]     = useState<SortKey>('date')
  const [sortAsc, setSortAsc]     = useState(false)
  const [page, setPage]           = useState(0)
  const [colMenuOpen, setColMenu] = useState(false)
  const [compareOn,   setCompare] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PERF_COLS_LS) || 'null')
      if (Array.isArray(saved)) return new Set(saved)
    } catch {}
    return new Set(PERF_COLS.filter(c => c.defaultOn).map(c => c.key))
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 14

  useEffect(() => {
    if (!colMenuOpen) return
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [colMenuOpen])

  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(PERF_COLS_LS, JSON.stringify([...next]))
      return next
    })
  }

  const dailyRows = useMemo<PerfRow[]>(() => {
    const series: any[] = charts?.series ?? []
    return series.map(d => {
      const cost  = d.cost          ?? 0
      const sales = d.sales_14d     ?? 0
      const clicks = d.clicks       ?? 0
      const impr  = d.impressions   ?? 0
      const purch = d.purchases_14d ?? 0
      return {
        date: String(d.date),
        cost, sales_14d: sales, clicks, impressions: impr, purchases_14d: purch,
        acos: sales  > 0 ? cost   / sales  : null,
        roas: cost   > 0 ? sales  / cost   : null,
        ctr:  impr   > 0 ? clicks / impr   : null,
        cpc:  clicks > 0 ? cost   / clicks : null,
        cvr:  clicks > 0 ? purch  / clicks : null,
      }
    })
  }, [charts])

  const weeklyRows = useMemo<PerfRow[]>(() => {
    const map = new Map<string, { cost: number; sales: number; clicks: number; impr: number; purch: number; dates: string[] }>()
    for (const r of dailyRows) {
      const k = weekKey(r.date)
      if (!map.has(k)) map.set(k, { cost: 0, sales: 0, clicks: 0, impr: 0, purch: 0, dates: [] })
      const w = map.get(k)!
      w.cost   += r.cost;          w.sales  += r.sales_14d
      w.clicks += r.clicks;        w.impr   += r.impressions
      w.purch  += r.purchases_14d; w.dates.push(r.date)
    }
    return Array.from(map.entries()).map(([k, w]) => ({
      date: weekLabel(k),
      cost: w.cost, sales_14d: w.sales, clicks: w.clicks, impressions: w.impr, purchases_14d: w.purch,
      acos: w.sales  > 0 ? w.cost   / w.sales  : null,
      roas: w.cost   > 0 ? w.sales  / w.cost   : null,
      ctr:  w.impr   > 0 ? w.clicks / w.impr   : null,
      cpc:  w.clicks > 0 ? w.cost   / w.clicks : null,
      cvr:  w.clicks > 0 ? w.purch  / w.clicks : null,
    }))
  }, [dailyRows])

  const rows = view === 'weekly' ? weeklyRows : dailyRows

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = (a as any)[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      const bv = (b as any)[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [rows, sortKey, sortAsc])

  // ── Totals / averages across all sorted rows ──────────────
  const totals = useMemo(() => {
    const sumCost   = sorted.reduce((s, r) => s + r.cost,           0)
    const sumSales  = sorted.reduce((s, r) => s + r.sales_14d,      0)
    const sumClicks = sorted.reduce((s, r) => s + r.clicks,         0)
    const sumImpr   = sorted.reduce((s, r) => s + r.impressions,    0)
    const sumPurch  = sorted.reduce((s, r) => s + r.purchases_14d,  0)
    return {
      cost: sumCost, sales_14d: sumSales, clicks: sumClicks,
      impressions: sumImpr, purchases_14d: sumPurch,
      roas: sumCost   > 0 ? sumSales  / sumCost   : null,
      acos: sumSales  > 0 ? sumCost   / sumSales  : null,
      ctr:  sumImpr   > 0 ? sumClicks / sumImpr   : null,
      cvr:  sumClicks > 0 ? sumPurch  / sumClicks : null,
    }
  }, [sorted])

  // ── Best ROAS for smart highlighting ──────────────────────
  const maxRoas = useMemo(() => Math.max(...sorted.map(r => r.roas ?? 0), 0), [sorted])

  // ── Week-over-week comparison index ───────────────────────
  // weeklyRows is in chronological order; map label → index so we can look up prev week
  const weekIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    weeklyRows.forEach((r, i) => m.set(r.date, i))
    return m
  }, [weeklyRows])

  function getPrevWeek(r: PerfRow): PerfRow | null {
    const idx = weekIndexMap.get(r.date)
    if (idx === undefined || idx === 0) return null
    return weeklyRows[idx - 1]
  }

  const paged      = sorted.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const activeCols = PERF_COLS.filter(c => visibleCols.has(c.key))
  const colSpan    = 1 + activeCols.length // date + active

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortAsc(a => !a)
    else { setSortKey(k); setSortAsc(false) }
    setPage(0)
  }

  function handleView(v: 'daily' | 'weekly') {
    setView(v); setPage(0); setSortKey('date'); setSortAsc(false)
  }

  function exportCSV() {
    const headers = [view === 'weekly' ? 'Week' : 'Date', ...activeCols.map(c => c.label)]
    const rowData = sorted.map(r => [
      r.date,
      ...activeCols.map(c => {
        if (c.key === 'sales_14d')     return r.sales_14d.toFixed(2)
        if (c.key === 'cost')          return r.cost.toFixed(2)
        if (c.key === 'clicks')        return r.clicks
        if (c.key === 'ctr')           return r.ctr  != null ? (r.ctr  * 100).toFixed(2) + '%' : ''
        if (c.key === 'cvr')           return r.cvr  != null ? (r.cvr  * 100).toFixed(2) + '%' : ''
        if (c.key === 'roas')          return r.roas != null ? r.roas.toFixed(2) : ''
        if (c.key === 'acos')          return r.acos != null ? (r.acos * 100).toFixed(2) + '%' : ''
        if (c.key === 'purchases_14d') return r.purchases_14d
        if (c.key === 'impressions')   return r.impressions
        return ''
      }),
    ])
    const csv  = [headers, ...rowData].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `performance_${view}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const isWeekly = view === 'weekly'
  const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: '#0d1f38' }
  const stickyDate: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: '#0d1f38' }
  const stickyCorner: React.CSSProperties = { ...stickyTh, ...stickyDate, zIndex: 3 }

  // Metric polarity: true = higher is better (green ↑), false = lower is better (green ↓)
  const METRIC_POSITIVE: Record<string, boolean> = {
    sales_14d: true, clicks: true, ctr: true, cvr: true,
    roas: true, purchases_14d: true, impressions: true,
    cost: false, acos: false, tacos: false,
  }

  function Delta({ cur, prev, metricKey }: { cur: number | null; prev: number | null; metricKey: string }) {
    if (cur == null || prev == null || prev === 0) return null
    const pct   = ((cur - prev) / Math.abs(prev)) * 100
    const isPos = METRIC_POSITIVE[metricKey] ?? true
    const up    = pct >= 0
    const good  = isPos ? up : !up
    const color = good ? 'var(--good)' : 'var(--bad)'
    const sign  = up ? '+' : ''
    return (
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color, marginTop: 2, letterSpacing: '0.02em' }}>
        {up ? '↑' : '↓'} {sign}{pct.toFixed(1)}%
      </div>
    )
  }

  function renderCell(r: PerfRow, key: string, prev?: PerfRow | null) {
    const showDelta = compareOn && isWeekly && prev !== undefined
    const acosColor = r.acos == null ? '' : r.acos < 0.3 ? 'var(--good)' : r.acos < 0.55 ? 'var(--accent)' : 'var(--bad)'

    function wrap(content: React.ReactNode, deltaVal: number | null, prevVal: number | null, cls = '') {
      return (
        <td key={key} className={`gf-num gf-col-r ${cls}`} style={{ verticalAlign: 'top' }}>
          {content}
          {showDelta && <Delta cur={deltaVal} prev={prevVal} metricKey={key} />}
        </td>
      )
    }

    switch (key) {
      case 'sales_14d':     return wrap(fmt(r.sales_14d, 'currency'), r.sales_14d, prev?.sales_14d ?? null, 'gf-pos')
      case 'organic':       return <td key={key} className="gf-num gf-col-r gf-muted" title="Requires SP-API">—</td>
      case 'total_sales':   return <td key={key} className="gf-num gf-col-r gf-muted" title="Requires SP-API">—</td>
      case 'cost':          return wrap(fmt(r.cost, 'currency'), r.cost, prev?.cost ?? null, 'gf-acc')
      case 'clicks':        return wrap(fmt(r.clicks), r.clicks, prev?.clicks ?? null)
      case 'ctr':           return wrap(r.ctr  != null ? (r.ctr  * 100).toFixed(2) + '%' : '—', r.ctr,  prev?.ctr  ?? null)
      case 'cvr':           return wrap(r.cvr  != null ? (r.cvr  * 100).toFixed(2) + '%' : '—', r.cvr,  prev?.cvr  ?? null, 'gf-muted')
      case 'roas': {
        const roasClr = r.roas != null && r.roas >= 1 ? 'var(--good)' : r.roas != null ? 'var(--bad)' : ''
        return wrap(<span style={{ color: roasClr }}>{r.roas != null ? r.roas.toFixed(2) + '×' : '—'}</span>, r.roas, prev?.roas ?? null)
      }
      case 'acos':          return wrap(<span style={{ color: acosColor }}>{r.acos != null ? (r.acos * 100).toFixed(2) + '%' : '—'}</span>, r.acos != null ? r.acos * 100 : null, prev?.acos != null ? prev.acos * 100 : null)
      case 'tacos':         return <td key={key} className="gf-num gf-col-r gf-muted" title="Requires SP-API">—</td>
      case 'purchases_14d': return wrap(fmt(r.purchases_14d), r.purchases_14d, prev?.purchases_14d ?? null)
      case 'impressions':   return wrap(fmt(r.impressions), r.impressions, prev?.impressions ?? null)
      default:              return <td key={key} className="gf-num gf-col-r">—</td>
    }
  }

  function renderTotalsCell(key: string) {
    const acosColor = totals.acos == null ? '' : totals.acos < 0.3 ? 'var(--good)' : totals.acos < 0.55 ? 'var(--accent)' : 'var(--bad)'
    const bold: React.CSSProperties = { fontWeight: 800, color: 'var(--text)' }
    switch (key) {
      case 'sales_14d':     return <td key={key} className="gf-num gf-col-r gf-pos" style={bold}>{fmt(totals.sales_14d, 'currency')}</td>
      case 'organic':       return <td key={key} className="gf-num gf-col-r gf-muted">—</td>
      case 'total_sales':   return <td key={key} className="gf-num gf-col-r gf-muted">—</td>
      case 'cost':          return <td key={key} className="gf-num gf-col-r gf-acc"  style={bold}>{fmt(totals.cost, 'currency')}</td>
      case 'clicks':        return <td key={key} className="gf-num gf-col-r"          style={bold}>{fmt(totals.clicks)}</td>
      case 'ctr':           return <td key={key} className="gf-num gf-col-r">{totals.ctr  != null ? (totals.ctr  * 100).toFixed(2) + '%' : '—'}</td>
      case 'cvr':           return <td key={key} className="gf-num gf-col-r gf-muted">{totals.cvr  != null ? (totals.cvr  * 100).toFixed(2) + '%' : '—'}</td>
      case 'roas':          return <td key={key} className="gf-num gf-col-r" style={{ fontWeight: 800, color: totals.roas != null && totals.roas >= 1 ? 'var(--good)' : 'var(--bad)' }}>{totals.roas != null ? totals.roas.toFixed(2) + '×' : '—'}</td>
      case 'acos':          return <td key={key} className="gf-num gf-col-r" style={{ fontWeight: 800, color: acosColor }}>{totals.acos != null ? (totals.acos * 100).toFixed(2) + '%' : '—'}</td>
      case 'tacos':         return <td key={key} className="gf-num gf-col-r gf-muted">—</td>
      case 'purchases_14d': return <td key={key} className="gf-num gf-col-r" style={bold}>{fmt(totals.purchases_14d)}</td>
      case 'impressions':   return <td key={key} className="gf-num gf-col-r" style={bold}>{fmt(totals.impressions)}</td>
      default: return <td key={key} className="gf-num gf-col-r">—</td>
    }
  }

  return (
    <div className="gf-card" style={{ padding: 0 }}>
      <div className="gf-card-header" style={{ padding: '16px 20px 14px', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="gf-card-title">
            {isWeekly ? 'Weekly Performance Table' : 'Daily Performance Table'}
          </div>
          <div className="gf-card-sub">
            {isWeekly
              ? `${weeklyRows.length} weeks · aggregated from ${dailyRows.length} days`
              : `${dailyRows.length} days · date-wise breakdown`}
          </div>
        </div>

        {/* Daily / Weekly toggle */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['daily', 'weekly'] as const).map(v => (
            <button key={v} onClick={() => handleView(v)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: view === v ? 'var(--accent)' : 'transparent',
              color:      view === v ? '#fff'          : 'var(--text-3)',
              boxShadow:  view === v ? '0 2px 8px rgba(108,140,255,0.3)' : 'none',
            }}>
              {v === 'daily' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>

        {/* Compare toggle — week-over-week, only meaningful in Weekly view */}
        <button onClick={() => setCompare(o => !o)} style={{
          padding: '6px 14px', borderRadius: 8, border: '1px solid',
          cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.04em', transition: 'all 0.15s',
          background:   compareOn ? 'rgba(240,180,41,0.12)' : 'rgba(255,255,255,0.04)',
          borderColor:  compareOn ? 'rgba(240,180,41,0.45)' : 'var(--border)',
          color:        compareOn ? '#f0b429'               : 'var(--text-3)',
          boxShadow:    compareOn ? '0 0 12px rgba(240,180,41,0.15)' : 'none',
          opacity:      !isWeekly ? 0.4 : 1,
        }}
          title={!isWeekly ? 'Switch to Weekly view to enable comparison' : ''}
        >
          Compare {compareOn ? 'ON' : 'OFF'}
        </button>

        {/* Column selector */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="gf-btn gf-btn-ghost" onClick={() => setColMenu(o => !o)} style={{ gap: 6 }}>
            <Icon name="settings" size={13} />Columns ({visibleCols.size})
          </button>
          {colMenuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 99,
              background: '#0d1f38', border: '1px solid var(--border)', borderRadius: 10,
              padding: '10px 4px', minWidth: 180, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}>
              {PERF_COLS.map(c => (
                <label key={c.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
                  cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }} />
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: visibleCols.has(c.key) ? 'var(--text)' : 'var(--text-3)', fontWeight: visibleCols.has(c.key) ? 600 : 400 }}>
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="gf-btn gf-btn-ghost" onClick={exportCSV}>
          <Icon name="download" size={13} />CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="gf-table">
          <thead>
            <tr>
              {/* Sticky corner: Date/Week header */}
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', ...stickyCorner, minWidth: isWeekly ? 160 : 100 }}>
                {isWeekly ? 'Week' : 'Date'}{sortKey === 'date' ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </th>
              {activeCols.map(c => (
                c.sortK
                  ? <th key={c.key} className="gf-col-r" onClick={() => handleSort(c.sortK!)} style={{ cursor: 'pointer', userSelect: 'none', ...stickyTh }}>
                      {c.label}{sortKey === c.sortK ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </th>
                  : <th key={c.key} className="gf-col-r" style={{ color: 'var(--text-3)', fontStyle: 'italic', ...stickyTh }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  No data for this period
                </td>
              </tr>
            )}
            {paged.map((r, i) => {
              const isBest      = r.roas != null && r.roas === maxRoas && maxRoas > 0 && sorted.length > 1
              const isWasted    = r.sales_14d === 0 && r.cost > 0
              const rowStyle: React.CSSProperties = isBest
                ? { borderLeft: '3px solid rgba(0,219,164,0.7)', background: 'rgba(0,219,164,0.04)' }
                : isWasted
                ? { borderLeft: '3px solid rgba(255,75,75,0.5)', background: 'rgba(255,75,75,0.03)' }
                : {}
              const prevRow = (compareOn && isWeekly) ? getPrevWeek(r) : undefined
              return (
                <tr key={i} style={rowStyle} title={isBest ? '🏆 Best ROAS week' : isWasted ? '⚠ Spend with no sales' : undefined}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap', verticalAlign: 'top', ...stickyDate }}>
                    <div>{r.date}</div>
                    {compareOn && isWeekly && prevRow && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>
                        vs {prevRow.date}
                      </div>
                    )}
                    {compareOn && isWeekly && !prevRow && (
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>no prev week</div>
                    )}
                  </td>
                  {activeCols.map(c => renderCell(r, c.key, prevRow))}
                </tr>
              )
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(108,140,255,0.04)' }}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '10px 14px', whiteSpace: 'nowrap', ...stickyDate }}>
                  {isWeekly ? `${sorted.length}W Total` : `${sorted.length}D Total`}
                </td>
                {activeCols.map(c => renderTotalsCell(c.key))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="gf-btn gf-btn-ghost" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ opacity: page === 0 ? 0.4 : 1 }}>Prev</button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>Page {page + 1} of {totalPages}</span>
          <button className="gf-btn gf-btn-ghost" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ opacity: page === totalPages - 1 ? 0.4 : 1 }}>Next</button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function OverviewPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const clientId = user?.client_id

  const [datePreset, setDatePreset] = useState('30d')
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [customEnd,   setCustomEnd]   = useState(() => new Date().toISOString().slice(0, 10))
  const [campaignType, setCampaignType] = useState('')

  const dates = useMemo(() => {
    if (datePreset === 'custom') return { start_date: customStart, end_date: customEnd }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])
  const apiParams = useMemo(() => ({
    ...dates,
    ...(campaignType ? { report_type: campaignType } : {}),
  }), [dates, campaignType])

  const skip = !clientId

  const { data: metrics, refetch: refetchMetrics, isLoading: loadingMetrics } = useGetMetricsQuery(apiParams, { skip })
  const { data: charts, refetch: refetchCharts, isLoading: loadingCharts }   = useGetChartsQuery(apiParams, { skip })
  const { data: campaigns = [], refetch: refetchCampaigns }                   = useGetCampaignsQuery({ ...apiParams, limit: 200 }, { skip })
  const isLoading = loadingMetrics || loadingCharts
  const { data: unreadData }                        = useGetUnreadCountQuery(undefined, { pollingInterval: 60000 })

  const unread = unreadData?.count ?? 0

  function handleRefresh() {
    refetchMetrics(); refetchCharts(); refetchCampaigns()
  }

  const subtitle = `${dates.start_date} — ${dates.end_date} · IST`

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-dash${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Overview" subtitle={subtitle} unread={unread} onRefresh={handleRefresh} onMenuToggle={() => setNavOpen(o => !o)} />
        <div className="gf-content">
          {/* Section 1 – Filters */}
          <FilterBar
            datePreset={datePreset} setDatePreset={setDatePreset}
            customStart={customStart} setCustomStart={setCustomStart}
            customEnd={customEnd} setCustomEnd={setCustomEnd}
            campaignType={campaignType} setCampaignType={setCampaignType}
          />

          {/* Section 2 – Scoreboard */}
          {isLoading && !metrics ? (
            <div className="gf-card" style={{ padding: '20px 24px', marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 88, borderRadius: 8, background: 'rgba(100,160,240,0.06)', animation: 'pulse 1.6s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            </div>
          ) : (
            <Scoreboard metrics={metrics} dates={dates} defaultSlots={['sales','total_cost','roas','acos','impressions','clicks']} />
          )}

          {/* Section 3 – Performance Trend */}
          {isLoading && !charts ? (
            <div className="gf-card" style={{ padding: '20px 24px' }}>
              <div style={{ height: 220, borderRadius: 8, background: 'rgba(100,160,240,0.05)', animation: 'pulse 1.6s ease-in-out infinite' }} />
            </div>
          ) : (
            <PerformanceTrend charts={charts} />
          )}

          {/* Section 4 – AI Brief + Festival */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, alignItems: 'start' }}>
            <AIBriefCard metrics={metrics} charts={charts} />
            <FestivalCard />
          </div>

          {/* Section 5 – Customer Journey + Ad Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SalesFunnelCard metrics={metrics} />
            <AdTypeCard charts={charts} />
          </div>

          {/* Section 6 – Budget Pacing + Anomaly */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <BudgetPacingCard campaigns={campaigns} dates={dates} />
            <AnomalyCard charts={charts} />
          </div>

          {/* Section 7 – Day-of-Week Heatmap */}
          <DayHeatmap charts={charts} />

          {/* Section 8 – Performance Table */}
          <PerformanceTable charts={charts} />

          <footer style={{ padding: '16px 0 4px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
            <span>GLANCEFIVE · OVERVIEW · v1.0</span>
            <span>Amazon Advertising API · Data source: ad_metrics</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
