import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { RootState } from './index'
import { setTokens, logout } from '../features/auth/authSlice'

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface CredentialsStatus {
  has_ads_credentials: boolean
  has_sp_credentials: boolean
  is_active: boolean
  amazon_profile_id: string | null
  sp_seller_id: string | null
  sp_marketplace_id: string | null
  amazon_region: string
  last_token_refresh: string | null
  sp_last_token_refresh: string | null
}

const base = fetchBaseQuery({
  baseUrl: (import.meta.env.VITE_API_URL ?? '') + '/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await base(args, api, extraOptions)
  if (result.error?.status === 401) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken
    if (refreshToken) {
      const refresh = await base(
        { url: '/auth/refresh', method: 'POST', body: { refresh_token: refreshToken } },
        api,
        extraOptions,
      )
      if (refresh.data) {
        api.dispatch(setTokens(refresh.data as { access_token: string; refresh_token: string }))
        result = await base(args, api, extraOptions)
      } else {
        api.dispatch(logout())
      }
    } else {
      api.dispatch(logout())
    }
  }
  return result
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Client', 'Notification', 'Dashboard', 'ReportFetch', 'Credentials'],
  endpoints: (builder) => ({
    // Auth
    login: builder.mutation<{ access_token: string; refresh_token: string }, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    signup: builder.mutation<{ id: number; email: string }, { email: string; password: string; full_name: string }>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),
    clientSignup: builder.mutation<
      { access_token: string; refresh_token: string; token_type: string },
      { business_name: string; full_name: string; email: string; password: string; amazon_region?: string }
    >({
      query: (body) => ({ url: '/auth/client-signup', method: 'POST', body }),
    }),
    requestPasswordReset: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: '/auth/password-reset', method: 'POST', body }),
    }),
    confirmPasswordReset: builder.mutation<{ message: string }, { token: string; new_password: string }>({
      query: (body) => ({ url: '/auth/password-reset', method: 'PUT', body }),
    }),
    getMe: builder.query<{ id: number; email: string; full_name: string; role: string; client_id: number | null }, void>({
      query: () => '/users/me',
      providesTags: ['User'],
    }),

    // Dashboard — client_id comes from JWT, not query params
    getMetrics: builder.query<any, { start_date?: string; end_date?: string; report_type?: string }>({
      query: ({ start_date, end_date, report_type }) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (report_type) params.set('report_type', report_type)
        const qs = params.toString()
        return `/dashboard/metrics${qs ? `?${qs}` : ''}`
      },
      providesTags: ['Dashboard'],
    }),
    getCharts: builder.query<any, { start_date?: string; end_date?: string; report_type?: string }>({
      query: ({ start_date, end_date, report_type }) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (report_type) params.set('report_type', report_type)
        const qs = params.toString()
        return `/dashboard/charts${qs ? `?${qs}` : ''}`
      },
      providesTags: ['Dashboard'],
    }),
    getDashboardSummary: builder.query<any, { start_date?: string; end_date?: string }>({
      query: ({ start_date, end_date } = {}) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        const qs = params.toString()
        return `/dashboard/summary${qs ? `?${qs}` : ''}`
      },
      providesTags: ['Dashboard'],
    }),
    getSearchTerms: builder.query<any[], { start_date?: string; end_date?: string; limit?: number; sort_by?: string }>({
      query: ({ start_date, end_date, limit = 50, sort_by = 'cost' } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        params.set('limit', String(limit))
        params.set('sort_by', sort_by)
        return `/dashboard/search-terms?${params.toString()}`
      },
      providesTags: ['Dashboard'],
    }),
    getKeywords: builder.query<any[], { start_date?: string; end_date?: string; limit?: number; sort_by?: string }>({
      query: ({ start_date, end_date, limit = 50, sort_by = 'cost' } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        params.set('limit', String(limit))
        params.set('sort_by', sort_by)
        return `/dashboard/keywords?${params.toString()}`
      },
      providesTags: ['Dashboard'],
    }),
    getProducts: builder.query<any[], { start_date?: string; end_date?: string; limit?: number }>({
      query: ({ start_date, end_date, limit = 20 } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        params.set('limit', String(limit))
        return `/dashboard/products?${params.toString()}`
      },
      providesTags: ['Dashboard'],
    }),
    getProductsDaily: builder.query<any[], { start_date?: string; end_date?: string; limit?: number }>({
      query: ({ start_date, end_date, limit = 500 } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        params.set('limit', String(limit))
        return `/dashboard/products/daily?${params.toString()}`
      },
      providesTags: ['Dashboard'],
    }),
    getPlacements: builder.query<any[], { start_date?: string; end_date?: string; report_type?: string }>({
      query: ({ start_date, end_date, report_type } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (report_type) params.set('report_type', report_type)
        const qs = params.toString()
        return `/dashboard/placements${qs ? `?${qs}` : ''}`
      },
      providesTags: ['Dashboard'],
    }),
    getCampaigns: builder.query<any[], { start_date?: string; end_date?: string; report_type?: string; limit?: number }>({
      query: ({ start_date, end_date, report_type, limit = 200 } = {} as any) => {
        const params = new URLSearchParams()
        if (start_date) params.set('start_date', start_date)
        if (end_date) params.set('end_date', end_date)
        if (report_type) params.set('report_type', report_type)
        params.set('limit', String(limit))
        return `/dashboard/campaigns?${params.toString()}`
      },
      providesTags: ['Dashboard'],
    }),

    // Reports — client_id injected from JWT by backend
    triggerFetch: builder.mutation<any, { report_types?: string[]; start_date: string; end_date: string }>({
      query: (body) => ({ url: '/reports/fetch', method: 'POST', body }),
      invalidatesTags: ['ReportFetch'],
    }),
    getFetchHistory: builder.query<PaginatedResponse<any>, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 20 }) =>
        `/reports/fetch-history?page=${page}&per_page=${per_page}`,
      providesTags: ['ReportFetch'],
    }),

    // Clients — operations on the current user's client
    getMyClient: builder.query<any, void>({
      query: () => '/clients/me',
      providesTags: ['Client'],
    }),
    updateCredentials: builder.mutation<any, { amazon_client_id: string; amazon_client_secret: string; amazon_refresh_token: string; amazon_profile_id?: string }>({
      query: (body) => ({
        url: '/clients/me/credentials',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Client'],
    }),
    getCredentialsStatus: builder.query<CredentialsStatus, void>({
      query: () => '/clients/me/credentials/status',
      providesTags: ['Client', 'Credentials'],
    }),

    // Amazon OAuth -- get consent URLs
    getAdsAuthUrl: builder.query<{ url: string }, void>({
      query: () => '/auth/amazon/ads/url',
    }),
    getSpAuthUrl: builder.query<{ url: string }, { marketplace_id?: string } | void>({
      query: (arg) => {
        const mkt = (arg as any)?.marketplace_id ?? 'A21TJRUUN4KGV'
        return `/auth/amazon/sp/url?marketplace_id=${mkt}`
      },
    }),

    // Amazon OAuth -- exchange authorization codes for tokens (called from /callback page)
    exchangeAdsCode: builder.mutation<{ message: string }, { code: string; state: string }>({
      query: (body) => ({ url: '/auth/amazon/ads/exchange', method: 'POST', body }),
      invalidatesTags: ['Client', 'Credentials'],
    }),
    exchangeSpCode: builder.mutation<{ message: string; seller_id: string }, { spapi_oauth_code: string; state: string; selling_partner_id: string }>({
      query: (body) => ({ url: '/auth/amazon/sp/exchange', method: 'POST', body }),
      invalidatesTags: ['Client', 'Credentials'],
    }),

    // Subscriptions
    getSubscriptionTiers: builder.query<any[], void>({
      query: () => '/subscriptions/tiers',
    }),
    getMyPlan: builder.query<{ client_name: string | null; subscription_status: string; tier: any | null }, void>({
      query: () => '/subscriptions/my-plan',
      providesTags: ['Client'],
    }),

    // Notifications
    getNotifications: builder.query<PaginatedResponse<any>, { page?: number; per_page?: number; unread_only?: boolean }>({
      query: ({ page = 1, per_page = 30, unread_only = false }) =>
        `/notifications?page=${page}&per_page=${per_page}&unread_only=${unread_only}`,
      providesTags: ['Notification'],
    }),
    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => '/notifications/unread-count',
      providesTags: ['Notification'],
    }),
    markAllRead: builder.mutation<any, void>({
      query: () => ({ url: '/notifications/mark-all-read', method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
  }),
})

export const {
  useLoginMutation, useSignupMutation, useClientSignupMutation,
  useRequestPasswordResetMutation, useConfirmPasswordResetMutation,
  useGetMeQuery,
  useGetMetricsQuery, useGetChartsQuery, useGetDashboardSummaryQuery,
  useGetSearchTermsQuery, useGetKeywordsQuery, useGetProductsQuery,
  useGetProductsDailyQuery, useGetCampaignsQuery,
  useTriggerFetchMutation, useGetFetchHistoryQuery,
  useGetMyClientQuery, useUpdateCredentialsMutation, useGetCredentialsStatusQuery,
  useGetPlacementsQuery, useGetSubscriptionTiersQuery, useGetMyPlanQuery,
  useGetNotificationsQuery, useGetUnreadCountQuery, useMarkAllReadMutation,
  useLazyGetAdsAuthUrlQuery, useLazyGetSpAuthUrlQuery,
  useExchangeAdsCodeMutation, useExchangeSpCodeMutation,
} = api
