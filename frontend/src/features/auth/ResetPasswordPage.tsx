import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material'
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material'
import { useConfirmPasswordResetMutation } from '../../store/api'

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [success, setSuccess] = useState(false)
  const [confirmReset, { isLoading, error }] = useConfirmPasswordResetMutation()

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => navigate('/login', { replace: true }), 3000)
      return () => clearTimeout(t)
    }
  }, [success, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (!token) return
    try {
      await confirmReset({ token, new_password: data.new_password }).unwrap()
      setSuccess(true)
    } catch {}
  }

  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06101c', p: 3 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 380 }}>
          <ErrorOutline sx={{ fontSize: 48, color: '#ff6b8a', mb: 2 }} />
          <Typography variant="h3" sx={{ fontSize: '1.6rem', mb: 1.5, color: '#d8eaf8' }}>
            Invalid reset link
          </Typography>
          <Typography sx={{ color: '#6e8faa', mb: 4, fontSize: '0.9rem' }}>
            This link is missing the reset token. Please request a new one.
          </Typography>
          <Link to="/forgot-password" style={{ color: '#64a0f0', fontSize: '0.88rem', textDecoration: 'none' }}>
            Request new reset link
          </Link>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#06101c',
        p: { xs: '24px', md: '56px' },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Typography
          sx={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#f0b429',
            mb: 6,
          }}
        >
          GlanceFive
        </Typography>

        {success ? (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleOutline sx={{ fontSize: 48, color: '#00dba4', mb: 2 }} />
            <Typography variant="h3" sx={{ fontSize: '1.6rem', mb: 1.5, color: '#d8eaf8' }}>
              Password updated
            </Typography>
            <Typography sx={{ color: '#6e8faa', fontSize: '0.9rem', mb: 2 }}>
              Your password has been changed. Redirecting you to sign in…
            </Typography>
            <Link to="/login" style={{ color: '#64a0f0', fontSize: '0.88rem', textDecoration: 'none' }}>
              Sign in now
            </Link>
          </Box>
        ) : (
          <>
            <Typography variant="h3" sx={{ fontSize: '1.9rem', mb: 1, color: '#d8eaf8' }}>
              Set new password
            </Typography>
            <Typography sx={{ color: '#6e8faa', mb: 5, fontSize: '0.9rem' }}>
              Choose a strong password for your account.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, fontSize: '0.85rem' }}>
                {'data' in error
                  ? (error.data as any)?.detail || 'This link is invalid or has expired.'
                  : 'Connection error. Please try again.'}
                {' '}
                <Link to="/forgot-password" style={{ color: '#ff6b8a' }}>
                  Request a new link.
                </Link>
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                {...register('new_password')}
                label="New password"
                type="password"
                fullWidth
                autoFocus
                error={!!errors.new_password}
                helperText={errors.new_password?.message}
                autoComplete="new-password"
                inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
              />
              <TextField
                {...register('confirm_password')}
                label="Confirm password"
                type="password"
                fullWidth
                error={!!errors.confirm_password}
                helperText={errors.confirm_password?.message}
                autoComplete="new-password"
                inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading}
                sx={{ py: 1.5, fontSize: '0.9rem', fontWeight: 600 }}
              >
                {isLoading ? <CircularProgress size={18} sx={{ color: '#06101c' }} /> : 'Update password'}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}
