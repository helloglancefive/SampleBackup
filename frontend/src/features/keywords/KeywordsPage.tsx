import { useState, useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import '../dashboard/DashboardPage.css'
import Scoreboard from '../../components/Scoreboard'
import {
  useGetMetricsQuery,
  useGetKeywordsQuery,
  useGetSearchTermsQuery,
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
const SORT_OPTIONS = [
  { value: 'cost',        label: 'By Spend' },
  { value: 'sales',       label: 'By Sales' },
  { value: 'clicks',      label: 'By Clicks' },
  { value: 'impressions', label: 'By Impressions' },
  { value: 'acos',        label: 'By ACOS' },
]

const SUB_COLORS: Record<string, string> = {
  'Keyword · Exact':     '#6c8cff',
  'Keyword · Phrase':    '#f0b429',
  'Keyword · Broad':     '#ff6b8e',
  'Product · ASIN':      '#00dba4',
  'Product · Category':  '#a78bfa',
  'Auto Targeting':      '#94a3b8',
  'Audience · Views':    '#f97316',
  'Audience · Purchase': '#ec4899',
}

const TGT_COLORS: Record<string, string> = {
  Keyword:  '#f0b429',
  Product:  '#00dba4',
  Audience: '#a78bfa',
  Auto:     '#60a5fa',
}

function roasTone(v: number) {
  if (v >= 4) return { color: '#00dba4', bg: 'rgba(0,219,164,0.12)' }
  if (v >= 2) return { color: '#f0b429', bg: 'rgba(240,180,41,0.10)' }
  return         { color: '#ff4d6d', bg: 'rgba(255,77,109,0.10)' }
}

function getMatchGroup(matchType: string | null): { group: string; sub: string } {
  const mt = (matchType || '').toLowerCase()
  if (mt === 'exact')  return { group: 'Keyword', sub: 'Keyword · Exact'  }
  if (mt === 'phrase') return { group: 'Keyword', sub: 'Keyword · Phrase' }
  if (mt === 'broad')  return { group: 'Keyword', sub: 'Keyword · Broad'  }
  if (mt === 'targeting_expression')            return { group: 'Product',  sub: 'Product · ASIN'     }
  if (mt === 'targeting_expression_predefined') return { group: 'Product',  sub: 'Product · Category' }
  if (mt.includes('view'))     return { group: 'Audience', sub: 'Audience · Views'    }
  if (mt.includes('purchase')) return { group: 'Audience', sub: 'Audience · Purchase' }
  return { group: 'Auto', sub: 'Auto Targeting' }
}

// ── Table Column Definitions ──────────────────────────────────
const KW_COL_DEFS = [
  { key: 'impressions',   label: 'Impr.',       sortable: true,  invertGood: false, getText: (k: any) => k.impressions    ?? null,               fmt: (v: number) => fmtNum(v) },
  { key: 'clicks',        label: 'Clicks',      sortable: true,  invertGood: false, getText: (k: any) => k.clicks         ?? null,               fmt: (v: number) => fmtNum(v) },
  { key: 'cost',          label: 'Spend',       sortable: true,  invertGood: true,  getText: (k: any) => k.cost           ?? null,               fmt: (v: number) => fmtCur(v) },
  { key: 'sales_14d',     label: 'Sales (14d)', sortable: true,  invertGood: false, getText: (k: any) => k.sales_14d      ?? null,               fmt: (v: number) => fmtCur(v) },
  { key: 'acos',          label: 'ACoS',        sortable: true,  invertGood: true,  getText: (k: any) => k.acos           ?? null,               fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'conv_rate',     label: 'Conv%',       sortable: false, invertGood: false, getText: (k: any) => k.conv_rate      ?? null,               fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'purchases_14d', label: 'Orders',      sortable: true,  invertGood: false, getText: (k: any) => k.purchases_14d  ?? null,               fmt: (v: number) => fmtNum(v) },
  { key: 'cpc',           label: 'CPC',         sortable: false, invertGood: true,  getText: (k: any) => k.clicks > 0 ? k.cost / k.clicks : null, fmt: (v: number) => fmtCur(v) },
  { key: 'ctr',           label: 'CTR',         sortable: false, invertGood: false, getText: (k: any) => k.impressions > 0 ? k.clicks / k.impressions : null, fmt: (v: number) => (v * 100).toFixed(2) + '%' },
  { key: 'roas',          label: 'ROAS',        sortable: false, invertGood: false, getText: (k: any) => k.cost > 0 ? (k.sales_14d ?? 0) / k.cost : null,     fmt: (v: number) => v.toFixed(2) + '×' },
]
const DEFAULT_KW_COLS = new Set(['impressions', 'clicks', 'cost', 'sales_14d', 'acos', 'conv_rate', 'purchases_14d'])

function KwMetricCell({ colKey, curr, prev, showComp }: { colKey: string; curr: any; prev: any | null; showComp: boolean }) {
  const col = KW_COL_DEFS.find(c => c.key === colKey)!
  const val    = col.getText(curr)
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
    display = <span style={{ color: val >= 1 ? 'var(--good)' : 'var(--bad)' }}>{val.toFixed(2)}×</span>
  } else if (colKey === 'cost') {
    display = <span style={{ color: 'var(--accent)' }}>{col.fmt(val)}</span>
  } else if (colKey === 'sales_14d') {
    display = <span style={{ color: 'var(--good)' }}>{col.fmt(val)}</span>
  } else {
    display = <span>{col.fmt(val)}</span>
  }

  return (
    <td className="gf-num gf-col-r">
      <div>{display}</div>
      {showComp && pct != null && (
        <div style={{ fontSize: 9, marginTop: 2, color: good ? '#00dba4' : '#ff4d6d', fontFamily: 'var(--mono)', textAlign: 'right' }}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
        </div>
      )}
      {showComp && pct == null && prevVal == null && val != null && (
        <div style={{ fontSize: 9, marginTop: 2, color: '#64a0f0', fontFamily: 'var(--mono)', textAlign: 'right' }}>new</div>
      )}
    </td>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function KeywordsPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [datePreset, setDatePreset] = useState('30d')
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [customEnd,   setCustomEnd]   = useState(() => new Date().toISOString().slice(0, 10))
  const [sortBy, setSortBy] = useState('cost')
  const [activeTab, setActiveTab] = useState<'keywords' | 'search_terms'>('keywords')
  const [searchQ, setSearchQ] = useState('')
  const [kwSortCol, setKwSortCol] = useState<string>('cost')
  const [kwSortDir, setKwSortDir] = useState<'asc' | 'desc'>('desc')
  const [refetchKey, setRefetchKey] = useState(0)
  const [showComparison, setShowComparison] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_KW_COLS)
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setColPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const dates = useMemo(() => {
    if (datePreset === 'custom') return { start_date: customStart, end_date: customEnd }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const prevDates = useMemo(() => {
    const start = new Date(dates.start_date)
    const end   = new Date(dates.end_date)
    const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)
    const f = (d: Date) => d.toISOString().slice(0, 10)
    return { start_date: f(prevStart), end_date: f(prevEnd) }
  }, [dates])

  const { data: metrics, isLoading: loadingMetrics } = useGetMetricsQuery(dates)
  const { data: rawKeywords = [], isFetching: kwLoading } = useGetKeywordsQuery({ ...dates, sort_by: sortBy, limit: 100 }, { refetchOnMountOrArgChange: refetchKey > 0 })
  const { data: rawSearchTerms = [], isFetching: stLoading } = useGetSearchTermsQuery({ ...dates, sort_by: sortBy, limit: 100 }, { refetchOnMountOrArgChange: refetchKey > 0 })
  const { data: prevRawKeywords = [] } = useGetKeywordsQuery({ ...prevDates, sort_by: sortBy, limit: 200 }, { skip: !showComparison })
  const { data: prevRawSearchTerms = [] } = useGetSearchTermsQuery({ ...prevDates, sort_by: sortBy, limit: 200 }, { skip: !showComparison })
  const { data: unreadData } = useGetUnreadCountQuery()
  const unread = unreadData?.count ?? 0

  const keywords = useMemo(() => {
    if (!searchQ) return rawKeywords
    const q = searchQ.toLowerCase()
    return rawKeywords.filter((r: any) => (r.keyword || '').toLowerCase().includes(q) || (r.match_type || '').toLowerCase().includes(q))
  }, [rawKeywords, searchQ])

  const searchTerms = useMemo(() => {
    if (!searchQ) return rawSearchTerms
    const q = searchQ.toLowerCase()
    return rawSearchTerms.filter((r: any) => (r.search_term || '').toLowerCase().includes(q))
  }, [rawSearchTerms, searchQ])

  const prevKwMap = useMemo(() => {
    const m = new Map<string, any>()
    prevRawKeywords.forEach((k: any) => {
      // unique key: keyword+match_type for keywords, targeting_text+match_type for product targets
      const key = (k.keyword || k.targeting_text || '') + '|' + (k.match_type || '')
      if (!m.has(key)) m.set(key, k)
    })
    return m
  }, [prevRawKeywords])

  const prevStMap = useMemo(() => {
    const m = new Map<string, any>()
    prevRawSearchTerms.forEach((s: any) => { if (!m.has(s.search_term || '')) m.set(s.search_term || '', s) })
    return m
  }, [prevRawSearchTerms])

  const toggleCol = (key: string) => setVisibleCols(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const visibleColDefs = KW_COL_DEFS.filter(c => visibleCols.has(c.key))

  const sortedKeywords = useMemo(() => {
    const colDef = KW_COL_DEFS.find(c => c.key === kwSortCol)
    return [...keywords].sort((a: any, b: any) => {
      const va = colDef ? (colDef.getText(a) ?? 0) : (a[kwSortCol] ?? 0)
      const vb = colDef ? (colDef.getText(b) ?? 0) : (b[kwSortCol] ?? 0)
      return kwSortDir === 'desc' ? vb - va : va - vb
    })
  }, [keywords, kwSortCol, kwSortDir])

  // Match type distribution
  const targetingBreakdown = useMemo(() => {
    const groups: Record<string, { spend: number; sales: number; cnt: number }> = {}
    const subs: Record<string, { spend: number; sales: number; cnt: number; group: string }> = {}
    rawKeywords.forEach((k: any) => {
      const { group, sub } = getMatchGroup(k.match_type)
      const spend = k.cost || 0
      const sales = k.sales_14d || 0
      if (!groups[group]) groups[group] = { spend: 0, sales: 0, cnt: 0 }
      groups[group].spend += spend
      groups[group].sales += sales
      groups[group].cnt += 1
      if (!subs[sub]) subs[sub] = { spend: 0, sales: 0, cnt: 0, group }
      subs[sub].spend += spend
      subs[sub].sales += sales
      subs[sub].cnt += 1
    })
    const totalSpend = Object.values(groups).reduce((s, g) => s + g.spend, 0)
    const totalSales = Object.values(groups).reduce((s, g) => s + g.sales, 0)
    const groupRows = ['Keyword', 'Product', 'Audience', 'Auto']
      .filter(g => groups[g])
      .map(g => ({
        name: g, label: g + ' Targeting',
        ...groups[g],
        roas: groups[g].spend > 0 ? groups[g].sales / groups[g].spend : null,
        spendPct: totalSpend > 0 ? (groups[g].spend / totalSpend) * 100 : 0,
        salesPct: totalSales > 0 ? (groups[g].sales / totalSales) * 100 : 0,
      }))
    const subRows = Object.entries(subs)
      .sort((a, b) => b[1].spend - a[1].spend)
      .map(([sub, v]) => ({
        sub, ...v,
        roas: v.spend > 0 ? v.sales / v.spend : null,
        acos: v.sales > 0 ? (v.spend / v.sales) * 100 : null,
        spendPct: totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0,
        salesPct: totalSales > 0 ? (v.sales / totalSales) * 100 : 0,
      }))
    const maxSubSpend = Math.max(...subRows.map(r => r.spend), 0.01)
    const maxSubSales = Math.max(...subRows.map(r => r.sales), 0.01)
    return {
      groupRows, subRows, totalSpend, totalSales, maxSubSpend, maxSubSales,
      totalRoas: totalSpend > 0 ? totalSales / totalSpend : null,
    }
  }, [rawKeywords])

  const handleSort = (col: string) => {
    if (col === kwSortCol) setKwSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setKwSortCol(col); setKwSortDir('desc') }
  }

  function exportCSV() {
    const isKw = activeTab === 'keywords'
    const rows = isKw ? sortedKeywords : searchTerms
    const filename = isKw ? 'keywords.csv' : 'search-terms.csv'
    const idCol = isKw ? 'Keyword' : 'Search Term'
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const headers = [idCol, 'Match Type', ...visibleColDefs.map(c => c.label)].map(esc)
    const csvRows = rows.map((r: any) => {
      const id = isKw ? (r.keyword || r.targeting_text || '') : (r.search_term || '')
      return [id, r.match_type || '', ...visibleColDefs.map(c => { const v = c.getText(r); return v != null ? c.fmt(v) : '' })].map(v => esc(String(v)))
    })
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const subtitle = `${dates.start_date} — ${dates.end_date} · ${rawKeywords.length} keywords · ${rawSearchTerms.length} search terms`

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-shell${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Keyword Insights" subtitle={subtitle} unread={unread} onRefresh={() => setRefetchKey(k => k + 1)} onMenuToggle={() => setNavOpen(o => !o)} postActions={<button className="gf-btn gf-btn-ghost" onClick={exportCSV}><Icon name="download" size={13} />Export</button>} />
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
            <select className="gf-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', flex: 1, maxWidth: 320 }}>
              <Icon name="search" size={13} />
              <input
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-1)', fontSize: 12, fontFamily: 'inherit', width: '100%' }}
                placeholder="Search keywords or match types..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="gf-live-dot" />
              Last updated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
            </div>
          </div>

          {/* Section 2: Scoreboard */}
          <Scoreboard metrics={metrics} dates={dates} defaultSlots={['clicks','cpc','acos','sales','total_cost','ctr']} isLoading={loadingMetrics} />

          {/* Section 3: Targeting Analytics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Card 1 — Targeting Type Breakdown */}
            <div className="gf-card">
              <div style={{ marginBottom: 14 }}>
                <div className="gf-card-title">Targeting Type Breakdown</div>
                <div className="gf-card-sub">Keyword / Product / Audience / Auto · spend &amp; revenue share</div>
              </div>

              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'TOTAL SPEND',    value: targetingBreakdown.totalSpend > 0 ? fmtCur(targetingBreakdown.totalSpend) : '—',   color: 'var(--accent)' },
                  { label: 'TOTAL REVENUE',  value: targetingBreakdown.totalSales > 0 ? fmtCur(targetingBreakdown.totalSales) : '—',   color: 'var(--good)'   },
                  { label: 'PORTFOLIO ROAS', value: targetingBreakdown.totalRoas != null ? targetingBreakdown.totalRoas.toFixed(2) + '×' : '—',
                    color: targetingBreakdown.totalRoas != null ? roasTone(targetingBreakdown.totalRoas).color : 'var(--text-3)' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 5 }}>{kpi.label}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {targetingBreakdown.groupRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.3, display: 'flex', justifyContent: 'center', color: 'var(--text-3)' }}><Icon name="chart" size={28} /></div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
                    No targeting data for this period.<br />
                    <span style={{ color: 'var(--accent)', opacity: 0.7 }}>Fetch spTargeting / spSearchTerm reports</span><br />
                    to see keyword-level analytics.
                  </div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono)' }}>
                  <thead>
                    <tr>
                      {['Targeting Type', 'Spend', 'Revenue', '%Spend', '%Rev.', 'ROAS'].map(h => (
                        <th key={h} style={{
                          padding: '5px 8px 10px', textAlign: h === 'Targeting Type' ? 'left' : 'right',
                          color: 'var(--text-3)', fontWeight: 500, fontSize: 9, letterSpacing: '0.1em',
                          borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {targetingBreakdown.groupRows.map((r, i) => {
                      const tone = roasTone(r.roas ?? 0)
                      return (
                        <tr key={r.name} style={{ borderBottom: i < targetingBreakdown.groupRows.length - 1 ? '1px solid rgba(100,160,240,0.05)' : 'none' }}>
                          <td style={{ padding: '10px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: TGT_COLORS[r.name], flexShrink: 0, marginTop: 2 }} />
                              <div>
                                <div style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 12 }}>{r.label}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
                                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(100,160,240,0.08)', width: 64, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: TGT_COLORS[r.name], width: `${r.spendPct}%` }} />
                                  </div>
                                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{r.cnt} kw</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmtCur(r.spend)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--good)', fontWeight: 600 }}>{fmtCur(r.sales)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <span style={{ color: TGT_COLORS[r.name], fontWeight: 700 }}>{r.spendPct.toFixed(0)}%</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <span style={{ color: TGT_COLORS[r.name], fontWeight: 700 }}>{r.salesPct.toFixed(0)}%</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            {r.roas != null ? (
                              <span style={{ color: tone.color, background: tone.bg, padding: '3px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                                {r.roas.toFixed(2)}×
                              </span>
                            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {targetingBreakdown.groupRows.length > 0 && (() => {
                const best = targetingBreakdown.groupRows.reduce((a, b) => (a.roas ?? 0) > (b.roas ?? 0) ? a : b)
                return (
                  <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(240,180,41,0.06)', borderRadius: 6, border: '1px solid rgba(240,180,41,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10 }}>⚡</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)' }}>
                      {best.label} leads with {best.roas?.toFixed(2)}× ROAS · {best.spendPct.toFixed(0)}% of budget
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* Card 2 — Match Type Performance */}
            <div className="gf-card">
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div className="gf-card-title">Match Type Performance</div>
                  <div className="gf-card-sub">Portfolio spend & sales mix by targeting type</div>
                </div>
                {targetingBreakdown.totalRoas != null && (() => {
                  const tone = roasTone(targetingBreakdown.totalRoas)
                  return (
                    <span style={{ color: tone.color, background: tone.bg, padding: '4px 10px', borderRadius: 8, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                      ROAS {targetingBreakdown.totalRoas.toFixed(1)}×
                    </span>
                  )
                })()}
              </div>

              {targetingBreakdown.subRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.3, display: 'flex', justifyContent: 'center', color: 'var(--text-3)' }}><Icon name="chart" size={28} /></div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7 }}>
                    No match-type data for this period.<br />
                    <span style={{ color: 'var(--accent)', opacity: 0.7 }}>Keyword · Exact / Phrase / Broad</span><br />
                    performance will appear here.
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Stacked composition bars ── */}
                  <div style={{ marginBottom: 14 }}>
                    {(['spend', 'sales'] as const).map(metric => (
                      <div key={metric} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: metric === 'spend' ? 5 : 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)', width: 34, textAlign: 'right', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {metric === 'spend' ? 'Spend' : 'Sales'}
                        </span>
                        <div style={{ flex: 1, height: 24, display: 'flex', borderRadius: 6, overflow: 'hidden', gap: 1 }}>
                          {targetingBreakdown.subRows.map(r => {
                            const pct = metric === 'spend' ? r.spendPct : r.salesPct
                            const col = SUB_COLORS[r.sub] || '#888'
                            return (
                              <div
                                key={r.sub}
                                title={`${r.sub}: ${pct.toFixed(1)}%`}
                                style={{ width: `${pct}%`, height: '100%', background: col, position: 'relative', minWidth: pct > 0 ? 2 : 0, transition: 'width 0.4s ease' }}
                              >
                                {pct >= 10 && (
                                  <span style={{
                                    position: 'absolute', left: '50%', top: '50%',
                                    transform: 'translate(-50%,-50%)',
                                    fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 800,
                                    color: 'rgba(0,0,0,0.65)', pointerEvents: 'none', whiteSpace: 'nowrap',
                                  }}>{Math.round(pct)}%</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Color legend ── */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(100,160,240,0.1)' }}>
                    {targetingBreakdown.subRows.map(r => (
                      <div key={r.sub} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: SUB_COLORS[r.sub] || '#888', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)' }}>{r.sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Detail table ── */}
                  {(() => {
                    const COLS = '1fr 26px 56px 44px 72px 72px'
                    return (
                      <div>
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '0 4px 6px 4px', borderBottom: '1px solid rgba(100,160,240,0.12)' }}>
                          {['Match Type', 'KW', 'ROAS', 'ACoS', 'Spend', 'Sales'].map((h, i) => (
                            <span key={h} style={{
                              fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)',
                              textTransform: 'uppercase', letterSpacing: '0.07em',
                              textAlign: i >= 4 ? 'right' : i >= 2 ? 'center' : 'left',
                            }}>{h}</span>
                          ))}
                        </div>

                        {/* Rows */}
                        {targetingBreakdown.subRows.map((r, i) => {
                          const col = SUB_COLORS[r.sub] || '#888'
                          const tone = r.roas != null ? roasTone(r.roas) : null
                          const acosColor = r.acos == null ? 'var(--text-3)'
                            : r.acos < 30 ? '#00dba4' : r.acos < 55 ? '#f0b429' : '#ff4d6d'
                          return (
                            <div key={r.sub} style={{
                              display: 'grid', gridTemplateColumns: COLS, gap: 6,
                              padding: '7px 4px', alignItems: 'center',
                              borderBottom: i < targetingBreakdown.subRows.length - 1 ? '1px solid rgba(100,160,240,0.05)' : 'none',
                              background: i % 2 === 0 ? 'rgba(100,160,240,0.018)' : 'transparent',
                              borderRadius: 5,
                            }}>
                              {/* Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                <div style={{ width: 3, height: 20, borderRadius: 2, background: col, flexShrink: 0 }} />
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.sub}
                                </span>
                              </div>
                              {/* KW count */}
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textAlign: 'center' }}>{r.cnt}</span>
                              {/* ROAS */}
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {tone && r.roas != null
                                  ? <span style={{ color: tone.color, background: tone.bg, padding: '2px 6px', borderRadius: 6, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>{r.roas.toFixed(1)}×</span>
                                  : <span style={{ color: 'var(--text-3)', fontSize: 9 }}>—</span>}
                              </div>
                              {/* ACoS */}
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: acosColor, fontWeight: 600 }}>
                                  {r.acos != null ? r.acos.toFixed(0) + '%' : '—'}
                                </span>
                              </div>
                              {/* Spend */}
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#f0b429', fontWeight: 600 }}>{fmtCur(r.spend)}</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)' }}>{r.spendPct.toFixed(0)}%</div>
                              </div>
                              {/* Sales */}
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#00dba4', fontWeight: 600 }}>{fmtCur(r.sales)}</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text-3)' }}>{r.salesPct.toFixed(0)}%</div>
                              </div>
                            </div>
                          )
                        })}

                        {/* Totals row */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: COLS, gap: 6,
                          padding: '8px 4px', marginTop: 4, borderRadius: 6,
                          borderTop: '1px solid rgba(100,160,240,0.18)',
                          background: 'rgba(100,160,240,0.04)', alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)', fontWeight: 700 }}>TOTAL</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', textAlign: 'center' }}>
                            {targetingBreakdown.subRows.reduce((s, r) => s + r.cnt, 0)}
                          </span>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {targetingBreakdown.totalRoas != null && (() => {
                              const tone = roasTone(targetingBreakdown.totalRoas)
                              return <span style={{ color: tone.color, background: tone.bg, padding: '2px 6px', borderRadius: 6, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9 }}>{targetingBreakdown.totalRoas.toFixed(1)}×</span>
                            })()}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {targetingBreakdown.totalSpend > 0 && targetingBreakdown.totalSales > 0 && (() => {
                              const acos = (targetingBreakdown.totalSpend / targetingBreakdown.totalSales) * 100
                              const c = acos < 30 ? '#00dba4' : acos < 55 ? '#f0b429' : '#ff4d6d'
                              return <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: c, fontWeight: 700 }}>{acos.toFixed(0)}%</span>
                            })()}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#f0b429', fontWeight: 700 }}>{fmtCur(targetingBreakdown.totalSpend)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#00dba4', fontWeight: 700 }}>{fmtCur(targetingBreakdown.totalSales)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Section 4: Keywords / Search Terms Table */}
          <div className="gf-card" style={{ padding: 0 }}>

            {/* Table toolbar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

              {/* Tab switcher — unchanged */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 6, padding: 3 }}>
                {(['keywords', 'search_terms'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: activeTab === tab ? 'var(--surface)' : 'transparent',
                    color: activeTab === tab ? 'var(--text-1)' : 'var(--text-3)', fontFamily: 'inherit',
                  }}>
                    {tab === 'keywords' ? `Keywords (${keywords.length})` : `Search Terms (${searchTerms.length})`}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }} />

              {/* Loading indicator */}
              {(kwLoading || stLoading) && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading…</div>}

              {/* Compare toggle */}
              <button
                onClick={() => setShowComparison(v => !v)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                  border: showComparison ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: showComparison ? 'rgba(240,180,41,0.12)' : 'var(--bg)',
                  color: showComparison ? 'var(--accent)' : 'var(--text-3)',
                  fontWeight: showComparison ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                Compare {showComparison ? 'ON' : 'OFF'}
              </button>

              {/* Column picker */}
              <div ref={colPickerRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setColPickerOpen(v => !v)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)',
                    border: '1px solid var(--border)', background: colPickerOpen ? 'var(--surface)' : 'var(--bg)',
                    color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  Columns <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
                </button>
                {colPickerOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '10px 4px', minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ padding: '2px 12px 8px', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      VISIBLE COLUMNS
                    </div>
                    {KW_COL_DEFS.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,160,240,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)}
                          style={{ accentColor: 'var(--accent)', width: 13, height: 13, cursor: 'pointer' }} />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: visibleCols.has(col.key) ? 'var(--text-1)' : 'var(--text-3)' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comparison period badge */}
            {showComparison && (
              <div style={{ padding: '6px 20px', background: 'rgba(240,180,41,0.05)', borderBottom: '1px solid rgba(240,180,41,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>COMPARING</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{dates.start_date} – {dates.end_date}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>vs</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>{prevDates.start_date} – {prevDates.end_date}</span>
              </div>
            )}

            {activeTab === 'keywords' ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'default' }}>Keyword</th>
                      <th style={{ cursor: 'default' }}>Match</th>
                      <th style={{ cursor: 'default' }}>Bid</th>
                      {visibleColDefs.map(col => (
                        <th key={col.key}
                          onClick={() => col.sortable && handleSort(col.key)}
                          style={{ cursor: col.sortable ? 'pointer' : 'default', textAlign: 'right' }}>
                          {col.label}{kwSortCol === col.key ? (kwSortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKeywords.length === 0 && (
                      <tr><td colSpan={3 + visibleColDefs.length} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>No keywords found</td></tr>
                    )}
                    {sortedKeywords.map((k: any, i: number) => {
                      const mt = (k.match_type || '').toLowerCase()
                      const isProductTgt = mt.includes('targeting_expression')
                      const isCatTgt = mt === 'targeting_expression_predefined'
                      const matchColor: Record<string, string> = {
                        exact: '#00dba4', phrase: '#6c8cff', broad: '#f0b429',
                        targeting_expression: '#00dba4', targeting_expression_predefined: '#a78bfa',
                      }
                      const matchLabel: Record<string, string> = {
                        exact: 'Exact', phrase: 'Phrase', broad: 'Broad',
                        targeting_expression: 'ASIN Target', targeting_expression_predefined: 'Category',
                      }
                      const kwKey = (k.keyword || k.targeting_text || '') + '|' + (k.match_type || '')
                      const prev = showComparison ? (prevKwMap.get(kwKey) ?? null) : null
                      const displayText = k.keyword || (isProductTgt
                        ? (isCatTgt ? (k.targeting_text || 'Category Target') : (k.targeting_text || 'ASIN Target'))
                        : '—')
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500, color: isProductTgt ? 'var(--good)' : 'var(--text-1)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayText}
                          </td>
                          <td>
                            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (matchColor[mt] || '#888') + '22', color: matchColor[mt] || 'var(--text-2)' }}>
                              {matchLabel[mt] || k.match_type || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{k.keyword_bid != null ? fmtCur(k.keyword_bid) : '—'}</td>
                          {visibleColDefs.map(col => (
                            <KwMetricCell key={col.key} colKey={col.key} curr={k} prev={prev} showComp={showComparison} />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="gf-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'default' }}>Search Term</th>
                      <th style={{ cursor: 'default' }}>Keyword</th>
                      <th style={{ cursor: 'default' }}>Match</th>
                      {visibleColDefs.map(col => (
                        <th key={col.key} style={{ textAlign: 'right' }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchTerms.length === 0 && (
                      <tr><td colSpan={3 + visibleColDefs.length} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>No search terms found</td></tr>
                    )}
                    {searchTerms.map((s: any, i: number) => {
                      const matchColor: Record<string, string> = { exact: '#00dba4', phrase: '#6c8cff', broad: '#f0b429' }
                      const mt = (s.match_type || '').toLowerCase()
                      const prev = showComparison ? (prevStMap.get(s.search_term || '') ?? null) : null
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500, color: 'var(--text-1)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.search_term || '—'}</td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>{s.keyword || '—'}</td>
                          <td>
                            <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: (matchColor[mt] || '#888') + '22', color: matchColor[mt] || 'var(--text-2)', textTransform: 'uppercase' }}>
                              {s.match_type || '—'}
                            </span>
                          </td>
                          {visibleColDefs.map(col => (
                            <KwMetricCell key={col.key} colKey={col.key} curr={s} prev={prev} showComp={showComparison} />
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
