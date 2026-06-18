import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '../features/auth/authSlice'
import { Icon, BrandMark } from './Icon'

function initials(name: string | undefined) {
  if (!name) return 'U'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const WORKSPACE_NAV = [
  { label: 'Overview',         icon: 'grid',        href: '/overview' },
  { label: 'Campaigns',        icon: 'campaigns',   href: '/campaigns' },
  { label: 'Keywords',         icon: 'tag',         href: '/keywords' },
  { label: 'Products',         icon: 'box',         href: '/products' },
  { label: 'Business Reports', icon: 'trending_up', href: '/sp-business' },
  { label: 'Smart Recs',       icon: 'bolt',        href: '/recommendations' },
  { label: 'Media Plan',       icon: 'calendar',    href: '/media-plan' },
  { label: 'Placements',       icon: 'chart',       href: '/placements' },
  { label: 'Reports',          icon: 'history',     href: '/fetch-history' },
  { label: 'Subscription',     icon: 'star',        href: '/subscription' },
]

export function WorkspaceSidebar({ user, unread }: { user: any; unread: number }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const path = window.location.pathname
  return (
    <aside className="gf-sidebar">
      <div className="gf-brand">
        <div className="gf-brand-mark"><BrandMark /> GlanceFive</div>
        <div className="gf-brand-title">Ads Console</div>
        <div className="gf-brand-sub">Amazon Advertising · Analytics</div>
      </div>
      <nav className="gf-nav">
        <div className="gf-nav-section">Workspace</div>
        {WORKSPACE_NAV.map(n => (
          <Link key={n.href} to={n.href} className={`gf-nav-item${path === n.href ? ' active' : ''}`}>
            <Icon name={n.icon} size={16} /><span>{n.label}</span>
          </Link>
        ))}
        <div className="gf-nav-section" style={{ marginTop: 8 }}>Account</div>
        <Link to="/notifications" className={`gf-nav-item${path === '/notifications' ? ' active' : ''}`}>
          <Icon name="bell" size={16} /><span>Notifications</span>
          {unread > 0 && <span className="gf-nav-badge warn">{unread}</span>}
        </Link>
        <Link to="/settings" className={`gf-nav-item${path === '/settings' ? ' active' : ''}`}>
          <Icon name="cog" size={16} /><span>Settings</span>
        </Link>
        <button className="gf-nav-item" onClick={() => { dispatch(logout()); navigate('/login', { replace: true }) }}>
          <Icon name="logout" size={16} /><span>Sign out</span>
        </button>
      </nav>
      {user && (
        <div className="gf-user-pill">
          <div className="gf-user-avatar">{initials(user.full_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="gf-user-name">{user.full_name || 'User'}</div>
            <div className="gf-user-email">{user.email}</div>
          </div>
        </div>
      )}
    </aside>
  )
}
