export function fmt(n: number | null | undefined, type: 'currency' | 'pct' | 'num' | 'x' = 'num'): string {
  if (n == null) return '—'
  if (type === 'currency') {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L'
    if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K'
    return '₹' + Math.round(n).toLocaleString('en-IN')
  }
  if (type === 'pct') return (n * 100).toFixed(2) + '%'
  if (type === 'x') return n.toFixed(2) + '×'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.round(n).toLocaleString('en-IN')
}

export function fmtCur(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L'
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function fmtNum(n: number | null | undefined, dec = 0): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return dec > 0 ? n.toFixed(dec) : Math.round(n).toLocaleString('en-IN')
}

export function fmtX(n: number | null | undefined): string {
  return n == null ? '—' : n.toFixed(2) + '×'
}

export function getDateRange(
  preset: string,
  customStart?: string,
  customEnd?: string,
): { start_date: string; end_date: string } {
  if (preset === 'custom' && customStart && customEnd) {
    return { start_date: customStart, end_date: customEnd }
  }
  const today = new Date()
  const f = (d: Date) => d.toISOString().slice(0, 10)
  const s = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() - n); return x }
  switch (preset) {
    case 'today':     return { start_date: f(today), end_date: f(today) }
    case 'yesterday': { const y = s(today, 1); return { start_date: f(y), end_date: f(y) } }
    case '7d':  return { start_date: f(s(today, 6)),  end_date: f(today) }
    case '14d': return { start_date: f(s(today, 13)), end_date: f(today) }
    case '30d': return { start_date: f(s(today, 29)), end_date: f(today) }
    case '60d': return { start_date: f(s(today, 59)), end_date: f(today) }
    case '90d': return { start_date: f(s(today, 89)), end_date: f(today) }
    case 'mtd': return { start_date: f(new Date(today.getFullYear(), today.getMonth(), 1)), end_date: f(today) }
    case 'qtd': {
      const q = Math.floor(today.getMonth() / 3)
      return { start_date: f(new Date(today.getFullYear(), q * 3, 1)), end_date: f(today) }
    }
    case 'ytd': return { start_date: f(new Date(today.getFullYear(), 0, 1)), end_date: f(today) }
    default:    return { start_date: f(s(today, 29)), end_date: f(today) }
  }
}
