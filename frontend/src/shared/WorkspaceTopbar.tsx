import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

interface WorkspaceTopbarProps {
  crumb: string
  subtitle: string
  unread: number
  onRefresh: () => void
  onMenuToggle: () => void
  preActions?: ReactNode
  postActions?: ReactNode
}

export function WorkspaceTopbar({
  crumb, subtitle, unread, onRefresh, onMenuToggle, preActions, postActions,
}: WorkspaceTopbarProps) {
  const navigate = useNavigate()
  return (
    <header className="gf-topbar">
      <div className="gf-topbar-left">
        <button className="gf-hamburger" onClick={onMenuToggle} aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
        </button>
        <div className="gf-crumb">Workspace · <b>{crumb}</b></div>
        <span className="gf-crumb" style={{ color: 'var(--text-3)' }}>{subtitle}</span>
      </div>
      <div className="gf-topbar-right">
        {preActions}
        <button className="gf-icon-btn" title="Refresh" onClick={onRefresh}><Icon name="refresh" size={15} /></button>
        <button className="gf-icon-btn gf-bell-btn" title="Notifications" onClick={() => navigate('/notifications')}>
          <Icon name="bell" size={15} />
          {unread > 0 && <span className="gf-icon-badge">{unread}</span>}
        </button>
        {postActions}
      </div>
    </header>
  )
}
