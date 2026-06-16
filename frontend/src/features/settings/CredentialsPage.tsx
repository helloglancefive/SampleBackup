import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box, Typography, TextField, Button, Alert, CircularProgress, Chip,
  Accordion, AccordionSummary, AccordionDetails, Divider, Tooltip,
} from '@mui/material'
import {
  CheckCircleOutlined, ErrorOutlined, LockOutlined, OpenInNewOutlined,
  ExpandMoreOutlined, BarChartOutlined, StorefrontOutlined, RefreshOutlined,
} from '@mui/icons-material'
import {
  useGetCredentialsStatusQuery,
  useUpdateCredentialsMutation,
  useLazyGetAdsAuthUrlQuery,
  useLazyGetSpAuthUrlQuery,
  type CredentialsStatus,
} from '../../store/api'

// ── Manual-entry form schema (advanced fallback) ──────────────────────────────
const manualSchema = z.object({
  amazon_client_id: z.string().min(1, 'Client ID required'),
  amazon_client_secret: z.string().min(1, 'Client Secret required'),
  amazon_refresh_token: z.string().min(1, 'Refresh Token required'),
  amazon_profile_id: z.string().optional(),
})
type ManualForm = z.infer<typeof manualSchema>

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusChip({ connected, loading }: { connected: boolean; loading: boolean }) {
  if (loading) return <Chip label="Checking..." size="small" sx={{ fontSize: '0.68rem', height: 22, background: 'rgba(100,160,240,0.08)', color: '#6e8faa' }} />
  return (
    <Chip
      label={connected ? 'Connected' : 'Not connected'}
      size="small"
      sx={{
        fontSize: '0.68rem',
        height: 22,
        fontFamily: "'JetBrains Mono', monospace",
        background: connected ? 'rgba(0,219,164,0.1)' : 'rgba(100,160,240,0.06)',
        color: connected ? '#00dba4' : '#4a6785',
        border: 'none',
      }}
    />
  )
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
      <Typography sx={{ fontSize: '0.72rem', color: '#4a6785', minWidth: 90 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.72rem', color: '#6e8faa', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </Typography>
    </Box>
  )
}

interface ApiCardProps {
  title: string
  subtitle: string
  Icon: React.ElementType
  connected: boolean
  loading: boolean
  meta?: React.ReactNode
  onConnect: () => void
  connecting: boolean
  disabled?: boolean
  disabledReason?: string
}

function ApiCard({ title, subtitle, Icon, connected, loading, meta, onConnect, connecting, disabled, disabledReason }: ApiCardProps) {
  return (
    <Box
      className="animate-in"
      sx={{
        background: '#0c1a2e',
        border: `1px solid ${connected ? 'rgba(0,219,164,0.15)' : 'rgba(100,160,240,0.07)'}`,
        borderRadius: '14px',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: connected ? 'rgba(0,219,164,0.08)' : 'rgba(100,160,240,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {connected
            ? <CheckCircleOutlined sx={{ color: '#00dba4', fontSize: 20 }} />
            : <Icon sx={{ color: '#4a6785', fontSize: 20 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.9rem', color: '#d8eaf8', fontWeight: 600 }}>
              {title}
            </Typography>
            <StatusChip connected={connected} loading={loading} />
          </Box>
          <Typography sx={{ fontSize: '0.76rem', color: '#6e8faa', mt: 0.3 }}>
            {subtitle}
          </Typography>
        </Box>
      </Box>

      {meta && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, pl: 0.5 }}>
          {meta}
        </Box>
      )}

      <Tooltip title={disabled ? (disabledReason || 'Not available') : ''} placement="top">
        <span>
          <Button
            variant={connected ? 'outlined' : 'contained'}
            size="small"
            disabled={connecting || disabled}
            onClick={onConnect}
            startIcon={connecting
              ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
              : connected
                ? <RefreshOutlined fontSize="small" />
                : <OpenInNewOutlined fontSize="small" />}
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              py: 0.9,
              px: 2.5,
              alignSelf: 'flex-start',
              ...(connected && {
                borderColor: 'rgba(100,160,240,0.2)',
                color: '#6e8faa',
                '&:hover': { borderColor: 'rgba(100,160,240,0.4)', background: 'rgba(100,160,240,0.04)' },
              }),
            }}
          >
            {connecting ? 'Redirecting...' : connected ? 'Reconnect' : 'Connect with Amazon'}
          </Button>
        </span>
      </Tooltip>
    </Box>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CredentialsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: credStatus, isLoading: loadingStatus, refetch } = useGetCredentialsStatusQuery(undefined)
  const [updateCreds, { isLoading: savingManual, isSuccess: manualSaved, error: manualError }] = useUpdateCredentialsMutation()

  const [triggerAdsUrl, { isFetching: fetchingAdsUrl }] = useLazyGetAdsAuthUrlQuery()
  const [triggerSpUrl, { isFetching: fetchingSpUrl }] = useLazyGetSpAuthUrlQuery()

  // Banner state from URL params after OAuth redirect
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const adsOk = searchParams.get('ads_connected')
    const spOk = searchParams.get('sp_connected')
    const err = searchParams.get('oauth_error')

    if (adsOk) {
      setBanner({ type: 'success', msg: 'Amazon Advertising API connected successfully.' })
      refetch()
    } else if (spOk) {
      setBanner({ type: 'success', msg: 'Amazon SP-API connected successfully.' })
      refetch()
    } else if (err) {
      setBanner({ type: 'error', msg: `OAuth failed: ${decodeURIComponent(err)}` })
    }

    // Clear params from URL without re-rendering
    if (adsOk || spOk || err) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectAds = async () => {
    const result = await triggerAdsUrl()
    if ('data' in result && result.data?.url) {
      window.location.href = result.data.url
    }
  }

  const handleConnectSp = async () => {
    const result = await triggerSpUrl({ marketplace_id: 'A21TJRUUN4KGV' })
    if ('data' in result && result.data?.url) {
      window.location.href = result.data.url
    }
  }

  // Manual form
  const { register, handleSubmit, formState: { errors } } = useForm<ManualForm>({
    resolver: zodResolver(manualSchema),
  })
  const onManualSubmit = async (data: ManualForm) => {
    try {
      await updateCreds(data).unwrap()
      refetch()
    } catch {}
  }

  const s = credStatus as CredentialsStatus | undefined
  const hasAds = s?.has_ads_credentials ?? false
  const hasSp = s?.has_sp_credentials ?? false

  const fmt = (iso: string | null | undefined) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: '#d8eaf8', lineHeight: 1.2 }}>
          Amazon Connections
        </Typography>
        <Typography sx={{ color: '#6e8faa', fontSize: '0.82rem', mt: 0.5 }}>
          Authorize GlanceFive to access your Amazon Advertising and Seller Central accounts
        </Typography>
      </Box>

      {/* OAuth result banners */}
      {banner && (
        <Alert
          severity={banner.type}
          onClose={() => setBanner(null)}
          icon={banner.type === 'success' ? <CheckCircleOutlined fontSize="small" /> : <ErrorOutlined fontSize="small" />}
          sx={{
            mb: 3,
            fontSize: '0.85rem',
            ...(banner.type === 'success'
              ? { background: 'rgba(0,219,164,0.06)', color: '#00dba4', border: '1px solid rgba(0,219,164,0.15)', '& .MuiAlert-icon': { color: '#00dba4' } }
              : {}),
          }}
        >
          {banner.msg}
        </Alert>
      )}

      {/* How it works note */}
      <Box
        sx={{
          background: 'rgba(100,160,240,0.04)',
          border: '1px solid rgba(100,160,240,0.08)',
          borderRadius: '10px',
          p: 2,
          mb: 3,
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
        }}
      >
        <LockOutlined sx={{ color: '#4a6785', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#6e8faa', lineHeight: 1.7 }}>
          Click <strong style={{ color: '#8ab4d8' }}>Connect with Amazon</strong> — you will be redirected to Amazon to grant access.
          After you approve, you are brought back here automatically.
          All tokens are stored AES-256-GCM encrypted and never logged.
        </Typography>
      </Box>

      {/* API connection cards */}
      <Box sx={{ display: 'flex', gap: 2.5, mb: 4, flexWrap: 'wrap' }}>
        <ApiCard
          title="Amazon Advertising API"
          subtitle="Campaigns, keywords, search terms, sponsored ads"
          Icon={BarChartOutlined}
          connected={hasAds}
          loading={loadingStatus}
          onConnect={handleConnectAds}
          connecting={fetchingAdsUrl}
          meta={
            <>
              <MetaRow label="Profile ID" value={s?.amazon_profile_id} />
              <MetaRow label="Region" value={s?.amazon_region} />
              <MetaRow label="Last authorized" value={fmt(s?.last_token_refresh)} />
            </>
          }
        />

        <ApiCard
          title="Amazon SP-API"
          subtitle="Seller Central — sales, traffic, product business reports"
          Icon={StorefrontOutlined}
          connected={hasSp}
          loading={loadingStatus}
          onConnect={handleConnectSp}
          connecting={fetchingSpUrl}
          meta={
            <>
              <MetaRow label="Seller ID" value={s?.sp_seller_id} />
              <MetaRow label="Marketplace" value={s?.sp_marketplace_id} />
              <MetaRow label="Region" value={hasSp ? s?.amazon_region : null} />
              <MetaRow label="Last authorized" value={fmt(s?.sp_last_token_refresh)} />
            </>
          }
        />
      </Box>

      {/* Developer note */}
      {(!hasAds || !hasSp) && (
        <Box
          sx={{
            background: 'rgba(255,193,7,0.04)',
            border: '1px solid rgba(255,193,7,0.12)',
            borderRadius: '10px',
            p: 2,
            mb: 4,
          }}
        >
          <Typography sx={{ fontSize: '0.76rem', color: '#b8960a', mb: 0.5, fontWeight: 600 }}>
            Setup checklist before connecting
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: '#8a7020', fontSize: '0.76rem', lineHeight: 2 }}>
            {!hasAds && (
              <>
                <li>LWA Security Profile — add <code style={{ background: 'rgba(255,193,7,0.08)', padding: '1px 5px', borderRadius: 3 }}>http://localhost:5173/callback</code> to Allowed Return URLs</li>
                <li>Amazon Ads API — your developer application must be approved</li>
              </>
            )}
            {!hasSp && (
              <>
                <li>SP-API app (Solution Provider Portal) — set OAuth Redirect URI to <code style={{ background: 'rgba(255,193,7,0.08)', padding: '1px 5px', borderRadius: 3 }}>http://localhost:5173/callback</code></li>
                <li>SP-API developer profile must be approved by Amazon (or use beta flow)</li>
              </>
            )}
          </Box>
        </Box>
      )}

      {/* Manual / advanced entry */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          background: '#0c1a2e',
          border: '1px solid rgba(100,160,240,0.07)',
          borderRadius: '12px !important',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreOutlined sx={{ color: '#4a6785', fontSize: 18 }} />}>
          <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6e8faa' }}>
            Advanced — manual token entry
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Divider sx={{ borderColor: 'rgba(100,160,240,0.06)', mb: 2.5 }} />

          <Typography sx={{ fontSize: '0.78rem', color: '#4a6785', mb: 2.5 }}>
            Paste credentials directly if you cannot use the OAuth flow above (e.g. during CI/CD or for legacy client setup).
          </Typography>

          {manualSaved && (
            <Alert severity="success" icon={<CheckCircleOutlined fontSize="small" />}
              sx={{ mb: 2.5, fontSize: '0.85rem', background: 'rgba(0,219,164,0.06)', color: '#00dba4', border: '1px solid rgba(0,219,164,0.15)' }}>
              Credentials saved successfully
            </Alert>
          )}
          {manualError && (
            <Alert severity="error" icon={<ErrorOutlined fontSize="small" />} sx={{ mb: 2.5, fontSize: '0.85rem' }}>
              {'data' in manualError ? (manualError.data as any)?.detail || 'Save failed' : 'Connection error'}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onManualSubmit)} autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <input type="text" name="prevent_autofill" style={{ display: 'none' }} readOnly tabIndex={-1} />
            <input type="password" name="prevent_autofill_pw" style={{ display: 'none' }} readOnly tabIndex={-1} />

            <TextField {...register('amazon_client_id')} label="Amazon Client ID" fullWidth autoComplete="off"
              error={!!errors.amazon_client_id} helperText={errors.amazon_client_id?.message ?? 'LWA OAuth client_id (amzn1.application-oa2-client.xxx)'}
              inputProps={{ autoComplete: 'off', style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' } }} />

            <TextField {...register('amazon_client_secret')} label="Amazon Client Secret" type="text" fullWidth autoComplete="off"
              error={!!errors.amazon_client_secret} helperText={errors.amazon_client_secret?.message ?? 'Encrypted with AES-256-GCM at rest'}
              inputProps={{ autoComplete: 'off', style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', WebkitTextSecurity: 'disc' } as React.CSSProperties }} />

            <TextField {...register('amazon_refresh_token')} label="Ads API Refresh Token" type="text" fullWidth autoComplete="off"
              error={!!errors.amazon_refresh_token} helperText={errors.amazon_refresh_token?.message ?? 'Long-lived LWA refresh token (Atzr|...)'}
              inputProps={{ autoComplete: 'off', style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', WebkitTextSecurity: 'disc' } as React.CSSProperties }} />

            <TextField {...register('amazon_profile_id')} label="Profile ID (optional)" fullWidth autoComplete="off"
              error={!!errors.amazon_profile_id} helperText="Amazon Advertising profile ID — auto-detected if left blank"
              inputProps={{ autoComplete: 'off', style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' } }} />

            <Button type="submit" variant="contained" disabled={savingManual}
              sx={{ py: 1.2, px: 4, fontSize: '0.88rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              {savingManual ? <CircularProgress size={18} sx={{ color: '#06101c' }} /> : 'Save credentials'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
