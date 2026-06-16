import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Legend, CartesianGrid,
} from 'recharts'
import '../dashboard/DashboardPage.css'
import {
  useGetMetricsQuery, useGetKeywordsQuery, useGetCampaignsQuery,
  useGetProductsQuery, useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import { fmtCur, fmtNum, fmtX } from '../../shared/utils'
import { Icon } from '../../shared/Icon'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPct(n: number | null | undefined): string { return n == null ? '—' : n.toFixed(2) + '%' }
function growthPct(current: number, prev: number): number {
  if (!prev || prev === 0) return 0
  return ((current - prev) / prev) * 100
}
function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
function nextMonthStr(): string {
  const d = new Date(); d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function getRefDates(days = 30) {
  const today = new Date()
  const f = (d: Date) => d.toISOString().slice(0, 10)
  const s = new Date(today); s.setDate(s.getDate() - (days - 1))
  return { start_date: f(s), end_date: f(today) }
}

// ── Seasonal Calendar (India Amazon) ─────────────────────────────────────────
const SEASONAL: Record<number, { mult: number; label: string; events: string[]; tip: string }> = {
  1:  { mult: 0.82, label: 'Slow',       events: ['Republic Day Sale (Jan 26)'],                                              tip: 'Post-holiday lull. Focus on efficiency and keyword mining.' },
  2:  { mult: 0.88, label: 'Low',        events: ["Valentine's Day", 'Budget Season'],                                       tip: 'Gifting & fashion categories lift. Good for testing.' },
  3:  { mult: 0.93, label: 'Medium',     events: ['Holi Sale', 'FY-end Deals', 'Women\'s Day'],                              tip: 'Clear slow-moving inventory. Restructure campaigns before summer.' },
  4:  { mult: 0.90, label: 'Medium',     events: ['Ugadi', 'Vishu', 'Summer Sale'],                                          tip: 'Summer categories (Fans, ACs, Apparel) peak. Seasonal pivots needed.' },
  5:  { mult: 0.86, label: 'Low',        events: ["Mother's Day", 'Summer Deals'],                                           tip: 'Quietest month. Best time to test new ad formats and creatives.' },
  6:  { mult: 0.91, label: 'Medium',     events: ['Mid-Year Sale', "Father's Day"],                                          tip: 'Pre-Prime Day prep window. Build exact match campaigns now.' },
  7:  { mult: 1.32, label: 'Very High',  events: ['🎉 Amazon Prime Day', 'Freedom Sale', 'Kargil Vijay Diwas Sale'],         tip: 'Highest traffic month. Increase budget 3x for Prime Day window.' },
  8:  { mult: 1.14, label: 'High',       events: ['Independence Day Sale (Aug 15)', 'Raksha Bandhan', 'Janmashtami'],        tip: 'Strong gifting season. Gift sets and combos outperform.' },
  9:  { mult: 1.20, label: 'High',       events: ['Onam Bumper Sale', 'Back-to-School', 'Navratri begins'],                  tip: 'Festival season warming up. Scale winners from last month.' },
  10: { mult: 1.48, label: 'Peak 🔥',   events: ['🎉 Great Indian Festival', '🎉 Big Billion Days', 'Dussehra', 'Navratri'], tip: 'PEAK of the year. Start prep 3 weeks early. Max all budgets.' },
  11: { mult: 1.28, label: 'Very High',  events: ['🎉 Diwali', 'Dhanteras', 'Black Friday', "Children's Day"],              tip: 'Second highest month. Diwali single-week = 40% of monthly sales.' },
  12: { mult: 1.15, label: 'High',       events: ['Christmas Deals', 'Year-End Clearance', 'New Year Sale'],                 tip: 'Premium and gifting categories peak. Plan year-end clearance.' },
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Goal = 'visibility' | 'sales' | 'balanced'
interface ScenarioForecast {
  id: string; label: string; budget: number; sales: number; orders: number
  impressions: number; clicks: number; acos: number; roas: number
  recommended: boolean; tag: string
}
interface RiskItem { type: string; level: 'critical' | 'high' | 'medium' | 'low'; issue: string; mitigation: string }
interface WeekTask { title: string; tasks: string[] }

interface BidRec { keyword: string; matchType: string; currentBid: number; recBid: number; cvr: number; targetAcos: number }
interface WeekPace { week: number; label: string; pct: number; daily: number; total: number; note: string }

interface ComputedPlan {
  refSpend: number; refSales: number; refOrders: number; refRoas: number
  refAcos: number; refImpressions: number; refClicks: number; refCtr: number
  refCpc: number; avgOrderValue: number
  scenarioBudgets: number[]
  scenarios: ScenarioForecast[]
  planned: ScenarioForecast
  seasonalMult: number; seasonalEvents: string[]; seasonalTip: string
  spPct: number; sbPct: number; sdPct: number; allocationRationale: string
  confidenceScore: number
  risks: RiskItem[]
  weeklyRoadmap: WeekTask[]
  kwScale: any[]; kwHarvest: any[]; kwNeg: any[]
  prodScale: any[]; prodMaintain: any[]; prodOptimize: any[]; prodReduce: any[]
  campScale: any[]; campMaintain: any[]; campOptimize: any[]; campPause: any[]
  placements: { name: string; currentShare: number; adjPct: number; rationale: string; color: string }[]
  // ── new ──
  chartData: { name: string; budget: number; sales: number; orders: number; roas: number; acos: number; color: string }[]
  roasCurve: { scale: string; budget: number; roas: number; acos: number }[]
  cpcForecast: { scenario: string; spCpc: number; sbCpm: number; sdCpm: number; efficiency: number }[]
  weekPacing: WeekPace[]
  bidRecs: BidRec[]
  breakEvenRoas: number
}

const GOAL_CFG: Record<Goal, { color: string; label: string; desc: string }> = {
  visibility: { color: '#6c8cff', label: 'Visibility', desc: 'Maximise impressions, reach & share of voice' },
  sales:      { color: '#00dba4', label: 'Sales',      desc: 'Maximise orders, revenue & conversion rate' },
  balanced:   { color: '#f0b429', label: 'Balanced',   desc: 'Sustainable growth with controlled ACoS' },
}

// ── Forecast Engine ───────────────────────────────────────────────────────────
function buildPlan(
  goal: Goal, planningMonthStr: string, proposedBudget: number, _growthTargetPct: number,
  metrics: any, campaigns: any[], keywords: any[], products: any[]
): ComputedPlan {
  const monthNum = parseInt(planningMonthStr.split('-')[1] ?? '7', 10)
  const seasonal = SEASONAL[monthNum] ?? SEASONAL[7]

  // ── Reference period baseline ─────────────────────────────────────────────
  const refSpend  = metrics?.total_cost        ?? 0
  const refSales  = metrics?.total_sales_14d   ?? metrics?.total_sales ?? 0
  const refOrders = metrics?.total_purchases_14d ?? metrics?.total_purchases ?? 0
  const refImp    = metrics?.total_impressions ?? 0
  const refClicks = metrics?.total_clicks      ?? 0
  const refRoas   = metrics?.overall_roas      ?? (refSales && refSpend ? refSales / refSpend : 3.5)
  const refAcosRaw= metrics?.overall_acos      ?? (refRoas ? (1 / refRoas) : 0.29)
  const refAcos   = refAcosRaw * 100
  const refCtr    = metrics?.overall_ctr       ?? (refClicks && refImp ? refClicks / refImp : 0.004)
  const refCpc    = metrics?.overall_cpc       ?? (refSpend && refClicks ? refSpend / refClicks : 18)
  const avgOV     = refOrders > 0 ? refSales / refOrders : 800

  // ── Goal multipliers ──────────────────────────────────────────────────────
  const goalEffMult  = goal === 'sales' ? 1.06 : goal === 'visibility' ? 0.94 : 1.0
  const goalImpMult  = goal === 'visibility' ? 1.10 : goal === 'sales' ? 0.95 : 1.0
  const goalRoasMult = goal === 'sales' ? 1.08 : goal === 'visibility' ? 0.92 : 1.0

  // ── Scenario generator ────────────────────────────────────────────────────
  const baseBudget = proposedBudget > 0 ? proposedBudget : refSpend > 0 ? refSpend * 1.25 : 10000
  const scenarioBudgets = [
    Math.round(baseBudget * 0.70),
    Math.round(baseBudget * 0.85),
    Math.round(baseBudget),
    Math.round(baseBudget * 1.25),
  ]

  function projectScenario(budget: number, id: string, label: string, tag: string, recommended: boolean): ScenarioForecast {
    const scale = refSpend > 0 ? budget / refSpend : 1
    // Diminishing returns: sales grow sub-linearly above base
    const impScale    = scale <= 1 ? scale : Math.pow(scale, 0.85)
    const effMult     = goalEffMult * goalRoasMult
    const roas        = Math.max(1.5, refRoas * (1 / Math.max(1, Math.log10(scale + 0.5) * 0.3 + 1)) * effMult * seasonal.mult)
    const sales       = budget * roas
    const orders      = Math.round(sales / Math.max(avgOV, 1))
    const impressions = Math.round(refImp * impScale * goalImpMult * seasonal.mult)
    const clicks      = Math.round(impressions * refCtr)
    const acos        = (1 / roas) * 100
    return { id, label, budget, sales, orders, impressions, clicks, acos, roas, recommended, tag }
  }

  const scenarios: ScenarioForecast[] = [
    projectScenario(scenarioBudgets[0], 'A', 'Budget A — Conservative', 'Stay flat', false),
    projectScenario(scenarioBudgets[1], 'B', 'Budget B — Moderate',     '~15% increase', false),
    projectScenario(scenarioBudgets[2], 'C', 'Budget C — Growth',       '~25% increase', true),
    projectScenario(scenarioBudgets[3], 'D', 'Budget D — Aggressive',   '~50% increase', false),
  ]

  // ── Allocation: SP / SB / SD ──────────────────────────────────────────────
  const alloc = {
    visibility: { sp: 50, sb: 32, sd: 18, r: 'Visibility goal: Invest heavily in Sponsored Brands (headline + video) and Display for upper-funnel awareness. SP covers core search traffic.' },
    sales:      { sp: 72, sb: 18, sd: 10, r: 'Sales goal: Sponsored Products drive 72% — best ROI for direct purchase intent. SB captures brand searches. SD for retargeting past visitors.' },
    balanced:   { sp: 62, sb: 25, sd: 13, r: 'Balanced goal: SP anchors efficiency, SB builds brand equity, SD closes retargeting loop. Proven 60/25/15 allocation for sustainable growth.' },
  }[goal]

  // ── Product plan ──────────────────────────────────────────────────────────
  const prodScale    = products.filter((p: any) => (p.acos ?? 1) < 0.25 && (p.sales_14d ?? 0) > 1000)
  const prodMaintain = products.filter((p: any) => { const a = p.acos ?? 1; return a >= 0.25 && a < 0.45 && (p.sales_14d ?? 0) > 300 })
  const prodOptimize = products.filter((p: any) => (p.acos ?? 1) > 0.45 && (p.sales_14d ?? 0) > 0 && (p.cost ?? 0) > 100)
  const prodReduce   = products.filter((p: any) => (p.cost ?? 0) > 200 && (p.sales_14d ?? 0) === 0)

  // ── Campaign plan ─────────────────────────────────────────────────────────
  const campScale    = campaigns.filter((c: any) => (c.roas ?? 0) >= 4 && (c.spend ?? 0) > 200)
  const campMaintain = campaigns.filter((c: any) => { const r = c.roas ?? 0; return r >= 2.5 && r < 4 && (c.spend ?? 0) > 100 })
  const campOptimize = campaigns.filter((c: any) => (c.acos ?? 0) * 100 > 60 && (c.spend ?? 0) > 100 && (c.sales ?? 0) > 0)
  const campPause    = campaigns.filter((c: any) => (c.spend ?? 0) > 200 && (c.sales ?? 0) === 0)

  // ── Keyword plan ──────────────────────────────────────────────────────────
  const kwScale   = keywords.filter((k: any) => (k.conv_rate ?? 0) > 0.07 && (k.acos ?? 1) < 0.35 && (k.cost ?? 0) > 50).slice(0, 10)
  const kwHarvest = keywords.filter((k: any) => (k.purchases_14d ?? 0) >= 2 && (k.match_type ?? '').toLowerCase() !== 'exact').slice(0, 8)
  const kwNeg     = keywords.filter((k: any) => (k.cost ?? 0) > 100 && (k.purchases_14d ?? 0) === 0).slice(0, 10)

  // ── Placement strategy ────────────────────────────────────────────────────
  const placements = [
    { name: 'Top of Search', currentShare: 45, adjPct: goal === 'visibility' ? +30 : goal === 'sales' ? +25 : +20, rationale: 'Highest visibility and CTR. Premium placement for brand searches.', color: '#00dba4' },
    { name: 'Rest of Search', currentShare: 35, adjPct: goal === 'visibility' ? +15 : +5, rationale: 'Secondary search results. Good for volume campaigns and broad terms.', color: '#6c8cff' },
    { name: 'Product Pages', currentShare: 20, adjPct: goal === 'sales' ? +20 : +10, rationale: 'Competitor and related product pages. Best for retargeting and category conquest.', color: '#f0b429' },
  ]

  // ── Risks ─────────────────────────────────────────────────────────────────
  const risks: RiskItem[] = []
  const proposed = scenarios[2].budget
  if (proposed > refSpend * 2.2) risks.push({ type: 'Budget Risk', level: 'high', issue: `Proposed budget is ${((proposed / refSpend - 1) * 100).toFixed(0)}% above reference — high over-spend risk if campaigns aren't ready.`, mitigation: 'Phase increases: 30% in week 1, 30% in week 2. Monitor daily ROAS before each step-up.' })
  if (refRoas < 2.5)             risks.push({ type: 'ROAS Risk', level: 'critical', issue: `Current ROAS ${refRoas.toFixed(1)}× is below the 2.5× sustainable threshold. Scaling now amplifies losses.`, mitigation: 'Fix underperforming campaigns first. Only scale after ROAS reaches 3×.' })
  if (refAcos > 60)              risks.push({ type: 'ACoS Risk', level: 'high', issue: `Blended ACoS at ${refAcos.toFixed(0)}% exceeds 60% — campaigns are running below margin. Growth plan needs to address this first.`, mitigation: 'Reduce bids on ACoS > 100% campaigns before increasing budgets.' })
  if (seasonal.mult > 1.2)       risks.push({ type: 'Competition Risk', level: 'medium', issue: `${monthName(planningMonthStr)} is a peak season month (${seasonal.label}). CPCs will be 20–40% higher than baseline as all advertisers increase spend.`, mitigation: 'Book budget early. Prioritize exact match. Avoid bidding on overly broad terms during peak.' })
  if (prodReduce.length > 2)     risks.push({ type: 'Inventory Risk', level: 'medium', issue: `${prodReduce.length} products spending with zero sales — potential listing/inventory issue. Scaling these will burn budget.`, mitigation: 'Pause these ASINs before scaling. Check FBA inventory levels and listing quality.' })
  if (refCpc > 30)               risks.push({ type: 'CPC Risk', level: 'medium', issue: `Average CPC of ${fmtCur(refCpc)} is elevated. Further scaling will push CPCs higher on competitive keywords.`, mitigation: 'Focus scale budget on exact match keywords with proven CVR. Avoid broad match for scale.' })
  if (refCtr && refCtr * 100 < 0.25) risks.push({ type: 'Creative Risk', level: 'low', issue: `Account CTR at ${(refCtr * 100).toFixed(2)}% is below benchmark. New budget will yield fewer clicks than optimal.`, mitigation: 'Refresh main images on top 3 campaigns before scaling to ensure budget efficiency.' })

  // ── Weekly Roadmap ────────────────────────────────────────────────────────
  const planned = scenarios[2]
  const weeklyRoadmap: WeekTask[] = [
    {
      title: 'Week 1 — Foundation & Launch',
      tasks: [
        `Increase budgets by 20% on Scale campaigns: ${campScale.slice(0, 2).map((c: any) => `"${c.campaign_name || c.campaign_id}"`).join(', ') || 'top ROAS performers'}`,
        `Pause or reduce ${campPause.length} zero-sales campaigns — redirect budget to winners`,
        `Add negative keywords from search term report: ${kwNeg.slice(0, 3).map((k: any) => `"${k.keyword || k.targeting_text}"`).join(', ') || 'review Search Term Report'}`,
        `Set ${monthName(planningMonthStr)} budget caps in Campaign Manager`,
        `Enable "Dynamic bids - up and down" for all Scale campaigns`,
      ],
    },
    {
      title: 'Week 2 — Scale & Optimise',
      tasks: [
        `Increase budgets another 20% on campaigns showing positive ROAS trend`,
        `Harvest converting search terms from auto/broad campaigns → add as Exact Match`,
        `Keywords to scale: ${kwScale.slice(0, 3).map((k: any) => `"${k.keyword || k.targeting_text}"`).join(', ') || 'check CVR > 8% keywords'}`,
        `Review Top of Search placement modifiers — increase to ${placements[0].adjPct > 0 ? '+' + placements[0].adjPct : placements[0].adjPct}%`,
        `Audit product listings for CTR issues (image, price, reviews)`,
      ],
    },
    {
      title: 'Week 3 — Mid-Month Review & Adjust',
      tasks: [
        `Download performance report — compare actual vs planned ROAS (target: ${fmtX(planned.roas)})`,
        `If ROAS tracking above plan: increase budgets by further 15%`,
        `If ROAS below plan: cut bids on underperformers first before reducing budget`,
        `Review product-level ACoS — pause ASIN campaigns that haven't improved`,
        `${goal === 'visibility' ? 'Check impression share — target 25%+ on primary keywords' : 'Check conversion rate trends — target CVR ≥ ' + (refOrders && refClicks ? ((refOrders / refClicks) * 100).toFixed(1) : '5') + '%'}`,
      ],
    },
    {
      title: 'Week 4 — Close, Report & Plan',
      tasks: [
        `Final budget flush: ensure full budget utilisation by month end`,
        `Download and save monthly Search Term Report for next month negatives`,
        `Document what worked: which campaigns / keywords / placements delivered ROAS > 4×`,
        `Prepare next month brief: carry winners forward, restructure underperformers`,
        `Generate GlanceFive report for client review — export all recommendations`,
      ],
    },
  ]

  // ── Chart data: scenario comparison ──────────────────────────────────────
  const SCENARIO_COLORS = ['#94a3b8', '#6c8cff', '#00dba4', '#f0b429']
  const chartData = [
    { name: 'Baseline', budget: Math.round(refSpend), sales: Math.round(refSales), orders: Math.round(refOrders), roas: parseFloat(refRoas.toFixed(2)), acos: parseFloat(refAcos.toFixed(1)), color: '#475569' },
    ...scenarios.map((s, i) => ({ name: s.id, budget: s.budget, sales: Math.round(s.sales), orders: s.orders, roas: parseFloat(s.roas.toFixed(2)), acos: parseFloat(s.acos.toFixed(1)), color: SCENARIO_COLORS[i] })),
  ]

  // ── ROAS diminishing-returns curve ────────────────────────────────────────
  const effMult = goalEffMult * goalRoasMult
  const roasCurve = Array.from({ length: 12 }, (_, i) => {
    const scale = 0.4 + i * 0.2
    const budget = Math.round(refSpend > 0 ? refSpend * scale : baseBudget * scale)
    const roas = parseFloat(Math.max(1.5, refRoas * (1 / Math.max(1, Math.log10(scale + 0.5) * 0.3 + 1)) * effMult * seasonal.mult).toFixed(2))
    const acos = parseFloat((100 / roas).toFixed(1))
    return { scale: `${(scale * 100).toFixed(0)}%`, budget, roas, acos }
  })

  // ── CPC forecast per scenario ─────────────────────────────────────────────
  const cpcForecast = scenarios.map(s => {
    const scale = refSpend > 0 ? s.budget / refSpend : 1
    const cpcMultiplier = 1 + Math.log10(Math.max(scale, 0.1)) * 0.18 * seasonal.mult
    const spCpc  = parseFloat((refCpc * cpcMultiplier).toFixed(1))
    const sbCpm  = parseFloat((refCpc * 12 * cpcMultiplier).toFixed(0))
    const sdCpm  = parseFloat((refCpc * 8  * cpcMultiplier).toFixed(0))
    const efficiency = parseFloat((100 / cpcMultiplier).toFixed(1))
    return { scenario: s.id, spCpc, sbCpm, sdCpm, efficiency }
  })

  // ── Weekly budget pacing ──────────────────────────────────────────────────
  const planBudget = planned.budget
  const isPeakMonth = seasonal.mult >= 1.2
  const weekPcts = isPeakMonth ? [18, 24, 34, 24] : [22, 26, 28, 24]
  const weekLabels = ['Foundation & Launch', 'Scale & Expand', 'Peak & Harvest', 'Review & Close']
  const weekNotes = [
    'Pause waste, set negatives, launch new exact campaigns',
    'Increase bids 15–20% on winners, harvest converting search terms',
    isPeakMonth ? 'EVENT WEEK — Max budgets. Monitor hourly.' : 'Full scale on proven campaigns',
    'Spend flush, report download, plan next month brief',
  ]
  const weekPacing: WeekPace[] = weekPcts.map((pct, i) => ({
    week: i + 1, label: weekLabels[i], pct,
    daily: Math.round(planBudget * pct / 100 / 7),
    total: Math.round(planBudget * pct / 100),
    note: weekNotes[i],
  }))

  // ── Keyword bid recommendations ───────────────────────────────────────────
  const targetAcosForGoal = goal === 'sales' ? 0.30 : goal === 'visibility' ? 0.45 : 0.35
  const bidRecs: BidRec[] = kwScale.slice(0, 8).map((k: any) => {
    const cvr  = k.conv_rate != null ? k.conv_rate : k.purchases_14d != null ? k.purchases_14d / Math.max(k.clicks ?? 1, 1) : 0.07
    const currentBid = k.bid != null ? k.bid : k.cost != null ? k.cost / Math.max(k.clicks ?? 1, 1) : 20
    const recBid = Math.round(cvr * avgOV * targetAcosForGoal * 0.95)
    return {
      keyword:    k.keyword || k.targeting_text || '—',
      matchType:  k.match_type || 'Broad',
      currentBid: parseFloat(currentBid.toFixed(1)),
      recBid:     Math.max(recBid, 5),
      cvr:        parseFloat((cvr * 100).toFixed(1)),
      targetAcos: targetAcosForGoal * 100,
    }
  })

  // ── Break-even ROAS ───────────────────────────────────────────────────────
  const breakEvenRoas = 2.5  // placeholder — overridden by grossMargin from UI state

  return {
    refSpend, refSales, refOrders, refRoas, refAcos, refImpressions: refImp, refClicks, refCtr, refCpc, avgOrderValue: avgOV,
    scenarioBudgets, scenarios, planned,
    seasonalMult: seasonal.mult, seasonalEvents: seasonal.events, seasonalTip: seasonal.tip,
    spPct: alloc.sp, sbPct: alloc.sb, sdPct: alloc.sd, allocationRationale: alloc.r,
    confidenceScore: Math.min(95, Math.max(45, 60 + (refSpend > 0 ? 15 : 0) + (refRoas > 0 ? 10 : 0) + (keywords.length > 10 ? 10 : 0))),
    risks, weeklyRoadmap,
    kwScale, kwHarvest, kwNeg,
    prodScale, prodMaintain, prodOptimize, prodReduce,
    campScale, campMaintain, campOptimize, campPause,
    placements,
    chartData, roasCurve, cpcForecast, weekPacing, bidRecs, breakEvenRoas,
  }
}


// ── Shared UI pieces ──────────────────────────────────────────────────────────
function SecCard({ num, title, icon, desc, children, defaultOpen = true }: { num: number; title: string; icon: string; desc: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="gf-card" style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none' }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(108,140,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
          <Icon name={icon} size={13} />
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', fontWeight: 700, minWidth: 28 }}>{num === 35 ? 'S3b' : `S${num.toString().padStart(2, '0')}`}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{desc}</div></div>
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '18px 20px' }}>{children}</div>}
    </div>
  )
}

function GrowthBadge({ pct }: { pct: number }) {
  const up = pct >= 0; const abs = Math.abs(pct)
  return <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: up ? '#00dba4' : '#ff4d6d', background: up ? 'rgba(0,219,164,0.1)' : 'rgba(255,77,109,0.1)', borderRadius: 4, padding: '2px 6px' }}>{up ? '+' : '-'}{abs.toFixed(1)}%</span>
}

function RiskBadge({ level }: { level: 'critical' | 'high' | 'medium' | 'low' }) {
  const cfg = { critical: ['#ff4d6d', 'rgba(255,77,109,0.12)'], high: ['#f0b429', 'rgba(240,180,41,0.12)'], medium: ['#6c8cff', 'rgba(108,140,255,0.12)'], low: ['#94a3b8', 'rgba(148,163,184,0.1)'] }[level]
  return <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: cfg[0], background: cfg[1], padding: '2px 7px', borderRadius: 4 }}>{level}</span>
}

function MetricRow({ label, baseline: r, plan: p, unit = '' }: { label: string; baseline: number; plan: number; unit?: string }) {
  const gp = growthPct(p, r)
  const fmt = (n: number) => unit === '₹' ? fmtCur(n) : unit === '%' ? fmtPct(n) : unit === '×' ? fmtX(n) : fmtNum(n)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 90px', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(100,160,240,0.07)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{fmt(r)}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-1)' }}>{fmt(p)}</span>
      <GrowthBadge pct={gp} />
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function MediaPlanPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [goal, setGoal]               = useState<Goal>('balanced')
  const [planningMonth, setPlanningMonth] = useState(nextMonthStr)
  const [budgetInput, setBudgetInput]     = useState('')
  const [growthInput, setGrowthInput]     = useState('25')
  const [selectedScenario, setSelectedScenario] = useState(2)
  const [grossMargin, setGrossMargin]     = useState('40')
  const [s3View, setS3View]               = useState<'cards' | 'chart'>('chart')

  const refDates = useMemo(() => getRefDates(30), [])
  const { data: metrics, refetch: rm } = useGetMetricsQuery(refDates)
  const { data: keywords  = [], refetch: rk } = useGetKeywordsQuery({ ...refDates, limit: 150 })
  const { data: campaigns = [], refetch: rc } = useGetCampaignsQuery({ ...refDates, limit: 200 })
  const { data: products  = [], refetch: rp } = useGetProductsQuery({ ...refDates, limit: 100 })
  const { data: unreadData } = useGetUnreadCountQuery()
  const unread = unreadData?.count ?? 0

  const proposedBudget = parseFloat(budgetInput) || 0
  const growthTarget   = parseFloat(growthInput)  || 25

  const plan = useMemo(
    () => buildPlan(goal, planningMonth, proposedBudget, growthTarget, metrics, campaigns, keywords, products),
    [goal, planningMonth, proposedBudget, growthTarget, metrics, campaigns, keywords, products]
  )

  const activeScenario = plan.scenarios[selectedScenario] ?? plan.scenarios[2]
  const goalCfg = GOAL_CFG[goal]

  // ── derive effective proposed budget for display ──────────────────────────
  const displayBudget = proposedBudget > 0 ? proposedBudget : plan.scenarioBudgets[2]

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-shell${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Media Plan & Forecast" subtitle={`${monthName(planningMonth)} · ${goalCfg.label} goal · ${fmtCur(displayBudget)} proposed`} unread={unread} onRefresh={() => { rm(); rk(); rc(); rp() }} onMenuToggle={() => setNavOpen(o => !o)} preActions={<button className="gf-icon-btn" onClick={() => window.print()} title="Print / Export PDF"><Icon name="print" size={15} /></button>} />

        <div className="gf-content">

          {/* ── Controls ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Goal */}
            <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['visibility','sales','balanced'] as Goal[]).map(g => (
                <button key={g} onClick={() => setGoal(g)} style={{ padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, border: 'none', borderRight: g !== 'balanced' ? '1px solid var(--border)' : 'none', background: goal === g ? GOAL_CFG[g].color + '20' : 'transparent', color: goal === g ? GOAL_CFG[g].color : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s' }}>
                  {g === 'visibility' ? '👁 ' : g === 'sales' ? '💰 ' : '⚖️ '}{g}
                </button>
              ))}
            </div>
            {/* Planning month */}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Planning Month</div>
              <input type="month" value={planningMonth} onChange={e => setPlanningMonth(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer' }} />
            </div>
            {/* Proposed budget */}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Proposed Budget (₹)</div>
              <input type="number" placeholder={`${Math.round(plan.refSpend * 1.25)}`} value={budgetInput} onChange={e => setBudgetInput(e.target.value)} style={{ width: 130, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)' }} />
            </div>
            {/* Growth target */}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Growth Target %</div>
              <input type="number" value={growthInput} onChange={e => setGrowthInput(e.target.value)} style={{ width: 80, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)' }} />
            </div>
            {/* Gross margin */}
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em' }}>Gross Margin %</div>
              <input type="number" min="1" max="99" value={grossMargin} onChange={e => setGrossMargin(e.target.value)} style={{ width: 80, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)' }} />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Reference: Last 30 days · {refDates.start_date} → {refDates.end_date}</span>
              <span style={{ fontSize: 11, color: goalCfg.color }}>Seasonal index: {plan.seasonalMult.toFixed(2)}× — {SEASONAL[parseInt(planningMonth.split('-')[1])]?.label ?? 'Medium'}</span>
            </div>
          </div>

          {/* Goal banner */}
          <div style={{ background: goalCfg.color + '10', border: `1px solid ${goalCfg.color}28`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: goalCfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: goalCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{goalCfg.label} Goal · </span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{goalCfg.desc}. All forecast numbers below are adjusted for this goal.</span>
          </div>

          {/* ── S1: Plan Settings ── */}
          <SecCard num={1} title="Plan Settings" icon="target" desc="Configuration overview for this media plan">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Planning Month',     value: monthName(planningMonth),             color: goalCfg.color },
                { label: 'Business Goal',       value: goalCfg.label,                        color: goalCfg.color },
                { label: 'Reference Spend',     value: fmtCur(plan.refSpend),                color: '#94a3b8' },
                { label: 'Proposed Budget',     value: fmtCur(displayBudget),                color: '#00dba4' },
                { label: 'Growth Target',       value: `+${growthTarget}%`,                  color: '#f0b429' },
                { label: 'Forecast Confidence', value: `${plan.confidenceScore}%`,           color: plan.confidenceScore >= 80 ? '#00dba4' : '#f0b429' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(100,160,240,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '8px 14px', background: `${goalCfg.color}0d`, borderRadius: 8, fontSize: 11, color: 'var(--text-3)' }}>
              <strong style={{ color: 'var(--text-2)' }}>Seasonal note:</strong> {monthName(planningMonth)} has a seasonal demand index of <strong style={{ color: goalCfg.color }}>{plan.seasonalMult.toFixed(2)}×</strong> — upcoming events: {plan.seasonalEvents.join(', ')}. {plan.seasonalTip}
            </div>
          </SecCard>

          {/* ── S2: Executive Media Plan ── */}
          <SecCard num={2} title="Executive Media Plan" icon="chart" desc="Last 30 days vs planned month comparison">
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 90px', gap: 12, marginBottom: 8, padding: '6px 0' }}>
              {['Metric', 'Last 30 Days (Actual)', `${monthName(planningMonth)} (Planned)`, 'Change'].map(h => (
                <span key={h} style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{h}</span>
              ))}
            </div>
            <MetricRow label="Ad Spend"    baseline={plan.refSpend} plan={activeScenario.budget}      unit="₹" />
            <MetricRow label="Ad Sales"    baseline={plan.refSales} plan={activeScenario.sales}       unit="₹" />
            <MetricRow label="Orders"      baseline={plan.refOrders} plan={activeScenario.orders}      />
            <MetricRow label="ROAS"        baseline={plan.refRoas} plan={activeScenario.roas}        unit="×" />
            <MetricRow label="ACoS"        baseline={plan.refAcos} plan={activeScenario.acos}        unit="%" />
            <MetricRow label="Impressions" baseline={plan.refImpressions} plan={activeScenario.impressions} />
            <MetricRow label="Clicks"      baseline={plan.refClicks} plan={activeScenario.clicks}      />
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', padding: '6px 0' }}>
              Showing Scenario {['A','B','C','D'][selectedScenario]} — change scenario in Section 3.
              <strong style={{ color: 'var(--text-2)', marginLeft: 6 }}>Seasonal multiplier: {plan.seasonalMult.toFixed(2)}×</strong>
            </div>
          </SecCard>

          {/* ── S3: Forecast Engine ── */}
          <SecCard num={3} title="Forecast Engine — Budget Scenarios" icon="up" desc="Click a scenario to update the executive plan">
            {/* View toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['chart', 'cards'] as const).map(v => (
                <button key={v} onClick={() => setS3View(v)} style={{ padding: '5px 14px', borderRadius: 6, border: `1px solid ${s3View === v ? 'var(--accent)' : 'var(--border)'}`, background: s3View === v ? 'rgba(108,140,255,0.12)' : 'transparent', color: s3View === v ? 'var(--accent)' : 'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {v === 'chart' ? <><Icon name="chart" size={12} /> Chart view</> : <><Icon name="grid" size={12} /> Card view</>}
                </button>
              ))}
            </div>

            {s3View === 'chart' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Sales comparison bar chart */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Estimated Sales by Scenario</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={plan.chartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,160,240,0.08)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickFormatter={v => fmtCur(v)} width={72} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="sales" name="Est. Sales (₹)" radius={[4,4,0,0]}
                        label={{ position: 'top', fontSize: 9, fill: 'var(--text-3)', formatter: (v: number) => fmtCur(v) }}
                        fill="url(#salesGrad)"
                      />
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00dba4" stopOpacity={0.9}/>
                          <stop offset="100%" stopColor="#00dba4" stopOpacity={0.4}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* ROAS curve */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>ROAS Diminishing Returns Curve — as budget scales from baseline</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={plan.roasCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,160,240,0.08)" />
                      <XAxis dataKey="scale" tick={{ fontSize: 9, fill: 'var(--text-3)' }} label={{ value: 'Budget vs Baseline', position: 'insideBottom', offset: -2, fontSize: 9, fill: 'var(--text-3)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickFormatter={v => v + '×'} width={40} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={2.5} stroke="#ff4d6d" strokeDasharray="4 2" label={{ value: 'Min viable ROAS', fontSize: 8, fill: '#ff4d6d' }} />
                      <Line dataKey="roas" name="ROAS" stroke="#6c8cff" strokeWidth={2} dot={{ r: 3, fill: '#6c8cff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Orders comparison */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Estimated Orders vs ACoS%</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={plan.chartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,160,240,0.08)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'var(--text-3)' }} width={40} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickFormatter={v => v + '%'} width={40} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar yAxisId="left"  dataKey="orders" name="Orders" fill="#6c8cff" opacity={0.85} radius={[3,3,0,0]} />
                      <Bar yAxisId="right" dataKey="acos"   name="ACoS %" fill="#f0b429" opacity={0.7}  radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {plan.scenarios.map((sc, i) => {
                  const active = i === selectedScenario
                  return (
                    <div key={sc.id} onClick={() => setSelectedScenario(i)} style={{ background: active ? 'rgba(108,140,255,0.1)' : 'var(--surface)', border: active ? `2px solid var(--accent)` : `1px solid var(--border)`, borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}>
                      {sc.recommended && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#00dba4', color: '#0a0f1a', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', padding: '2px 10px', borderRadius: 20 }}>Recommended</div>}
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginBottom: 4 }}>Scenario {sc.id}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>{sc.tag}</div>
                      {[['Budget', fmtCur(sc.budget)], ['Sales', fmtCur(sc.sales)], ['Orders', fmtNum(sc.orders)], ['ROAS', fmtX(sc.roas)], ['ACoS', fmtPct(sc.acos)]].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(100,160,240,0.06)' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{k}</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text-1)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Scenario selector strip (always visible) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {plan.scenarios.map((sc, i) => (
                <button key={sc.id} onClick={() => setSelectedScenario(i)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${selectedScenario === i ? goalCfg.color : 'var(--border)'}`, background: selectedScenario === i ? goalCfg.color + '18' : 'transparent', color: selectedScenario === i ? goalCfg.color : 'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {sc.id}: {fmtCur(sc.budget)} {sc.recommended ? '⭐' : ''}
                </button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center', marginLeft: 4 }}>← selected scenario drives Executive Plan &amp; Outcome</span>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(100,160,240,0.04)', borderRadius: 8, fontSize: 11, color: 'var(--text-3)' }}>
              Diminishing returns model: ROAS degrades ~{Math.round(Math.log10(1.5) * 15)}% per 50% budget increase. Seasonal {plan.seasonalMult.toFixed(2)}× applied. Break-even ROAS = <strong style={{ color: grossMargin ? (100 / parseFloat(grossMargin || '40')).toFixed(2) + '×' ? '#f0b429' : 'inherit' : '#f0b429' }}>{(100 / parseFloat(grossMargin || '40')).toFixed(2)}×</strong> at {grossMargin || 40}% margin.
            </div>
          </SecCard>

          {/* ── S3b: Profit & Break-even Simulator ── */}
          <SecCard num={35} title="Profit & Break-even Simulator" icon="key" desc="Net profit per scenario based on your gross margin">
            {(() => {
              const margin = parseFloat(grossMargin) / 100 || 0.4
              const beRoas = 1 / margin
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '10px 14px', background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.2)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 3 }}>Break-even ROAS</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#f0b429' }}>{beRoas.toFixed(2)}×</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>at {grossMargin}% gross margin</div>
                    </div>
                    <div style={{ width: 1, height: 48, background: 'var(--border)' }} />
                    <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, flex: 1 }}>
                      Any scenario with ROAS &gt; <strong style={{ color: '#f0b429' }}>{beRoas.toFixed(2)}×</strong> is profitable. Below break-even = net loss even with sales.{' '}
                      {plan.refRoas < beRoas
                        ? <span style={{ color: '#ff4d6d', fontWeight: 600 }}>⚠ Current ROAS ({plan.refRoas.toFixed(2)}×) is below break-even — fix efficiency before scaling.</span>
                        : <span style={{ color: '#00dba4', fontWeight: 600 }}>✓ Current ROAS ({plan.refRoas.toFixed(2)}×) is above break-even — safe to scale.</span>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {([{ name: 'Baseline', spend: plan.refSpend, sales: plan.refSales, roas: plan.refRoas }, ...plan.scenarios.map(s => ({ name: `Scenario ${s.id}`, spend: s.budget, sales: s.sales, roas: s.roas }))] as { name: string; spend: number; sales: number; roas: number }[]).map(sc => {
                      const netProfit = sc.sales * margin - sc.spend
                      const profitable = sc.roas > beRoas
                      return (
                        <div key={sc.name} style={{ background: profitable ? 'rgba(0,219,164,0.07)' : 'rgba(255,77,109,0.07)', border: `1px solid ${profitable ? 'rgba(0,219,164,0.2)' : 'rgba(255,77,109,0.2)'}`, borderRadius: 10, padding: '12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{sc.name}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>ROAS</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: sc.roas > beRoas ? '#00dba4' : '#ff4d6d', marginBottom: 8 }}>{sc.roas.toFixed(2)}×</div>
                          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>Net Profit</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: netProfit > 0 ? '#00dba4' : '#ff4d6d' }}>{netProfit >= 0 ? '+' : ''}{fmtCur(netProfit)}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: profitable ? '#00dba4' : '#ff4d6d', marginTop: 6 }}>{profitable ? '✓ Profitable' : '✗ Loss'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </SecCard>

          {/* ── S4: Budget Allocation ── */}
          <SecCard num={4} title="Budget Allocation Plan" icon="chart" desc="Recommended SP / SB / SD split for the planning month">
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                {[
                  { label: `SP ${plan.spPct}%`, pct: plan.spPct, color: '#00dba4' },
                  { label: `SB ${plan.sbPct}%`, pct: plan.sbPct, color: '#6c8cff' },
                  { label: `SD ${plan.sdPct}%`, pct: plan.sdPct, color: '#f0b429' },
                ].map(seg => (
                  <div key={seg.label} style={{ flex: seg.pct, background: seg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#0a0f1a', transition: 'all 0.4s' }}>
                    {seg.label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { name: 'Sponsored Products', pct: plan.spPct, budget: Math.round(displayBudget * plan.spPct / 100), color: '#00dba4', desc: 'Core search traffic. Best direct ROI. Manual + Auto targeting mix.' },
                  { name: 'Sponsored Brands',   pct: plan.sbPct, budget: Math.round(displayBudget * plan.sbPct / 100), color: '#6c8cff', desc: 'Brand awareness + headline ads. Video format for premium visibility.' },
                  { name: 'Sponsored Display',  pct: plan.sdPct, budget: Math.round(displayBudget * plan.sdPct / 100), color: '#f0b429', desc: 'Retargeting past visitors + competitor product pages.' },
                ].map(item => (
                  <div key={item.name} style={{ background: item.color + '0d', border: `1px solid ${item.color}25`, borderRadius: 10, padding: '14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>{fmtCur(item.budget)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(100,160,240,0.05)', borderRadius: 8, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
              <strong style={{ color: 'var(--text-1)' }}>Rationale:</strong> {plan.allocationRationale}
            </div>
            {/* CPC forecast per scenario */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>CPC / CPM Forecast by Scenario <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>(CPC increases as budget scales — competition auction effect)</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Scenario', 'Budget', 'SP CPC (est.)', 'SB CPM (est.)', 'SD CPM (est.)', 'Efficiency vs baseline'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.cpcForecast.map((row, i) => {
                    const sc = plan.scenarios[i]
                    const effColor = row.efficiency >= 100 ? '#00dba4' : row.efficiency >= 85 ? '#f0b429' : '#ff4d6d'
                    return (
                      <tr key={row.scenario} style={{ borderBottom: '1px solid rgba(100,160,240,0.06)', background: selectedScenario === i ? 'rgba(108,140,255,0.05)' : 'transparent' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-1)' }}>Scenario {row.scenario}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>{fmtCur(sc?.budget)}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: '#00dba4' }}>₹{row.spCpc}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: '#6c8cff' }}>₹{row.sbCpm}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: '#f0b429' }}>₹{row.sdCpm}</td>
                        <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, fontWeight: 700, color: effColor }}>{row.efficiency}%</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SecCard>

          {/* ── S5: Product Media Plan ── */}
          <SecCard num={5} title="Product Media Plan" icon="box" desc="ASIN-level budget recommendations">
            {products.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>No product data for last 30 days. Fetch a report first.</div>
              : (
                <div>
                  {[
                    { label: 'Scale',    color: '#00dba4', bg: 'rgba(0,219,164,0.06)',  border: 'rgba(0,219,164,0.2)',  items: plan.prodScale,    action: 'Increase SP budget +20%', icon: '↑' },
                    { label: 'Maintain', color: '#6c8cff', bg: 'rgba(108,140,255,0.06)', border: 'rgba(108,140,255,0.2)', items: plan.prodMaintain, action: 'Keep current budget ±5%',  icon: '→' },
                    { label: 'Optimize', color: '#f0b429', bg: 'rgba(240,180,41,0.06)',  border: 'rgba(240,180,41,0.2)',  items: plan.prodOptimize, action: 'Cut bids 30%, add negatives', icon: '⬇' },
                    { label: 'Reduce',   color: '#ff4d6d', bg: 'rgba(255,77,109,0.06)',  border: 'rgba(255,77,109,0.2)',  items: plan.prodReduce,   action: 'Pause SP campaigns',     icon: '✕' },
                  ].map(tier => tier.items.length === 0 ? null : (
                    <div key={tier.label} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: tier.color, background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 20, padding: '2px 10px' }}>{tier.icon} {tier.label} ({tier.items.length})</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Action: {tier.action}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                        {tier.items.slice(0, 6).map((p: any) => (
                          <div key={p.advertised_asin} style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: tier.color, marginBottom: 4 }}>{p.advertised_asin || p.advertised_sku}</div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>Spend</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{fmtCur(p.cost)}</div></div>
                              <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>Sales</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{fmtCur(p.sales_14d)}</div></div>
                              <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>ACoS</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: tier.color }}>{p.acos != null ? fmtPct(p.acos * 100) : '—'}</div></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </SecCard>

          {/* ── S6: Campaign Media Plan ── */}
          <SecCard num={6} title="Campaign Media Plan" icon="campaigns" desc="Campaign-level scale / maintain / optimize / pause decisions">
            {campaigns.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>No campaign data. Fetch a report first.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Scale',    color: '#00dba4', items: plan.campScale,    action: 'Increase budget 25–30%', reco: () => `→ Budget +25% → Placement: Top of Search +20%` },
                    { label: 'Maintain', color: '#6c8cff', items: plan.campMaintain, action: 'Keep budget, optimise bids', reco: () => `→ Review bids weekly, no budget change` },
                    { label: 'Optimise', color: '#f0b429', items: plan.campOptimize, action: 'Reduce bids, add negatives', reco: () => `→ Bids −30%, Search Term Report + negatives` },
                    { label: 'Pause',    color: '#ff4d6d', items: plan.campPause,    action: 'Pause immediately',        reco: () => `→ Pause now, diagnose before reactivating` },
                  ].map(tier => tier.items.length === 0 ? null : (
                    <div key={tier.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: tier.color, marginBottom: 6 }}>{tier.label} ({tier.items.length}) — {tier.action}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {tier.items.slice(0, 5).map((c: any) => (
                          <div key={c.campaign_id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 1fr', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(100,160,240,0.03)', border: `1px solid ${tier.color}20`, borderLeft: `3px solid ${tier.color}`, borderRadius: 7 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name || c.campaign_id}</span>
                            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: 'var(--text-3)' }}>SPEND</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{fmtCur(c.spend)}</div></div>
                            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: 'var(--text-3)' }}>ROAS</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: tier.color }}>{fmtX(c.roas)}</div></div>
                            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 8, color: 'var(--text-3)' }}>ACoS</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{c.acos != null ? fmtPct(c.acos * 100) : '—'}</div></div>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{tier.reco()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </SecCard>

          {/* ── S7: Keyword Growth Plan ── */}
          <SecCard num={7} title="Keyword Growth Plan" icon="tag" desc="Scale winners · Harvest converters · Eliminate waste">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { title: '↑ Scale', color: '#00dba4', bg: 'rgba(0,219,164,0.06)', list: plan.kwScale, sub: 'Increase bids 20–30%', impact: `+${plan.kwScale.length * 4}–${plan.kwScale.length * 8} orders/month` },
                { title: '→ Harvest', color: '#6c8cff', bg: 'rgba(108,140,255,0.06)', list: plan.kwHarvest, sub: 'Add as Exact Match', impact: `${plan.kwHarvest.length} exact match campaigns` },
                { title: '✕ Negative', color: '#ff4d6d', bg: 'rgba(255,77,109,0.06)', list: plan.kwNeg, sub: 'Add as Exact Negative', impact: `${plan.kwNeg.length > 0 ? fmtCur(plan.kwNeg.reduce((s: number, k: any) => s + (k.cost ?? 0), 0)) : '—'} recoverable` },
              ].map(col => (
                <div key={col.title} style={{ background: col.bg, borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: col.color, marginBottom: 4 }}>{col.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>{col.sub}</div>
                  {col.list.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--text-3)' }}>None identified</div>
                    : col.list.slice(0, 8).map((k: any) => (
                        <div key={k.keyword || k.targeting_text} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(100,160,240,0.07)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{k.keyword || k.targeting_text || '—'}</span>
                          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: col.color }}>{k.acos != null ? fmtPct(k.acos * 100) : k.conv_rate != null ? fmtPct(k.conv_rate * 100) + ' CVR' : fmtCur(k.cost)}</span>
                        </div>
                      ))}
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: col.color }}>Est. impact: {col.impact}</div>
                </div>
              ))}
            </div>

            {/* Bid Recommendations Table */}
            {plan.bidRecs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                  Keyword Bid Recommendations <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>formula: CVR × AOV × Target ACoS</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Keyword', 'Match', 'CVR', 'Current Bid', 'Rec. Bid', 'Change', 'Target ACoS'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.bidRecs.map((b, i) => {
                        const delta = b.recBid - b.currentBid
                        const deltaPct = b.currentBid > 0 ? ((delta / b.currentBid) * 100).toFixed(0) : '—'
                        const up = delta > 0
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(100,160,240,0.06)' }}>
                            <td style={{ padding: '7px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-1)' }}>{b.keyword}</td>
                            <td style={{ padding: '7px 10px', fontSize: 9, color: '#6c8cff' }}>{b.matchType}</td>
                            <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: '#00dba4' }}>{b.cvr}%</td>
                            <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>₹{b.currentBid}</td>
                            <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-1)' }}>₹{b.recBid}</td>
                            <td style={{ padding: '7px 10px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: up ? '#00dba4' : '#ff4d6d' }}>{up ? '↑' : '↓'} {up ? '+' : ''}{typeof deltaPct === 'string' ? deltaPct : deltaPct}%</span>
                            </td>
                            <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: '#f0b429' }}>{b.targetAcos.toFixed(0)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SecCard>

          {/* ── S8: Placement Strategy ── */}
          <SecCard num={8} title="Placement Strategy" icon="target" desc="Top of Search / Rest of Search / Product Pages modifiers">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {plan.placements.map(pl => (
                <div key={pl.name} style={{ background: pl.color + '0d', border: `1px solid ${pl.color}25`, borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: pl.color, marginBottom: 6 }}>{pl.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    <div><div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 3 }}>Current Share</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>~{pl.currentShare}%</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 3 }}>Recommended Adj.</div><div style={{ fontSize: 18, fontWeight: 800, color: pl.color }}>{pl.adjPct > 0 ? '+' : ''}{pl.adjPct}%</div></div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{pl.rationale}</div>
                  <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-3)' }}>
                    In Amazon Ads: Campaign → Placements tab → "{pl.name}" modifier → set to {pl.adjPct > 0 ? '+' : ''}{pl.adjPct}%
                  </div>
                </div>
              ))}
            </div>
          </SecCard>

          {/* ── S9: Goal-Based Strategy ── */}
          <SecCard num={9} title="Goal-Based Strategy" icon="bolt" desc="Tailored strategy for your selected objective">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: goalCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Priority Metrics for {goalCfg.label}</div>
                {(goal === 'visibility' ? [
                  { metric: 'Impressions', target: fmtNum(activeScenario.impressions), priority: 'Primary' },
                  { metric: 'Clicks',      target: fmtNum(activeScenario.clicks),      priority: 'Primary' },
                  { metric: 'CTR',         target: '> 0.40%',                           priority: 'Secondary' },
                  { metric: 'ROAS',        target: '> 2.0×',                            priority: 'Guard rail' },
                  { metric: 'ACoS',        target: '< 50%',                             priority: 'Guard rail' },
                ] : goal === 'sales' ? [
                  { metric: 'Ad Sales',    target: fmtCur(activeScenario.sales), priority: 'Primary' },
                  { metric: 'Orders',      target: fmtNum(activeScenario.orders), priority: 'Primary' },
                  { metric: 'ROAS',        target: fmtX(activeScenario.roas), priority: 'Primary' },
                  { metric: 'ACoS',        target: fmtPct(activeScenario.acos), priority: 'Target' },
                  { metric: 'Conv. Rate',  target: '> 8%', priority: 'Target' },
                ] : [
                  { metric: 'Ad Sales',    target: fmtCur(activeScenario.sales), priority: 'Primary' },
                  { metric: 'ROAS',        target: fmtX(activeScenario.roas), priority: 'Primary' },
                  { metric: 'Impressions', target: fmtNum(activeScenario.impressions), priority: 'Secondary' },
                  { metric: 'ACoS',        target: fmtPct(activeScenario.acos), priority: 'Target' },
                  { metric: 'Orders',      target: fmtNum(activeScenario.orders), priority: 'Secondary' },
                ]).map(row => (
                  <div key={row.metric} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(100,160,240,0.07)' }}>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{row.metric}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 6, textTransform: 'uppercase' }}>{row.priority}</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: goalCfg.color }}>{row.target}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: goalCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Strategy Recommendations</div>
                {(goal === 'visibility' ? [
                  'Increase broad match coverage — target new search queries',
                  'Boost Sponsored Brands video ads — highest recall format',
                  'Set Top of Search placement modifier to +40–60%',
                  'Expand to category targeting with Sponsored Display',
                  'Add auto-targeting campaigns with loose match type',
                  'Increase daily budget cap — impressions plateau when budget limited',
                  'Track: Share of Voice (SoV) for your top 5 keywords monthly',
                ] : goal === 'sales' ? [
                  'Concentrate budget on Exact Match campaigns — highest CVR',
                  'Scale top 3 ROAS campaigns first before expanding',
                  'Harvest converting search terms weekly → build Exact campaigns',
                  'Add Sponsored Display retargeting → close cart abandoners',
                  'Bid modifier: Top of Search +25% for your best keywords',
                  'Product pages targeting on top 5 competitor ASINs',
                  'Target: conversion rate > 10% on your best Exact keywords',
                ] : [
                  'Split budget: 60% scale winners, 30% maintain, 10% test',
                  'Week 1–2: Fix inefficiencies before scaling',
                  'Week 3–4: Scale campaigns that hit ROAS target',
                  'Monitor blended ACoS weekly — pause any > 80%',
                  'Grow keyword portfolio by harvesting from auto campaigns',
                  'Balance reach (Broad/Auto) with efficiency (Exact/Phrase)',
                  'Review: Top 5 ROAS and Bottom 5 ACoS every Monday',
                ]).map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(100,160,240,0.06)' }}>
                    <span style={{ color: goalCfg.color, flexShrink: 0, fontSize: 10, marginTop: 2 }}>→</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </SecCard>

          {/* ── S10: Seasonal Opportunities ── */}
          <SecCard num={10} title="Seasonal Opportunities" icon="calendar" desc="India Amazon calendar — upcoming events and budget recommendations">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {Array.from({ length: 4 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() + i)
                const mn = d.getMonth() + 1
                const s = SEASONAL[mn]
                const isCurrent = planningMonth === `${d.getFullYear()}-${String(mn).padStart(2, '0')}`
                return (
                  <div key={mn} style={{ background: isCurrent ? `${goalCfg.color}12` : 'rgba(100,160,240,0.04)', border: isCurrent ? `2px solid ${goalCfg.color}` : '1px solid var(--border)', borderRadius: 10, padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? goalCfg.color : 'var(--text-1)' }}>{d.toLocaleDateString('en-IN', { month: 'long' })}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: s.mult >= 1.3 ? '#ff4d6d' : s.mult >= 1.1 ? '#f0b429' : s.mult < 0.9 ? '#94a3b8' : '#00dba4' }}>{s.mult.toFixed(2)}×</div>
                    </div>
                    <div style={{ fontSize: 9, color: s.mult >= 1.2 ? '#f0b429' : 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                    {s.events.slice(0, 3).map(e => <div key={e} style={{ fontSize: 10, color: 'var(--text-2)', marginBottom: 2 }}>• {e}</div>)}
                    {isCurrent && <div style={{ marginTop: 8, fontSize: 10, color: goalCfg.color, lineHeight: 1.4 }}>{s.tip}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '10px 14px', background: `${plan.seasonalMult >= 1.2 ? '#f0b429' : plan.seasonalMult >= 1.0 ? '#00dba4' : '#94a3b8'}12`, border: `1px solid ${plan.seasonalMult >= 1.2 ? '#f0b429' : '#00dba4'}28`, borderRadius: 8, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-1)' }}>Budget Recommendation for {monthName(planningMonth)}:</strong>{' '}
              {plan.seasonalMult >= 1.3
                ? `HIGH DEMAND month (${plan.seasonalMult.toFixed(2)}× multiplier). Allocate maximum budget — competition will be fierce. Start campaigns 2 weeks before the main event.`
                : plan.seasonalMult >= 1.1
                  ? `Above-average demand month (${plan.seasonalMult.toFixed(2)}×). Good opportunity for growth. Increase budget 15–25% above reference.`
                  : `Below-average demand month (${plan.seasonalMult.toFixed(2)}×). Focus on efficiency — use this time to test, restructure, and prepare for peak months.`}
            </div>
          </SecCard>

          {/* ── S11: Inventory Validation ── */}
          <SecCard num={11} title="Inventory Validation" icon="shield" desc="Sales-velocity based inventory risk before scaling">
            {products.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>No product data available.</div>
              : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {products.slice(0, 12).map((p: any) => {
                      const dailySales = (p.sales_14d ?? 0) / 14
                      const daysOfStock = dailySales > 0 ? Math.round(30 / dailySales * 10) : null
                      const status: 'safe' | 'attention' | 'critical' | 'paused' =
                        (p.sales_14d ?? 0) === 0 ? 'paused' :
                        daysOfStock != null && daysOfStock < 15 ? 'critical' :
                        daysOfStock != null && daysOfStock < 30 ? 'attention' : 'safe'
                      const cfg = {
                        safe:      { color: '#00dba4', bg: 'rgba(0,219,164,0.07)',    label: 'Safe to Scale' },
                        attention: { color: '#f0b429', bg: 'rgba(240,180,41,0.07)',   label: 'Monitor Closely' },
                        critical:  { color: '#ff4d6d', bg: 'rgba(255,77,109,0.07)',   label: 'Do NOT Scale' },
                        paused:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', label: 'No Sales' },
                      }[status]
                      return (
                        <div key={p.advertised_asin} style={{ background: cfg.bg, border: `1px solid ${cfg.color}25`, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-1)' }}>{p.advertised_asin || p.advertised_sku}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 14 }}>
                            <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>Daily Sales</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{fmtCur(dailySales)}/day</div></div>
                            <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>Units/Day</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{((p.units_sold ?? 0) / 14).toFixed(1)}</div></div>
                            <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>ACoS</div><div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: cfg.color }}>{p.acos != null ? fmtPct(p.acos * 100) : '—'}</div></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)', padding: '6px 0' }}>
                    Inventory status is estimated from sales velocity (last 14 days ÷ 14 days = daily rate). Always verify actual FBA inventory in Seller Central → Manage Inventory before approving scale budgets.
                  </div>
                </div>
              )}
          </SecCard>

          {/* ── S12: Risk Assessment ── */}
          <SecCard num={12} title="Risk Assessment" icon="alert" desc="Detected risks with mitigation plans">
            {plan.risks.length === 0
              ? <div style={{ fontSize: 12, color: '#00dba4', textAlign: 'center', padding: 16 }}>✓ No significant risks detected for this plan. Good to proceed.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...plan.risks].sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1 }[b.level] ?? 0) - ({ critical: 4, high: 3, medium: 2, low: 1 }[a.level] ?? 0)).map(risk => (
                    <div key={risk.type} style={{ background: 'var(--surface)', border: `1px solid ${({ critical: '#ff4d6d', high: '#f0b429', medium: '#6c8cff', low: '#94a3b8' }[risk.level])}28`, borderLeft: `3px solid ${({ critical: '#ff4d6d', high: '#f0b429', medium: '#6c8cff', low: '#94a3b8' }[risk.level])}`, borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <RiskBadge level={risk.level} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{risk.type}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 3 }}>Issue</div><div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{risk.issue}</div></div>
                        <div><div style={{ fontSize: 8, color: '#00dba4', textTransform: 'uppercase', marginBottom: 3 }}>Mitigation</div><div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{risk.mitigation}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </SecCard>

          {/* ── S13: Monthly Execution Roadmap ── */}
          <SecCard num={13} title="Monthly Execution Roadmap" icon="calendar" desc={`Week-by-week action plan for ${monthName(planningMonth)}`}>
            {/* Budget pacing visual */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>
                Budget Pacing Calendar <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400 }}>— how to distribute {fmtCur(activeScenario.budget)} across 4 weeks</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                {plan.weekPacing.map(wp => (
                  <div key={wp.week} style={{ background: 'rgba(100,160,240,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: `${wp.pct}%`, height: 3, background: goalCfg.color, borderRadius: '0 2px 0 0' }} />
                    <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Week {wp.week}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: goalCfg.color, marginBottom: 2 }}>{wp.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{fmtCur(wp.total)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{fmtCur(wp.daily)}/day · {wp.pct}% of budget</div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.4 }}>{wp.note}</div>
                  </div>
                ))}
              </div>
              {/* Pacing bar */}
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
                {plan.weekPacing.map((wp, i) => (
                  <div key={i} style={{ flex: wp.pct, background: [`#475569`, `#6c8cff`, `#00dba4`, `#f0b429`][i], opacity: 0.85 }} title={`Week ${wp.week}: ${wp.pct}%`} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                {plan.weekPacing.map((wp, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: [`#475569`, `#6c8cff`, `#00dba4`, `#f0b429`][i] }} />
                    W{wp.week} {wp.pct}%
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly task cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {plan.weeklyRoadmap.map((week, wi) => (
                <div key={wi} style={{ background: 'rgba(100,160,240,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: goalCfg.color }}>{week.title}</div>
                    <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-3)', background: 'rgba(100,160,240,0.08)', padding: '2px 7px', borderRadius: 10 }}>{fmtCur(plan.weekPacing[wi]?.total)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {week.tasks.map((task, ti) => (
                      <div key={ti} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ width: 18, height: 18, borderRadius: 4, background: `${goalCfg.color}15`, border: `1px solid ${goalCfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: goalCfg.color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{ti + 1}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SecCard>

          {/* ── S14: Forecasted Outcome ── */}
          <SecCard num={14} title="Forecasted Business Outcome" icon="up" desc="Expected results if this plan is fully implemented">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Sales Growth',     value: `+${growthPct(activeScenario.sales, plan.refSales).toFixed(0)}%`,    sub: `${fmtCur(plan.refSales)} → ${fmtCur(activeScenario.sales)}`, color: '#00dba4' },
                { label: 'Order Growth',     value: `+${growthPct(activeScenario.orders, plan.refOrders).toFixed(0)}%`,   sub: `${fmtNum(plan.refOrders)} → ${fmtNum(activeScenario.orders)} orders`, color: '#6c8cff' },
                { label: 'Visibility Growth',value: `+${growthPct(activeScenario.impressions, plan.refImpressions).toFixed(0)}%`, sub: `${fmtNum(plan.refImpressions)} → ${fmtNum(activeScenario.impressions)} impr.`, color: '#a78bfa' },
                { label: 'ROAS Change',      value: fmtX(activeScenario.roas),                                             sub: `Was ${fmtX(plan.refRoas)}`, color: activeScenario.roas >= plan.refRoas ? '#00dba4' : '#f0b429' },
                { label: 'ACoS Change',      value: fmtPct(activeScenario.acos),                                           sub: `Was ${fmtPct(plan.refAcos)}`, color: activeScenario.acos <= plan.refAcos ? '#00dba4' : '#ff4d6d' },
              ].map(card => (
                <div key={card.label} style={{ background: card.color + '0d', border: `1px solid ${card.color}25`, borderRadius: 10, padding: '14px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color, marginBottom: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{card.sub}</div>
                </div>
              ))}
            </div>
            {/* Confidence score */}
            <div style={{ background: 'rgba(100,160,240,0.05)', border: '1px solid rgba(100,160,240,0.15)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Forecast Confidence</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: plan.confidenceScore >= 80 ? '#00dba4' : plan.confidenceScore >= 65 ? '#f0b429' : '#ff4d6d' }}>{plan.confidenceScore}%</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: 'rgba(100,160,240,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${plan.confidenceScore}%`, height: '100%', borderRadius: 4, background: plan.confidenceScore >= 80 ? '#00dba4' : plan.confidenceScore >= 65 ? '#f0b429' : '#ff4d6d', transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Confidence reflects: data depth ({plan.refSpend > 0 ? '✓' : '✗'} spend data), campaign coverage ({campaigns.length}), keyword coverage ({keywords.length}), product coverage ({products.length}).{' '}
                  <strong style={{ color: 'var(--text-2)' }}>Forecasts are directional estimates — validate weekly against actuals.</strong>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(108,140,255,0.05)', borderRadius: 8, fontSize: 11, color: 'var(--text-3)' }}>
              <strong style={{ color: 'var(--text-2)' }}>Based on:</strong> Scenario {['A','B','C','D'][selectedScenario]} budget of {fmtCur(activeScenario.budget)} · {goalCfg.label} goal · {plan.seasonalMult.toFixed(2)}× seasonal index for {monthName(planningMonth)} · Diminishing-returns ROAS model.
            </div>
          </SecCard>

          {/* Footer */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ color: 'var(--text-3)', marginTop: 1, flexShrink: 0 }}><Icon name="info" size={14} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-2)' }}>Media Plan generated by GlanceFive.</strong> All forecasts are data-driven projections from your last 30 days of advertising performance. They use industry-standard diminishing-returns modelling and India Amazon seasonality indices.{' '}
              <strong style={{ color: 'var(--text-2)' }}>Use as a planning guide, not a guarantee.</strong> Actual results depend on competitor behaviour, inventory, listing quality, and Amazon algorithm changes. Review actuals weekly and adjust plan accordingly.{' '}
              Click <strong style={{ color: 'var(--text-2)' }}>Print</strong> (top-right) to export as PDF for client presentations.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
