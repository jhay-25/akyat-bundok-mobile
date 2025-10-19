/**
 * Main barrel export file for the src directory
 * Provides organized exports for key modules
 */

// Screens
export { default as SignInScreen } from './screens/SignInScreen'
export { default as SignUpScreen } from './screens/SignUpScreen'
export { default as HomeScreen } from './screens/HomeScreen'
export { default as LatestClimbsScreen } from './screens/LatestClimbsScreen'

// Contexts
export { AuthProvider, useAuth } from './contexts/AuthContext'

// Navigation
export * from './navigation'

// Utils
export { supabase } from './utils/supabase'
export { default as getImageUrl, getAssetsImageUrl } from './utils/getImageUrl'

// Types
export * from './types'

// Theme
export { colors } from './theme/colors'
export * from './theme'

// Constants
export * from './constants'
