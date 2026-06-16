import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material'
import { CheckCircleOutline } from '@mui/icons-material'
import { useRequestPasswordResetMutation } from '../../store/api'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [requestReset, { isLoading, error }] = useRequestPasswordResetMutation()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await requestReset(data).unwrap()
      setSubmitted(true)
    } catch {
      // API always returns 202 even for unknown emails — error means network failure
    }
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

        {submitted ? (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleOutline sx={{ fontSize: 48, color: '#00dba4', mb: 2 }} />
            <Typography variant="h3" sx={{ fontSize: '1.6rem', mb: 1.5, color: '#d8eaf8' }}>
              Check your inbox
            </Typography>
            <Typography sx={{ color: '#6e8faa', fontSize: '0.9rem', lineHeight: 1.7, mb: 4 }}>
              If that email is registered, we've sent a reset link. It expires in 1 hour.
              Check your spam folder if you don't see it.
            </Typography>
            <Link to="/login" style={{ color: '#64a0f0', fontSize: '0.88rem', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </Box>
        ) : (
          <>
            <Typography variant="h3" sx={{ fontSize: '1.9rem', mb: 1, color: '#d8eaf8' }}>
              Forgot password?
            </Typography>
            <Typography sx={{ color: '#6e8faa', mb: 5, fontSize: '0.9rem', lineHeight: 1.6 }}>
              Enter your account email and we'll send you a reset link.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, fontSize: '0.85rem' }}>
                Could not send reset email. Check your connection and try again.
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                {...register('email')}
                label="Email address"
                type="email"
                fullWidth
                autoFocus
                error={!!errors.email}
                helperText={errors.email?.message}
                autoComplete="email"
                inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem' } }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading}
                sx={{ py: 1.5, fontSize: '0.9rem', fontWeight: 600 }}
              >
                {isLoading ? <CircularProgress size={18} sx={{ color: '#06101c' }} /> : 'Send reset link'}
              </Button>
            </Box>

            <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid rgba(100,160,240,0.07)', textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#64a0f0', fontSize: '0.85rem', textDecoration: 'none' }}>
                ← Back to sign in
              </Link>
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}
