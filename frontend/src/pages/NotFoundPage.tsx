import { Link } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'

export default function NotFoundPage() {
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
      <Box sx={{ maxWidth: 400 }}>
        <Typography
          sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '5rem',
            fontWeight: 700,
            color: 'rgba(100,160,240,0.15)',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>
        <Typography
          variant="h3"
          sx={{ fontSize: '1.6rem', mb: 1.5, color: '#d8eaf8' }}
        >
          Page not found
        </Typography>
        <Typography
          sx={{ color: '#6e8faa', fontSize: '0.9rem', lineHeight: 1.7, mb: 4 }}
        >
          The page you're looking for doesn't exist or has been moved.
        </Typography>
        <Button
          component={Link}
          to="/overview"
          variant="contained"
          sx={{ fontWeight: 600 }}
        >
          Back to Overview
        </Button>
      </Box>
    </Box>
  )
}
