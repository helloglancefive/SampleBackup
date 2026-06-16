import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import OverviewPage from './features/overview/OverviewPage'
import CampaignPage from './features/campaigns/CampaignPage'
import KeywordsPage from './features/keywords/KeywordsPage'
import ProductsPage from './features/products/ProductsPage'
import SmartRecsPage from './features/recommendations/SmartRecsPage'
import MediaPlanPage from './features/mediaplan/MediaPlanPage'
import FetchHistoryPage from './features/reports/FetchHistoryPage'
import CredentialsPage from './features/settings/CredentialsPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import PlacementsPage from './features/placements/PlacementsPage'
import SubscriptionPage from './features/billing/SubscriptionPage'
import CallbackPage from './pages/CallbackPage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/ErrorBoundary'
import { useGetMeQuery } from './store/api'
import { setUser } from './features/auth/authSlice'
import type { RootState } from './store'

function AuthInit() {
  const dispatch = useDispatch()
  const token = useSelector((s: RootState) => s.auth.accessToken)
  const { data: me } = useGetMeQuery(undefined, { skip: !token })
  useEffect(() => {
    if (me) dispatch(setUser(me))
  }, [me, dispatch])
  return null
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthInit />
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Public OAuth callback -- Amazon redirects here after consent */}
        <Route path="/callback" element={<CallbackPage />} />

        {/* ── New 5-page analytics workspace ── */}
        <Route path="/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
        <Route path="/campaigns" element={<ProtectedRoute><CampaignPage /></ProtectedRoute>} />
        <Route path="/keywords" element={<ProtectedRoute><KeywordsPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><SmartRecsPage /></ProtectedRoute>} />
        <Route path="/media-plan" element={<ProtectedRoute><MediaPlanPage /></ProtectedRoute>} />

        {/* ── Legacy /dashboard redirect ── */}
        <Route path="/dashboard" element={<Navigate to="/overview" replace />} />

        {/* ── Account / utility pages (use shared Layout) ── */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/fetch-history" element={<FetchHistoryPage />} />
                  <Route path="/settings" element={<CredentialsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/placements" element={<PlacementsPage />} />
                  <Route path="/subscription" element={<SubscriptionPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
