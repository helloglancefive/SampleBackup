import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material'
import { useLoginMutation, useGetMeQuery } from '../../store/api'
import { setTokens, setUser } from './authSlice'
import type { RootState } from '../../store'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})
type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const token = useSelector((s: RootState) => s.auth.accessToken)
  const [login, { isLoading, error }] = useLoginMutation()
  const { data: me } = useGetMeQuery(undefined, { skip: !token })

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (me) {
      dispatch(setUser(me))
      navigate('/dashboard', { replace: true })
    }
  }, [me, dispatch, navigate])

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login(data).unwrap()
      dispatch(setTokens({ access_token: result.access_token, refresh_token: result.refresh_token }))
    } catch {}
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        background: '#06101c',
      }}
    >
      {/* Left panel — editorial brand identity */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: '56px 64px',
          background: 'linear-gradient(160deg, #08152a 0%, #06101c 60%)',
          borderRight: '1px solid rgba(100,160,240,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid texture */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.4,
          backgroundImage: 'linear-gradient(rgba(100,160,240,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(100,160,240,0.04) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Amber accent line */}
        <Box sx={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '2px', background: 'linear-gradient(to bottom, transparent, #f0b429, transparent)', opacity: 0.6 }} />

        <Box sx={{ position: 'relative' }}>
          <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f0b429', mb: 3 }}>
            GlanceFive
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          <Typography
            sx={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 'clamp(2.4rem, 3.5vw, 3.5rem)',
              lineHeight: 1.15,
              color: '#d8eaf8',
              mb: 3,
            }}
          >
            Amazon Ads,<br />
            <Box component="em" sx={{ color: '#f0b429', fontStyle: 'italic' }}>
              seen clearly.
            </Box>
          </Typography>
          <Typography sx={{ color: '#6e8faa', fontSize: '0.95rem', maxWidth: 380, lineHeight: 1.7 }}>
            Unified analytics across Sponsored Products, Brands, and Display. Real-time metrics, one platform.
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          {[
            { label: 'Report types', value: '8' },
            { label: 'Metrics tracked', value: '100+' },
            { label: 'Data latency', value: '<24h' },
          ].map((stat) => (
            <Box key={stat.label} sx={{ display: 'inline-flex', flexDirection: 'column', mr: 5, opacity: 0.8 }}>
              <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '1.4rem', fontWeight: 600, color: '#d8eaf8' }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6e8faa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right panel — login form */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: '40px 24px', md: '56px 72px' },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <Typography sx={{ display: { md: 'none' }, fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f0b429', mb: 4 }}>
            GlanceFive
          </Typography>

          <Typography variant="h3" sx={{ fontSize: '1.9rem', mb: 1, color: '#d8eaf8' }}>
            Sign in
          </Typography>
          <Typography sx={{ color: '#6e8faa', mb: 5, fontSize: '0.9rem' }}>
            Enter your credentials to access your dashboard.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, fontSize: '0.85rem' }}>
              {'data' in error ? (error.data as any)?.detail || 'Login failed' : 'Connection error'}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              {...register('email')}
              label="Email address"
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              autoComplete="email"
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />
            <TextField
              {...register('password')}
              label="Password"
              type="password"
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              autoComplete="current-password"
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isLoading}
              sx={{
                mt: 1,
                py: 1.5,
                fontSize: '0.9rem',
                fontWeight: 600,
                position: 'relative',
              }}
            >
              {isLoading ? <CircularProgress size={18} sx={{ color: '#06101c' }} /> : 'Sign in'}
            </Button>
          </Box>

          <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid rgba(100,160,240,0.07)', display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.82rem', color: '#6e8faa' }}>
              New to GlanceFive?{' '}
              <Link to="/signup" style={{ color: '#64a0f0', textDecoration: 'none', fontWeight: 500 }}>
                Create an account
              </Link>
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#3d5570' }}>
              <Link to="/forgot-password" style={{ color: '#6e8faa', textDecoration: 'none' }}>
                Forgot your password?
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
