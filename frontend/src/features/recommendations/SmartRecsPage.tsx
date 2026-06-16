import { useState, useMemo, useCallback } from 'react'
import { useSelector } from 'react-redux'
import '../dashboard/DashboardPage.css'
import Scoreboard from '../../components/Scoreboard'
import {
  useGetMetricsQuery, useGetKeywordsQuery, useGetCampaignsQuery,
  useGetProductsQuery, useGetUnreadCountQuery,
} from '../../store/api'
import type { RootState } from '../../store'
import { fmtCur, fmtNum, getDateRange } from '../../shared/utils'
import { Icon } from '../../shared/Icon'
import { WorkspaceSidebar } from '../../shared/WorkspaceSidebar'
import { WorkspaceTopbar } from '../../shared/WorkspaceTopbar'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Goal     = 'visibility' | 'sales' | 'balanced'
type Priority = 'critical' | 'high' | 'medium' | 'low'
type SectionId = 'exec' | 'scale' | 'visibility' | 'sales_growth' | 'optimization' | 'waste' | 'products' | 'risks' | 'do_not' | 'impact'
type EffectiveStatus = 'active' | 'actioned' | 'snoozed' | 'dismissed' | 'recurring'

interface RichRec {
  id: string           // stable entity-level ID e.g. "waste::camp::12345"
  sectionId: SectionId
  category: string
  priority: Priority
  title: string
  what: string
  why: string
  doAction: string
  doNot?: string
  impacts: string[]
  confidence: number
  goals: Goal[]
  actionSteps: string[]  // Ordered navigation path: where to go + exactly what to do
}

interface RecAction {
  status: 'actioned' | 'snoozed' | 'dismissed'
  timestamp: string   // ISO
  snoozeUntil?: string // ISO
}

interface DoNotRec { id: string; title: string; reason: string; consequence: string }
interface ImpactEstimate { metric: string; direction: 'up' | 'down'; change: string; confidence: number; color: string }

// ── Config ────────────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<Priority, { color: string; bg: string; label: string; score: number }> = {
  critical: { color: '#ff4d6d', bg: 'rgba(255,77,109,0.12)', label: 'Critical', score: 4 },
  high:     { color: '#f0b429', bg: 'rgba(240,180,41,0.12)', label: 'High',     score: 3 },
  medium:   { color: '#6c8cff', bg: 'rgba(108,140,255,0.12)', label: 'Medium',  score: 2 },
  low:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Low',     score: 1 },
}

const GOAL_CFG: Record<Goal, { color: string; label: string; desc: string }> = {
  visibility: { color: '#6c8cff', label: 'Visibility', desc: 'Max impressions, reach & share of voice — ACoS is secondary' },
  sales:      { color: '#00dba4', label: 'Sales',      desc: 'Max orders, revenue & conversion rate — efficiency matters' },
  balanced:   { color: '#f0b429', label: 'Balanced',   desc: 'Grow sales & visibility with controlled ACoS — sustainable scaling' },
}

const SECTION_META: Record<SectionId, { title: string; icon: string; desc: string }> = {
  exec:         { title: 'Executive Summary',         icon: 'bolt',        desc: 'Top 5 highest-impact actions' },
  scale:        { title: 'Scale Opportunities',       icon: 'trending_up', desc: 'High-performers ready to accelerate' },
  visibility:   { title: 'Visibility Opportunities',  icon: 'eye',         desc: 'Impression & reach gaps to close' },
  sales_growth: { title: 'Sales Growth',              icon: 'chart',       desc: 'Converting assets to amplify' },
  optimization: { title: 'Optimization',              icon: 'cog',         desc: 'Inefficiencies with root cause analysis' },
  waste:        { title: 'Waste Reduction',           icon: 'trash',       desc: 'Budget leaks to stop immediately' },
  products:     { title: 'Product Strategy',          icon: 'box',         desc: 'ASIN-level scale / maintain / optimize / reduce' },
  risks:        { title: 'Risk Alerts',               icon: 'alert',       desc: 'Account-level issues needing attention' },
  do_not:       { title: 'Do NOT Take These Actions', icon: 'shield',      desc: 'Mandatory guardrails — read before acting' },
  impact:       { title: 'Expected Business Impact',  icon: 'trending_up', desc: 'Projected outcomes if recommendations are implemented' },
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: '7D'    },
  { value: '14d',   label: '14D'   },
  { value: '30d',   label: '30D'   },
  { value: '60d',   label: '60D'   },
  { value: '90d',   label: '90D'   },
  { value: 'custom', label: 'Custom' },
]


// ── Rec Lifecycle Hook (localStorage) ─────────────────────────────────────────
function useRecActions(userKey: string) {
  const storageKey = `gf_rec_actions_v1::${userKey}`

  const [actionsMap, setActionsMap] = useState<Record<string, RecAction>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') }
    catch { return {} }
  })

  const save = useCallback((updated: Record<string, RecAction>) => {
    setActionsMap(updated)
    try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
  }, [storageKey])

  const markDone = useCallback((recId: string) => {
    save({ ...actionsMap, [recId]: { status: 'actioned', timestamp: new Date().toISOString() } })
  }, [actionsMap, save])

  const snooze = useCallback((recId: string, days: number) => {
    const until = new Date(); until.setDate(until.getDate() + days)
    save({ ...actionsMap, [recId]: { status: 'snoozed', timestamp: new Date().toISOString(), snoozeUntil: until.toISOString() } })
  }, [actionsMap, save])

  const dismiss = useCallback((recId: string) => {
    save({ ...actionsMap, [recId]: { status: 'dismissed', timestamp: new Date().toISOString() } })
  }, [actionsMap, save])

  const undo = useCallback((recId: string) => {
    const updated = { ...actionsMap }
    delete updated[recId]
    save(updated)
  }, [actionsMap, save])

  const clearAll = useCallback(() => save({}), [save])

  // Returns the effective display status for a rec that IS currently generated
  const getStatus = useCallback((recId: string): EffectiveStatus => {
    const a = actionsMap[recId]
    if (!a) return 'active'
    if (a.status === 'dismissed') return 'dismissed'
    if (a.status === 'snoozed') {
      if (a.snoozeUntil && new Date(a.snoozeUntil) > new Date()) return 'snoozed'
      return 'active'   // snooze expired — resurface
    }
    // actioned: if still showing after 7 days → recurring problem
    const daysSince = (Date.now() - new Date(a.timestamp).getTime()) / 86400000
    return daysSince >= 7 ? 'recurring' : 'actioned'
  }, [actionsMap])

  // Count recs that were actioned but are no longer generated (= resolved by data change)
  const countResolved = useCallback((generatedIds: string[]): number => {
    const idSet = new Set(generatedIds)
    return Object.entries(actionsMap).filter(([id, a]) => a.status === 'actioned' && !idSet.has(id)).length
  }, [actionsMap])

  return { actionsMap, markDone, snooze, dismiss, undo, clearAll, getStatus, countResolved }
}

// ── Recommendation Engine ─────────────────────────────────────────────────────
function generateRecs(
  goal: Goal, metrics: any, campaigns: any[], keywords: any[], products: any[],
  dates: { start_date: string; end_date: string }
): { recs: RichRec[]; doNotRecs: DoNotRec[]; impacts: ImpactEstimate[] } {
  const recs: RichRec[] = []
  const doNotRecs: DoNotRec[] = []
  const allGoals: Goal[] = ['visibility', 'sales', 'balanced']
  const isSales   = goal === 'sales'
  const isVisible = goal === 'visibility'

  const up = (p: Priority): Priority => {
    const o: Priority[] = ['low', 'medium', 'high', 'critical']
    const i = o.indexOf(p); return i < 3 ? o[i + 1] : p
  }

  // ── Scale: per-campaign (top 5 by ROAS) ──────────────────────────────────
  campaigns
    .filter((c: any) => (c.roas ?? 0) >= 4 && (c.spend ?? 0) > 200)
    .sort((a: any, b: any) => (b.roas ?? 0) - (a.roas ?? 0))
    .slice(0, 5)
    .forEach((c: any) => {
      recs.push({
        id: `scale::camp::${c.campaign_id}`,
        sectionId: 'scale', category: 'Campaign',
        priority: up('high'),
        title: `"${c.campaign_name || c.campaign_id}" — ROAS ${(c.roas ?? 0).toFixed(1)}× · Ready to scale`,
        what: `Spent ${fmtCur(c.spend)} and returned ${fmtCur(c.sales)} — ROAS ${(c.roas ?? 0).toFixed(1)}× consistently above the 4× scale threshold.`,
        why: `High ROAS means every rupee is working hard. This campaign is NOT budget-constrained — scaling is low-risk and high-reward right now.`,
        doAction: `Increase daily budget by 25–35%. Apply "Top of Search" placement modifier +20%. Consider cloning for new match types.`,
        doNot: `Don't increase bids blindly — scale budget first. Also don't mix with underperforming campaigns.`,
        impacts: [`+${fmtCur(c.sales * 0.25)} est. additional sales`, `ROAS maintained ≥ ${(c.roas ?? 4).toFixed(1)}×`, `Impression share +20–30%`],
        confidence: 88, goals: ['sales', 'balanced'],
        actionSteps: [
          `Amazon Ads Console → Campaign Manager`,
          `Search / find campaign: "${c.campaign_name || c.campaign_id}"`,
          `Click campaign name → top tab "Settings"`,
          `Daily Budget field → increase by 25–35% (e.g. ₹${Math.round((c.spend / 30) * 1.3 * 100) / 100}/day)`,
          `Click top tab "Placements" → "Top of Search (on-search)" → set adjustment to +20–30%`,
          `Click Save → monitor daily for 7 days before next increase`,
        ],
      })
    })

  // ── Scale: keyword aggregate ──────────────────────────────────────────────
  const scaleKws = keywords.filter((k: any) => (k.conv_rate ?? 0) > 0.08 && (k.acos ?? 1) < 0.30 && (k.cost ?? 0) > 50)
  if (scaleKws.length > 0) {
    const avgConv = scaleKws.reduce((s: number, k: any) => s + (k.conv_rate ?? 0), 0) / scaleKws.length
    recs.push({
      id: `scale::kw-group`,
      sectionId: 'scale', category: 'Keywords',
      priority: isSales ? 'critical' : 'high',
      title: `${scaleKws.length} keyword(s) converting at ${(avgConv * 100).toFixed(1)}% with ACoS < 30%`,
      what: `${scaleKws.length} keywords are consistently converting with ACoS below 30%. Combined spend: ${fmtCur(scaleKws.reduce((s: number, k: any) => s + k.cost, 0))}.`,
      why: `CVR > 8% + ACoS < 30% = strong product-keyword relevance. Increasing bids captures more of this proven traffic at the same efficiency.`,
      doAction: `Raise bids by 20–30% on Exact match variants. For Phrase match, go 15–20%. Create a dedicated campaign if they're mixed with others.`,
      doNot: `Don't simultaneously increase Broad match bids — it dilutes targeting and inflates irrelevant traffic spend.`,
      impacts: [`+${scaleKws.length * 3}–${scaleKws.length * 7} additional orders/week`, `Incremental revenue at ≤ 30% ACoS`],
      confidence: 84, goals: ['sales', 'balanced'],
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → find campaigns containing these keywords`,
        `Click campaign → tab "Keywords" → sort by Conv. Rate (highest first)`,
        `Select keywords where CVR > 8% AND ACoS < 30%: ${scaleKws.slice(0, 3).map((k: any) => `"${k.keyword || k.targeting_text}"`).join(', ')}`,
        `Click "Edit" → Adjust Bids → Exact match: +25%, Phrase match: +15%`,
        `Best practice: Create a new campaign "SP | Top Converters | Exact" and move these keywords there`,
        `Set that campaign budget = target monthly spend / 30 days`,
      ],
    })
  }

  // ── Scale: product aggregate ──────────────────────────────────────────────
  const scaleProd = products.filter((p: any) => (p.acos ?? 1) < 0.25 && (p.sales_14d ?? 0) > 2000)
  if (scaleProd.length > 0) {
    recs.push({
      id: `scale::product-group`,
      sectionId: 'scale', category: 'Products',
      priority: 'high',
      title: `${scaleProd.length} ASIN(s) with ACoS < 25% and strong sales — invest more`,
      what: `${scaleProd.length} ASINs generating ${fmtCur(scaleProd.reduce((s: number, p: any) => s + p.sales_14d, 0))} combined sales with ACoS below 25%.`,
      why: `Low ACoS + high sales = proven product-market fit. These ASINs won't waste budget — they're your best growth lever.`,
      doAction: `Increase Sponsored Products budget. Consider adding Sponsored Brands and Sponsored Display for full-funnel coverage.`,
      doNot: `Don't reduce their budget to "test efficiency" — cutting spend risks losing top-of-search placement to competitors permanently.`,
      impacts: [`+18–30% sales potential`, `ACoS stays < 25%`, `Best ROI deployment of available budget`],
      confidence: 87, goals: allGoals,
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → find existing SP campaigns for these ASINs`,
        `ASINs to scale: ${scaleProd.slice(0, 4).map((p: any) => p.advertised_asin).join(', ')}`,
        `Campaign → Settings → Daily Budget → increase by 20%`,
        `Consider: Create "SP | [ASIN] | Exact" campaign for each ASIN for granular control`,
        `Consider: Add Sponsored Brands campaign (requires Brand Registry) → brand logo + headline`,
        `Consider: Sponsored Display → "Views remarketing" audience → retarget product page visitors`,
      ],
    })
  }

  // ── Visibility: per-campaign (low impressions) ────────────────────────────
  const lowImpCamps = campaigns.filter((c: any) => (c.impressions ?? 0) < 500 && (c.spend ?? 0) > 0)
  if (lowImpCamps.length > 0) {
    recs.push({
      id: `vis::low-imp-camps`,
      sectionId: 'visibility', category: 'Campaigns',
      priority: isVisible ? up('medium') : 'medium',
      title: `${lowImpCamps.length} campaign(s) spending but generating < 500 impressions`,
      what: `${lowImpCamps.length} campaigns are active and spending but showing almost no impressions — total: ${fmtNum(lowImpCamps.reduce((s: number, c: any) => s + c.impressions, 0))}.`,
      why: `Low impressions despite spend = bids below Amazon's first-page threshold, or keywords too narrow for available search volume.`,
      doAction: `Increase bids by 30–50%. Add broader keyword match types or enable auto-targeting to discover new traffic.`,
      doNot: `Don't pause these campaigns — low impressions ≠ bad campaign. Fix the bid floor first.`,
      impacts: [`+200–500% impression increase`, `Stronger ad rank signal for organic boost`],
      confidence: 78, goals: ['visibility', 'balanced'],
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → filter by Status: Active`,
        `Campaigns affected: ${lowImpCamps.slice(0, 3).map((c: any) => `"${c.campaign_name || c.campaign_id}"`).join(', ')}`,
        `Click campaign → tab "Keywords" → sort by Impressions (lowest first)`,
        `Select all low-impression keywords → "Edit" → Adjust Bids → increase by 35–50%`,
        `Click tab "Settings" → Bid strategy → switch to "Dynamic bids - up and down"`,
        `Alternative: Add new Auto Targeting Ad Group (Loose match) to discover new search traffic`,
      ],
    })
  }

  // ── Visibility: zero-click keywords ──────────────────────────────────────
  const zeroClickKws = keywords.filter((k: any) => (k.impressions ?? 0) > 500 && (k.clicks ?? 0) === 0)
  if (zeroClickKws.length > 0) {
    recs.push({
      id: `vis::zero-click-kws`,
      sectionId: 'visibility', category: 'Keywords',
      priority: isVisible ? 'high' : 'medium',
      title: `${zeroClickKws.length} keyword(s) with ${fmtNum(zeroClickKws.reduce((s: number, k: any) => s + k.impressions, 0))} impressions and zero clicks`,
      what: `High impressions, zero clicks. Shoppers are seeing your ads on these keywords but none are clicking.`,
      why: `Zero CTR after 500+ impressions means: (1) bid is too low for top-of-page placement, or (2) main image / price is losing to competitors in the ad unit.`,
      doAction: `Raise bids by 25–40% to test top-of-page. Audit main image and price vs top 3 competitors. Run in "Top of Search" placement.`,
      doNot: `Don't add these as negatives yet — they're getting visibility. The issue is engagement, not relevance.`,
      impacts: [`CTR target: ≥ 0.3%`, `${Math.round(zeroClickKws.reduce((s: number, k: any) => s + k.impressions, 0) * 0.003)} projected additional clicks`],
      confidence: 74, goals: ['visibility', 'balanced'],
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → find campaigns using these keywords`,
        `Zero-click keywords: ${zeroClickKws.slice(0, 3).map((k: any) => `"${k.keyword || k.targeting_text}" (${k.match_type})`).join(', ')}`,
        `Campaign → tab "Keywords" → select zero-click keywords → Edit Bids → increase 25–40%`,
        `Campaign → tab "Placements" → "Top of Search (on-search)" → set adjustment to +40–60%`,
        `Outside Amazon: Update main product image (white bg, product fills 85%+ of frame)`,
        `Check your price vs top 3 organic competitors for these search terms`,
      ],
    })
  }

  // ── Sales Growth: per-campaign ────────────────────────────────────────────
  campaigns
    .filter((c: any) => (c.roas ?? 0) >= 5 && (c.purchases ?? 0) >= 5)
    .sort((a: any, b: any) => (b.purchases ?? 0) - (a.purchases ?? 0))
    .slice(0, 3)
    .forEach((c: any) => {
      recs.push({
        id: `sg::camp::${c.campaign_id}`,
        sectionId: 'sales_growth', category: 'Campaign',
        priority: isSales ? 'critical' : 'high',
        title: `"${c.campaign_name || c.campaign_id}" — ROAS ${(c.roas ?? 0).toFixed(1)}× · ${c.purchases} orders · Revenue engine`,
        what: `${c.purchases} orders at ROAS ${(c.roas ?? 0).toFixed(1)}×. Sales: ${fmtCur(c.sales)}. Your most efficient revenue-generating campaign.`,
        why: `ROAS of 5×+ means ₹5 returned per ₹1 spent. These campaigns are likely underserved — the budget cap is costing you sales daily.`,
        doAction: `Increase Top of Search bid modifier +20–30%. Add Placement boosts. Expand to Sponsored Display for retargeting these converters.`,
        doNot: `Don't spread budget across all campaigns equally — concentrate here first. Every rupee here returns 5×.`,
        impacts: [`Est. +${fmtCur(c.sales * 0.2)} additional monthly revenue`, `Order velocity +20–35%`],
        confidence: 91, goals: ['sales', 'balanced'],
        actionSteps: [
          `Amazon Ads Console → Campaign Manager`,
          `Click campaign: "${c.campaign_name || c.campaign_id}"`,
          `Tab "Placements" → "Top of Search (on-search)" → set adjustment to +30–50%`,
          `Tab "Settings" → Daily Budget → increase by 20–30%`,
          `Tab "Targeting" → review and add exact-match variants of best-performing keywords`,
          `Consider: Sponsored Display campaign → "Audiences" → Views remarketing on this product's ASIN`,
        ],
      })
    })

  // ── Sales Growth: top converting keywords ─────────────────────────────────
  const topConvKws = keywords.filter((k: any) => (k.conv_rate ?? 0) > 0.12 && (k.purchases_14d ?? 0) >= 3)
  if (topConvKws.length > 0) {
    recs.push({
      id: `sg::top-conv-kws`,
      sectionId: 'sales_growth', category: 'Keywords',
      priority: 'high',
      title: `${topConvKws.length} keyword(s) converting > 12% — your best buyer-intent terms`,
      what: `${topConvKws.length} keywords achieving > 12% conversion rate, generating ${topConvKws.reduce((s: number, k: any) => s + (k.purchases_14d ?? 0), 0)} orders in the period.`,
      why: `>12% CVR means 1 in 8 clicks buys. These shoppers have high purchase intent. Winning more clicks on these terms = near-guaranteed orders.`,
      doAction: `Isolate top performers in an Exact Match campaign with higher bid caps. Don't mix with lower-CVR keywords — they'll dilute ACoS.`,
      doNot: `Don't mix these high-CVR keywords in Broad/Auto campaigns — you'll lose the precise signal and inflate ACoS.`,
      impacts: ['+12–18 orders per 100 additional clicks', 'Revenue per click increases', 'ACoS stays controlled'],
      confidence: 89, goals: ['sales', 'balanced'],
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → Reports → Search Term Report`,
        `Date range: ${dates.start_date} to ${dates.end_date} → filter Conv. Rate > 12%, Orders ≥ 3`,
        `Note exact search query strings (not the keyword, the actual shopper queries)`,
        `Create new campaign: "SP | Top Converters | Exact Match"`,
        `Add those exact queries as Exact Match keywords with bids: (product price × target ACoS) × CVR`,
        `Keywords to move: ${topConvKws.slice(0, 3).map((k: any) => `"${k.keyword || k.targeting_text}" (CVR ${((k.conv_rate ?? 0) * 100).toFixed(1)}%)`).join(', ')}`,
        `Set daily budget = target monthly spend ÷ 30 → monitor for 14 days`,
      ],
    })
  }

  // ── Optimization: per-campaign high ACoS ─────────────────────────────────
  campaigns
    .filter((c: any) => (c.acos ?? 0) * 100 > 80 && (c.spend ?? 0) > 100)
    .sort((a: any, b: any) => (b.acos ?? 0) - (a.acos ?? 0))
    .slice(0, 5)
    .forEach((c: any) => {
      const acosVal = (c.acos ?? 0) * 100
      const roasVal = c.roas ?? 0
      const ctrLow  = c.ctr != null && c.ctr * 100 < 0.3
      recs.push({
        id: `opt::camp::${c.campaign_id}`,
        sectionId: 'optimization', category: 'Campaign',
        priority: acosVal > 150 ? 'critical' : 'high',
        title: `"${c.campaign_name || c.campaign_id}" — ACoS ${acosVal.toFixed(2)}% · Needs optimization`,
        what: `Spent ${fmtCur(c.spend)}, returned ${fmtCur(c.sales)}. ACoS is ${acosVal.toFixed(2)}% — that's ${(acosVal - 35).toFixed(1)}pp above the 35% target.`,
        why: `Root cause: ROAS ${roasVal.toFixed(2)}× + ${ctrLow ? 'low CTR (' + ((c.ctr ?? 0) * 100).toFixed(2) + '%) = keyword-product relevance issue' : 'bid too high relative to conversion rate'}. Run search term report to identify irrelevant triggers.`,
        doAction: `Reduce bids 25–40% on non-converting terms. Download search term report and add irrelevant terms as Exact negatives.`,
        doNot: `Don't pause the entire campaign — isolate the bad keywords first. Pausing may hurt account-level Ad Rank and organic position.`,
        impacts: [`Recoverable waste: ${fmtCur(c.spend * 0.35)}/period`, `ACoS target: 35–50%`, `ROAS improvement to 2.5×+`],
        confidence: acosVal > 150 ? 90 : 79, goals: allGoals,
        actionSteps: [
          `Amazon Ads Console → Campaign Manager`,
          `Click campaign: "${c.campaign_name || c.campaign_id}"`,
          `Tab "Search terms" → Date: ${dates.start_date} → ${dates.end_date} → Sort by Spend (high→low)`,
          `Select rows where Spend > ₹50 AND Orders = 0 → click "Add as negative keyword" → Exact Match → Campaign level`,
          `Tab "Keywords" → Sort by ACoS (high→low) → select ACoS > 80% keywords`,
          `Click Edit → Adjust Bids → reduce by 30–40% → Save`,
          `Recheck in 7 days — target ACoS < 60% in week 1, then < 40% in week 3`,
        ],
      })
    })

  // ── Optimization: low CTR campaigns ──────────────────────────────────────
  const lowCtrCamps = campaigns.filter((c: any) => c.ctr != null && c.ctr * 100 < 0.25 && (c.impressions ?? 0) > 1000)
  if (lowCtrCamps.length > 0) {
    recs.push({
      id: `opt::low-ctr-camps`,
      sectionId: 'optimization', category: 'Campaigns',
      priority: 'medium',
      title: `${lowCtrCamps.length} campaign(s) with CTR below 0.25% — creative or relevance issue`,
      what: `${lowCtrCamps.length} campaigns served ${fmtNum(lowCtrCamps.reduce((s: number, c: any) => s + c.impressions, 0))} impressions but converted under 0.25% to clicks.`,
      why: `CTR < 0.25% after 1000+ impressions = shoppers see your ad but choose competitors. Common causes: main image, price, reviews, or keyword mismatch.`,
      doAction: `A/B test a new main image. Check price vs top 3 organic results. Review star rating — below 4.0 kills CTR.`,
      doNot: `Don't interpret low CTR as low demand — demand may be high but your creative loses to competitors. Don't just raise bids.`,
      impacts: [`CTR to 0.4%+ adds significant ad rank benefit`, `Lower effective CPC as quality score improves`],
      confidence: 72, goals: allGoals,
      actionSteps: [
        `Campaigns with low CTR: ${lowCtrCamps.slice(0, 3).map((c: any) => `"${c.campaign_name || c.campaign_id}"`).join(', ')}`,
        `Outside Amazon: Update main product image — white background, product fills 85%+ of frame`,
        `Outside Amazon: Check your price vs top 3 organic results for your main keywords`,
        `Outside Amazon: If star rating < 4.0 — focus on getting more reviews before increasing ad spend`,
        `In Campaign Manager → Campaign → tab "Placements" → increase "Top of Search" modifier to +30%`,
        `Consider: Request an A+ Content upgrade on the product detail page (requires Brand Registry)`,
      ],
    })
  }

  // ── Waste: per-campaign (zero sales, high spend) ──────────────────────────
  campaigns
    .filter((c: any) => (c.spend ?? 0) > 300 && (c.sales ?? 0) === 0)
    .sort((a: any, b: any) => (b.spend ?? 0) - (a.spend ?? 0))
    .slice(0, 5)
    .forEach((c: any) => {
      recs.push({
        id: `waste::camp::${c.campaign_id}`,
        sectionId: 'waste', category: 'Campaign',
        priority: 'critical',
        title: `"${c.campaign_name || c.campaign_id}" — Spent ${fmtCur(c.spend)} · Zero sales`,
        what: `This campaign consumed ${fmtCur(c.spend)} in the period with zero attributed sales. Every rupee spent here is unrecovered.`,
        why: `Zero sales after ₹300+ spend = structural problem: wrong targeting, product listing not converting, or non-commercial search queries.`,
        doAction: `Pause this campaign now. Review product listing for conversion issues. Rebuild with tighter keyword list — only high-intent terms.`,
        doNot: `Don't increase budget hoping for improvement. Don't keep running "to collect data" — you have enough data. More budget = more waste.`,
        impacts: [`${fmtCur(c.spend)} immediate spend recovery`, `Portfolio ACoS improvement`, `Reallocation to proven campaigns`],
        confidence: 96, goals: allGoals,
        actionSteps: [
          `Amazon Ads Console → Campaign Manager`,
          `Find campaign: "${c.campaign_name || c.campaign_id}"`,
          `Click checkbox next to campaign → top bar "Actions" → select "Pause"`,
          `Click campaign name → tab "Search Terms" → export all search terms to CSV`,
          `Analyse: are queries relevant? If yes → fix product listing. If no → tighten keyword targeting`,
          `Before reactivating: Run Search Term Report and add irrelevant terms as Exact negatives`,
          `Do NOT click Archive — pausing preserves data and allows reactivation`,
        ],
      })
    })

  // ── Waste: keyword aggregate ──────────────────────────────────────────────
  const wasteKws = keywords.filter((k: any) => (k.cost ?? 0) > 100 && (k.purchases_14d ?? 0) === 0 && (k.sales_14d ?? 0) === 0)
  const wasteKwSpend = wasteKws.reduce((s: number, k: any) => s + (k.cost ?? 0), 0)
  if (wasteKws.length > 0) {
    recs.push({
      id: `waste::kw-group`,
      sectionId: 'waste', category: 'Keywords',
      priority: 'critical',
      title: `${wasteKws.length} keyword(s) spent ${fmtCur(wasteKwSpend)} · Zero sales or orders`,
      what: `${wasteKws.length} keywords consumed ${fmtCur(wasteKwSpend)} without generating any attributed sale or order in the attribution window.`,
      why: `Zero sales keywords are either (1) Broad match triggering irrelevant queries, (2) competing in saturated segments with weak listing conversion, or (3) top-of-funnel terms that don't close.`,
      doAction: `Add top wasters as Exact-match negatives immediately. Download search term report to identify the exact queries. Reduce bids to ₹0.01 to stop spend while keeping data.`,
      doNot: `Don't delete keywords yet — pausing preserves historical data. Understand WHY they don't convert before removing permanently.`,
      impacts: [`${fmtCur(wasteKwSpend)} recoverable per period`, `Overall ACoS reduction`, `Budget reallocation to winners`],
      confidence: 94, goals: allGoals,
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → Reports (top nav) → Sponsored Products Search Term Report`,
        `Date range: ${dates.start_date} to ${dates.end_date} → Download CSV`,
        `Open CSV → Filter: Orders = 0, Spend > ₹100 → note the "Customer Search Term" column values`,
        `These are the EXACT queries wasting budget (different from keywords — read the actual queries)`,
        `Zero-spend keywords to address: ${wasteKws.slice(0, 4).map((k: any) => `"${k.keyword || k.targeting_text}" (${k.match_type ?? 'match'}, spent ${fmtCur(k.cost ?? 0)})`).join(' | ')}`,
        `Back in Campaign Manager → find the campaign(s) running those keywords`,
        `Campaign → tab "Negative keywords" → click "Add negative keywords"`,
        `Paste the irrelevant search queries → Match type: Exact (for specific bad queries), Phrase (for bad intent patterns)`,
        `Click Save → negatives go live within 1 hour`,
        `Also reduce bids on those keywords to ₹0.01 to preserve data while stopping spend`,
      ],
    })
  }

  // ── Products: portfolio strategy ──────────────────────────────────────────
  const pScale    = products.filter((p: any) => (p.acos ?? 1) < 0.25 && (p.sales_14d ?? 0) > 1000)
  const pMaintain = products.filter((p: any) => { const a = p.acos ?? 1; return a >= 0.25 && a < 0.45 && (p.sales_14d ?? 0) > 500 })
  const pOptimize = products.filter((p: any) => (p.acos ?? 1) > 0.45 && (p.sales_14d ?? 0) > 0 && (p.cost ?? 0) > 100)
  const pReduce   = products.filter((p: any) => (p.cost ?? 0) > 200 && (p.sales_14d ?? 0) === 0)
  if (products.length > 0) {
    recs.push({
      id: `prod::strategy`,
      sectionId: 'products', category: 'Products',
      priority: 'high',
      title: `Portfolio: ${pScale.length} Scale · ${pMaintain.length} Maintain · ${pOptimize.length} Optimize · ${pReduce.length} Reduce`,
      what: `${products.length} advertised ASINs show clear segmentation by advertising efficiency and sales contribution.`,
      why: `Equal budget treatment for all products is the most common PPC mistake. Each tier needs a different strategy.`,
      doAction: `Scale: ${pScale.map((p: any) => p.advertised_asin).slice(0, 3).join(', ')}. Reduce: ${pReduce.map((p: any) => p.advertised_asin).slice(0, 2).join(', ')}.`,
      doNot: `Don't pause ALL products to save budget — reallocate from Reduce tier to Scale tier instead.`,
      impacts: [
        pScale.length > 0    ? `${pScale.length} ASINs ready for +20% budget`                                        : '',
        pReduce.length > 0   ? `${fmtCur(pReduce.reduce((s: number, p: any) => s + p.cost, 0))} recoverable from reduce-tier` : '',
        `Portfolio ACoS normalisation`,
      ].filter(Boolean),
      confidence: 82, goals: allGoals,
      actionSteps: [
        `Amazon Ads Console → Campaign Manager → search by ASIN in the search bar (top right)`,
        ...(pScale.length > 0 ? [
          `SCALE (ACoS < 25%, Sales > ₹1K): ${pScale.slice(0, 3).map((p: any) => p.advertised_asin).join(', ')}`,
          `→ Find their SP campaigns → Settings → increase Daily Budget by 20%`,
        ] : []),
        ...(pOptimize.length > 0 ? [
          `OPTIMIZE (ACoS > 45%): ${pOptimize.slice(0, 3).map((p: any) => p.advertised_asin).join(', ')}`,
          `→ Campaign → Keywords tab → reduce bids 30% on ACoS > 80% keywords → add negatives`,
        ] : []),
        ...(pReduce.length > 0 ? [
          `REDUCE (spend > ₹200, zero sales): ${pReduce.slice(0, 3).map((p: any) => p.advertised_asin).join(', ')}`,
          `→ Find their SP campaigns → checkbox → Actions → Pause`,
        ] : []),
        `Tip: Create Portfolios in Campaign Manager to group by tier for easy budget management`,
      ],
    })
  }

  // ── Risks ─────────────────────────────────────────────────────────────────
  if (metrics) {
    const roas = metrics.overall_roas
    const acos = metrics.overall_acos
    const ctr  = metrics.overall_ctr
    if (roas != null && roas < 2) {
      recs.push({
        id: `risk::low-roas`,
        sectionId: 'risks', category: 'Account Health',
        priority: 'critical',
        title: `CRITICAL: Portfolio ROAS ${roas.toFixed(1)}× — account operating at loss on advertising`,
        what: `Overall account ROAS of ${roas.toFixed(1)}× means earning less than ₹2 for every ₹1 spent across all campaigns.`,
        why: `ROAS < 2× after typical product margins means ads are eating into profit. This needs immediate portfolio restructuring — not incremental tweaks.`,
        doAction: `Immediately pause or cut budget on all campaigns with ROAS < 1.5×. Concentrate remaining budget on your top 3 ROAS performers. Set 30-day target: portfolio ROAS ≥ 3×.`,
        doNot: `Don't make incremental 5–10% changes — the scale of inefficiency needs bold action. Small adjustments won't move the needle.`,
        impacts: [`Portfolio ROAS target: 3× in 30 days`, `Spend reduction: 20–35%`, `Net profitability recovery`],
        confidence: 93, goals: allGoals,
        actionSteps: [
          `Amazon Ads Console → Campaign Manager → View all campaigns`,
          `Click column header "ROAS" to sort ascending (lowest ROAS first)`,
          `Campaigns with ROAS < 1.5×: click checkbox → Actions → Pause (immediate stop-bleed)`,
          `Campaigns with ROAS 1.5–2×: click campaign → Keywords tab → reduce all bids by 40%`,
          `Scroll to highest ROAS campaigns → Settings → increase Daily Budget by 30%`,
          `Amazon Ads Console → Reports → Campaign performance report → Download for full audit`,
          `Week 1 target: Portfolio ROAS > 2×. Week 4 target: ROAS > 3×`,
        ],
      })
    }
    if (acos != null && acos * 100 > 60) {
      recs.push({
        id: `risk::high-acos`,
        sectionId: 'risks', category: 'Account Health',
        priority: 'high',
        title: `Blended ACoS at ${(acos * 100).toFixed(2)}% — significantly above 25–35% industry target`,
        what: `Your blended ACoS of ${(acos * 100).toFixed(2)}% means spending ₹${(acos * 100).toFixed(0)} in ads to generate ₹100 in sales.`,
        why: `High blended ACoS typically comes from 3–4 underperforming campaigns dragging the portfolio. Pareto principle: fix the worst 20% to improve 80% of the metric.`,
        doAction: `Sort all campaigns by ACoS descending. Take immediate action on the top 3 worst performers — reduce bids or pause.`,
        doNot: `Don't try to fix all campaigns simultaneously — you'll spread resources too thin and improve nothing.`,
        impacts: [`ACoS target: 35% in 60 days`, `ROAS improvement to 3×+`],
        confidence: 86, goals: allGoals,
        actionSteps: [
          `Amazon Ads Console → Campaign Manager → sort all campaigns by ACoS (highest first)`,
          `Identify top 3 worst ACoS campaigns — these are the portfolio drains`,
          `For each: Campaign → Search Terms tab → add zero-order high-spend queries as Exact negatives`,
          `For each: Campaign → Keywords tab → select ACoS > 100% keywords → reduce bids 35%`,
          `Set a weekly calendar reminder every Monday to check blended ACoS trend`,
          `Target milestones: Week 2: ACoS < ${Math.round((acos ?? 0.6) * 100 * 0.8)}% → Week 4: < ${Math.round((acos ?? 0.6) * 100 * 0.6)}% → Week 8: < 35%`,
        ],
      })
    }
    if (ctr != null && ctr * 100 < 0.2) {
      recs.push({
        id: `risk::low-ctr`,
        sectionId: 'risks', category: 'Account Health',
        priority: 'medium',
        title: `Account CTR at ${(ctr * 100).toFixed(2)}% — below 0.4% benchmark · Creatives losing to competitors`,
        what: `Blended CTR of ${(ctr * 100).toFixed(2)}% means roughly 2 clicks per 1000 impressions. Amazon SP benchmark is ~0.4–0.5%.`,
        why: `Low CTR reduces ad rank over time (Amazon favours high-engagement ads). Lower rank = worse placements = higher effective CPC.`,
        doAction: `Audit top 5 campaigns: main image quality, price competitiveness, review count and star rating. A +0.1% CTR can reduce ACoS by 10–15%.`,
        doNot: `Don't just raise bids to compensate for low CTR — fix the creative first, then raise bids from a stronger position.`,
        impacts: [`CTR improvement to 0.35%+ boosts organic rank`, `Lower effective CPC as quality score improves`],
        confidence: 77, goals: allGoals,
        actionSteps: [
          `Amazon Ads Console → Campaign Manager → sort by CTR (lowest first) → identify worst 5`,
          `For each low-CTR campaign: note the main ASIN being advertised`,
          `Outside Amazon: Go to your product listing → audit main image (white bg, product fills frame, no text overlay)`,
          `Outside Amazon: Search your main keyword on Amazon → compare your listing vs top 3 organic: price, images, reviews`,
          `If price is > 10% higher than competitors → pricing adjustment will have more impact than any ad change`,
          `In Campaign Manager → Campaign → Placements tab → increase "Top of Search" modifier to +30%`,
          `Use Amazon Vine or Request a Review button to increase review count (improves CTR organically)`,
        ],
      })
    }
  }

  // ── Do NOT ────────────────────────────────────────────────────────────────
  const wasteCamps = campaigns.filter((c: any) => (c.spend ?? 0) > 300 && (c.sales ?? 0) === 0)
  if (wasteCamps.length > 0) {
    doNotRecs.push({
      id: 'dn::waste-budget',
      title: `Do NOT increase budget on the ${wasteCamps.length} zero-sales campaign(s)`,
      reason: `These campaigns already spent ${fmtCur(wasteCamps.reduce((s: number, c: any) => s + c.spend, 0))} with no return. More budget accelerates losses.`,
      consequence: `Every rupee added to zero-sales campaigns is guaranteed wasted spend until the underlying targeting is fixed.`,
    })
  }
  const broadHighAcos = keywords.filter((k: any) => (k.match_type || '').toLowerCase() === 'broad' && (k.acos ?? 0) > 0.5)
  if (broadHighAcos.length > 0) {
    doNotRecs.push({
      id: 'dn::broad-bid-increase',
      title: `Do NOT increase bids on ${broadHighAcos.length} Broad-match keyword(s) with ACoS > 50%`,
      reason: `Broad match + high ACoS = irrelevant search queries are being triggered. More budget means more irrelevant traffic.`,
      consequence: `Bid increases on high-ACoS broad keywords will raise spend on non-converting queries and worsen ACoS further.`,
    })
  }
  doNotRecs.push({
    id: 'dn::pause-for-acos-alone',
    title: `Do NOT pause a campaign based solely on ACoS without checking organic rank impact`,
    reason: `Advertising often boosts organic rank. Pausing a "high ACoS" campaign can cause organic rank to drop, losing more revenue than the ad spend saved.`,
    consequence: `Net revenue loss from organic rank decline can exceed the ACoS savings by 3–5×. Check organic rank before pausing.`,
  })
  doNotRecs.push({
    id: goal === 'visibility' ? 'dn::visibility-acos-obsess' : 'dn::sales-acos-ignore',
    title: goal === 'visibility'
      ? `Do NOT cut Visibility campaigns for "high ACoS" — you're optimising for reach, not margin`
      : `Do NOT scale aggressively without tracking ACoS — efficiency matters for long-term margin`,
    reason: goal === 'visibility'
      ? `Visibility campaigns are designed to build top-of-funnel presence. Short-term ACoS will be higher — this is expected and acceptable.`
      : `Unchecked ACoS during growth leads to unsustainable scaling that erodes profit margin and limits future growth capital.`,
    consequence: goal === 'visibility'
      ? `Cutting visibility campaigns for high ACoS defeats the purpose of the Visibility strategy and shrinks brand awareness.`
      : `ACoS spiral from uncontrolled scaling requires painful reductions that can take 2–3 months to recover from.`,
  })
  doNotRecs.push({
    id: 'dn::broad-to-exact-without-negatives',
    title: `Do NOT convert Broad-match keywords to Exact match before running the search term report`,
    reason: `Broad match discovers the actual converting search queries. Converting to Exact without knowing which queries convert may miss the real winners.`,
    consequence: `You may lock in exact match keywords for terms that never converted, while the actually converting variants continue triggering on Broad.`,
  })

  // ── Impact Estimates ──────────────────────────────────────────────────────
  const totalSales = metrics?.total_sales_14d ?? 0
  const totalSpend = metrics?.total_cost ?? 0
  const scaleUpside  = campaigns.filter((c: any) => (c.roas ?? 0) >= 4 && (c.spend ?? 0) > 200).reduce((s: number, c: any) => s + c.sales, 0) * 0.2
  const wasteRecover = (wasteKwSpend + wasteCamps.reduce((s: number, c: any) => s + c.spend, 0)) * 0.65
  const impacts: ImpactEstimate[] = [
    { metric: 'Est. Sales Increase',    direction: 'up',   change: `+${fmtCur(scaleUpside + totalSales * 0.1)}`,  confidence: 72, color: '#00dba4' },
    { metric: 'Est. Wasted Spend Saved', direction: 'down', change: fmtCur(wasteRecover),                          confidence: 91, color: '#ff4d6d' },
    { metric: 'Est. ACoS Reduction',    direction: 'down', change: wasteRecover > 0 ? `−${Math.min(20, Math.round(wasteRecover / (totalSpend || 1) * 100 * 0.8))}pp` : 'Monitor', confidence: 67, color: '#f0b429' },
    { metric: 'Est. Additional Orders', direction: 'up',   change: `+${Math.round(scaleKws.length * 4 + topConvKws.length * 5)}–${Math.round(scaleKws.length * 8 + topConvKws.length * 10)}`, confidence: 65, color: '#a78bfa' },
    { metric: 'Budget Efficiency Gain', direction: 'up',   change: pReduce.length > 0 ? `${fmtCur(pReduce.reduce((s: number, p: any) => s + p.cost, 0))} reallocatable` : 'Reassess in 14d', confidence: 80, color: '#6c8cff' },
  ]

  return { recs, doNotRecs, impacts }
}

// ── Export Engine ─────────────────────────────────────────────────────────────
function csvEsc(s: string): string { return `"${s.replace(/"/g, '""').replace(/\n/g, ' ')}"` }

function downloadCSV(
  recs: RichRec[], doNotRecs: DoNotRec[],
  dates: { start_date: string; end_date: string },
  goal: Goal, getStatus: (id: string) => EffectiveStatus
) {
  const rows: string[] = []
  rows.push(`GlanceFive Smart Recommendations Export`)
  rows.push(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`)
  rows.push(`Period: ${dates.start_date} to ${dates.end_date}`)
  rows.push(`Goal: ${GOAL_CFG[goal].label}`)
  rows.push(``)
  rows.push(`RECOMMENDATIONS`)
  rows.push([
    'Priority','Section','Category','Title',
    'What Is Happening','Why It Happens',
    'Step-by-Step Action Path (Amazon Ads Console)',
    "Don't Do This",'Expected Impact','Confidence %','Status'
  ].map(csvEsc).join(','))

  recs.forEach(r => {
    const status = getStatus(r.id)
    if (status === 'dismissed') return
    rows.push([
      r.priority.toUpperCase(),
      SECTION_META[r.sectionId].title,
      r.category,
      r.title,
      r.what,
      r.why,
      r.actionSteps.map((s, n) => `${n + 1}. ${s}`).join(' | '),
      r.doNot ?? '',
      r.impacts.join('; '),
      `${r.confidence}%`,
      status,
    ].map(csvEsc).join(','))
  })

  rows.push(``)
  rows.push(`DO NOT ACTIONS — GUARDRAILS`)
  rows.push(['Guardrail','Reason','Consequence If Ignored'].map(csvEsc).join(','))
  doNotRecs.forEach(d => {
    rows.push([d.title, d.reason, d.consequence].map(csvEsc).join(','))
  })

  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `GlanceFive_Recs_${dates.start_date}_${dates.end_date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildTextSummary(
  recs: RichRec[], doNotRecs: DoNotRec[],
  dates: { start_date: string; end_date: string },
  goal: Goal, getStatus: (id: string) => EffectiveStatus
): string {
  const lines: string[] = []
  lines.push(`GlanceFive Smart Recommendations`)
  lines.push(`Period: ${dates.start_date} → ${dates.end_date}  |  Goal: ${GOAL_CFG[goal].label}`)
  lines.push(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`)
  lines.push(`${'─'.repeat(60)}`)

  const active = recs.filter(r => { const s = getStatus(r.id); return s === 'active' || s === 'recurring' })
  const bySev = { critical: active.filter(r => r.priority === 'critical'), high: active.filter(r => r.priority === 'high'), medium: active.filter(r => r.priority === 'medium'), low: active.filter(r => r.priority === 'low') }

  const emit = (label: string, list: RichRec[], emoji: string) => {
    if (list.length === 0) return
    lines.push(``)
    lines.push(`${emoji} ${label} (${list.length})`)
    list.forEach((r, i) => {
      lines.push(``)
      lines.push(`  ${i + 1}. ${r.title}`)
      lines.push(`     [${r.category}] | Confidence: ${r.confidence}%`)
      lines.push(`     WHY: ${r.why}`)
      lines.push(`     ACTION PATH:`)
      r.actionSteps.forEach((s, n) => lines.push(`       ${n + 1}. ${s}`))
      if (r.doNot) lines.push(`     ✗ DON'T: ${r.doNot}`)
      if (r.impacts.length) lines.push(`     IMPACT: ${r.impacts.join(' · ')}`)
    })
  }

  emit('CRITICAL', bySev.critical, '🚨')
  emit('HIGH PRIORITY', bySev.high, '🔴')
  emit('MEDIUM PRIORITY', bySev.medium, '🟡')
  emit('LOW PRIORITY', bySev.low, '⚪')

  if (doNotRecs.length > 0) {
    lines.push(``)
    lines.push(`${'─'.repeat(60)}`)
    lines.push(`🚫 DO NOT TAKE THESE ACTIONS`)
    doNotRecs.forEach((d, i) => {
      lines.push(``)
      lines.push(`  ${i + 1}. ${d.title}`)
      lines.push(`     Reason: ${d.reason}`)
      lines.push(`     Consequence: ${d.consequence}`)
    })
  }

  lines.push(``)
  lines.push(`${'─'.repeat(60)}`)
  lines.push(`Total active: ${active.length} | Source: GlanceFive Ads Console`)
  return lines.join('\n')
}

function ExportBtn({ recs, doNotRecs, dates, goal, getStatus }: {
  recs: RichRec[]; doNotRecs: DoNotRec[]
  dates: { start_date: string; end_date: string }
  goal: Goal; getStatus: (id: string) => EffectiveStatus
}) {
  const [open, setOpen]    = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCSV = () => {
    downloadCSV(recs, doNotRecs, dates, goal, getStatus)
    setOpen(false)
  }
  const handleCopy = async () => {
    const text = buildTextSummary(recs, doNotRecs, dates, goal, getStatus)
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    setCopied(true); setOpen(false)
    setTimeout(() => setCopied(false), 2500)
  }

  const active = recs.filter(r => { const s = getStatus(r.id); return s !== 'dismissed' }).length

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
        cursor: 'pointer', color: copied ? '#00dba4' : 'var(--text-2)', fontSize: 11,
        fontWeight: 700, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
        transition: 'all 0.15s',
      }}>
        <Icon name={copied ? 'check' : 'trending_up'} size={13} />
        {copied ? 'Copied!' : `Export (${active})`}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden', minWidth: 220,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}>
            <div style={{ padding: '10px 14px 6px', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Export {active} recommendations
            </div>
            {[
              { icon: 'calendar', label: 'Download CSV', sub: 'Full detail with action paths', action: handleCSV },
              { icon: 'check',    label: 'Copy as text', sub: 'Paste into email or doc',       action: handleCopy },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,160,240,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ marginTop: 2, color: 'var(--accent)', flexShrink: 0 }}><Icon name={item.icon} size={14} /></div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{item.sub}</div>
                </div>
              </button>
            ))}
            <div style={{ padding: '6px 14px 10px', fontSize: 10, color: 'var(--text-3)', borderTop: '1px solid var(--border)', marginTop: 2 }}>
              Includes action paths with exact Amazon navigation
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Snooze Button ─────────────────────────────────────────────────────────────
function SnoozeBtn({ onSnooze }: { onSnooze: (days: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Snooze this recommendation"
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, fontFamily: 'inherit' }}>
        <Icon name="clock" size={12} /> Snooze
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => { onSnooze(d); setOpen(false) }}
                style={{ padding: '5px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 12, textAlign: 'left', borderRadius: 5, fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,160,240,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {d} days
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Action Path ───────────────────────────────────────────────────────────────
function ActionPath({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6,
        border: '1px solid rgba(108,140,255,0.25)', background: 'rgba(108,140,255,0.07)',
        cursor: 'pointer', color: 'var(--accent)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
      }}>
        <Icon name="search" size={12} />
        📍 Where to do this in Amazon Ads
        <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, background: 'rgba(108,140,255,0.04)', border: '1px solid rgba(108,140,255,0.15)', borderRadius: 8, padding: '10px 14px' }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map((step, i) => {
              // Highlight campaign names (text in quotes) and paths (→)
              const parts = step.split(/(→|"[^"]*")/g)
              return (
                <li key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {parts.map((part, j) =>
                    part === '→'
                      ? <span key={j} style={{ color: 'var(--accent)', fontWeight: 700, margin: '0 3px' }}>→</span>
                      : part.startsWith('"') && part.endsWith('"')
                        ? <span key={j} style={{ color: '#f0b429', fontFamily: 'var(--mono)', fontWeight: 600 }}>{part}</span>
                        : part.startsWith('SCALE') || part.startsWith('OPTIMIZE') || part.startsWith('REDUCE') || part.startsWith('Do NOT') || part.startsWith('✗')
                          ? <span key={j} style={{ color: '#ff4d6d', fontWeight: 600 }}>{part}</span>
                          : part.startsWith('Step') || part.startsWith('Tab') || part.startsWith('Week') || part.startsWith('Outside')
                            ? <span key={j} style={{ color: '#00dba4', fontWeight: 600 }}>{part}</span>
                            : <span key={j}>{part}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Rec Card ──────────────────────────────────────────────────────────────────
function RecCard({ rec, status, actionTimestamp, snoozeUntil, onMarkDone, onSnooze, onDismiss, onUndo }: {
  rec: RichRec; status: EffectiveStatus; actionTimestamp?: string; snoozeUntil?: string
  onMarkDone: () => void; onSnooze: (days: number) => void; onDismiss: () => void; onUndo: () => void
}) {
  const [expanded, setExpanded] = useState(status === 'active' || status === 'recurring')
  const pc = PRIORITY_CFG[rec.priority]

  // Actioned card: compact muted row
  if (status === 'actioned') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'rgba(0,219,164,0.04)', border: '1px solid rgba(0,219,164,0.12)', borderLeft: '3px solid #00dba4', borderRadius: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(0,219,164,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#00dba4' }}>
          <Icon name="check" size={11} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.title}</div>
          {actionTimestamp && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Marked done {fmtDate(actionTimestamp)}</div>}
        </div>
        <span style={{ fontSize: 9, background: 'rgba(0,219,164,0.12)', color: '#00dba4', padding: '2px 7px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>Done</span>
        <button onClick={onUndo} title="Undo — mark as active again"
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 10, flexShrink: 0, fontFamily: 'inherit' }}>
          <Icon name="undo" size={10} /> Undo
        </button>
      </div>
    )
  }

  // Snoozed card: compact muted row
  if (status === 'snoozed') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'rgba(100,160,240,0.03)', border: '1px solid rgba(100,160,240,0.1)', borderLeft: '3px solid rgba(100,160,240,0.3)', borderRadius: 8, opacity: 0.65 }}>
        <div style={{ color: 'var(--text-3)', flexShrink: 0 }}><Icon name="clock" size={14} /></div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.title}</div>
        {snoozeUntil && <div style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>Until {fmtDate(snoozeUntil)}</div>}
        <button onClick={onUndo} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 10, flexShrink: 0, fontFamily: 'inherit' }}>Wake up</button>
      </div>
    )
  }

  // Active / Recurring card: full detail
  const isRecurring = status === 'recurring'
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${isRecurring ? '#f0b429' : pc.color}22`, borderLeft: `3px solid ${isRecurring ? '#f0b429' : pc.color}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        {isRecurring && (
          <span style={{ background: 'rgba(240,180,41,0.15)', color: '#f0b429', padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>Recurring</span>
        )}
        <span style={{ background: pc.bg, color: pc.color, padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{pc.label}</span>
        <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{rec.category}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: 'rgba(100,160,240,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${rec.confidence}%`, height: '100%', borderRadius: 2, background: rec.confidence >= 80 ? '#00dba4' : rec.confidence >= 65 ? '#f0b429' : '#ff4d6d' }} />
          </div>
          <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{rec.confidence}%</span>
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 10, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {isRecurring && actionTimestamp && (
        <div style={{ padding: '0 14px 8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert" size={12} />
          <span style={{ fontSize: 11, color: '#f0b429' }}>
            You marked this done on {fmtDate(actionTimestamp)} — but the issue persists in current data. Verify the change was applied in your Amazon Ads panel.
          </span>
          <button onClick={onUndo} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(240,180,41,0.3)', background: 'none', cursor: 'pointer', color: '#f0b429', fontSize: 10, flexShrink: 0, fontFamily: 'inherit' }}>Clear status</button>
        </div>
      )}

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(100,160,240,0.07)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, marginBottom: 10 }}>
            <div style={{ background: 'rgba(100,160,240,0.04)', borderRadius: 7, padding: '9px 11px' }}>
              <div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>WHAT IS HAPPENING</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{rec.what}</div>
            </div>
            <div style={{ background: 'rgba(100,160,240,0.04)', borderRadius: 7, padding: '9px 11px' }}>
              <div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>WHY IT IS HAPPENING</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{rec.why}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: rec.doNot ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ background: 'rgba(0,219,164,0.06)', border: '1px solid rgba(0,219,164,0.15)', borderRadius: 7, padding: '9px 11px' }}>
              <div style={{ fontSize: 8, color: '#00dba4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>✓ DO THIS</div>
              <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.55 }}>{rec.doAction}</div>
            </div>
            {rec.doNot && (
              <div style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 7, padding: '9px 11px' }}>
                <div style={{ fontSize: 8, color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>✗ DON'T DO THIS</div>
                <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.55 }}>{rec.doNot}</div>
              </div>
            )}
          </div>
          {rec.impacts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', flexShrink: 0 }}>Impact:</span>
              {rec.impacts.map((b, i) => (
                <span key={i} style={{ fontSize: 10, color: 'var(--text-2)', background: 'rgba(100,160,240,0.08)', border: '1px solid rgba(100,160,240,0.12)', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--mono)' }}>{b}</span>
              ))}
            </div>
          )}
          {/* Action Path */}
          {rec.actionSteps.length > 0 && (
            <ActionPath steps={rec.actionSteps} />
          )}
          {/* Action row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(100,160,240,0.07)' }}>
            <button onClick={onMarkDone}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'rgba(0,219,164,0.15)', cursor: 'pointer', color: '#00dba4', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
              <Icon name="check" size={12} /> Mark as Done
            </button>
            <SnoozeBtn onSnooze={onSnooze} />
            <button onClick={onDismiss} title="Permanently dismiss this recommendation"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, fontFamily: 'inherit' }}>
              <Icon name="x" size={12} /> Dismiss
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>Applied on Amazon panel? → Mark as Done above</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ id, recs, actionsMap, getStatus, onMarkDone, onSnooze, onDismiss, onUndo, children }: {
  id: SectionId; recs?: RichRec[]
  actionsMap?: Record<string, RecAction>; getStatus?: (id: string) => EffectiveStatus
  onMarkDone?: (id: string) => void; onSnooze?: (id: string, days: number) => void
  onDismiss?: (id: string) => void; onUndo?: (id: string) => void
  children?: React.ReactNode
}) {
  const [open, setOpen]             = useState(true)
  const [actionedOpen, setActionedOpen] = useState(false)
  const meta = SECTION_META[id]

  const { activeRecs, recurringRecs, actionedRecs, snoozedRecs } = useMemo(() => {
    if (!recs || !getStatus) return { activeRecs: recs ?? [], recurringRecs: [], actionedRecs: [], snoozedRecs: [] }
    const active: RichRec[] = [], recurring: RichRec[] = [], actioned: RichRec[] = [], snoozed: RichRec[] = []
    recs.forEach(r => {
      const s = getStatus(r.id)
      if (s === 'dismissed') return
      if (s === 'active')    active.push(r)
      else if (s === 'recurring') recurring.push(r)
      else if (s === 'actioned')  actioned.push(r)
      else if (s === 'snoozed')   snoozed.push(r)
    })
    return { activeRecs: active, recurringRecs: recurring, actionedRecs: actioned, snoozedRecs: snoozed }
  }, [recs, getStatus])

  const visibleCount   = activeRecs.length + recurringRecs.length
  const collectedCount = actionedRecs.length + snoozedRecs.length

  if (recs && visibleCount === 0 && collectedCount === 0 && !children) return null

  return (
    <div className="gf-card" style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none' }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(108,140,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
          <Icon name={meta.icon} size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{meta.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{meta.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {visibleCount > 0 && <span style={{ background: 'rgba(108,140,255,0.15)', color: 'var(--accent)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700 }}>{visibleCount}</span>}
          {collectedCount > 0 && <span style={{ background: 'rgba(0,219,164,0.1)', color: '#00dba4', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontFamily: 'var(--mono)' }}>✓ {collectedCount}</span>}
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Active recs */}
          {recs && getStatus && [...recurringRecs, ...activeRecs].map(r => {
            const s = getStatus(r.id)
            const action = actionsMap?.[r.id]
            return (
              <RecCard key={r.id} rec={r} status={s}
                actionTimestamp={action?.timestamp} snoozeUntil={action?.snoozeUntil}
                onMarkDone={() => onMarkDone?.(r.id)}
                onSnooze={(d) => onSnooze?.(r.id, d)}
                onDismiss={() => onDismiss?.(r.id)}
                onUndo={() => onUndo?.(r.id)}
              />
            )
          })}

          {/* Children (for non-rec sections like exec, do_not, impact) */}
          {children}

          {/* Actioned / snoozed sub-bucket */}
          {collectedCount > 0 && (
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setActionedOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(0,219,164,0.15)', background: 'rgba(0,219,164,0.04)', cursor: 'pointer', width: '100%', fontFamily: 'inherit', color: 'var(--text-3)', fontSize: 11 }}>
                <Icon name="check" size={12} />
                <span>{actionedRecs.length > 0 ? `${actionedRecs.length} actioned` : ''}{actionedRecs.length > 0 && snoozedRecs.length > 0 ? ' · ' : ''}{snoozedRecs.length > 0 ? `${snoozedRecs.length} snoozed` : ''}</span>
                <span style={{ marginLeft: 'auto' }}>{actionedOpen ? '▲' : '▼'}</span>
              </button>
              {actionedOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {[...actionedRecs, ...snoozedRecs].map(r => {
                    const s = getStatus?.(r.id) ?? 'active'
                    const action = actionsMap?.[r.id]
                    return (
                      <RecCard key={r.id} rec={r} status={s}
                        actionTimestamp={action?.timestamp} snoozeUntil={action?.snoozeUntil}
                        onMarkDone={() => onMarkDone?.(r.id)}
                        onSnooze={(d) => onSnooze?.(r.id, d)}
                        onDismiss={() => onDismiss?.(r.id)}
                        onUndo={() => onUndo?.(r.id)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!children && recs && visibleCount === 0 && collectedCount === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-3)', fontSize: 12 }}>
              No issues detected for this period and goal.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SmartRecsPage() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [goal, setGoal]               = useState<Goal>('balanced')
  const [datePreset, setDatePreset]   = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')
  const [pendingCustom, setPendingCustom] = useState(false)

  const dates = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) return getDateRange('custom', customStart, customEnd)
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

  const userKey = (user as any)?.email ?? 'anon'
  const { actionsMap, markDone, snooze, dismiss, undo, clearAll, getStatus, countResolved } = useRecActions(userKey)

  const { data: metrics, refetch: refetchMetrics } = useGetMetricsQuery(dates)
  const { data: keywords  = [], refetch: refetchKws   } = useGetKeywordsQuery({ ...dates, limit: 100 })
  const { data: campaigns = [], refetch: refetchCamps  } = useGetCampaignsQuery({ ...dates, limit: 200 })
  const { data: products  = [], refetch: refetchProds  } = useGetProductsQuery({ ...dates, limit: 100 })
  const { data: unreadData } = useGetUnreadCountQuery()
  const unread = unreadData?.count ?? 0

  const { recs, doNotRecs, impacts } = useMemo(
    () => generateRecs(goal, metrics, campaigns, keywords, products, dates),
    [goal, metrics, campaigns, keywords, products, dates]
  )

  const generatedIds = useMemo(() => recs.map(r => r.id), [recs])
  const resolvedCount = useMemo(() => countResolved(generatedIds), [countResolved, generatedIds])

  const bySection = useMemo(() => {
    const m: Record<string, RichRec[]> = {}
    recs.forEach(r => { if (!m[r.sectionId]) m[r.sectionId] = []; m[r.sectionId].push(r) })
    return m
  }, [recs])

  const execTop5 = useMemo(() =>
    [...recs]
      .filter(r => { const s = getStatus(r.id); return s === 'active' || s === 'recurring' })
      .sort((a, b) => (PRIORITY_CFG[b.priority].score * b.confidence) - (PRIORITY_CFG[a.priority].score * a.confidence))
      .slice(0, 5),
    [recs, getStatus]
  )

  const priorityCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Priority, number>
    recs.forEach(r => { const s = getStatus(r.id); if (s === 'active' || s === 'recurring') c[r.priority]++ })
    return c
  }, [recs, getStatus])

  const actionedTotal = useMemo(() => Object.values(actionsMap).filter(a => a.status === 'actioned').length, [actionsMap])
  const snoozedTotal  = useMemo(() => Object.values(actionsMap).filter(a => a.status === 'snoozed' && a.snoozeUntil && new Date(a.snoozeUntil) > new Date()).length, [actionsMap])

  const handleRefresh = () => { refetchMetrics(); refetchKws(); refetchCamps(); refetchProds() }
  const subtitle = `${dates.start_date} — ${dates.end_date} · ${recs.filter(r => { const s = getStatus(r.id); return s === 'active' || s === 'recurring' }).length} active`
  const goalCfg = GOAL_CFG[goal]

  const today = new Date().toISOString().slice(0, 10)

  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className={`gf-shell${navOpen ? ' gf-nav-open' : ''}`}>
      <div className="gf-nav-overlay" onClick={() => setNavOpen(false)} />
      <WorkspaceSidebar user={user} unread={unread} />
      <div className="gf-main">
        <WorkspaceTopbar crumb="Smart Recommendations" subtitle={subtitle} unread={unread} onRefresh={handleRefresh} onMenuToggle={() => setNavOpen(o => !o)} />
        <div className="gf-content">

          {/* ── Controls bar ── */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Goal selector */}
            <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['visibility', 'sales', 'balanced'] as Goal[]).map(g => {
                const gc = GOAL_CFG[g]
                return (
                  <button key={g} onClick={() => setGoal(g)} style={{
                    padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                    border: 'none', borderRight: g !== 'balanced' ? '1px solid var(--border)' : 'none',
                    background: goal === g ? gc.color + '20' : 'transparent',
                    color: goal === g ? gc.color : 'var(--text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s',
                  }}>
                    {g === 'visibility' ? '👁 ' : g === 'sales' ? '💰 ' : '⚖️ '}{gc.label}
                  </button>
                )
              })}
            </div>

            {/* Date presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {DATE_PRESETS.map((p, i) => (
                  <button key={p.value} onClick={() => { setDatePreset(p.value); if (p.value === 'custom') setPendingCustom(true) }} style={{
                    padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                    border: 'none', borderRight: i < DATE_PRESETS.length - 1 ? '1px solid var(--border)' : 'none',
                    background: datePreset === p.value ? 'rgba(108,140,255,0.18)' : 'transparent',
                    color: datePreset === p.value ? 'var(--accent)' : 'var(--text-3)',
                    transition: 'all 0.15s',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Custom date inputs */}
              {datePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="date" value={customStart} max={customEnd || today} onChange={e => { setCustomStart(e.target.value); setPendingCustom(true) }}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer' }} />
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>→</span>
                  <input type="date" value={customEnd} min={customStart} max={today} onChange={e => { setCustomEnd(e.target.value); setPendingCustom(true) }}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer' }} />
                  {pendingCustom && customStart && customEnd && (
                    <button onClick={() => setPendingCustom(false)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#0a0f1a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Apply
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExportBtn recs={recs} doNotRecs={doNotRecs} dates={dates} goal={goal} getStatus={getStatus} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)' }}>
                  <span className="gf-live-dot" /> Live · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                </div>
              </div>
              {(actionedTotal > 0 || snoozedTotal > 0 || resolvedCount > 0) && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {resolvedCount > 0 && <span style={{ fontSize: 10, color: '#00dba4', background: 'rgba(0,219,164,0.1)', borderRadius: 4, padding: '2px 7px' }}>✓ {resolvedCount} resolved by data</span>}
                  {actionedTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'rgba(100,160,240,0.07)', borderRadius: 4, padding: '2px 7px' }}>✓ {actionedTotal} actioned</span>}
                  {snoozedTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'rgba(100,160,240,0.07)', borderRadius: 4, padding: '2px 7px' }}>⏸ {snoozedTotal} snoozed</span>}
                  <button onClick={clearAll} style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Goal Context Banner ── */}
          <div style={{ background: goalCfg.color + '10', border: `1px solid ${goalCfg.color}30`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: goalCfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: goalCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{goalCfg.label} Goal Active — </span>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{goalCfg.desc}.</span>
          </div>

          {/* ── Scoreboard ── */}
          <Scoreboard metrics={metrics} dates={dates} defaultSlots={['roas','acos','sales','total_cost','purchases','impressions']} />

          {/* ── Priority Summary ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
              const pc = PRIORITY_CFG[p]
              const n = priorityCounts[p]
              return (
                <div key={p} style={{ background: 'var(--surface)', border: `1px solid ${n > 0 ? pc.color + '28' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: n > 0 ? pc.bg : 'rgba(100,160,240,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n > 0 ? pc.color : 'var(--text-3)', flexShrink: 0, fontSize: n > 0 ? 18 : 16, fontWeight: 800 }}>
                    {n > 0 ? n : '✓'}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: n > 0 ? pc.color : 'var(--text-3)' }}>{n}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{pc.label}</div>
                  </div>
                </div>
              )
            })}
            {/* Progress box */}
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,219,164,0.2)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,219,164,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#00dba4' }}>
                <Icon name="check" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#00dba4' }}>{actionedTotal + resolvedCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved</div>
              </div>
            </div>
          </div>

          {/* ── S1: Executive Summary ── */}
          <SectionCard id="exec">
            {execTop5.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 12 }}>No active issues detected for this period and goal.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {execTop5.map((rec, i) => {
                  const pc = PRIORITY_CFG[rec.priority]
                  return (
                    <div key={rec.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto auto', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(100,160,240,0.03)', border: `1px solid ${pc.color}20`, borderLeft: `3px solid ${pc.color}`, borderRadius: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>#{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{rec.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rec.doAction.slice(0, 100)}{rec.doAction.length > 100 ? '…' : ''}</div>
                      </div>
                      <span style={{ background: pc.bg, color: pc.color, padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{pc.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div style={{ width: 34, height: 4, background: 'rgba(100,160,240,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${rec.confidence}%`, height: '100%', background: rec.confidence >= 80 ? '#00dba4' : '#f0b429', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{rec.confidence}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* ── Sections 2–8 ── */}
          {(['scale','visibility','sales_growth','optimization','waste','products','risks'] as SectionId[]).map(sid => (
            <SectionCard key={sid} id={sid} recs={bySection[sid] ?? []} actionsMap={actionsMap} getStatus={getStatus} onMarkDone={markDone} onSnooze={snooze} onDismiss={dismiss} onUndo={undo} />
          ))}

          {/* ── S9: Do NOT Actions ── */}
          <SectionCard id="do_not">
            {doNotRecs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>No specific guardrails for current data.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doNotRecs.map(d => (
                  <div key={d.id} style={{ background: 'rgba(255,77,109,0.04)', border: '1px solid rgba(255,77,109,0.18)', borderLeft: '3px solid #ff4d6d', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(255,77,109,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="x" size={11} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ff4d6d' }}>{d.title}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontWeight: 700 }}>REASON</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{d.reason}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3, fontWeight: 700 }}>CONSEQUENCE IF IGNORED</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{d.consequence}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── S10: Expected Business Impact ── */}
          <SectionCard id="impact">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {impacts.map((imp, i) => (
                <div key={i} style={{ background: imp.color + '0e', border: `1px solid ${imp.color}25`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{imp.metric}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: imp.color, marginBottom: 6 }}>{imp.change}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ flex: 1, height: 3, background: 'rgba(100,160,240,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${imp.confidence}%`, height: '100%', background: imp.color, borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{imp.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(100,160,240,0.05)', borderRadius: 7 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                <strong style={{ color: 'var(--text-2)' }}>Confidence methodology:</strong> 90%+ = high data volume, clear signal. 65–89% = moderate data. &lt;65% = limited data — validate before major budget decisions. Estimates are directional, not guaranteed.
              </span>
            </div>
          </SectionCard>

          {/* ── Footer ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ color: 'var(--text-3)', marginTop: 1, flexShrink: 0 }}><Icon name="info" size={14} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-2)' }}>How this works:</strong> Recommendations are generated from your real data in real-time — no AI API calls. When you apply a change in Amazon Ads panel, click{' '}
              <strong style={{ color: '#00dba4' }}>"Mark as Done"</strong> — the rec enters "Actioned" state. If the underlying issue persists after 7 days of data, it resurfaces as{' '}
              <strong style={{ color: '#f0b429' }}>"Recurring"</strong> so you know the change hasn't taken effect yet. Use{' '}
              <strong style={{ color: 'var(--text-2)' }}>"Snooze"</strong> to hide a rec temporarily while waiting for changes to reflect. Actions are saved per-user and persist across sessions.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
