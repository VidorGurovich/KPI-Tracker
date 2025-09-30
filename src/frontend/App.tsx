import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LoginForm } from './components/auth/LoginForm'
import { Dashboard } from './components/dashboard/Dashboard'
import { ThemeProvider } from './components/ThemeProvider'
import { apiClient } from './lib/api'
import './styles/globals.css'

interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  emailVerified: boolean
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const response = await apiClient.getUserProfile()
          setUser(response.user)
        } catch (error) {
          console.error('Failed to get user profile:', error)
          // Token might be expired, clear it
          apiClient.logout()
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (userData: User) => {
    setUser(userData)
    setError(null)
  }

  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage)
    setUser(null)
  }

  const handleLogout = () => {
    apiClient.logout()
    setUser(null)
  }

  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gradient-premium flex items-center justify-center">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-lg font-medium text-gradient">Loading KPI Tracker...</p>
            <p className="text-sm text-muted-foreground mt-2">Preparing your dashboard</p>
          </motion.div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              className="min-h-screen bg-gradient-premium flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-full max-w-md">
                <LoginForm
                  onSuccess={handleLoginSuccess}
                  onError={handleLoginError}
                />
                
                {/* Demo credentials info */}
                <motion.div
                  className="mt-8 p-4 glass rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-sm font-medium mb-2">Demo Credentials:</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Manager:</strong> manager@demo.com / password123</p>
                    <p><strong>Employee:</strong> employee@demo.com / password123</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 opacity-75">
                    Note: These are demo credentials for testing the premium UI
                  </p>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Dashboard user={user} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global error notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="fixed bottom-4 right-4 z-50"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-destructive/90 backdrop-blur-sm text-destructive-foreground px-4 py-3 rounded-lg shadow-premium max-w-sm">
                <p className="text-sm font-medium">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs underline hover:no-underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  )
}

export default App
