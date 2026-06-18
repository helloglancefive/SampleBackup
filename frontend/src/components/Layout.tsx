import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Typography, Badge, Tooltip, Divider,
} from '@mui/material'
import {
  DashboardOutlined, HistoryOutlined, SettingsOutlined,
  NotificationsOutlined, LogoutOutlined, MenuOutlined,
  PlaceOutlined, WorkspacePremiumOutlined, PeopleOutlined,
  StorefrontOutlined,
} from '@mui/icons-material'
import { logout } from '../features/auth/authSlice'
import { useGetUnreadCountQuery } from '../store/api'
import type { RootState } from '../store'

const SIDEBAR_W = 220

const navItems = [
  { label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
  { label: 'Business Reports', icon: <StorefrontOutlined />, path: '/sp-business' },
  { label: 'Placements', icon: <PlaceOutlined />, path: '/placements' },
  { label: 'Fetch History', icon: <HistoryOutlined />, path: '/fetch-history' },
  { label: 'Subscription', icon: <WorkspacePremiumOutlined />, path: '/subscription' },
  { label: 'Settings', icon: <SettingsOutlined />, path: '/settings' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const user = useSelector((s: RootState) => s.auth.user)
  const { data: unreadData } = useGetUnreadCountQuery(undefined, { pollingInterval: 30000 })
  const unread = unreadData?.count ?? 0
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 3 }}>
      {/* Logo */}
      <Box sx={{ px: 3, mb: 4 }}>
        <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f0b429' }}>
          GlanceFive
        </Typography>
        <Typography sx={{ fontFamily: "'Instrument Serif',serif", fontSize: '1.05rem', color: '#d8eaf8', lineHeight: 1.2, mt: 0.5 }}>
          Analytics
        </Typography>
      </Box>

      <Divider sx={{ mx: 3, mb: 2 }} />

      {/* Nav items */}
      <List sx={{ px: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: '8px',
                mb: 0.5,
                px: 2,
                py: 1,
                color: active ? '#f0b429' : '#6e8faa',
                background: active ? 'rgba(240,180,41,0.08)' : 'transparent',
                border: active ? '1px solid rgba(240,180,41,0.18)' : '1px solid transparent',
                '&:hover': {
                  color: '#d8eaf8',
                  background: 'rgba(100,160,240,0.06)',
                  border: '1px solid rgba(100,160,240,0.1)',
                },
                transition: 'all 0.15s',
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: active ? 500 : 400 }}
              />
            </ListItemButton>
          )
        })}
      </List>

      {/* Admin section — only for Admin role */}
      {user?.role === 'Admin' && (
        <>
          <Divider sx={{ mx: 3, mb: 1.5 }} />
          <Box sx={{ px: 2.5, mb: 0.5 }}>
            <Typography sx={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '0.6rem', color: '#f0b429',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>
              Admin
            </Typography>
          </Box>
          <List sx={{ px: 1.5 }}>
            {[{ label: 'Clients', icon: <PeopleOutlined />, path: '/admin/clients' }].map((item) => {
              const active = location.pathname === item.path
              return (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  sx={{
                    borderRadius: '8px', mb: 0.5, px: 2, py: 1,
                    color: active ? '#f0b429' : '#6e8faa',
                    background: active ? 'rgba(240,180,41,0.08)' : 'transparent',
                    border: active ? '1px solid rgba(240,180,41,0.18)' : '1px solid transparent',
                    '&:hover': { color: '#d8eaf8', background: 'rgba(100,160,240,0.06)', border: '1px solid rgba(100,160,240,0.1)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.88rem', fontWeight: active ? 500 : 400 }} />
                </ListItemButton>
              )
            })}
          </List>
        </>
      )}

      <Divider sx={{ mx: 3, mb: 2 }} />

      {/* Bottom actions */}
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Tooltip title={`${unread} unread notifications`} placement="right">
          <ListItemButton
            component={Link}
            to="/notifications"
            sx={{ borderRadius: '8px', px: 2, py: 1, color: '#6e8faa', '&:hover': { color: '#d8eaf8' } }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
              <Badge badgeContent={unread} color="warning" max={99}>
                <NotificationsOutlined />
              </Badge>
            </ListItemIcon>
            <ListItemText primary="Notifications" primaryTypographyProps={{ fontSize: '0.88rem' }} />
          </ListItemButton>
        </Tooltip>

        <ListItemButton onClick={handleLogout} sx={{ borderRadius: '8px', px: 2, py: 1, color: '#6e8faa', '&:hover': { color: '#ff4d6d' } }}>
          <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><LogoutOutlined /></ListItemIcon>
          <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: '0.88rem' }} />
        </ListItemButton>
      </Box>

      {/* User pill */}
      {user && (
        <Box sx={{ mx: 2, mt: 2, p: 1.5, background: 'rgba(100,160,240,0.04)', borderRadius: '8px', border: '1px solid rgba(100,160,240,0.07)' }}>
          <Typography sx={{ fontSize: '0.78rem', color: '#d8eaf8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.full_name}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: '#6e8faa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </Typography>
          <Box sx={{ mt: 0.5, display: 'inline-block', px: 1, py: 0.25, background: 'rgba(240,180,41,0.1)', borderRadius: '4px', border: '1px solid rgba(240,180,41,0.2)' }}>
            <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.62rem', color: '#f0b429', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {user.role}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#06101c' }}>
      {/* Desktop sidebar */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: SIDEBAR_W,
          flexShrink: 0,
          borderRight: '1px solid rgba(100,160,240,0.07)',
          background: '#0c1a2e',
        }}
      >
        {sidebarContent}
      </Box>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: SIDEBAR_W, background: '#0c1a2e', border: 'none' } }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile topbar */}
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          height: 52,
          px: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(100,160,240,0.07)',
          background: '#0c1a2e',
        }}>
          <Typography sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f0b429' }}>
            GlanceFive
          </Typography>
          <IconButton onClick={() => setMobileOpen(true)} size="small" sx={{ color: '#6e8faa' }}>
            <MenuOutlined />
          </IconButton>
        </Box>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 4 }, overflowX: 'hidden' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
