import { useState } from 'react'
import {
  Box, Typography, Button, Chip, Skeleton, Divider,
} from '@mui/material'
import {
  CheckOutlined, NotificationsNoneOutlined, DoneAllOutlined,
} from '@mui/icons-material'
import {
  useGetNotificationsQuery,
  useMarkAllReadMutation,
} from '../../store/api'

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  fetch_complete:  { color: '#00dba4', bg: 'rgba(0,219,164,0.1)' },
  fetch_failed:    { color: '#ff4d6d', bg: 'rgba(255,77,109,0.1)' },
  fetch_started:   { color: '#64a0f0', bg: 'rgba(100,160,240,0.1)' },
  system:          { color: '#f0b429', bg: 'rgba(240,180,41,0.1)' },
  info:            { color: '#6e8faa', bg: 'rgba(100,160,240,0.06)' },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { data, isLoading, refetch } = useGetNotificationsQuery(
    { page, per_page: 30, unread_only: unreadOnly },
    { pollingInterval: 30000 },
  )
  const [markAll, { isLoading: marking }] = useMarkAllReadMutation()

  const handleMarkAll = async () => {
    try {
      await markAll().unwrap()
      refetch()
    } catch {}
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontFamily: "'Instrument Serif',serif", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: '#d8eaf8', lineHeight: 1.2 }}>
            Notifications
          </Typography>
          <Typography sx={{ color: '#6e8faa', fontSize: '0.82rem', mt: 0.5 }}>
            System alerts and fetch status updates
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant={unreadOnly ? 'contained' : 'outlined'}
            onClick={() => { setUnreadOnly((v) => !v); setPage(1) }}
            sx={{
              fontSize: '0.78rem',
              borderColor: 'rgba(100,160,240,0.2)',
              color: unreadOnly ? '#06101c' : '#6e8faa',
              background: unreadOnly ? '#f0b429' : 'transparent',
              '&:hover': { borderColor: 'rgba(100,160,240,0.4)' },
            }}
          >
            Unread only
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DoneAllOutlined sx={{ fontSize: 15 }} />}
            onClick={handleMarkAll}
            disabled={marking}
            sx={{ fontSize: '0.78rem', borderColor: 'rgba(100,160,240,0.2)', color: '#6e8faa', '&:hover': { borderColor: 'rgba(100,160,240,0.4)', color: '#d8eaf8' } }}
          >
            Mark all read
          </Button>
        </Box>
      </Box>

      <Box
        className="animate-in"
        sx={{
          background: '#0c1a2e',
          border: '1px solid rgba(100,160,240,0.07)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={60} sx={{ background: 'rgba(100,160,240,0.06)', mb: 1 }} />
            ))}
          </Box>
        ) : (data?.items ?? []).length === 0 ? (
          <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <NotificationsNoneOutlined sx={{ fontSize: 40, color: '#2a3d55' }} />
            <Typography sx={{ color: '#4a6785', fontSize: '0.88rem' }}>
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </Typography>
          </Box>
        ) : (
          <Box>
            {(data?.items ?? []).map((notif: any, i: number) => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.info
              return (
                <Box key={notif.id}>
                  {i > 0 && <Divider sx={{ borderColor: 'rgba(100,160,240,0.05)' }} />}
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 2,
                      px: 3,
                      py: 2,
                      background: notif.is_read ? 'transparent' : 'rgba(100,160,240,0.025)',
                      transition: 'background 0.1s',
                      '&:hover': { background: 'rgba(100,160,240,0.04)' },
                    }}
                  >
                    {/* Unread dot */}
                    <Box sx={{ mt: 0.6, width: 6, height: 6, borderRadius: '50%', background: notif.is_read ? 'transparent' : '#f0b429', flexShrink: 0, alignSelf: 'flex-start' }} />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={notif.type?.replace(/_/g, ' ')}
                          size="small"
                          sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.62rem', height: 18, background: cfg.bg, color: cfg.color, border: 'none', textTransform: 'lowercase' }}
                        />
                        <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', color: '#4a6785' }}>
                          {relativeTime(notif.created_at)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.85rem', color: notif.is_read ? '#6e8faa' : '#d8eaf8', lineHeight: 1.5 }}>
                        {notif.message}
                      </Typography>
                    </Box>

                    {!notif.is_read && (
                      <CheckOutlined sx={{ fontSize: 16, color: '#2a3d55', alignSelf: 'center', cursor: 'default' }} />
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {data && data.total > 30 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 2, borderTop: '1px solid rgba(100,160,240,0.06)' }}>
            <Button size="small" disabled={page === 1} onClick={() => setPage((p) => p - 1)} sx={{ fontSize: '0.78rem', color: '#6e8faa' }}>Prev</Button>
            <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.75rem', color: '#4a6785', alignSelf: 'center' }}>
              {page} / {Math.ceil(data.total / 30)}
            </Typography>
            <Button size="small" disabled={page >= Math.ceil(data.total / 30)} onClick={() => setPage((p) => p + 1)} sx={{ fontSize: '0.78rem', color: '#6e8faa' }}>Next</Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
