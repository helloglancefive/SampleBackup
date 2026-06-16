import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: number; email: string; full_name: string; role: string; client_id: number | null } | null
}

const initial: AuthState = {
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  user: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    setTokens(state, action: PayloadAction<{ access_token: string; refresh_token: string }>) {
      state.accessToken = action.payload.access_token
      state.refreshToken = action.payload.refresh_token
      localStorage.setItem('access_token', action.payload.access_token)
      localStorage.setItem('refresh_token', action.payload.refresh_token)
    },
    setUser(state, action: PayloadAction<AuthState['user']>) {
      state.user = action.payload
    },
    logout(state) {
      state.accessToken = null
      state.refreshToken = null
      state.user = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
  },
})

export const { setTokens, setUser, logout } = authSlice.actions
export default authSlice.reducer
