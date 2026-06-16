import {
  Box, Typography, Chip, Skeleton, Divider,
} from '@mui/material'
import {
  CheckOutlined, StarOutlined, DiamondOutlined, WorkspacePremiumOutlined,
  BarChartOutlined,
} from '@mui/icons-material'
import { useGetSubscriptionTiersQuery, useGetMyPlanQuery } from '../../store/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freqLabel(minutes: number): string {
  if (!minutes || minutes >= 1440) return 'Daily'
  if (minutes >= 360) return 'Every 6 hours'
  if (minutes >= 60) return 'Hourly'
  if (minutes >= 15) return 'Every 15 min'
  return `Every ${minutes} min`
}

function limitLabel(n: number | null): string {
  if (n === null || n === 0) return 'Unlimited'
  return n.toString()
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  Free: <BarChartOutlined sx={{ fontSize: 22 }} />,
  Starter: <StarOutlined sx={{ fontSize: 22 }} />,
  Professional: <WorkspacePremiumOutlined sx={{ fontSize: 22 }} />,
  Enterprise: <DiamondOutlined sx={{ fontSize: 22 }} />,
}

const TIER_COLORS: Record<string, { border: string; badge: string; icon: string }> = {
  Free: { border: 'rgba(100,160,240,0.12)', badge: 'rgba(100,160,240,0.08)', icon: '#6e8faa' },
  Starter: { border: 'rgba(240,180,41,0.2)', badge: 'rgba(240,180,41,0.1)', icon: '#f0b429' },
  Professional: { border: 'rgba(100,160,240,0.3)', badge: 'rgba(100,160,240,0.12)', icon: '#64a0f0' },
  Enterprise: { border: 'rgba(0,219,164,0.25)', badge: 'rgba(0,219,164,0.08)', icon: '#00dba4' },
}

// ── Current plan card ─────────────────────────────────────────────────────────

function CurrentPlanCard({ plan }: { plan: any }) {
  const status = plan?.subscription_status || 'Trial'
  const tierName = plan?.tier?.name || null
  const isTrial = !tierName || status === 'Trial'

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, rgba(100,160,240,0.06) 0%, rgba(0,219,164,0.04) 100%)',
        border: '1px solid rgba(100,160,240,0.15)',
        borderRadius: '14px',
        p: 3,
        mb: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ width: 52, height: 52, borderRadius: '12px', background: 'rgba(100,160,240,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isTrial
          ? <StarOutlined sx={{ color: '#f0b429', fontSize: 26 }} />
          : <WorkspacePremiumOutlined sx={{ color: '#64a0f0', fontSize: 26 }} />}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.4 }}>
          <Typography sx={{ fontSize: '1rem', color: '#d8eaf8', fontWeight: 600 }}>
            {plan?.client_name || 'My Account'}
          </Typography>
          <Chip
            label={status}
            size="small"
            sx={{
              fontSize: '0.68rem',
              height: 20,
              fontFamily: "'JetBrains Mono',monospace",
              background: isTrial ? 'rgba(240,180,41,0.1)' : 'rgba(0,219,164,0.1)',
              color: isTrial ? '#f0b429' : '#00dba4',
              border: 'none',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: '#6e8faa' }}>
          {isTrial
            ? 'You are on a free trial. Choose a plan below to unlock full access.'
            : `Active plan: ${tierName}`}
        </Typography>
      </Box>
      {isTrial && (
        <Typography sx={{ fontSize: '0.78rem', color: '#4a6785', fontStyle: 'italic' }}>
          No payment required during trial
        </Typography>
      )}
    </Box>
  )
}

// ── Feature list item ─────────────────────────────────────────────────────────

function Feature({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.8 }}>
      <CheckOutlined sx={{ color: '#00dba4', fontSize: 14, mt: 0.2, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.8rem', color: highlight ? '#d8eaf8' : '#6e8faa', lineHeight: 1.5 }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ tier, isCurrentPlan }: { tier: any; isCurrentPlan: boolean }) {
  const colors = TIER_COLORS[tier.name] || TIER_COLORS.Free
  const price = tier.price_monthly !== null ? Number(tier.price_monthly) : 0
  const isPopular = tier.name === 'Professional'

  return (
    <Box
      sx={{
        background: isCurrentPlan ? 'rgba(0,219,164,0.03)' : '#0c1a2e',
        border: `1px solid ${isCurrentPlan ? 'rgba(0,219,164,0.3)' : colors.border}`,
        borderRadius: '14px',
        p: 3,
        flex: 1,
        minWidth: 200,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'rgba(100,160,240,0.3)' },
      }}
    >
      {isPopular && (
        <Box sx={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#64a0f0', color: '#06101c', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', px: 1.5, py: 0.4, borderRadius: '20px' }}>
          Most Popular
        </Box>
      )}

      {/* Icon + name */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '9px', background: colors.badge, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.icon, flexShrink: 0 }}>
          {TIER_ICONS[tier.name] || <StarOutlined sx={{ fontSize: 20 }} />}
        </Box>
        <Box>
          <Typography sx={{ fontSize: '0.95rem', color: '#d8eaf8', fontWeight: 600 }}>{tier.name}</Typography>
          {isCurrentPlan && (
            <Typography sx={{ fontSize: '0.65rem', color: '#00dba4', fontFamily: "'JetBrains Mono',monospace" }}>current plan</Typography>
          )}
        </Box>
      </Box>

      {/* Price */}
      <Box>
        {price === 0 ? (
          <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: '#d8eaf8', fontFamily: "'JetBrains Mono',monospace" }}>
            Free
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.9rem', color: '#6e8faa' }}>₹</Typography>
            <Typography sx={{ fontSize: '1.7rem', fontWeight: 700, color: '#d8eaf8', fontFamily: "'JetBrains Mono',monospace" }}>
              {price}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#4a6785' }}>/mo</Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(100,160,240,0.07)' }} />

      {/* Features */}
      <Box sx={{ flex: 1 }}>
        <Feature label={`${limitLabel(tier.max_clients)} Amazon account${tier.max_clients !== 1 ? 's' : ''}`} highlight />
        <Feature label={`${limitLabel(tier.max_users_per_client)} team member${tier.max_users_per_client !== 1 ? 's' : ''}`} />
        <Feature label={`Data refresh: ${freqLabel(Number(tier.report_fetch_freq))}`} highlight />
        <Feature label={`${limitLabel(tier.export_limit_monthly)} exports/month`} />
        {tier.api_access && <Feature label="API access" highlight />}
        <Feature label="All 18 Amazon report types" />
        <Feature label="Placement & keyword analytics" />
        {tier.name !== 'Free' && <Feature label="Email support" />}
        {(tier.name === 'Professional' || tier.name === 'Enterprise') && <Feature label="Priority support" />}
        {tier.name === 'Enterprise' && <Feature label="Dedicated onboarding" />}
      </Box>

      {/* CTA */}
      <Box
        onClick={isCurrentPlan ? undefined : () => {
          window.location.href = `mailto:support@glancefive.com?subject=${encodeURIComponent('Upgrade to ' + tier.name)}&body=${encodeURIComponent('Hi, I would like to upgrade my GlanceFive account to the ' + tier.name + ' plan. Please get in touch.')}`
        }}
        sx={{
          mt: 1,
          py: 1.1,
          px: 2,
          borderRadius: '8px',
          textAlign: 'center',
          cursor: isCurrentPlan ? 'default' : 'pointer',
          background: isCurrentPlan
            ? 'rgba(0,219,164,0.08)'
            : isPopular
              ? '#64a0f0'
              : 'rgba(100,160,240,0.08)',
          border: isCurrentPlan
            ? '1px solid rgba(0,219,164,0.2)'
            : isPopular
              ? 'none'
              : '1px solid rgba(100,160,240,0.15)',
          '&:hover': !isCurrentPlan ? { opacity: 0.85 } : {},
          transition: 'opacity 0.15s',
        }}
      >
        <Typography sx={{
          fontSize: '0.84rem',
          fontWeight: 600,
          color: isCurrentPlan ? '#00dba4' : isPopular ? '#06101c' : '#8ab4d8',
        }}>
          {isCurrentPlan ? 'Current plan' : price === 0 ? 'Get started free' : `Upgrade to ${tier.name}`}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { data: tiers = [], isLoading: loadingTiers } = useGetSubscriptionTiersQuery()
  const { data: myPlan, isLoading: loadingPlan } = useGetMyPlanQuery()

  const currentTierName = myPlan?.tier?.name || null

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: '#d8eaf8', lineHeight: 1.2 }}>
          Subscription
        </Typography>
        <Typography sx={{ color: '#6e8faa', fontSize: '0.82rem', mt: 0.5 }}>
          Choose the plan that fits your Amazon advertising operation
        </Typography>
      </Box>

      {/* Current plan */}
      {loadingPlan ? (
        <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '14px', background: 'rgba(100,160,240,0.05)', mb: 4 }} />
      ) : (
        <CurrentPlanCard plan={myPlan} />
      )}

      {/* Plan cards */}
      {loadingTiers ? (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rectangular" height={420} sx={{ flex: 1, minWidth: 200, borderRadius: '14px', background: 'rgba(100,160,240,0.05)' }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {tiers.map((tier: any) => (
            <PlanCard
              key={tier.id}
              tier={tier}
              isCurrentPlan={currentTierName === tier.name}
            />
          ))}
        </Box>
      )}

      {/* FAQ / note */}
      <Box sx={{ mt: 4, p: 2.5, background: '#0c1a2e', border: '1px solid rgba(100,160,240,0.07)', borderRadius: '12px' }}>
        <Typography sx={{ fontSize: '0.78rem', color: '#3d5570', lineHeight: 1.8 }}>
          All plans include the full GlanceFive analytics platform (campaigns, keywords, search terms, placements, SP-API product data).
          Data refresh frequency controls how often Amazon reports are fetched automatically.
          To upgrade your plan or for billing questions, contact{' '}
          <strong style={{ color: '#4a6785' }}>support@glancefive.com</strong>.
        </Typography>
      </Box>
    </Box>
  )
}
