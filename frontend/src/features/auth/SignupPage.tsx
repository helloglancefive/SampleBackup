import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Box, Typography, TextField, Button, Alert, CircularProgress, MenuItem,
  LinearProgress,
} from '@mui/material'
import { useClientSignupMutation } from '../../store/api'
import { setTokens } from './authSlice'

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters').max(200),
  full_name: z.string().min(2, 'Your name must be at least 2 characters').max(200),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  amazon_region: z.enum(['eu', 'na', 'fe']),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type SignupForm = z.infer<typeof schema>

const REGIONS = [
  { value: 'eu', label: 'Europe / India / Middle East (EU)' },
  { value: 'na', label: 'North America — US, Canada, Mexico (NA)' },
  { value: 'fe', label: 'Far East — Japan, Australia, Singapore (FE)' },
]

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ].filter(Boolean).length

  const label = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][score]
  const color = ['', '#f44336', '#ff9800', '#ffc107', '#4caf50', '#00dba4'][score]
  const pct = (score / 5) * 100

  return (
    <Box sx={{ mt: -1.5 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(100,160,240,0.08)',
          '& .MuiLinearProgress-bar': { background: color, borderRadius: 2, transition: 'all 0.4s' },
        }}
      />
      <Typography sx={{ fontSize: '0.7rem', color, mt: 0.4 }}>{label}</Typography>
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [clientSignup, { isLoading, error }] = useClientSignupMutation()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(schema),
    defaultValues: { amazon_region: 'eu' },
  })

  const passwordValue = watch('password', '')

  const onSubmit = async (data: SignupForm) => {
    try {
      const result = await clientSignup({
        business_name: data.business_name,
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        amazon_region: data.amazon_region,
      }).unwrap()
      dispatch(setTokens({ access_token: result.access_token, refresh_token: result.refresh_token }))
      navigate('/settings', { replace: true })
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
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
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
              fontSize: 'clamp(2.2rem, 3vw, 3.2rem)',
              lineHeight: 1.15,
              color: '#d8eaf8',
              mb: 3,
            }}
          >
            Start seeing<br />
            your Amazon ads<br />
            <Box component="em" sx={{ color: '#f0b429', fontStyle: 'italic' }}>clearly.</Box>
          </Typography>
          <Typography sx={{ color: '#6e8faa', fontSize: '0.9rem', maxWidth: 360, lineHeight: 1.8 }}>
            Connect once. Get campaigns, keywords, search terms, and product analytics — all in one place.
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          {[
            { label: 'Setup time', value: '< 5 min' },
            { label: 'Trial period', value: 'Free' },
            { label: 'Data encrypted', value: 'AES-256' },
          ].map((stat) => (
            <Box key={stat.label} sx={{ display: 'inline-flex', flexDirection: 'column', mr: 5, opacity: 0.8 }}>
              <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '1.2rem', fontWeight: 600, color: '#d8eaf8' }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6e8faa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Right panel — signup form ───────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: '40px 24px', md: '48px 72px' },
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile logo */}
          <Typography sx={{ display: { md: 'none' }, fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f0b429', mb: 4 }}>
            GlanceFive
          </Typography>

          <Typography variant="h3" sx={{ fontSize: '1.8rem', mb: 0.5, color: '#d8eaf8' }}>
            Create your account
          </Typography>
          <Typography sx={{ color: '#6e8faa', mb: 4, fontSize: '0.88rem' }}>
            Free trial — no credit card required
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, fontSize: '0.85rem' }}>
              {'data' in error ? (error.data as any)?.detail || 'Signup failed. Please try again.' : 'Connection error'}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}
          >
            <TextField
              {...register('business_name')}
              label="Business / Store name"
              fullWidth
              autoFocus
              error={!!errors.business_name}
              helperText={errors.business_name?.message ?? 'Your Amazon seller account name or brand name'}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />

            <TextField
              {...register('full_name')}
              label="Your full name"
              fullWidth
              error={!!errors.full_name}
              helperText={errors.full_name?.message}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />

            <TextField
              {...register('email')}
              label="Email address"
              type="email"
              fullWidth
              autoComplete="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <TextField
                {...register('password')}
                label="Password"
                type="password"
                fullWidth
                autoComplete="new-password"
                error={!!errors.password}
                helperText={errors.password?.message ?? 'Minimum 8 characters'}
                inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
              />
              <PasswordStrength password={passwordValue} />
            </Box>

            <TextField
              {...register('confirm_password')}
              label="Confirm password"
              type="password"
              fullWidth
              autoComplete="new-password"
              error={!!errors.confirm_password}
              helperText={errors.confirm_password?.message}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
            />

            <TextField
              {...register('amazon_region')}
              select
              label="Amazon marketplace region"
              fullWidth
              error={!!errors.amazon_region}
              helperText={errors.amazon_region?.message ?? 'Choose the region where you sell on Amazon'}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' } }}
            >
              {REGIONS.map((r) => (
                <MenuItem key={r.value} value={r.value} sx={{ fontSize: '0.85rem' }}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isLoading}
              sx={{ mt: 0.5, py: 1.5, fontSize: '0.92rem', fontWeight: 600 }}
            >
              {isLoading
                ? <CircularProgress size={18} sx={{ color: '#06101c' }} />
                : 'Create account'}
            </Button>
          </Box>

          <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid rgba(100,160,240,0.07)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.82rem', color: '#6e8faa' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#64a0f0', textDecoration: 'none', fontWeight: 500 }}>
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
