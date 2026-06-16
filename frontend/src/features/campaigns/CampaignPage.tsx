import { useState, useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
} from 'recharts'
import '../dashboard/DashboardPage.css'
import Scoreboard from '../../components/Scoreboard'
import {
  useGetMetricsQuery,
  useGetChartsQuery,
  useGetCampaignsQuery,
  useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import { fmtCur, fmtNum, getDateRange } from '../../shared/utils'
import { Icon } from '../../shared/Icon'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'


function acosTone(v: number | null | undefined) {
  if (v == null) return ''
  if (v < 30) return 'good'
  if (v < 55) return 'warn'
  return 'bad'
}


// ── Section 1: Filter Bar ────────────────────────────────────
const DATE_PRESETS = [
  { value: 'today',     label: 'Today'           },
  { value: 'yesterday', label: 'Yesterday'       },
  { value: '7d',        label: 'Last 7 Days'     },
  { value: '30d',       label: 'Last 30 Days'    },
  { value: 'mtd',       label: 'Month to Date'   },
  { value: 'qtd',       label: 'Quarter to Date' },
  { value: 'ytd',       label: 'Year to Date'    },
  { value: 'max',       label: 'Max Available'   },
  { value: 'custom',    label: 'Custom Range'    },
]
const CAMPAIGN_TYPES = [
  { value: '',             label: 'All Types' },
  { value: 'spCampaigns',  label: 'Sponsored Products' },
  { value: 'sbTargeting',  label: 'Sponsored Brands' },
  { value: 'sdTargeting',  label: 'Sponsored Display' },
]
const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'enabled', label: 'Active' },
  { value: 'paused',  label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

function FilterBar({
  datePreset, setDatePreset,
  customStart, setCustomStart,
  customEnd, setCustomEnd,
  campaignType, setCampaignType,
  statusFilter, setStatusFilter,
  searchQ, setSearchQ,
  dataMinDate, dataMaxDate,
}: {
  datePreset: string; setDatePreset: (v: string) => void
  customStart: string; setCustomStart: (v: string) => void
  customEnd: string; setCustomEnd: (v: string) => void
  campaignType: string; setCampaignType: (v: string) => void
  statusFilter: string; setStatusFilter: (v: string) => void
  searchQ: string; setSearchQ: (v: string) => void
  dataMinDate?: string | null; dataMaxDate?: string | null
}) {
  const sel: React.CSSProperties = {
    height: 34, padding: '0 10px', borderRadius: 8, background: 'var(--surface)',
    border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--mono)',
    fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', outline: 'none',
  }
  const dateInp: React.CSSProperties = {
    ...sel, padding: '0 8px', border: '1px solid var(--accent)', minWidth: 130,
    colorScheme: 'dark',
  }
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="calendar" size={14} />
        <select style={sel} value={datePreset} onChange={e => setDatePreset(e.target.value)}>
          {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {datePreset === 'custom' && (
          <>
            <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)} style={dateInp} />
            <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--mono)' }}>→</span>
            <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)} style={dateInp} />
          </>
        )}
      </div>
      {dataMinDate && dataMaxDate && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(100,160,240,0.08)', border: '1px solid rgba(100,160,240,0.2)',
          borderRadius: 6, padding: '3px 10px', fontSize: 10, fontFamily: 'var(--mono)',
          color: 'var(--text-3)',
        }}>
          <span style={{ color: '#64a0f0' }}>DB</span>
          {fmtDate(dataMinDate)} – {fmtDate(dataMaxDate)}
        </div>
      )}
      <select style={sel} value={campaignType} onChange={e => setCampaignType(e.target.value)}>
        {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <select style={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
        {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', height: 34 }}>
        <Icon name="search" size={13} />
        <input
          placeholder="Search campaigns..."
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, width: 180 }}
        />
      </div>
      <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
        <span className="gf-live-dot" />
        Last updated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
      </div>
    </div>
  )
}

// ── Section 3 & 4: Campaign Type Distribution + Placement ────
const TYPE_COLORS: Record<string, string> = { SP: '#f0b429', SB: '#00dba4', SD: '#a78bfa' }
const TYPE_LABELS: Record<string, string> = {
  SP: 'Sponsored Products',
  SB: 'Sponsored Brands',
  SD: 'Sponsored Display',
}
const PLACEMENT_LABEL: Record<string, string> = {
  SP: 'Search Results',
  SB: 'Top of Search',
  SD: 'Product Pages',
}

const STATUS_TABS = [
  { key: '',         label: 'All'      },
  { key: 'enabled',  label: 'Active'   },
  { key: 'paused',   label: 'Paused'   },
  { key: 'archived', label: 'Archived' },
]

function roasTone(v: number) {
  if (v >= 4)  return { color: '#00dba4', bg: 'rgba(0,219,164,0.12)' }
  if (v >= 2)  return { color: '#f0b429', bg: 'rgba(240,180,41,0.1)'  }
  return           { color: '#ff4d6d', bg: 'rgba(255,77,109,0.1)'  }
}
function acosToneCell(v: number) {
  if (v < 25)  return { color: '#00dba4', bg: 'rgba(0,219,164,0.12)' }
  if (v < 50)  return { color: '#f0b429', bg: 'rgba(240,180,41,0.1)'  }
  return           { color: '#ff4d6d', bg: 'rgba(255,77,109,0.1)'  }
}

function CampaignTypeDistribution({ charts, campaigns }: { charts: any; campaigns: any[] }) {
  const [statusTab, setStatusTab] = useState('')
  const breakdown: any[] = charts?.ad_type_breakdown ?? []

  const countsByType = useMemo(() => {
    const filtered = statusTab ? campaigns.filter(c => (c.campaign_status ?? 'enabled').toLowerCase() === statusTab) : campaigns
    const seen = new Set<number>()
    const counts: Record<string, number> = { SP: 0, SB: 0, SD: 0 }
    filtered.forEach(c => {
      if (seen.has(c.campaign_id)) return
      seen.add(c.campaign_id)
      const t = getAdType(c.report_type) ?? ''
      if (t in counts) counts[t]++
    })
    return counts
  }, [campaigns, statusTab])

  const totalCampaigns = Object.values(countsByType).reduce((s, n) => s + n, 0)
  const totalSpend = breakdown.reduce((s, b) => s + (b.spend ?? 0), 0)
  const totalSales = breakdown.reduce((s, b) => s + (b.sales ?? 0), 0)

  const rows = ['SP', 'SB', 'SD'].map(t => {
    const b = breakdown.find(x => x.ad_type === t)
    const cnt = countsByType[t] ?? 0
    const spend = b?.spend ?? 0
    const sales = b?.sales ?? 0
    const roas = spend > 0 ? sales / spend : null
    const acos = sales > 0 ? (spend / sales) * 100 : null
    const cntPct = totalCampaigns > 0 ? (cnt / totalCampaigns) * 100 : 0
    return { type: t, label: TYPE_LABELS[t], cnt, cntPct, spend, sales, roas, acos }
  })

  const donutData = (totalCampaigns > 0 ? rows : rows.map(r => ({ ...r, cnt: r.spend }))).map(r => ({
    name: r.type, value: totalCampaigns > 0 ? r.cnt : r.spend, fill: TYPE_COLORS[r.type],
  })).filter(d => d.value > 0)

  const dominantRow = rows.reduce((a, b) => b.cnt > a.cnt ? b : a, rows[0])
  const overallRoas = totalSpend > 0 ? totalSales / totalSpend : null

  return (
    <div className="gf-card">
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Campaign Type Bifurcation</div>
          <div className="gf-card-sub">SP / SB / SD breakdown with performance metrics</div>
        </div>
        <div className="gf-seg">
          {STATUS_TABS.map(t => (
            <button key={t.key} className={statusTab === t.key ? 'is-on' : ''} onClick={() => setStatusTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'CAMPAIGNS', value: totalCampaigns > 0 ? String(totalCampaigns) : '—', color: 'var(--text-1)', sub: 'total unique' },
          { label: 'LEAD TYPE', value: totalCampaigns > 0 ? dominantRow.type : '—', color: TYPE_COLORS[dominantRow.type] ?? 'var(--text-1)', sub: totalCampaigns > 0 ? dominantRow.label : 'no data' },
          { label: 'PORTFOLIO ROAS', value: overallRoas != null ? overallRoas.toFixed(2) + '×' : '—', color: overallRoas != null ? roasTone(overallRoas).color : 'var(--text-3)', sub: 'spend-weighted avg' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--sans)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* Donut */}
        <div style={{ flexShrink: 0, position: 'relative', width: 170, height: 170 }}>
          <PieChart width={170} height={170}>
            <Pie data={donutData.length ? donutData : [{ name: '—', value: 1, fill: 'rgba(100,160,240,0.08)' }]}
              cx={82} cy={82} innerRadius={52} outerRadius={78} paddingAngle={donutData.length > 1 ? 3 : 0} dataKey="value" startAngle={90} endAngle={-270}>
              {donutData.length ? donutData.map((d, i) => <Cell key={i} fill={d.fill} />) : <Cell fill="rgba(100,160,240,0.08)" />}
            </Pie>
            <ReTooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 11 }} />
          </PieChart>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{totalCampaigns || '—'}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', marginTop: 3 }}>CAMPAIGNS</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Count', '% Share', 'Spend', 'Sales', 'ROAS', 'ACoS'].map(h => (
                  <th key={h} style={{ padding: '6px 8px 8px', textAlign: h === 'Type' ? 'left' : 'right', color: 'var(--text-3)', fontWeight: 500, fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.type} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(100,160,240,0.06)' : 'none' }}>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: TYPE_COLORS[r.type], flexShrink: 0, display: 'inline-block' }} />
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLORS[r.type], letterSpacing: '0.1em' }}>{r.type}</div>
                        <div style={{ color: 'var(--text-1)', fontSize: 11 }}>{r.label}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {r.cnt > 0
                      ? <span style={{ fontSize: 15, fontWeight: 700, color: TYPE_COLORS[r.type] }}>{r.cnt}</span>
                      : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {r.cnt > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontWeight: 600, color: TYPE_COLORS[r.type] }}>{r.cntPct.toFixed(0)}%</span>
                        <div style={{ width: 54, height: 3, borderRadius: 2, background: 'rgba(100,160,240,0.1)' }}>
                          <div style={{ width: `${r.cntPct}%`, height: '100%', borderRadius: 2, background: TYPE_COLORS[r.type] }} />
                        </div>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: r.spend > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{r.spend > 0 ? fmtCur(r.spend) : '—'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: r.sales > 0 ? 'var(--good)' : 'var(--text-3)' }}>{r.sales > 0 ? fmtCur(r.sales) : '—'}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {r.roas != null ? <span style={{ ...roasTone(r.roas), padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{r.roas.toFixed(1)}×</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {r.acos != null ? <span style={{ ...acosToneCell(r.acos), padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{r.acos.toFixed(2)}%</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(100,160,240,0.04)' }}>
                <td style={{ padding: '9px 8px', color: 'var(--text-2)', fontWeight: 600 }}>Total</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{totalCampaigns || '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--text-2)' }}>100%</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmtCur(totalSpend)}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--good)', fontWeight: 600 }}>{fmtCur(totalSales)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Insight strip */}
      {totalCampaigns > 0 && overallRoas != null && (
        <div style={{ marginTop: 14, padding: '9px 14px', background: 'rgba(240,180,41,0.06)', borderRadius: 8, borderLeft: '3px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)' }}>
            {dominantRow.type} leads at {dominantRow.cntPct.toFixed(0)}% share · Portfolio ROAS {overallRoas.toFixed(2)}× · ACoS {totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(2) + '%' : '—'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Section 4: Placement-wise Performance ─────────────────────
function PlacementPerformance({ charts, campaigns }: { charts: any; campaigns: any[] }) {
  const breakdown: any[] = charts?.ad_type_breakdown ?? []
  const [chartMetric, setChartMetric] = useState<'roas' | 'acos' | 'spend' | 'sales'>('roas')

  const rows = useMemo(() => {
    const seen = new Set<number>()
    const counts: Record<string, number> = { SP: 0, SB: 0, SD: 0 }
    campaigns.forEach(c => {
      if (seen.has(c.campaign_id)) return
      seen.add(c.campaign_id)
      const t = getAdType(c.report_type) ?? ''
      if (t in counts) counts[t]++
    })
    return ['SP', 'SB', 'SD'].map(t => {
      const b = breakdown.find(x => x.ad_type === t)
      const spend = b?.spend ?? 0
      const sales = b?.sales ?? 0
      return {
        type: t,
        placement: PLACEMENT_LABEL[t],
        cnt: counts[t] ?? 0,
        spend,
        sales,
        roas: spend > 0 ? sales / spend : null,
        acos: sales > 0 ? (spend / sales) * 100 : null,
      }
    })
  }, [breakdown, campaigns])

  const maxVal = (metric: string) => Math.max(...rows.map(r => {
    if (metric === 'roas') return r.roas ?? 0
    if (metric === 'acos') return r.acos ?? 0
    if (metric === 'spend') return r.spend
    return r.sales
  }), 0.01)

  const metricFmt: Record<string, (v: number) => string> = {
    roas: v => v.toFixed(2) + '×',
    acos: v => v.toFixed(2) + '%',
    spend: v => fmtCur(v),
    sales: v => fmtCur(v),
  }

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0)
  const totalSales = rows.reduce((s, r) => s + r.sales, 0)
  const overallRoas = totalSpend > 0 ? totalSales / totalSpend : null
  const bestRow = rows.reduce((a, b) => (b.roas ?? 0) > (a.roas ?? 0) ? b : a, rows[0])

  return (
    <div className="gf-card">
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Placement-wise Performance</div>
          <div className="gf-card-sub">Search Results · Top of Search · Product Pages</div>
        </div>
        <div className="gf-seg">
          {(['roas', 'acos', 'spend', 'sales'] as const).map(m => (
            <button key={m} className={m === chartMetric ? 'is-on' : ''} onClick={() => setChartMetric(m)}>{m.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'BEST PLACEMENT', value: bestRow.roas != null ? bestRow.placement : '—', color: '#00dba4', sub: bestRow.roas != null ? bestRow.roas.toFixed(2) + '× ROAS' : 'no data' },
          { label: 'TOTAL SPEND', value: fmtCur(totalSpend), color: 'var(--accent)', sub: 'across all placements' },
          { label: 'PORTFOLIO ROAS', value: overallRoas != null ? overallRoas.toFixed(2) + '×' : '—', color: overallRoas != null ? roasTone(overallRoas).color : 'var(--text-3)', sub: 'weighted avg' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--sans)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Gradient bar chart */}
      {breakdown.length === 0 ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No placement data</div>
      ) : (
        <div style={{ padding: '0 0 16px' }}>
          {rows.filter(r => r.spend > 0 || r.cnt > 0).map((r, i) => {
            const val = r[chartMetric as keyof typeof r] as number | null
            const mv = maxVal(chartMetric)
            const pct = val == null ? 0 : Math.min((val / mv) * 100, 100)
            const tone = chartMetric === 'roas' && val != null ? roasTone(val)
              : chartMetric === 'acos' && val != null ? acosToneCell(val)
              : { color: 'var(--accent)', bg: 'rgba(240,180,41,0.1)' }
            const isBest = r === bestRow && val != null && chartMetric === 'roas'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 96, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)', textAlign: 'right', flexShrink: 0 }}>
                  {r.placement}
                </div>
                <div style={{ flex: 1, position: 'relative', height: 34, background: 'rgba(100,160,240,0.05)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(pct, val != null && val > 0 ? 6 : 0)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${tone.color}70, ${tone.color})`,
                    borderRadius: 7,
                    transition: 'width 0.5s ease',
                    display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    {val != null && val > 0 && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {metricFmt[chartMetric](val)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: 36, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: TYPE_COLORS[r.type], textAlign: 'center' }}>
                  {r.type}
                  {isBest && <div style={{ fontSize: 7, color: '#00dba4', marginTop: 1 }}>BEST</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Heatmap table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Placement', 'Campaigns', 'Spend', 'Sales', 'ROAS', 'ACoS'].map(h => (
              <th key={h} style={{ padding: '6px 10px 8px', textAlign: h === 'Placement' ? 'left' : 'right', color: 'var(--text-3)', fontWeight: 500, fontSize: 10, letterSpacing: '0.08em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isBestRow = r === bestRow && r.roas != null
            return (
              <tr key={r.type} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(100,160,240,0.06)' : 'none', background: isBestRow ? 'rgba(0,219,164,0.04)' : 'transparent' }}>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: TYPE_COLORS[r.type], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-1)' }}>{r.placement}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 2 }}>({r.type})</span>
                    {isBestRow && <span style={{ fontSize: 8, background: 'rgba(0,219,164,0.15)', color: '#00dba4', padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginLeft: 2 }}>BEST</span>}
                  </div>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: r.cnt > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: r.cnt > 0 ? 600 : 400 }}>{r.cnt || '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: r.spend > 0 ? 'var(--accent)' : 'var(--text-3)' }}>{r.spend > 0 ? fmtCur(r.spend) : '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: r.sales > 0 ? 'var(--good)' : 'var(--text-3)' }}>{r.sales > 0 ? fmtCur(r.sales) : '—'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                  {r.roas != null ? <span style={{ ...roasTone(r.roas), padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>{r.roas.toFixed(2)}×</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                  {r.acos != null ? <span style={{ ...acosToneCell(r.acos), padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>{r.acos.toFixed(2)}%</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: '8px 10px 2px', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--sans)' }}>
        Green = high performance · Amber = average · Red = needs attention
      </div>
    </div>
  )
}

// ── Section 5: Campaign Performance Table ────────────────────
const SP_TYPES = new Set(['spCampaigns', 'spTargeting', 'spSearchTerm', 'spProductAds'])
const SB_TYPES = new Set(['sbTargeting', 'sbSearchTerm'])
const SD_TYPES = new Set(['sdTargeting', 'sdAdvertising'])

function getAdType(rt: string | null): 'SP' | 'SB' | 'SD' | null {
  if (!rt) return null
  if (SP_TYPES.has(rt)) return 'SP'
  if (SB_TYPES.has(rt)) return 'SB'
  if (SD_TYPES.has(rt)) return 'SD'
  return null
}

const COL_DEFS = [
  { key: 'budget',            label: 'Budget',       sortable: false, invertGood: false, getValue: (c: any) => c.budget ?? null,                                                                        fmt: (v: number) => fmtCur(v) },
  { key: 'spend',             label: 'Spend',        sortable: true,  invertGood: true,  getValue: (c: any) => c.spend ?? null,                                                                         fmt: (v: number) => fmtCur(v) },
  { key: 'sales',             label: 'Sales',        sortable: true,  invertGood: false, getValue: (c: any) => c.sales ?? null,                                                                         fmt: (v: number) => fmtCur(v) },
  { key: 'roas',              label: 'ROAS',         sortable: true,  invertGood: false, getValue: (c: any) => c.roas ?? null,                                                                          fmt: (v: number) => v.toFixed(2) + '×' },
  { key: 'acos',              label: 'ACoS',         sortable: true,  invertGood: true,  getValue: (c: any) => c.acos != null ? c.acos * 100 : null,                                                   fmt: (v: number) => v.toFixed(2) + '%' },
  { key: 'impressions',       label: 'Impr.',        sortable: true,  invertGood: false, getValue: (c: any) => c.impressions ?? null,                                                                   fmt: (v: number) => fmtNum(v) },
  { key: 'clicks',            label: 'Clicks',       sortable: true,  invertGood: false, getValue: (c: any) => c.clicks ?? null,                                                                        fmt: (v: number) => fmtNum(v) },
  { key: 'ctr',               label: 'CTR',          sortable: false, invertGood: false, getValue: (c: any) => c.ctr != null ? c.ctr * 100 : null,                                                     fmt: (v: number) => v.toFixed(2) + '%' },
  { key: 'cpc',               label: 'CPC',          sortable: false, invertGood: true,  getValue: (c: any) => c.cpc ?? null,                                                                           fmt: (v: number) => '₹' + v.toFixed(2) },
  { key: 'purchases',         label: 'Purchases',    sortable: true,  invertGood: false, getValue: (c: any) => c.purchases ?? null,                                                                     fmt: (v: number) => fmtNum(v) },
  { key: 'units_sold',        label: 'Units Sold',   sortable: true,  invertGood: false, getValue: (c: any) => c.units_sold > 0 ? c.units_sold : null,                                                 fmt: (v: number) => fmtNum(v) },
  { key: 'detail_page_views', label: 'DPV',          sortable: true,  invertGood: false, getValue: (c: any) => c.detail_page_views ?? null,                                                            fmt: (v: number) => fmtNum(v) },
  { key: 'viewable_impressions', label: 'Viewable',  sortable: true,  invertGood: false, getValue: (c: any) => c.viewable_impressions ?? null,                                                         fmt: (v: number) => fmtNum(v) },
  { key: 'top_of_search_impression_share', label: 'TOS IS', sortable: false, invertGood: false, getValue: (c: any) => c.top_of_search_impression_share != null ? c.top_of_search_impression_share * 100 : null, fmt: (v: number) => v.toFixed(2) + '%' },
  { key: 'cpm',               label: 'CPM',          sortable: false, invertGood: true,  getValue: (c: any) => c.impressions > 0 ? (c.spend / c.impressions * 1000) : null,                            fmt: (v: number) => fmtCur(v) },
  { key: 'ntb_purchases',     label: 'NTB Orders',   sortable: true,  invertGood: false, getValue: (c: any) => c.ntb_purchases ?? null,                                                                fmt: (v: number) => fmtNum(v) },
  { key: 'ntb_sales',         label: 'NTB Sales',    sortable: true,  invertGood: false, getValue: (c: any) => c.ntb_sales ?? null,                                                                    fmt: (v: number) => fmtCur(v) },
  { key: 'ntb_purchases_pct', label: 'NTB%',         sortable: false, invertGood: false, getValue: (c: any) => (c.ntb_purchases != null && c.purchases > 0) ? (c.ntb_purchases / c.purchases * 100) : null, fmt: (v: number) => v.toFixed(1) + '%' },
  { key: 'ntb_sales_pct',     label: 'NTB Sales%',   sortable: false, invertGood: false, getValue: (c: any) => (c.ntb_sales != null && c.sales > 0) ? (c.ntb_sales / c.sales * 100) : null,          fmt: (v: number) => v.toFixed(1) + '%' },
]

const DEFAULT_COLS = new Set(['spend', 'sales', 'roas', 'acos', 'impressions', 'clicks', 'purchases', 'units_sold', 'detail_page_views'])

type CSort = 'spend' | 'sales' | 'roas' | 'acos' | 'impressions' | 'clicks' | 'purchases' | 'units_sold' | 'detail_page_views' | 'viewable_impressions' | 'ntb_purchases' | 'ntb_sales'

function MetricCell({ colKey, curr, prev, showComp }: { colKey: string; curr: any; prev: any | null; showComp: boolean }) {
  const col = COL_DEFS.find(c => c.key === colKey)!
  const val = col.getValue(curr)
  const prevVal = prev ? col.getValue(prev) : null
  const pct = (val != null && prevVal != null && prevVal !== 0) ? ((val - prevVal) / Math.abs(prevVal)) * 100 : null
  const isUp = pct != null && pct > 0
  const good = pct != null ? (col.invertGood ? !isUp : isUp) : null
  let content: JSX.Element
  if (val == null) {
    content = <span style={{ color: 'var(--text-3)' }}>—</span>
  } else if (colKey === 'acos') {
    content = <span className={`gf-acos-pill ${acosTone(val)}`}>{val.toFixed(1)}%</span>
  } else if (colKey === 'roas') {
    content = <span style={{ color: val >= 1 ? 'var(--good)' : 'var(--bad)' }}>{val.toFixed(2)}×</span>
  } else if (colKey === 'spend') {
    content = <span style={{ color: 'var(--accent)' }}>{col.fmt(val)}</span>
  } else if (colKey === 'sales') {
    content = <span style={{ color: 'var(--good)' }}>{col.fmt(val)}</span>
  } else {
    content = <span>{col.fmt(val)}</span>
  }
  return (
    <td className="gf-num gf-col-r">
      <div>{content}</div>
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

function CampaignTable({ campaigns, prevCampaigns, loading, prevDates }: {
  campaigns: any[]
  prevCampaigns: any[]
  loading: boolean
  prevDates: { start_date: string; end_date: string }
}) {
  const [sortKey, setSortKey] = useState<CSort>('spend')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(0)
  const [showComparison, setShowComparison] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_COLS)
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef<HTMLDivElement>(null)
  const PER_PAGE = 15

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false)
      }
    }
    if (colPickerOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [colPickerOpen])

  const prevMap = useMemo(() => {
    const m = new Map<number, any>()
    prevCampaigns.forEach(c => { if (!m.has(c.campaign_id)) m.set(c.campaign_id, c) })
    return m
  }, [prevCampaigns])

  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const av = a[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      const bv = b[sortKey] ?? (sortAsc ? Infinity : -Infinity)
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
  }, [campaigns, sortKey, sortAsc])

  const paged = sorted.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const visibleColDefs = COL_DEFS.filter(c => visibleCols.has(c.key))

  function handleSort(k: CSort) {
    if (k === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
    setPage(0)
  }

  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function exportCSV() {
    const headers = ['Campaign Name', 'Campaign ID', 'Type', 'Status', ...visibleColDefs.map(c => c.label)]
    const rows = sorted.map(r => [
      r.campaign_name ?? '', r.campaign_id, getAdType(r.report_type) ?? '',
      r.campaign_status ?? '',
      ...visibleColDefs.map(c => { const v = c.getValue(r); return v != null ? c.fmt(v) : '' }),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'campaigns.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const SortTh = ({ label, k }: { label: string; k: CSort }) => (
    <th className="gf-col-r" onClick={() => handleSort(k)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="gf-card" style={{ padding: 0 }}>
      <div className="gf-card-header" style={{ padding: '18px 20px 14px' }}>
        <div>
          <div className="gf-card-title">Campaign Performance Table</div>
          <div className="gf-card-sub">
            {sorted.length} campaigns · sorted by {sortKey}
            {showComparison && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· vs {prevDates.start_date} – {prevDates.end_date}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Compare toggle */}
          <button
            onClick={() => setShowComparison(v => !v)}
            style={{
              height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: showComparison ? 'rgba(240,180,41,0.12)' : 'var(--surface)',
              color: showComparison ? 'var(--accent)' : 'var(--text-2)',
              fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s, color 0.2s',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: showComparison ? 'var(--accent)' : 'var(--text-3)',
              flexShrink: 0, transition: 'background 0.2s',
            }} />
            {showComparison ? 'COMPARE ON' : 'COMPARE OFF'}
          </button>
          {/* Column picker */}
          <div style={{ position: 'relative' }} ref={colPickerRef}>
            <button
              onClick={() => setColPickerOpen(v => !v)}
              style={{
                height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: colPickerOpen ? 'rgba(100,160,240,0.1)' : 'var(--surface)',
                color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              Columns ▾
            </button>
            {colPickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 100,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '12px 16px', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 10 }}>VISIBLE COLUMNS</div>
                {COL_DEFS.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleCol(col.key)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="gf-btn gf-btn-ghost" onClick={exportCSV}><Icon name="download" size={13} />CSV</button>
        </div>
      </div>
      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading campaigns…</div>
      )}
      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table className="gf-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th>Status</th>
                {visibleColDefs.map(col =>
                  col.sortable
                    ? <SortTh key={col.key} label={col.label} k={col.key as CSort} />
                    : <th key={col.key} className="gf-col-r">{col.label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr><td colSpan={3 + visibleColDefs.length} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No campaign data for this period</td></tr>
              )}
              {paged.map((c: any, i: number) => {
                const adType = getAdType(c.report_type)
                const st = (c.campaign_status ?? '').toLowerCase()
                const prev = prevMap.get(c.campaign_id) ?? null
                return (
                  <tr key={c.campaign_id + '_' + i}>
                    <td className="gf-name" style={{ maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name ?? '—'}</div>
                      <div className="meta">ID {c.campaign_id}</div>
                    </td>
                    <td>{adType && <span className={`gf-tag ${adType.toLowerCase()}`}>{adType}</span>}</td>
                    <td>
                      <span className={`gf-tag ${st === 'enabled' ? 'live' : st === 'paused' ? 'paused' : ''}`}>
                        {st === 'enabled' ? 'Active' : st === 'paused' ? 'Paused' : st === 'archived' ? 'Archived' : st || '—'}
                      </span>
                    </td>
                    {visibleColDefs.map(col => (
                      <MetricCell key={col.key} colKey={col.key} curr={c} prev={prev} showComp={showComparison} />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
export default function CampaignPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const clientId = user?.client_id

  const [datePreset, setDatePreset] = useState('30d')
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [customEnd,   setCustomEnd]   = useState(() => new Date().toISOString().slice(0, 10))
  const [campaignType, setCampaignType] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQ, setSearchQ] = useState('')

  const dates = useMemo(() => {
    if (datePreset === 'custom') return { start_date: customStart, end_date: customEnd }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const prevDates = useMemo(() => {
    const start = new Date(dates.start_date)
    const end = new Date(dates.end_date)
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days + 1)
    const f = (d: Date) => d.toISOString().slice(0, 10)
    return { start_date: f(prevStart), end_date: f(prevEnd) }
  }, [dates])

  const apiParams = useMemo(() => ({
    ...dates,
    ...(campaignType ? { report_type: campaignType } : {}),
  }), [dates, campaignType])

  const prevApiParams = useMemo(() => ({
    ...prevDates,
    ...(campaignType ? { report_type: campaignType } : {}),
  }), [prevDates, campaignType])

  const skip = !clientId

  const { data: metrics,  refetch: refetchMetrics, isLoading: loadingMetrics }  = useGetMetricsQuery(apiParams, { skip })
  const { data: charts,   refetch: refetchCharts }   = useGetChartsQuery(apiParams, { skip })
  const { data: rawCampaigns = [], isFetching: camLoading, refetch: refetchCampaigns } = useGetCampaignsQuery(apiParams, { skip })
  const { data: prevCampaigns = [] } = useGetCampaignsQuery(prevApiParams, { skip })
  const { data: unreadData } = useGetUnreadCountQuery(undefined, { pollingInterval: 60000 })

  const unread = unreadData?.count ?? 0

  const filteredCampaigns = useMemo(() => {
    let list = rawCampaigns
    if (statusFilter) list = list.filter(c => (c.campaign_status ?? '').toLowerCase() === statusFilter)
    if (searchQ) {
      const q = searchQ.toLowerCase()
      list = list.filter(c => (c.campaign_name ?? '').toLowerCase().includes(q) || String(c.campaign_id).includes(q))
    }
    return list
  }, [rawCampaigns, statusFilter, searchQ])

  function handleRefresh() {
    refetchMetrics(); refetchCharts(); refetchCampaigns()
  }

  const subtitle = `${dates.start_date} — ${dates.end_date} · ${filteredCampaigns.length} campaigns`

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-dash${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Campaign Performance" subtitle={subtitle} unread={unread} onRefresh={handleRefresh} onMenuToggle={() => setNavOpen(o => !o)} />
        <div className="gf-content">
          {/* Section 1 – Filters */}
          <FilterBar
            datePreset={datePreset} setDatePreset={setDatePreset}
            customStart={customStart} setCustomStart={setCustomStart}
            customEnd={customEnd} setCustomEnd={setCustomEnd}
            campaignType={campaignType} setCampaignType={setCampaignType}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            searchQ={searchQ} setSearchQ={setSearchQ}
            dataMinDate={metrics?.data_min_date}
            dataMaxDate={metrics?.data_max_date}
          />

          {/* Section 2 – Scoreboard */}
          <Scoreboard metrics={metrics} dates={dates} defaultSlots={['sales','total_cost','roas','acos','ctr','cpc']} isLoading={loadingMetrics} />

          {/* Section 3 + 4 */}
          <div className="gf-row-2-even">
            <CampaignTypeDistribution charts={charts} campaigns={rawCampaigns} />
            <PlacementPerformance charts={charts} campaigns={rawCampaigns} />
          </div>

          {/* Section 5 – Campaign Table */}
          <CampaignTable campaigns={filteredCampaigns} prevCampaigns={prevCampaigns} loading={camLoading} prevDates={prevDates} />

          <footer style={{ padding: '16px 0 4px', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
            <span>GLANCEFIVE · CAMPAIGN PERFORMANCE · v1.0</span>
            <span>Amazon Advertising API · Data source: ad_metrics</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
