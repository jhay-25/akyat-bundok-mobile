import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LatestClimbsScreen from '../screens/LatestClimbsScreen'
import HomeScreen from '../screens/HomeScreen'
import WorldPeaksScreen from '../screens/WorldPeaksScreen'
import { AuthNavigator } from './AuthNavigator'
import { MainTabParamList } from './types'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * Main Tab Navigator
 * Available to both authenticated and unauthenticated users
 * - Latest: Public climbing activity feed
 * - World Peaks: Browse peaks by country
 * - Account/Sign In: User account or auth flow
 */
export const MainTabNavigator: React.FC = () => {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

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
            case 'WorldPeaks':
              iconName = focused ? 'earth' : 'earth-outline'
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
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.quaternary,
        tabBarStyle: {
          backgroundColor: colors.background.secondary,
          borderTopWidth: 0,
          height: 60 + insets.bottom
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2
        },
        tabBarItemStyle: {
          paddingVertical: 4
        }
      })}
    >
      <Tab.Screen
        name="Latest"
        component={LatestClimbsScreen}
        options={{ tabBarLabel: 'Latest' }}
      />

      <Tab.Screen
        name="WorldPeaks"
        component={WorldPeaksScreen}
        options={{ tabBarLabel: 'World Peaks' }}
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
