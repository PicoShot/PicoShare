import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import {JSX, lazy} from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import Layout from '../pages/layout'

const Home = lazy(() => import('../pages/home'))
const NotFound = lazy(() => import('../pages/errors/NotFound'))
const Login = lazy(() => import('../pages/auth/login'))

function ProtectedRoute({ children }: { readonly children: JSX.Element }) {
  const isAuth = useSelector((state: RootState) => state.user.isAuth)

  if (!isAuth) {
    return <Navigate to="/auth/login" replace />
  }

  return children
}

function GuestRoute({ children }: { readonly children: JSX.Element }) {
  const isAuth = useSelector((state: RootState) => state.user.isAuth)

  if (isAuth) {
    return <Navigate to="/" replace />
  }

  return children
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        )
      },
      {
        path: '/home',
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        )
      },
      {
        path: '/auth/login',
        element: (
          <GuestRoute>
            <Login />
          </GuestRoute>
        )
      },
      { path: '*', element: <NotFound /> }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
