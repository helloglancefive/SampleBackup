import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import { ErrorOutlineOutlined } from '@mui/icons-material'

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#06101c',
          p: 3,
          textAlign: 'center',
        }}
      >
        <Box sx={{ maxWidth: 440 }}>
          <ErrorOutlineOutlined sx={{ fontSize: 52, color: '#ff6b8a', mb: 2 }} />
          <Typography
            variant="h3"
            sx={{ fontSize: '1.6rem', mb: 1.5, color: '#d8eaf8' }}
          >
            Something went wrong
          </Typography>
          <Typography
            sx={{ color: '#6e8faa', fontSize: '0.9rem', lineHeight: 1.7, mb: 4 }}
          >
            An unexpected error occurred. The details have been logged.
            Try refreshing the page — if the problem persists, contact support.
          </Typography>
          <Box
            sx={{
              mb: 3,
              p: 2,
              background: 'rgba(255,107,138,0.06)',
              border: '1px solid rgba(255,107,138,0.15)',
              borderRadius: '8px',
              textAlign: 'left',
            }}
          >
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: '#ff6b8a',
                wordBreak: 'break-all',
              }}
            >
              {this.state.error.message}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ mr: 2, fontWeight: 600 }}
          >
            Reload page
          </Button>
          <Button
            variant="outlined"
            onClick={() => { this.setState({ error: null }); window.history.back() }}
            sx={{ fontWeight: 600 }}
          >
            Go back
          </Button>
        </Box>
      </Box>
    )
  }
}
