import { useState } from 'react'
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, Skeleton,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Alert,
  Tooltip,
} from '@mui/material'
import { PlaceOutlined, TrendingUpOutlined, InfoOutlined } from '@mui/icons-material'
import { useGetPlacementsQuery } from '../../store/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

function AcosChip({ acos }: { acos: number | null }) {
  if (acos === null) return <Typography sx={{ color: '#3d5570', fontSize: '0.8rem' }}>—</Typography>
  const pct = acos * 100
  const bg = pct <= 25 ? 'rgba(0,219,164,0.1)' : pct <= 40 ? 'rgba(240,180,41,0.1)' : 'rgba(255,77,109,0.1)'
  const color = pct <= 25 ? '#00dba4' : pct <= 40 ? '#f0b429' : '#ff4d6d'
  return (
    <Chip label={`${pct.toFixed(1)}%`} size="small"
      sx={{ fontSize: '0.72rem', height: 20, fontFamily: "'JetBrains Mono',monospace", background: bg, color, border: 'none' }} />
  )
}

function RoasChip({ roas }: { roas: number | null }) {
  if (roas === null) return <Typography sx={{ color: '#3d5570', fontSize: '0.8rem' }}>—</Typography>
  const bg = roas >= 3 ? 'rgba(0,219,164,0.1)' : roas >= 1.5 ? 'rgba(240,180,41,0.1)' : 'rgba(255,77,109,0.1)'
  const color = roas >= 3 ? '#00dba4' : roas >= 1.5 ? '#f0b429' : '#ff4d6d'
  return (
    <Chip label={`${roas.toFixed(2)}x`} size="small"
      sx={{ fontSize: '0.72rem', height: 20, fontFamily: "'JetBrains Mono',monospace", background: bg, color, border: 'none' }} />
  )
}

// Friendly name for placement codes
const PLACEMENT_LABEL: Record<string, string> = {
  'Top of Search on-Amazon': 'Top of Search',
  'Detail Page on-Amazon': 'Product Detail Page',
  'Other on-Amazon': 'Other Placements',
}

const PLACEMENT_DESC: Record<string, string> = {
  'Top of Search on-Amazon': 'Ads shown at the very top of Amazon search results. Highest visibility, higher CPC.',
  'Detail Page on-Amazon': 'Ads on product detail pages and below search results. Good conversion rate.',
  'Other on-Amazon': 'Ads shown in other Amazon placements (cart page, etc.).',
}

const RT_LABEL: Record<string, string> = {
  spCampaignPlacement: 'SP',
  sbCampaignPlacement: 'SB',
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ background: '#0c1a2e', border: '1px solid rgba(100,160,240,0.07)', borderRadius: '12px', p: 2.5, flex: 1, minWidth: 140 }}>
      <Typography sx={{ fontSize: '0.7rem', color: '#4a6785', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#d8eaf8', fontFamily: "'JetBrains Mono',monospace" }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '0.72rem', color: '#6e8faa', mt: 0.3 }}>{sub}</Typography>}
    </Box>
  )
}

// ── Bar showing relative spend across placements ──────────────────────────────

function SpendBar({ rows }: { rows: any[] }) {
  const total = rows.reduce((s, r) => s + r.cost, 0)
  if (!total) return null

  const grouped: Record<string, number> = {}
  for (const r of rows) {
    const lbl = PLACEMENT_LABEL[r.placement] || r.placement
    grouped[lbl] = (grouped[lbl] || 0) + r.cost
  }

  return (
    <Box sx={{ background: '#0c1a2e', border: '1px solid rgba(100,160,240,0.07)', borderRadius: '12px', p: 3, mb: 3 }}>
      <Typography sx={{ fontSize: '0.7rem', color: '#4a6785', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2 }}>
        Spend distribution by placement
      </Typography>
      <Box sx={{ display: 'flex', height: 28, borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
        {Object.entries(grouped).map(([label, spend], i) => {
          const pct = (spend / total) * 100
          const colors = ['#64a0f0', '#f0b429', '#00dba4']
          return (
            <Tooltip key={label} title={`${label}: ₹${fmt(spend)} (${pct.toFixed(1)}%)`}>
              <Box sx={{ flex: pct, background: colors[i % 3], display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 40 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#06101c', whiteSpace: 'nowrap', px: 0.5 }}>
                  {pct > 12 ? `${pct.toFixed(0)}%` : ''}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
        {Object.entries(grouped).map(([label], i) => {
          const colors = ['#64a0f0', '#f0b429', '#00dba4']
          return (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: colors[i % 3], flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#6e8faa' }}>{label}</Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlacementsPage() {
  const [rtFilter, setRtFilter] = useState<string>('')

  const { data: rows = [], isLoading } = useGetPlacementsQuery(
    rtFilter ? { report_type: rtFilter } : {},
  )

  const totalSpend = rows.reduce((s, r) => s + r.cost, 0)
  const totalSales = rows.reduce((s, r) => s + r.sales, 0)
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  const overallAcos = totalSales > 0 ? totalSpend / totalSales : null
  const bestPlacement = rows.length
    ? [...rows].filter(r => r.roas !== null).sort((a, b) => (b.roas || 0) - (a.roas || 0))[0]
    : null

  const hasData = rows.length > 0

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <PlaceOutlined sx={{ color: '#64a0f0', fontSize: 28 }} />
          <Typography sx={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: '#d8eaf8', lineHeight: 1.2 }}>
            Placement Analytics
          </Typography>
        </Box>
        <Typography sx={{ color: '#6e8faa', fontSize: '0.82rem', mt: 0.5 }}>
          Where your ads appear and which positions drive the best return
        </Typography>
      </Box>

      {/* Explainer */}
      <Alert
        severity="info"
        icon={<InfoOutlined fontSize="small" />}
        sx={{ mb: 3, fontSize: '0.82rem', background: 'rgba(100,160,240,0.05)', color: '#6e8faa', border: '1px solid rgba(100,160,240,0.1)', '& .MuiAlert-icon': { color: '#64a0f0' } }}
      >
        Placement data shows <strong style={{ color: '#8ab4d8' }}>where on Amazon your ads were shown</strong>: Top of Search, Product Detail Pages, and Other placements.
        Use this to adjust placement bid modifiers in Seller Central → Campaigns → Placement.
      </Alert>

      {/* Report type filter */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          size="small"
          value={rtFilter}
          exclusive
          onChange={(_, v) => setRtFilter(v ?? '')}
          sx={{ '& .MuiToggleButton-root': { fontSize: '0.78rem', px: 2, py: 0.6, borderColor: 'rgba(100,160,240,0.12)', color: '#6e8faa', '&.Mui-selected': { background: 'rgba(100,160,240,0.1)', color: '#d8eaf8', borderColor: 'rgba(100,160,240,0.25)' } } }}
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="spCampaignPlacement">Sponsored Products</ToggleButton>
          <ToggleButton value="sbCampaignPlacement">Sponsored Brands</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: '8px', background: 'rgba(100,160,240,0.05)' }} />)}
        </Box>
      )}

      {!isLoading && !hasData && (
        <Box sx={{ background: '#0c1a2e', border: '1px solid rgba(100,160,240,0.07)', borderRadius: '12px', p: 5, textAlign: 'center' }}>
          <PlaceOutlined sx={{ color: '#2a3f5a', fontSize: 48, mb: 2 }} />
          <Typography sx={{ color: '#4a6785', fontSize: '0.9rem' }}>No placement data for this period</Typography>
          <Typography sx={{ color: '#3d5570', fontSize: '0.78rem', mt: 0.5 }}>
            Placement data is available once Sponsored Products or Brands campaigns have run
          </Typography>
        </Box>
      )}

      {!isLoading && hasData && (
        <>
          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <SummaryCard label="Total spend" value={`₹${fmt(totalSpend)}`} />
            <SummaryCard label="Total sales" value={`₹${fmt(totalSales)}`} />
            <SummaryCard label="Total clicks" value={totalClicks.toLocaleString('en-IN')} />
            <SummaryCard
              label="Overall ACOS"
              value={overallAcos !== null ? `${(overallAcos * 100).toFixed(1)}%` : '—'}
              sub={overallAcos !== null && overallAcos < 0.3 ? 'Healthy' : overallAcos !== null && overallAcos < 0.5 ? 'Moderate' : 'High'}
            />
            {bestPlacement && (
              <SummaryCard
                label="Best ROAS placement"
                value={PLACEMENT_LABEL[bestPlacement.placement] || bestPlacement.placement}
                sub={`${(bestPlacement.roas || 0).toFixed(2)}x ROAS`}
              />
            )}
          </Box>

          {/* Spend distribution bar */}
          <SpendBar rows={rows} />

          {/* Detail table */}
          <Box sx={{ background: '#0c1a2e', border: '1px solid rgba(100,160,240,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgba(100,160,240,0.06)' }}>
              <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6e8faa' }}>
                Placement breakdown
              </Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { borderColor: 'rgba(100,160,240,0.07)', color: '#4a6785', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, py: 1.5 } }}>
                    <TableCell>Placement</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Impressions</TableCell>
                    <TableCell align="right">Clicks</TableCell>
                    <TableCell align="right">CTR</TableCell>
                    <TableCell align="right">Spend (₹)</TableCell>
                    <TableCell align="right">Sales (₹)</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">ACOS</TableCell>
                    <TableCell align="right">ROAS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={`${r.placement}-${r.report_type}`}
                      sx={{
                        '& td': { borderColor: 'rgba(100,160,240,0.05)', py: 1.5 },
                        '&:last-child td': { border: 'none' },
                        '&:hover': { background: 'rgba(100,160,240,0.03)' },
                      }}
                    >
                      <TableCell>
                        <Tooltip title={PLACEMENT_DESC[r.placement] || ''} placement="right">
                          <Box>
                            <Typography sx={{ fontSize: '0.84rem', color: '#d8eaf8', fontWeight: 500 }}>
                              {PLACEMENT_LABEL[r.placement] || r.placement}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#4a6785' }}>
                              {r.placement}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={RT_LABEL[r.report_type] || r.report_type} size="small"
                          sx={{ fontSize: '0.68rem', height: 20, background: 'rgba(100,160,240,0.08)', color: '#6e8faa', border: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#8ab4d8', fontFamily: "'JetBrains Mono',monospace" }}>
                          {r.impressions.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#8ab4d8', fontFamily: "'JetBrains Mono',monospace" }}>
                          {r.clicks.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#6e8faa', fontFamily: "'JetBrains Mono',monospace" }}>
                          {r.ctr !== null ? fmtPct(r.ctr) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#d8eaf8', fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 }}>
                          {fmt(r.cost)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#d8eaf8', fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 }}>
                          {fmt(r.sales)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontSize: '0.82rem', color: '#6e8faa', fontFamily: "'JetBrains Mono',monospace" }}>
                          {r.orders}
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><AcosChip acos={r.acos} /></TableCell>
                      <TableCell align="right"><RoasChip roas={r.roas} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>

          {/* Interpretation tip */}
          <Box sx={{ mt: 3, p: 2.5, background: 'rgba(240,180,41,0.04)', border: '1px solid rgba(240,180,41,0.1)', borderRadius: '10px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUpOutlined sx={{ color: '#f0b429', fontSize: 16 }} />
              <Typography sx={{ fontSize: '0.78rem', color: '#f0b429', fontWeight: 600 }}>How to use this data</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.76rem', color: '#8a7020', lineHeight: 1.7 }}>
              In <strong style={{ color: '#b8960a' }}>Seller Central → Campaigns → Placement</strong>, you can increase or decrease bids for each placement by percentage.
              If Top of Search has high ACOS, reduce its bid modifier. If Detail Page has better ROAS, increase it.
              These are "placement bid multipliers" — they adjust your campaign's base bid up or down for that specific position.
            </Typography>
          </Box>
        </>
      )}
    </Box>
  )
}
