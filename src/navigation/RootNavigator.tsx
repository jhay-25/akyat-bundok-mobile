import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { MainTabNavigator } from './MainTabNavigator'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'

/**
 * Root Navigator
 * Handles the top-level navigation structure and loading states
 */
export const RootNavigator: React.FC = () => {
  const { loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brown[500]} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <MainTabNavigator />
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.main[500]
  }
})
