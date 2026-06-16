import { useEffect, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'

interface UseWebSocketOptions {
  path: string        // e.g. "/ws/v1/dashboard/42"
  onMessage?: (data: unknown) => void
  enabled?: boolean
}

export function useWebSocket({ path, onMessage, enabled = true }: UseWebSocketOptions) {
  const token = useSelector((s: RootState) => s.auth.accessToken)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!token || !enabled || !mountedRef.current) return

    const apiUrl = import.meta.env.VITE_API_URL ?? ''
    const wsBase = apiUrl
      ? apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    const url = `${wsBase}${path}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        onMessage?.(data)
      } catch {}
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 3000)
    }

    ws.onerror = () => ws.close()
  }, [path, token, enabled, onMessage])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])
}
