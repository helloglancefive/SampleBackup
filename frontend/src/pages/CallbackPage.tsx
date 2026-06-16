/**
 * Amazon OAuth Callback Page
 *
 * Amazon redirects to /callback after the seller grants consent.
 * This page reads the URL params, sends them to the backend exchange
 * endpoint, then redirects to /settings with a success or error flag.
 *
 * Ads API params:  ?code=...&state=...
 * SP-API params:   ?spapi_oauth_code=...&selling_partner_id=...&state=...
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'
import { CloudOutlined } from '@mui/icons-material'
import { useExchangeAdsCodeMutation, useExchangeSpCodeMutation } from '../store/api'

export default function CallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [exchangeAds] = useExchangeAdsCodeMutation()
  const [exchangeSp] = useExchangeSpCodeMutation()
  const [label, setLabel] = useState('Connecting to Amazon...')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = searchParams.get('code')
    const spapiCode = searchParams.get('spapi_oauth_code')
    const state = searchParams.get('state')
    const sellingPartnerId = searchParams.get('selling_partner_id') ?? ''
    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')

    const redirect = (path: string) => {
      setTimeout(() => navigate(path, { replace: true }), 800)
    }

    if (error) {
      redirect(`/settings?oauth_error=${encodeURIComponent(errorDesc || error)}`)
      return
    }

    if (!state) {
      redirect('/settings?oauth_error=missing_state_parameter')
      return
    }

    if (code) {
      setLabel('Completing Ads API connection...')
      exchangeAds({ code, state })
        .unwrap()
        .then(() => redirect('/settings?ads_connected=1'))
        .catch((err) => {
          const msg = err?.data?.detail || 'ads_exchange_failed'
          redirect(`/settings?oauth_error=${encodeURIComponent(msg)}`)
        })
    } else if (spapiCode) {
      setLabel('Completing SP-API connection...')
      exchangeSp({ spapi_oauth_code: spapiCode, state, selling_partner_id: sellingPartnerId })
        .unwrap()
        .then(() => redirect('/settings?sp_connected=1'))
        .catch((err) => {
          const msg = err?.data?.detail || 'sp_exchange_failed'
          redirect(`/settings?oauth_error=${encodeURIComponent(msg)}`)
        })
    } else {
      redirect('/settings?oauth_error=no_authorization_code')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#06101c',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '14px',
          background: 'rgba(100,160,240,0.08)',
          border: '1px solid rgba(100,160,240,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <CloudOutlined sx={{ color: '#64a0f0', fontSize: 28 }} />
      </Box>

      <CircularProgress size={28} thickness={3} sx={{ color: '#64a0f0' }} />

      <Typography sx={{ color: '#d8eaf8', fontSize: '0.95rem', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#6e8faa', fontSize: '0.78rem' }}>
        You will be redirected automatically
      </Typography>
    </Box>
  )
}
