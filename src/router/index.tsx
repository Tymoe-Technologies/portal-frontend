import React, { ReactElement } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import BaseLayout from '@/layouts/BaseLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Register from '@/pages/Register'
import FranchiseInvitationAccept from '@/pages/FranchiseInvitationAccept'
import ApiTest from '@/pages/ApiTest'
import Profile from '@/pages/Profile'
import ItemManagement from '@/pages/ItemManagement'
import ItemApiTest from '@/pages/ItemApiTest'
import OrganizationManagement from '@/pages/OrganizationManagement'
import AccountManagement from '@/pages/AccountManagement'
import PermissionSets from '@/pages/PermissionSets'
import DeviceManagement from '@/pages/DeviceManagement'
import PrintSettings from '@/pages/PrintSettings'
import RecipeGuide from '@/pages/RecipeGuide'
import Features from '@/pages/Features'
import OrderConfig from '@/pages/OrderConfig'
import PricingManagement from '@/pages/OrderConfig/PricingManagement'
import ChannelManagementPage from '@/pages/ChannelManagement'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireOrganization } from '@/auth/RequireOrganization'
import MenuCenter from '@/pages/MenuCenter'
import ErrorBoundary from '@/components/ErrorBoundary'
import ErrorPage from '@/pages/ErrorPage'
import { UberIntegration } from '@/pages/Integration'
import TaxManagement from '@/pages/TaxManagement'
import PaymentSettings from '@/pages/PaymentSettings'
import BookingDashboard from '@/pages/BookingManagement/Dashboard'
import BookingList from '@/pages/BookingManagement/Bookings'
import BookingResources from '@/pages/BookingManagement/Resources'
import BookingSettings from '@/pages/BookingManagement/Settings'
import PublicBookingPage from '@/pages/PublicBooking'
import SubscriptionManagement from '@/pages/SubscriptionManagement'
import OnlineOrderConfig from '@/pages/OnlineOrderConfig'
import StripeConnectCallback from '@/pages/StripeConnectCallback'
import UberDirectPage from '@/pages/UberDirect'
import RewardManagement from '@/pages/RewardManagement'
import MemberManagement from '@/pages/MemberManagement'
import MultiMenuManagement from '@/pages/MultiMenuManagement'
import GiftCardSettings from '@/pages/GiftCardSettings'
import Reports from '@/pages/Reports'

// 辅助函数：为路由元素包装 ErrorBoundary
const withErrorBoundary = (element: ReactElement): ReactElement => (
  <ErrorBoundary>{element}</ErrorBoundary>
)

const routes: RouteObject[] = [
  {
    path: '/',
    element: <BaseLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ErrorBoundary>
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          </ErrorBoundary>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'menu-center',
        element: (
          <ErrorBoundary>
            <RequireAuth>
              <RequireOrganization>
                <MenuCenter />
              </RequireOrganization>
            </RequireAuth>
          </ErrorBoundary>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'organizations',
        element: withErrorBoundary(
          <RequireAuth>
            <OrganizationManagement />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'accounts',
        element: withErrorBoundary(
          <RequireAuth>
            <AccountManagement />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'permission-sets',
        element: withErrorBoundary(
          <RequireAuth>
            <PermissionSets />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'devices',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <DeviceManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'print-settings',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <PrintSettings />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'order-config',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <OrderConfig />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'order-config/channels',
        element: <Navigate to="/channel-management" replace />,
      },
      {
        path: 'order-config/channel-settlement',
        element: <Navigate to="/channel-management" replace />,
      },
      {
        path: 'channel-management',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <ChannelManagementPage />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'order-config/pricing',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <PricingManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'order-config/pickup-number',
        element: <Navigate to="/order-config" replace />,
      },
      {
        path: 'features',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <Features />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'recipe-guide',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <RecipeGuide />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'profile',
        element: withErrorBoundary(
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'item-management',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <ItemManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'item-api-test',
        element: withErrorBoundary(
          <RequireAuth>
            <ItemApiTest />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'api-test',
        element: withErrorBoundary(
          <RequireAuth>
            <ApiTest />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'settings/integrations/uber',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <UberIntegration />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'tax-management',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <TaxManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
{
        path: 'payment-settings',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <PaymentSettings />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'gift-card-settings',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <GiftCardSettings />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'booking',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <BookingDashboard />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'booking/bookings',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <BookingList />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'booking/resources',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <BookingResources />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'booking/settings',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <BookingSettings />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'subscription',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <SubscriptionManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'online-order-config',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <OnlineOrderConfig />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'direct-delivery',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <UberDirectPage />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'reward-management',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <RewardManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'member-management',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <MemberManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'reports',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <Reports />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'multi-menu',
        element: withErrorBoundary(
          <RequireAuth>
            <RequireOrganization>
              <MultiMenuManagement />
            </RequireOrganization>
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'merchants/stripe/complete',
        element: withErrorBoundary(
          <RequireAuth>
            <StripeConnectCallback />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
      {
        path: 'merchants/stripe/reauth',
        element: withErrorBoundary(
          <RequireAuth>
            <StripeConnectCallback />
          </RequireAuth>
        ),
        errorElement: <ErrorPage />
      },
    ]
  },
  {
    path: '/public-booking/:orgId',
    element: <PublicBookingPage />,
    errorElement: <ErrorPage />
  },
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorPage />
  },
  {
    path: '/register',
    element: <Register />,
    errorElement: <ErrorPage />
  },
  {
    path: '/franchise-invitations/:token',
    element: <FranchiseInvitationAccept />,
    errorElement: <ErrorPage />
  },
  {
    path: '*',
    element: <ErrorPage />
  }
]

export const router = createBrowserRouter(routes)
