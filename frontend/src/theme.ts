import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#06101c',
      paper: '#0c1a2e',
    },
    primary: { main: '#f0b429', contrastText: '#06101c' },
    secondary: { main: '#00dba4', contrastText: '#06101c' },
    error: { main: '#ff4d6d' },
    warning: { main: '#f0b429' },
    info: { main: '#4d9eff' },
    success: { main: '#00dba4' },
    text: {
      primary: '#d8eaf8',
      secondary: '#6e8faa',
      disabled: '#3d5570',
    },
    divider: 'rgba(100,160,240,0.07)',
  },
  typography: {
    fontFamily: "'Outfit', system-ui, sans-serif",
    h1: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 },
    h2: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 },
    h3: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 },
    h4: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 },
    h5: { fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 500 },
    h6: { fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 500 },
    overline: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    caption: { color: '#6e8faa' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #06101c; }
        ::-webkit-scrollbar-thumb { background: #192b42; border-radius: 3px; }
      `,
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(100,160,240,0.07)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: '#0c1a2e',
          border: '1px solid rgba(100,160,240,0.07)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            borderColor: 'rgba(240,180,41,0.3)',
            boxShadow: '0 0 20px rgba(240,180,41,0.1)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 500,
          textTransform: 'none',
          letterSpacing: '0.01em',
        },
        contained: {
          background: '#f0b429',
          color: '#06101c',
          '&:hover': { background: '#ffcc55', boxShadow: '0 0 20px rgba(240,180,41,0.3)' },
        },
        outlined: {
          borderColor: 'rgba(240,180,41,0.4)',
          color: '#f0b429',
          '&:hover': { borderColor: '#f0b429', background: 'rgba(240,180,41,0.06)' },
        },
        text: {
          color: '#f0b429',
          '&:hover': { background: 'rgba(240,180,41,0.06)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: '#06101c',
            '& fieldset': { borderColor: 'rgba(100,160,240,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(100,160,240,0.25)' },
            '&.Mui-focused fieldset': { borderColor: '#f0b429', borderWidth: 1 },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: '#f0b429' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#6e8faa',
            borderBottom: '1px solid rgba(100,160,240,0.12)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(100,160,240,0.06)',
          padding: '10px 16px',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(100,160,240,0.07)' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { border: '1px solid' },
        standardError: { borderColor: 'rgba(255,77,109,0.3)', background: 'rgba(255,77,109,0.08)' },
        standardSuccess: { borderColor: 'rgba(0,219,164,0.3)', background: 'rgba(0,219,164,0.08)' },
        standardWarning: { borderColor: 'rgba(240,180,41,0.3)', background: 'rgba(240,180,41,0.08)' },
      },
    },
  },
})
