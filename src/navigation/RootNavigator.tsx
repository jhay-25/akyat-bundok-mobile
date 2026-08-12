import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { MainTabNavigator } from './MainTabNavigator'
import UsernameSetupScreen from '../screens/UsernameSetupScreen'
import MountainScreen from '../screens/MountainScreen'
import LogClimbScreen from '../screens/LogClimbScreen'
import GpxRouteScreen from '../screens/GpxRouteScreen'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'
import { RootStackParamList } from './types'

const Stack = createStackNavigator<RootStackParamList>()

/**
 * Root Navigator
 * Handles the top-level navigation structure and loading states
 * Checks if authenticated users have a username and redirects accordingly
 */
export const RootNavigator: React.FC = () => {
  const { loading, user, profile, checkUsername } = useAuth()
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

  useEffect(() => {
    const checkUsernameStatus = async () => {
      if (user && !loading) {
        setIsCheckingUsername(true)
        await checkUsername()
        setIsCheckingUsername(false)
      }
    }

    checkUsernameStatus()
  }, [user, loading])

  if (loading || isCheckingUsername) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  // Determine if we need to show username setup
  const needsUsername = user && profile && !profile.username

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {needsUsername ? (
          <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        )}
        <Stack.Screen name="Mountain" component={MountainScreen} />
        <Stack.Screen name="LogClimb" component={LogClimbScreen} />
        <Stack.Screen name="GpxRoute" component={GpxRouteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary
  }
})
