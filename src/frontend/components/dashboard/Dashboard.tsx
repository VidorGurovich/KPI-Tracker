import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button-clean'
import { 
  BarChart3, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  ChevronDown
} from 'lucide-react'
// Removed duplicate Button import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { PremiumAvatar } from '../ui/avatar'
import { useTheme } from '../ThemeProvider'
import { formatNumber, formatPercentage, getTrend } from '../../lib/utils'

interface DashboardProps {
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { theme, setTheme } = useTheme()

  // Mock data for demonstration
  const kpiData = [
    {
      title: "Revenue",
      value: 125000,
      target: 150000,
      trend: { current: 125000, previous: 110000 },
      icon: <BarChart3 className="h-5 w-5" />,
      color: "text-green-600"
    },
    {
      title: "Team Members",
      value: 24,
      target: 30,
      trend: { current: 24, previous: 22 },
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-600"
    },
    {
      title: "Goals Completed",
      value: 18,
      target: 25,
      trend: { current: 18, previous: 15 },
      icon: <Target className="h-5 w-5" />,
      color: "text-purple-600"
    },
    {
      title: "Growth Rate",
      value: 12.5,
      target: 15,
      trend: { current: 12.5, previous: 10.2 },
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-orange-600"
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen bg-gradient-premium">
      {/* Header */}
      <motion.header
        className="glass border-b border-border/50 sticky top-0 z-50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container-premium py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gradient">KPI Tracker</h1>
                <p className="text-sm text-muted-foreground">Performance Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block">
                <Input
                  placeholder="Search KPIs..."
                  className="w-64"
                  icon={<Search className="h-4 w-4" />}
                />
              </div>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <motion.div
                  className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                />
              </Button>

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <PremiumAvatar
                  name={`${user.firstName} ${user.lastName}`}
                  status="online"
                />
                <div className="hidden md:block text-sm">
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-muted-foreground capitalize">{user.role}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container-premium py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Welcome Section */}
          <motion.div variants={itemVariants}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {user.firstName}! 👋
              </h2>
              <p className="text-muted-foreground">
                Here's what's happening with your KPIs today.
              </p>
            </div>
          </motion.div>

          {/* KPI Cards Grid */}
          <motion.div 
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {kpiData.map((kpi, index) => {
              const trend = getTrend(kpi.trend.current, kpi.trend.previous)
              const progress = (kpi.value / kpi.target) * 100

              return (
                <motion.div key={kpi.title} variants={itemVariants}>
                  <Card className="relative overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {kpi.title}
                      </CardTitle>
                      <div className={kpi.color}>
                        {kpi.icon}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold mb-1">
                        {typeof kpi.value === 'number' && kpi.value > 1000 
                          ? formatNumber(kpi.value)
                          : kpi.value.toString()
                        }
                        {kpi.title === 'Growth Rate' && '%'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Target: {formatNumber(kpi.target)}</span>
                        <div className={`flex items-center ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                          <TrendingUp className={`h-3 w-3 mr-1 ${trend.direction === 'down' ? 'rotate-180' : ''}`} />
                          {formatPercentage(trend.percentage, 1)}
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Progress</span>
                          <span>{formatPercentage(progress, 0)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <motion.div
                            className={`h-2 rounded-full ${
                              progress >= 100 ? 'bg-green-500' : 
                              progress >= 75 ? 'bg-blue-500' : 
                              progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                          />
                        </div>
                      </div>
                    </CardContent>
                    
                    {/* Hover overlay */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0"
                      whileHover={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Recent Activity & Chart Placeholder */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from your team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { user: 'John Doe', action: 'Updated Q4 Revenue target', time: '2 hours ago' },
                    { user: 'Jane Smith', action: 'Completed Customer Satisfaction KPI', time: '4 hours ago' },
                    { user: 'Mike Johnson', action: 'Added new team member', time: '1 day ago' },
                  ].map((activity, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      <PremiumAvatar name={activity.user} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.user}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.action}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {activity.time}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Chart</CardTitle>
                <CardDescription>Your KPI trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
                  <p className="text-muted-foreground">Chart integration coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
