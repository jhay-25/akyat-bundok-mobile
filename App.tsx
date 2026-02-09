import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/contexts/AuthContext'
import { RootNavigator } from './src/navigation'

/**
 * Main App Component
 *
 * Sets up the app's core providers and navigation structure:
 * - GestureHandlerRootView: Enables gesture handling for React Navigation
 * - SafeAreaProvider: Provides safe area insets for modern devices
 * - AuthProvider: Provides authentication state throughout the app
 * - RootNavigator: Handles all navigation logic
 * - StatusBar: Configures the status bar appearance
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
