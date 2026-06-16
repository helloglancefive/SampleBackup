import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtCur, fmtNum } from '../../shared/utils'

// ── AI Performance Brief ──────────────────────────────────────

export function AIBriefCard({ metrics, charts }: { metrics: any; charts: any }) {
  if (!metrics) return null

  const spend    = metrics.total_cost ?? 0
  const sales    = metrics.total_sales_14d ?? 0
  const roas     = metrics.overall_roas
  const acos     = metrics.overall_acos != null ? metrics.overall_acos * 100 : null
  const trendS   = metrics.trend_sales_14d
  const trendC   = metrics.trend_cost
  const impr     = metrics.total_impressions ?? 0
  const clicks   = metrics.total_clicks ?? 0
  const ctr      = metrics.overall_ctr != null ? metrics.overall_ctr * 100 : null

  const breakdown: any[] = charts?.ad_type_breakdown ?? []
  const totalBdSpend = breakdown.reduce((s: number, t: any) => s + (t.spend || 0), 0)
  const topType = [...breakdown].sort((a, b) => (b.spend || 0) - (a.spend || 0))[0]

  const adTypeLabel: Record<string, string> = { SP: 'Sponsored Products', SB: 'Sponsored Brands', SD: 'Sponsored Display' }
  const isGoodRoas = roas != null && roas >= 3
  const isGoodAcos = acos != null && acos < 30

  return (
    <div className="gf-card gf-ai-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="gf-ai-head">
        <div className="gf-ai-mark">AI</div>
        <div className="gf-ai-title">Performance Brief</div>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>
          AUTO-GENERATED
        </span>
      </div>

      <div className="gf-ai-body">
        {spend > 0 && sales > 0 ? (
          <>
            Your account delivered{' '}
            <b style={{ color: 'var(--good)' }}>{fmtCur(sales)} in attributed sales</b>{' '}
            on <b style={{ color: 'var(--accent)' }}>{fmtCur(spend)} spend</b>
            {roas != null && <> — <b style={{ color: isGoodRoas ? 'var(--good)' : 'var(--text)' }}>ROAS {roas.toFixed(2)}×</b></>}
            {acos != null && <>, ACoS <b style={{ color: isGoodAcos ? 'var(--good)' : 'var(--bad)' }}>{acos.toFixed(1)}%</b></>}
            .{' '}
          </>
        ) : (
          <>No ad performance data available for this period. </>
        )}

        {trendS != null && (
          <>
            Sales are{' '}
            <b style={{ color: trendS >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {trendS >= 0 ? 'up' : 'down'} {Math.abs(trendS).toFixed(1)}%
            </b>{' '}
            vs the prior period
            {trendC != null && (
              <>, spend{' '}
                <b style={{ color: trendC > 5 ? 'var(--bad)' : trendC < -5 ? 'var(--good)' : 'var(--text-2)' }}>
                  {trendC >= 0 ? 'up' : 'down'} {Math.abs(trendC).toFixed(1)}%
                </b>
              </>
            )}
            .{' '}
          </>
        )}

        {topType && totalBdSpend > 0 && (
          <>
            <b>{adTypeLabel[topType.ad_type] ?? topType.ad_type}</b> leads with{' '}
            <b style={{ color: 'var(--accent)' }}>{fmtCur(topType.spend)}</b>
            {' '}({((topType.spend / totalBdSpend) * 100).toFixed(0)}% of spend).{' '}
          </>
        )}

        {impr > 0 && ctr != null && (
          <>
            {fmtNum(impr)} impressions at <b>{ctr.toFixed(2)}% CTR</b> driving{' '}
            <b>{fmtNum(clicks)}</b> clicks.
          </>
        )}
      </div>

      <div className="gf-ai-foot">
        {[
          { label: 'Campaigns →', to: '/campaigns' },
          { label: 'Keywords →',  to: '/keywords'  },
          { label: 'Smart Recs →', to: '/recommendations' },
        ].map(l => (
          <Link
            key={l.to}
            to={l.to}
            style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-2)',
              textDecoration: 'none', padding: '4px 10px',
              border: '1px solid var(--border)', borderRadius: 6,
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Festival / Event Countdown ────────────────────────────────

const FESTIVALS = [
  { name: 'Independence Day Sale', date: '2026-08-15', saleDays: 7 },
  { name: 'Raksha Bandhan',        date: '2026-08-09', saleDays: 3 },
  { name: 'Janmashtami',           date: '2026-08-14', saleDays: 3 },
  { name: 'Onam',                  date: '2026-09-10', saleDays: 7 },
  { name: 'Navratri',              date: '2026-09-30', saleDays: 10 },
  { name: 'Dussehra',              date: '2026-10-09', saleDays: 5  },
  { name: 'Great Indian Festival', date: '2026-10-15', saleDays: 21 },
  { name: 'Diwali',                date: '2026-10-29', saleDays: 14 },
  { name: 'Bhai Dooj',             date: '2026-11-01', saleDays: 2  },
  { name: 'Christmas Sale',        date: '2026-12-25', saleDays: 14 },
  { name: 'Republic Day Sale',     date: '2027-01-26', saleDays: 10 },
  { name: 'Holi',                  date: '2027-03-06', saleDays: 7  },
]

const PREP_ITEMS = [
  'Review and pause underperforming campaigns',
  'Set up dedicated festival ad campaigns',
  'Boost bids on high-converting keywords',
  'Set daily budget caps for peak days',
  'Update product listing images & A+ content',
]

export function FestivalCard() {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const upcoming = useMemo(() => {
    const today = Date.now()
    return FESTIVALS
      .map(f => ({ ...f, daysUntil: Math.ceil((new Date(f.date).getTime() - today) / 86400000) }))
      .filter(f => f.daysUntil > 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? null
  }, [])

  if (!upcoming) return null

  const toggle = (i: number) => setChecked(prev => {
    const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next
  })

  const saleStartDays = upcoming.daysUntil - upcoming.saleDays

  return (
    <div className="gf-card gf-fest">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 4 }}>
        Next Big Event
      </div>
      <div className="gf-fest-title">{upcoming.name}</div>

      <div className="gf-fest-count">
        <div>
          <div className="gf-num">{upcoming.daysUntil}</div>
          <span className="gf-lbl">Days to go</span>
        </div>
        {saleStartDays > 0 && (
          <div>
            <div className="gf-num" style={{ fontSize: 24, color: 'var(--text-2)' }}>{saleStartDays}</div>
            <span className="gf-lbl">Days to sale start</span>
          </div>
        )}
      </div>

      <div className="gf-fest-check">
        {PREP_ITEMS.map((item, i) => (
          <div
            key={i}
            className={`gf-item${checked.has(i) ? ' done' : ''}`}
            onClick={() => toggle(i)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="gf-box">
              {checked.has(i) && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Budget Pacing ─────────────────────────────────────────────

export function BudgetPacingCard({
  campaigns,
  dates,
}: {
  campaigns: any[]
  dates: { start_date: string; end_date: string }
}) {
  const dayCount = useMemo(() => {
    const d1 = new Date(dates.start_date + 'T00:00:00')
    const d2 = new Date(dates.end_date + 'T00:00:00')
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dates])

  const rows = useMemo(() => {
    return campaigns
      .filter(c => c.budget != null && c.budget > 0)
      .map(c => {
        const expected = (c.budget as number) * dayCount
        const actual   = c.spend || 0
        const pct      = expected > 0 ? (actual / expected) * 100 : 0
        const isPaused = (c.campaign_status || '').toLowerCase() === 'paused'
        const status   = isPaused ? 'paused' : pct >= 95 ? 'warn' : pct >= 65 ? 'good' : 'bad'
        return { ...c, expected, actual, pct, status }
      })
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 8)
  }, [campaigns, dayCount])

  const typeShort: Record<string, string> = {
    spCampaigns: 'SP', sbCampaigns: 'SB', sdCampaigns: 'SD',
    sbTargeting: 'SB', sdTargeting: 'SD', spTargeting: 'SP',
  }

  return (
    <div className="gf-card">
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Budget Pacing</div>
          <div className="gf-card-sub">
            {rows.length
              ? `Spend vs ${dayCount}-day budget · ${rows.length} campaigns`
              : 'No campaign budget data available'}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          No campaigns with daily budget set
        </div>
      ) : (
        <div style={{ padding: '2px 0' }}>
          {rows.map((c, i) => (
            <div key={i} className="gf-pace-row">
              <div className="gf-pace-name">
                {c.campaign_name || `Campaign ${c.campaign_id}`}
                <div className="meta">
                  {typeShort[c.report_type] ?? c.report_type ?? '—'} · {c.campaign_status ?? 'active'}
                </div>
              </div>
              <div className={`gf-pace-bar ${c.status}`} style={{ position: 'relative' }}>
                <i style={{ width: `${Math.min(100, c.pct)}%` }} />
                <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
              </div>
              <div className="gf-pace-val">
                {fmtCur(c.actual)}
                <div className="gf-sub">of {fmtCur(c.expected)} · {c.pct.toFixed(0)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Anomaly Detector ──────────────────────────────────────────

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

export function AnomalyCard({ charts }: { charts: any }) {
  const anomalies = useMemo(() => {
    const series: any[] = [...(charts?.series ?? [])].sort((a, b) => a.date < b.date ? -1 : 1)
    if (series.length < 5) return []

    const costs  = series.map(d => d.cost      || 0)
    const salesA = series.map(d => d.sales_14d || 0)

    const meanC = costs.reduce((s, v)  => s + v, 0) / costs.length
    const meanS = salesA.reduce((s, v) => s + v, 0) / salesA.length
    const stdC  = stddev(costs)
    const stdS  = stddev(salesA)

    type Anom = { type: 'spike' | 'drop' | 'win'; label: string; detail: string; date: string; mag: number }
    const results: Anom[] = []

    series.forEach(d => {
      const cost = d.cost || 0
      const sale = d.sales_14d || 0
      const zC   = stdC > 0 ? (cost - meanC) / stdC : 0
      const zS   = stdS > 0 ? (sale - meanS) / stdS : 0

      if (zC > 1.8) {
        results.push({
          type: 'spike', label: 'Spend spike',
          detail: `${fmtCur(cost)} (+${((cost / Math.max(meanC, 0.01) - 1) * 100).toFixed(0)}% vs avg)`,
          date: d.date, mag: zC,
        })
      } else if (zC < -1.8) {
        results.push({
          type: 'drop', label: 'Spend drop',
          detail: `${fmtCur(cost)} (${((cost / Math.max(meanC, 0.01) - 1) * 100).toFixed(0)}% vs avg)`,
          date: d.date, mag: Math.abs(zC),
        })
      }

      if (zS > 1.8 && zC <= 1.5) {
        results.push({
          type: 'win', label: 'Sales surge',
          detail: `${fmtCur(sale)} (+${((sale / Math.max(meanS, 0.01) - 1) * 100).toFixed(0)}% vs avg)`,
          date: d.date, mag: zS,
        })
      } else if (zS < -1.8 && zC >= -1.5) {
        results.push({
          type: 'drop', label: 'Sales dip',
          detail: `${fmtCur(sale)} (${((sale / Math.max(meanS, 0.01) - 1) * 100).toFixed(0)}% vs avg)`,
          date: d.date, mag: Math.abs(zS),
        })
      }
    })

    return results.sort((a, b) => b.mag - a.mag).slice(0, 5)
  }, [charts])

  const ICON: Record<string, string> = { spike: '!', drop: '↓', win: '↑' }

  return (
    <div className="gf-card">
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Anomaly Detector</div>
          <div className="gf-card-sub">Statistical outliers · ±1.8σ threshold</div>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
          {(charts?.series?.length ?? 0) < 5
            ? 'Need at least 5 days of data to detect anomalies'
            : '✓ No anomalies in this period'}
        </div>
      ) : (
        <div style={{ padding: '2px 0' }}>
          {anomalies.map((a, i) => (
            <div key={i} className="gf-anom-row">
              <div className={`gf-anom-icon ${a.type}`}>{ICON[a.type]}</div>
              <div className="gf-anom-text">
                {a.label}
                <div className="meta">{a.date} · {a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Day-of-Week Heatmap ───────────────────────────────────────

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function DayHeatmap({ charts }: { charts: any }) {
  const [metric, setMetric] = useState<'cost' | 'clicks' | 'sales_14d'>('cost')

  const { weeks, weekData, maxVal } = useMemo(() => {
    const raw: any[] = charts?.series ?? []
    if (!raw.length) return { weeks: [] as string[], weekData: {} as Record<string, Record<string, number>>, maxVal: 1 }

    const series = [...raw].sort((a, b) => a.date < b.date ? -1 : 1)

    const dayMap: Record<string, number> = {}
    series.forEach(d => { dayMap[d.date] = d[metric] || 0 })

    const firstDate = new Date(series[0].date + 'T00:00:00')
    const lastDate  = new Date(series[series.length - 1].date + 'T00:00:00')

    // Find the Monday on or before firstDate
    const dow = firstDate.getDay()
    const offsetToMon = (dow + 6) % 7 // Sun=6, Mon=0, Tue=1, ...
    const startMon = new Date(firstDate)
    startMon.setDate(startMon.getDate() - offsetToMon)

    const weeks: string[] = []
    const weekData: Record<string, Record<string, number>> = {}

    const cur = new Date(startMon)
    while (cur <= lastDate) {
      const wk = cur.toISOString().slice(0, 10)
      weeks.push(wk)
      weekData[wk] = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(cur)
        d.setDate(d.getDate() + i)
        const ds = d.toISOString().slice(0, 10)
        weekData[wk][DOW_LABELS[i]] = dayMap[ds] ?? -1
      }
      cur.setDate(cur.getDate() + 7)
    }

    const maxVal = Math.max(...series.map(d => d[metric] || 0), 0.001)
    return { weeks, weekData, maxVal }
  }, [charts, metric])

  if (!weeks.length) return null

  const getColor = (val: number) => {
    if (val < 0) return 'rgba(100,160,240,0.03)'
    if (val === 0) return 'rgba(100,160,240,0.05)'
    const t = Math.pow(val / maxVal, 0.55)
    return metric === 'sales_14d'
      ? `rgba(0,219,164,${0.1 + t * 0.8})`
      : metric === 'clicks'
        ? `rgba(100,160,240,${0.1 + t * 0.8})`
        : `rgba(240,180,41,${0.1 + t * 0.8})`
  }

  const fmtTip = (val: number) =>
    val < 0 ? '—'
      : metric === 'cost'     ? fmtCur(val)
      : metric === 'sales_14d' ? fmtCur(val)
      : fmtNum(val) + ' clicks'

  const CELL = 18
  const GAP  = 3

  return (
    <div className="gf-card">
      <div className="gf-card-header">
        <div>
          <div className="gf-card-title">Day-of-Week Pattern</div>
          <div className="gf-card-sub">{weeks.length} weeks of data</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {([['cost', 'Spend'], ['clicks', 'Clicks'], ['sales_14d', 'Sales']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                padding: '3px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid',
                background: metric === m ? 'rgba(100,160,240,0.12)' : 'transparent',
                borderColor: metric === m ? 'rgba(100,160,240,0.3)' : 'var(--border)',
                color: metric === m ? 'var(--info)' : 'var(--text-3)',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {/* Week date labels along top */}
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${weeks.length}, ${CELL}px)`, gap: GAP, marginBottom: 4, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-3)' }}>
          <div />
          {weeks.map((w, i) => {
            const d = new Date(w + 'T00:00:00')
            const show = d.getDate() <= 7 || i === 0
            return (
              <div key={w} style={{ textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap' }}>
                {show ? d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : ''}
              </div>
            )
          })}
        </div>

        {/* Day rows */}
        {DOW_LABELS.map(day => (
          <div key={day} style={{ display: 'grid', gridTemplateColumns: `40px repeat(${weeks.length}, ${CELL}px)`, gap: GAP, marginBottom: GAP }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
              {day}
            </div>
            {weeks.map(w => {
              const val = weekData[w]?.[day] ?? -1
              return (
                <div
                  key={w}
                  title={val >= 0 ? `${w} ${day}: ${fmtTip(val)}` : ''}
                  style={{ width: CELL, height: CELL, borderRadius: 2, background: getColor(val) }}
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
          <span>Less</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {[0.15, 0.35, 0.55, 0.75, 0.92].map(t => (
              <div key={t} style={{ width: 10, height: 10, borderRadius: 2, background: getColor(maxVal * t) }} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
