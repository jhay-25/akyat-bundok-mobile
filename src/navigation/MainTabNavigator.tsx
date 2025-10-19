import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import LatestClimbsScreen from '../screens/LatestClimbsScreen'
import HomeScreen from '../screens/HomeScreen'
import { AuthNavigator } from './AuthNavigator'
import { MainTabParamList } from './types'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * Main Tab Navigator
 * Available to both authenticated and unauthenticated users
 * - Latest: Public climbing activity feed
 * - Account/Sign In: User account or auth flow
 */
export const MainTabNavigator: React.FC = () => {
  const { user } = useAuth()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap

          switch (route.name) {
            case 'Latest':
              iconName = focused ? 'compass' : 'compass-outline'
              break
            case 'Home':
              iconName = focused ? 'home' : 'home-outline'
              break
            case 'Account':
              iconName = focused ? 'person' : 'person-outline'
              break
            default:
              iconName = 'help-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: colors.brown[500],
        tabBarInactiveTintColor: colors.brown[800],
        tabBarStyle: {
          backgroundColor: colors.main[400],
          borderTopColor: colors.brown[800],
          borderTopWidth: 1
        }
      })}
    >
      <Tab.Screen
        name="Latest"
        component={LatestClimbsScreen}
        options={{ tabBarLabel: 'Latest' }}
      />

      {user ? (
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Account' }}
        />
      ) : (
        <Tab.Screen
          name="Account"
          component={AuthNavigator}
          options={{ tabBarLabel: 'Sign In' }}
        />
      )}
    </Tab.Navigator>
  )
}
