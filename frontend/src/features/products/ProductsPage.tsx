import { useState, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { useSelector } from 'react-redux'
import '../dashboard/DashboardPage.css'
import Scoreboard from '../../components/Scoreboard'
import {
  useGetProductsQuery,
  useGetProductsDailyQuery,
  useGetMetricsQuery,
  useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import { fmtCur, fmtNum, getDateRange } from '../../shared/utils'
import { Icon } from '../../shared/Icon'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'


function acosTone(v: number | null | undefined) {
  if (v == null) return ''
  const pct = v * 100
  if (pct < 30) return 'good'
  if (pct < 55) return 'warn'
  return 'bad'
}


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


const COMBO_MODES = [
  { id: 'sales_spend',   label: 'Sales vs Spend',   key1: 'sales_14d',    lbl1: 'Sales (14d)', col1: '#00dba4', fmt1: fmtCur, key2: 'cost',          lbl2: 'Spend',   col2: '#f0b429', fmt2: fmtCur },
  { id: 'impr_clicks',   label: 'Impr. vs Clicks',  key1: 'impressions',  lbl1: 'Impr.',       col1: '#6c8cff', fmt1: fmtNum, key2: 'clicks',        lbl2: 'Clicks',  col2: '#f0b429', fmt2: fmtNum },
  { id: 'clicks_orders', label: 'Clicks vs Orders', key1: 'clicks',       lbl1: 'Clicks',      col1: '#f0b429', fmt1: fmtNum, key2: 'purchases_14d', lbl2: 'Orders',  col2: '#00dba4', fmt2: fmtNum },
  { id: 'spend_units',   label: 'Spend vs Units',   key1: 'cost',         lbl1: 'Spend',       col1: '#f0b429', fmt1: fmtCur, key2: 'units_sold',    lbl2: 'Units',   col2: '#a78bfa', fmt2: fmtNum },
  { id: 'sales_orders',  label: 'Sales vs Orders',  key1: 'sales_14d',    lbl1: 'Sales',       col1: '#00dba4', fmt1: fmtCur, key2: 'purchases_14d', lbl2: 'Orders',  col2: '#60a5fa', fmt2: fmtNum },
]

// ── Product Table Column Definitions ─────────────────────────
const PROD_COL_DEFS = [
  { key: 'impressions',   label: 'Impr.',     sortable: true, invertGood: false, getText: (p: any) => p.impressions ?? null,                                          fmt: (v: number) => fmtNum(v)               },
  { key: 'clicks',        label: 'Clicks',    sortable: true, invertGood: false, getText: (p: any) => p.clicks ?? null,                                                fmt: (v: number) => fmtNum(v)               },
  { key: 'ctr',           label: 'CTR',       sortable: true, invertGood: false, getText: (p: any) => (p.impressions || 0) > 0 ? p.clicks / p.impressions : null,      fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'cost',          label: 'Ad Spend',  sortable: true, invertGood: true,  getText: (p: any) => p.cost ?? null,                                                  fmt: (v: number) => fmtCur(v)               },
  { key: 'sales_14d',     label: 'Ad Sales',  sortable: true, invertGood: false, getText: (p: any) => p.sales_14d ?? null,                                             fmt: (v: number) => fmtCur(v)               },
  { key: 'roas',          label: 'ROAS',      sortable: true, invertGood: false, getText: (p: any) => (p.cost || 0) > 0 ? (p.sales_14d || 0) / p.cost : null,         fmt: (v: number) => v.toFixed(2) + '×'      },
  { key: 'acos',          label: 'ACoS',      sortable: true, invertGood: true,  getText: (p: any) => p.acos ?? null,                                                  fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'cpc',           label: 'CPC',       sortable: true, invertGood: true,  getText: (p: any) => (p.clicks || 0) > 0 ? p.cost / p.clicks : null,                 fmt: (v: number) => fmtCur(v)               },
  { key: 'purchases_14d', label: 'Orders',    sortable: true, invertGood: false, getText: (p: any) => p.purchases_14d ?? null,                                         fmt: (v: number) => fmtNum(v)               },
  { key: 'cvr',           label: 'CVR',       sortable: true, invertGood: false, getText: (p: any) => (p.clicks || 0) > 0 ? (p.purchases_14d || 0) / p.clicks : null, fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'units_sold',       label: 'Units',          sortable: true, invertGood: false, getText: (p: any) => p.units_sold ?? null,                                                                           fmt: (v: number) => fmtNum(v)                             },
  { key: 'campaigns_count', label: '# Campaigns',    sortable: true, invertGood: false, getText: (p: any) => (p.campaigns_count != null && p.campaigns_count > 0) ? p.campaigns_count : null,             fmt: (v: number) => String(v)                             },
  { key: 'avg_price',       label: 'Avg. Price',     sortable: true, invertGood: false, getText: (p: any) => (p.units_sold || 0) > 0 ? (p.sales_14d || 0) / p.units_sold : null,                          fmt: (v: number) => fmtCur(v)                             },
  { key: 'daily_run_rate',  label: 'Daily Units',    sortable: true, invertGood: false, getText: (p: any) => (p._days && p._days > 0) ? (p.units_sold || 0) / p._days : null,                             fmt: (v: number) => v.toFixed(1) + ' u/d'                },
  { key: 'forecast_30d',    label: 'Fcst. 30d',      sortable: true, invertGood: false, getText: (p: any) => (p._days && p._days > 0) ? Math.round(((p.units_sold || 0) / p._days) * 30) : null,          fmt: (v: number) => fmtNum(v) + ' units'                 },
]
const DEFAULT_PROD_COLS = new Set(['impressions', 'clicks', 'cost', 'sales_14d', 'roas', 'acos', 'purchases_14d', 'cvr'])

function ProdMetricCell({ colKey, curr, prev, showComp, isTotals = false }: { colKey: string; curr: any; prev: any | null; showComp: boolean; isTotals?: boolean }) {
  const col = PROD_COL_DEFS.find(c => c.key === colKey)!
  const val     = col.getText(curr)
  const prevVal = prev ? col.getText(prev) : null
  const pct = (val != null && prevVal != null && prevVal !== 0)
    ? ((val - prevVal) / Math.abs(prevVal)) * 100 : null
  const isUp = pct != null && pct > 0
  const good = pct != null ? (col.invertGood ? !isUp : isUp) : null

  let display: React.ReactNode
  if (val == null) {
    display = <span style={{ color: 'var(--text-3)' }}>—</span>
  } else if (colKey === 'acos') {
    display = <span className={`gf-acos-pill ${acosTone(val)}`}>{(val * 100).toFixed(2)}%</span>
  } else if (colKey === 'roas') {
    const rc = val >= 4 ? '#00dba4' : val >= 2 ? '#f0b429' : '#ff4d6d'
    const rbg = val >= 4 ? 'rgba(0,219,164,0.12)' : val >= 2 ? 'rgba(240,180,41,0.10)' : 'rgba(255,77,109,0.10)'
    display = <span style={{ color: rc, background: rbg, padding: '2px 7px', borderRadius: 8, fontWeight: 700, fontSize: 11 }}>{val.toFixed(2)}×</span>
  } else if (colKey === 'cost') {
    display = <span style={{ color: 'var(--accent)', fontWeight: isTotals ? 700 : 400 }}>{col.fmt(val)}</span>
  } else if (colKey === 'sales_14d') {
    display = <span style={{ color: 'var(--good)', fontWeight: isTotals ? 700 : 400 }}>{col.fmt(val)}</span>
  } else if (colKey === 'cvr' || colKey === 'ctr') {
    display = <span style={{ color: '#a78bfa' }}>{col.fmt(val)}</span>
  } else if (colKey === 'campaigns_count') {
    display = <span style={{ background: 'rgba(108,140,255,0.15)', color: '#6c8cff', padding: '2px 8px', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}>{val} {val === 1 ? 'campaign' : 'campaigns'}</span>
  } else if (colKey === 'avg_price') {
    display = <span style={{ color: '#60a5fa', fontWeight: isTotals ? 700 : 400 }}>{col.fmt(val)}</span>
  } else if (colKey === 'daily_run_rate') {
    display = <span style={{ color: '#a78bfa' }}>{col.fmt(val)}</span>
  } else if (colKey === 'forecast_30d') {
    display = <span style={{ color: '#f472b6' }}>{col.fmt(val)}</span>
  } else {
    display = <span style={{ fontWeight: isTotals ? 600 : 400 }}>{col.fmt(val)}</span>
  }

  return (
    <td className="gf-num gf-col-r" style={isTotals ? { background: 'rgba(240,180,41,0.04)', borderTop: '1px solid rgba(240,180,41,0.15)' } : undefined}>
      <div>{display}</div>
      {!isTotals && showComp && pct != null && (
        <div style={{ fontSize: 9, marginTop: 2, color: good ? '#00dba4' : '#ff4d6d', fontFamily: 'var(--mono)', textAlign: 'right' }}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
        </div>
      )}
      {!isTotals && showComp && pct == null && prevVal == null && val != null && (
        <div style={{ fontSize: 9, marginTop: 2, color: '#64a0f0', fontFamily: 'var(--mono)', textAlign: 'right' }}>new</div>
      )}
    </td>
  )
}

export default function ProductsPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [datePreset, setDatePreset] = useState('30d')
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [customEnd,   setCustomEnd]   = useState(() => new Date().toISOString().slice(0, 10))
  const [comboMode, setComboMode] = useState('sales_spend')
  const [sortCol, setSortCol] = useState('cost')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchQ, setSearchQ] = useState('')
  const [refetchKey, setRefetchKey] = useState(0)
  const [showProdComp, setShowProdComp] = useState(false)
  const [visibleProdCols, setVisibleProdCols] = useState<Set<string>>(DEFAULT_PROD_COLS)
  const [prodPickerOpen, setProdPickerOpen] = useState(false)
  const prodPickerRef = useRef<HTMLDivElement>(null)
  const [prodView, setProdView] = useState<'summary' | 'daily'>('summary')
  const [dailySortCol, setDailySortCol] = useState('metric_date')
  const [dailySortDir, setDailySortDir] = useState<'asc' | 'desc'>('desc')
  const [dailySearchQ, setDailySearchQ] = useState('')

  useEffect(() => {
    const h = (e: MouseEvent) => { if (prodPickerRef.current && !prodPickerRef.current.contains(e.target as Node)) setProdPickerOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const dates = useMemo(() => {
    if (datePreset === 'custom') return { start_date: customStart, end_date: customEnd }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const days = useMemo(() => {
    const start = new Date(dates.start_date); const end = new Date(dates.end_date)
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  }, [dates])

  const prevDates = useMemo(() => {
    const start = new Date(dates.start_date)
    const pe = new Date(start); pe.setDate(pe.getDate() - 1)
    const ps = new Date(pe);    ps.setDate(ps.getDate() - days + 1)
    const f = (d: Date) => d.toISOString().slice(0, 10)
    return { start_date: f(ps), end_date: f(pe) }
  }, [dates, days])

  const { data: rawProducts = [], isFetching } = useGetProductsQuery({ ...dates, limit: 100 }, { refetchOnMountOrArgChange: refetchKey > 0 })
  const { data: prevRawProducts = [] } = useGetProductsQuery({ ...prevDates, limit: 200 }, { skip: !showProdComp })
  const { data: rawDailyProducts = [], isFetching: isDailyFetching } = useGetProductsDailyQuery({ ...dates, limit: 2000 }, { skip: prodView !== 'daily' })
  const { data: metrics, isLoading: loadingMetrics } = useGetMetricsQuery(dates)
  const { data: unreadData } = useGetUnreadCountQuery()
  const unread = unreadData?.count ?? 0

  const prevProdMap = useMemo(() => {
    const m = new Map<string, any>()
    prevRawProducts.forEach((p: any) => { if (!m.has(p.advertised_asin || '')) m.set(p.advertised_asin || '', { ...p, _days: days }) })
    return m
  }, [prevRawProducts, days])

  const portfolioRow = useMemo(() => {
    const tot: any = { impressions: 0, clicks: 0, cost: 0, sales_14d: 0, purchases_14d: 0, units_sold: 0, acos: null as number | null, campaigns_count: null, _days: days }
    rawProducts.forEach((p: any) => {
      tot.impressions   += p.impressions    || 0
      tot.clicks        += p.clicks         || 0
      tot.cost          += p.cost           || 0
      tot.sales_14d     += p.sales_14d      || 0
      tot.purchases_14d += p.purchases_14d  || 0
      tot.units_sold    += p.units_sold     || 0
    })
    if (tot.sales_14d > 0) tot.acos = tot.cost / tot.sales_14d
    return tot
  }, [rawProducts, days])

  const prevPortfolioRow = useMemo(() => {
    const tot: any = { impressions: 0, clicks: 0, cost: 0, sales_14d: 0, purchases_14d: 0, units_sold: 0, acos: null as number | null, campaigns_count: null, _days: days }
    prevRawProducts.forEach((p: any) => {
      tot.impressions   += p.impressions    || 0
      tot.clicks        += p.clicks         || 0
      tot.cost          += p.cost           || 0
      tot.sales_14d     += p.sales_14d      || 0
      tot.purchases_14d += p.purchases_14d  || 0
      tot.units_sold    += p.units_sold     || 0
    })
    if (tot.sales_14d > 0) tot.acos = tot.cost / tot.sales_14d
    return tot
  }, [prevRawProducts, days])

  const toggleProdCol = (key: string) => setVisibleProdCols(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })
  const visibleProdColDefs = PROD_COL_DEFS.filter(c => visibleProdCols.has(c.key))

  const products = useMemo(() => {
    const enriched = rawProducts.map((p: any) => ({ ...p, _days: days }))
    if (!searchQ) return enriched
    const q = searchQ.toLowerCase()
    return enriched.filter((p: any) => (p.advertised_asin || '').toLowerCase().includes(q) || (p.advertised_sku || '').toLowerCase().includes(q))
  }, [rawProducts, searchQ, days])

  const sortedProducts = useMemo(() => {
    const colDef = PROD_COL_DEFS.find(c => c.key === sortCol)
    return [...products].sort((a: any, b: any) => {
      const va = colDef ? (colDef.getText(a) ?? 0) : (a[sortCol] ?? 0)
      const vb = colDef ? (colDef.getText(b) ?? 0) : (b[sortCol] ?? 0)
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [products, sortCol, sortDir])

  const handleSort = (col: string) => {
    if (col === sortCol) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const handleDailySort = (col: string) => {
    if (col === dailySortCol) setDailySortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setDailySortCol(col); setDailySortDir('desc') }
  }

  function exportCSV() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const headers = ['ASIN', 'SKU', ...visibleProdColDefs.map(c => c.label)].map(esc)
    const csvRows = sortedProducts.map((p: any) => [
      p.advertised_asin || '', p.advertised_sku || '',
      ...visibleProdColDefs.map(c => { const v = c.getText(p); return v != null ? c.fmt(v) : '' }),
    ].map(v => esc(String(v))))
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filteredDailyProducts = useMemo(() => {
    const enriched = rawDailyProducts.map((p: any) => ({ ...p, _days: 1 }))
    if (!dailySearchQ) return enriched
    const q = dailySearchQ.toLowerCase()
    return enriched.filter((p: any) =>
      (p.advertised_asin || '').toLowerCase().includes(q) ||
      (p.advertised_sku || '').toLowerCase().includes(q) ||
      (p.metric_date || '').includes(q)
    )
  }, [rawDailyProducts, dailySearchQ])

  const sortedDailyProducts = useMemo(() => {
    if (dailySortCol === 'metric_date') {
      return [...filteredDailyProducts].sort((a: any, b: any) => {
        const cmp = a.metric_date < b.metric_date ? -1 : a.metric_date > b.metric_date ? 1 : 0
        return dailySortDir === 'desc' ? -cmp : cmp
      })
    }
    const colDef = PROD_COL_DEFS.find(c => c.key === dailySortCol)
    return [...filteredDailyProducts].sort((a: any, b: any) => {
      const va = colDef ? (colDef.getText(a) ?? 0) : (a[dailySortCol] ?? 0)
      const vb = colDef ? (colDef.getText(b) ?? 0) : (b[dailySortCol] ?? 0)
      return dailySortDir === 'desc' ? vb - va : va - vb
    })
  }, [filteredDailyProducts, dailySortCol, dailySortDir])

  const totalSpend = rawProducts.reduce((s: number, p: any) => s + (p.cost || 0), 0)
  const totalSales = rawProducts.reduce((s: number, p: any) => s + (p.sales_14d || 0), 0)
  const totalUnits = rawProducts.reduce((s: number, p: any) => s + (p.units_sold || 0), 0)
  const totalPurchases = rawProducts.reduce((s: number, p: any) => s + (p.purchases_14d || 0), 0)
  const avgAcos = totalSales > 0 ? totalSpend / totalSales : null
  const avgRoas = totalSpend > 0 ? totalSales / totalSpend : null

  const combo = COMBO_MODES.find(c => c.id === comboMode) ?? COMBO_MODES[0]

  const top10 = useMemo(() => {
    const cm = COMBO_MODES.find(c => c.id === comboMode) ?? COMBO_MODES[0]
    return [...rawProducts]
      .filter((p: any) => (p[cm.key1] || 0) > 0 || (p[cm.key2] || 0) > 0)
      .sort((a: any, b: any) => (b[cm.key1] || 0) - (a[cm.key1] || 0))
      .slice(0, 10)
      .map((p: any) => ({
        asin: p.advertised_asin || '—',
        sku:  p.advertised_sku  || '',
        v1: p[cm.key1] || 0,
        v2: p[cm.key2] || 0,
        acos: p.acos,
        roas: (p.cost || 0) > 0 ? (p.sales_14d || 0) / p.cost : null,
      }))
  }, [rawProducts, comboMode])

  const subtitle = `${dates.start_date} — ${dates.end_date} · ${rawProducts.length} products`

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-shell${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Product Analytics" subtitle={subtitle} unread={unread} onRefresh={() => setRefetchKey(k => k + 1)} onMenuToggle={() => setNavOpen(o => !o)} postActions={<button className="gf-btn gf-btn-ghost" onClick={exportCSV}><Icon name="download" size={13} />Export</button>} />
        <div className="gf-content">

          {/* Section 1: Filter Bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Icon name="calendar" size={14} />
            <select className="gf-select" value={datePreset} onChange={e => setDatePreset(e.target.value)}>
              {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {datePreset === 'custom' && (
              <>
                <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)}
                  style={{ height: 34, padding: '0 8px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', outline: 'none', minWidth: 130, colorScheme: 'dark' }} />
                <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--mono)' }}>→</span>
                <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)}
                  style={{ height: 34, padding: '0 8px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', outline: 'none', minWidth: 130, colorScheme: 'dark' }} />
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', flex: 1, maxWidth: 300 }}>
              <Icon name="search" size={13} />
              <input
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 12, fontFamily: 'inherit', width: '100%' }}
                placeholder="Search ASIN or SKU..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>
            {isFetching && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="gf-live-dot" />
              Last updated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
            </div>
          </div>

          {/* Section 2: Scoreboard */}
          <Scoreboard metrics={metrics} dates={dates} defaultSlots={['sales','total_cost','acos','roas','purchases','impressions']} isLoading={loadingMetrics} />

          {/* Section 3: Top Products Dual-Metric Chart */}
          <div className="gf-card">

            {/* Header + combo selector */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="gf-card-title">Top Products Performance</div>
                <div className="gf-card-sub">Top 10 ASINs · <span style={{ color: combo.col1 }}>{combo.lbl1}</span> vs <span style={{ color: combo.col2 }}>{combo.lbl2}</span> · sorted by primary metric</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {COMBO_MODES.map(cm => (
                  <button key={cm.id} onClick={() => setComboMode(cm.id)} style={{
                    padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10,
                    border: comboMode === cm.id ? `1px solid ${cm.col1}` : '1px solid var(--border)',
                    background: comboMode === cm.id ? cm.col1 + '18' : 'var(--bg)',
                    color: comboMode === cm.id ? cm.col1 : 'var(--text-3)',
                    fontWeight: comboMode === cm.id ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {cm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {[{ col: combo.col1, lbl: combo.lbl1 }, { col: combo.col2, lbl: combo.lbl2 }].map(l => (
                <div key={l.lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 28, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${l.col}60, ${l.col})` }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)' }}>{l.lbl}</span>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {top10.length === 0 ? (
              <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" />
                </svg>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>No product-level data available</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Fetch a product ads report (grain: product_ad) to see per-ASIN performance</div>
              </div>
            ) : (() => {
              const totalV1 = top10.reduce((s, r) => s + r.v1, 0) || 1
              const totalV2 = top10.reduce((s, r) => s + r.v2, 0) || 1

              const chartData = top10.map((r, i) => ({
                label: r.asin,
                fullAsin: r.asin,
                sku: r.sku,
                rank: i + 1,
                v1: r.v1,
                v2: r.v2,
                pct1: Math.round((r.v1 / totalV1) * 100),
                pct2: Math.round((r.v2 / totalV2) * 100),
                roas: r.roas,
                acos: r.acos,
              }))

              const yFmt = (v: number) => {
                if (v === 0) return '₹0'
                if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L'
                if (v >= 1e3) return '₹' + (v / 1e3).toFixed(0) + 'K'
                return '₹' + Math.round(v)
              }

              const renderPctLabel = (color: string) => (props: any) => {
                const { x, y, width, value } = props
                if (!value || value < 2) return null
                return (
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Number(y) - 5}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="var(--mono)"
                    fill={color}
                    fontWeight="700"
                  >
                    {value}%
                  </text>
                )
              }

              const CustomXTick = ({ x, y, payload }: any) => {
                const row = chartData.find(d => d.label === payload.value)
                const roasVal = row?.roas ?? null
                const rc = roasVal == null ? 'var(--text-3)'
                  : roasVal >= 4 ? '#00dba4'
                  : roasVal >= 2 ? '#f0b429'
                  : '#ff4d6d'
                const asin = payload.value as string
                const sku  = row?.sku ?? ''
                const skuShort = sku.length > 10 ? sku.slice(0, 10) + '…' : sku
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text textAnchor="middle" fill="rgba(180,210,255,0.55)" fontSize={9} fontFamily="JetBrains Mono, monospace" dy={12}>
                      {asin}
                    </text>
                    {skuShort && (
                      <text textAnchor="middle" fill="rgba(180,210,255,0.30)" fontSize={8} fontFamily="JetBrains Mono, monospace" dy={23}>
                        {skuShort}
                      </text>
                    )}
                    {roasVal != null && (
                      <text textAnchor="middle" fill={rc} fontSize={9} fontFamily="var(--mono)" fontWeight="700" dy={34}>
                        {roasVal.toFixed(1)}×
                      </text>
                    )}
                  </g>
                )
              }

              const TooltipContent = ({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const row = chartData.find(d => d.label === label)
                return (
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                    minWidth: 160,
                  }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.03em' }}>
                      {row?.fullAsin ?? label}
                    </div>
                    {payload.map((p: any, idx: number) => {
                      const pct = idx === 0 ? row?.pct1 : row?.pct2
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: idx < payload.length - 1 ? 5 : 0 }}>
                          <span style={{
                            background: p.fill, color: '#0a0f1a',
                            padding: '2px 8px', borderRadius: 5,
                            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                          }}>{p.name}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: p.fill, fontWeight: 700 }}>
                            {idx === 0 ? combo.fmt1(p.value) : combo.fmt2(p.value)}
                          </span>
                          {pct != null && pct >= 1 && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', background: 'rgba(100,160,240,0.1)', borderRadius: 4, padding: '1px 5px' }}>
                              {pct}% of total
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              }

              return (
                <div>
                  {/* Grouped bar chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 22, right: 12, bottom: 6, left: 4 }}
                      barCategoryGap="28%"
                      barGap={3}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(100,160,240,0.07)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={<CustomXTick />}
                        axisLine={false}
                        tickLine={false}
                        height={58}
                      />
                      <YAxis
                        tickFormatter={yFmt}
                        tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'var(--mono)' }}
                        axisLine={false}
                        tickLine={false}
                        width={54}
                      />
                      <Tooltip
                        content={<TooltipContent />}
                        cursor={{ fill: 'rgba(100,160,240,0.05)', radius: 4 } as any}
                      />
                      <Bar dataKey="v1" name={combo.lbl1} fill={combo.col1} radius={[4, 4, 0, 0]} maxBarSize={38}>
                        <LabelList dataKey="pct1" content={renderPctLabel(combo.col1)} />
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={combo.col1} fillOpacity={0.88 + (i === 0 ? 0.12 : 0)} />
                        ))}
                      </Bar>
                      <Bar dataKey="v2" name={combo.lbl2} fill={combo.col2} radius={[4, 4, 0, 0]} maxBarSize={38}>
                        <LabelList dataKey="pct2" content={renderPctLabel(combo.col2)} />
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={combo.col2} fillOpacity={0.88 + (i === 0 ? 0.12 : 0)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Bottom data table — mirrors the chart columns */}
                  <div style={{ marginTop: 8, borderTop: '1px solid rgba(100,160,240,0.1)' }}>
                    {/* Metric 1 row */}
                    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(100,160,240,0.06)' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                        width: 110, padding: '8px 12px',
                        background: combo.col1 + '14', borderRight: `2px solid ${combo.col1}30`,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={combo.col1} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                        </svg>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: combo.col1, fontWeight: 700 }}>{combo.lbl1}</span>
                      </div>
                      {chartData.map((r, i) => (
                        <div key={i} style={{
                          flex: 1, padding: '8px 4px', textAlign: 'center',
                          borderRight: i < chartData.length - 1 ? '1px solid rgba(100,160,240,0.05)' : 'none',
                          background: i % 2 === 0 ? 'rgba(100,160,240,0.015)' : 'transparent',
                        }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-1)', fontWeight: 600 }}>{combo.fmt1(r.v1)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Metric 2 row */}
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                        width: 110, padding: '8px 12px',
                        background: combo.col2 + '14', borderRight: `2px solid ${combo.col2}30`,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={combo.col2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                        </svg>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: combo.col2, fontWeight: 700 }}>{combo.lbl2}</span>
                      </div>
                      {chartData.map((r, i) => (
                        <div key={i} style={{
                          flex: 1, padding: '8px 4px', textAlign: 'center',
                          borderRight: i < chartData.length - 1 ? '1px solid rgba(100,160,240,0.05)' : 'none',
                          background: i % 2 === 0 ? 'rgba(100,160,240,0.015)' : 'transparent',
                        }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-1)', fontWeight: 600 }}>{combo.fmt2(r.v2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Section 4: All Products Table — upgraded */}
          <div className="gf-card" style={{ padding: 0 }}>

            {/* Toolbar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <span className="gf-card-title" style={{ margin: 0 }}>All Products</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginLeft: 10 }}>
                  {prodView === 'summary' ? `${products.length} ASINs · grain: product_ad` : `${sortedDailyProducts.length} rows · date × ASIN`}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              {(isFetching || isDailyFetching) && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</span>}

              {/* View toggle */}
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {(['summary', 'daily'] as const).map(v => (
                  <button key={v} onClick={() => setProdView(v)} style={{
                    padding: '5px 13px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                    border: 'none',
                    background: prodView === v ? 'var(--surface)' : 'transparent',
                    color: prodView === v ? 'var(--accent)' : 'var(--text-3)',
                    fontWeight: prodView === v ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {v === 'summary' ? 'ASIN Summary' : 'Date-wise'}
                  </button>
                ))}
              </div>

              {/* Compare toggle — only in summary view */}
              {prodView === 'summary' && (
                <button onClick={() => setShowProdComp(v => !v)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                  border: showProdComp ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: showProdComp ? 'rgba(240,180,41,0.12)' : 'var(--bg)',
                  color: showProdComp ? 'var(--accent)' : 'var(--text-3)',
                  fontWeight: showProdComp ? 700 : 400, transition: 'all 0.15s',
                }}>
                  Compare {showProdComp ? 'ON' : 'OFF'}
                </button>
              )}

              {/* Column picker */}
              <div ref={prodPickerRef} style={{ position: 'relative' }}>
                <button onClick={() => setProdPickerOpen(v => !v)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                  border: '1px solid var(--border)', background: prodPickerOpen ? 'var(--surface)' : 'var(--bg)',
                  color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  Columns <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
                </button>
                {prodPickerOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 4px', minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div style={{ padding: '2px 12px 8px', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>VISIBLE COLUMNS</div>
                    {PROD_COL_DEFS.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,160,240,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <input type="checkbox" checked={visibleProdCols.has(col.key)} onChange={() => toggleProdCol(col.key)} style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: visibleProdCols.has(col.key) ? 'var(--text-1)' : 'var(--text-3)' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Compare period banner — summary only */}
            {prodView === 'summary' && showProdComp && (
              <div style={{ padding: '6px 20px', background: 'rgba(240,180,41,0.05)', borderBottom: '1px solid rgba(240,180,41,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>COMPARING</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{dates.start_date} – {dates.end_date}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>vs</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{prevDates.start_date} – {prevDates.end_date}</span>
              </div>
            )}

            {/* Daily view search bar */}
            {prodView === 'daily' && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="search" size={13} />
                <input
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 12, fontFamily: 'inherit', flex: 1 }}
                  placeholder="Filter by ASIN, SKU or date…"
                  value={dailySearchQ}
                  onChange={e => setDailySearchQ(e.target.value)}
                />
                {dailySearchQ && (
                  <button onClick={() => setDailySearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, lineHeight: 1 }}>✕</button>
                )}
              </div>
            )}

            {/* ASIN Summary table */}
            {prodView === 'summary' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32, cursor: 'default' }}>#</th>
                      <th style={{ cursor: 'default', minWidth: 200 }}>ASIN / SKU</th>
                      {visibleProdColDefs.map(col => (
                        <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          {col.label}{sortCol === col.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Portfolio totals row */}
                    {rawProducts.length > 0 && (
                      <tr>
                        <td style={{ background: 'rgba(240,180,41,0.04)', borderTop: '1px solid rgba(240,180,41,0.15)' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)', opacity: 0.8 }}>∑</span>
                        </td>
                        <td style={{ background: 'rgba(240,180,41,0.04)', borderTop: '1px solid rgba(240,180,41,0.15)' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>PORTFOLIO TOTAL</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{rawProducts.length} products</div>
                        </td>
                        {visibleProdColDefs.map(col => (
                          <ProdMetricCell key={col.key} colKey={col.key} curr={portfolioRow}
                            prev={showProdComp ? prevPortfolioRow : null} showComp={showProdComp} isTotals />
                        ))}
                      </tr>
                    )}

                    {sortedProducts.length === 0 && (
                      <tr><td colSpan={2 + visibleProdColDefs.length} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 28, fontFamily: 'var(--mono)', fontSize: 12 }}>No products found for this date range</td></tr>
                    )}

                    {sortedProducts.map((p: any, i: number) => {
                      const prev = showProdComp ? (prevProdMap.get(p.advertised_asin || '') ?? null) : null
                      const roas = (p.cost || 0) > 0 ? (p.sales_14d || 0) / p.cost : null
                      const roasColor = roas != null ? (roas >= 4 ? '#00dba4' : roas >= 2 ? '#f0b429' : '#ff4d6d') : 'var(--text-3)'
                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-3)', width: 32, fontFamily: 'var(--mono)', fontSize: 11 }}>{i + 1}</td>
                          <td style={{ minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: 600 }}>
                                  {p.advertised_asin || '—'}
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                                  {p.advertised_sku || '—'}
                                </div>
                              </div>
                              {roas != null && (
                                <span style={{ marginLeft: 4, fontFamily: 'var(--mono)', fontSize: 9, color: roasColor, opacity: 0.85 }}>
                                  {roas.toFixed(1)}×
                                </span>
                              )}
                            </div>
                          </td>
                          {visibleProdColDefs.map(col => (
                            <ProdMetricCell key={col.key} colKey={col.key} curr={p} prev={prev} showComp={showProdComp} />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Date-wise table */}
            {prodView === 'daily' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleDailySort('metric_date')} style={{ cursor: 'pointer', minWidth: 100 }}>
                        Date{dailySortCol === 'metric_date' ? (dailySortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                      </th>
                      <th style={{ cursor: 'default', minWidth: 180 }}>ASIN / SKU</th>
                      {visibleProdColDefs.map(col => (
                        <th key={col.key} onClick={() => handleDailySort(col.key)} style={{ cursor: 'pointer', textAlign: 'right' }}>
                          {col.label}{dailySortCol === col.key ? (dailySortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isDailyFetching && (
                      <tr><td colSpan={2 + visibleProdColDefs.length} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 28, fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</td></tr>
                    )}
                    {!isDailyFetching && sortedDailyProducts.length === 0 && (
                      <tr>
                        <td colSpan={2 + visibleProdColDefs.length} style={{ textAlign: 'center', padding: '36px 20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>No date-wise product data available</span>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Fetch a product_ad report to see daily ASIN performance</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isDailyFetching && sortedDailyProducts.map((p: any, i: number) => {
                      const roas = (p.cost || 0) > 0 ? (p.sales_14d || 0) / p.cost : null
                      const roasColor = roas != null ? (roas >= 4 ? '#00dba4' : roas >= 2 ? '#f0b429' : '#ff4d6d') : 'var(--text-3)'
                      return (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                            {p.metric_date}
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: 600 }}>
                                  {p.advertised_asin || '—'}
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                                  {p.advertised_sku || '—'}
                                </div>
                              </div>
                              {roas != null && (
                                <span style={{ marginLeft: 4, fontFamily: 'var(--mono)', fontSize: 9, color: roasColor, opacity: 0.85 }}>
                                  {roas.toFixed(1)}×
                                </span>
                              )}
                            </div>
                          </td>
                          {visibleProdColDefs.map(col => (
                            <ProdMetricCell key={col.key} colKey={col.key} curr={p} prev={null} showComp={false} />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Portfolio ROAS/ACOS Context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div className="gf-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div className="gf-metric-label">PORTFOLIO ACOS</div>
              <div className={`gf-metric-value${avgAcos != null ? ' ' + acosTone(avgAcos) : ''}`} style={{ fontSize: 32, marginTop: 6 }}>
                {avgAcos != null ? (avgAcos * 100).toFixed(1) + '%' : '—'}
              </div>
              <div className="gf-metric-sub" style={{ marginTop: 4 }}>Across {rawProducts.length} products</div>
            </div>
            <div className="gf-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div className="gf-metric-label">PORTFOLIO ROAS</div>
              <div className="gf-metric-value" style={{ fontSize: 32, marginTop: 6, color: 'var(--good)' }}>
                {avgRoas != null ? avgRoas.toFixed(2) + '×' : '—'}
              </div>
              <div className="gf-metric-sub" style={{ marginTop: 4 }}>{fmtCur(totalSales)} sales on {fmtCur(totalSpend)} spend</div>
            </div>
            <div className="gf-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div className="gf-metric-label">COST PER UNIT</div>
              <div className="gf-metric-value" style={{ fontSize: 32, marginTop: 6 }}>
                {totalUnits > 0 ? fmtCur(totalSpend / totalUnits) : '—'}
              </div>
              <div className="gf-metric-sub" style={{ marginTop: 4 }}>{fmtNum(totalUnits)} units · {fmtNum(totalPurchases)} orders</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
