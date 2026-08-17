import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import LatestClimbsScreen from '../screens/LatestClimbsScreen'
import HomeScreen from '../screens/HomeScreen'
import WorldPeaksScreen from '../screens/WorldPeaksScreen'
import MapScreen from '../screens/MapScreen'
import MountainSearchScreen from '../screens/MountainSearchScreen'
import { AuthNavigator } from './AuthNavigator'
import { MainTabParamList } from './types'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'

const Tab = createBottomTabNavigator<MainTabParamList>()

/**
 * Prominent center "Log a climb" button — raised above the tab bar so it
 * stands out as the app's primary action.
 */
const CenterLogButton = ({ onPress, accessibilityState }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.9}
    style={styles.centerWrap}
    accessibilityState={accessibilityState}
  >
    <View style={styles.centerButton}>
      <Ionicons name="add" size={30} color={colors.black} />
    </View>
  </TouchableOpacity>
)

/**
 * Main Tab Navigator
 * Available to both authenticated and unauthenticated users
 * - Map: Interactive mountain map (initial screen)
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
            case 'Map':
              iconName = focused ? 'map' : 'map-outline'
              break
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
        tabBarActiveTintColor: colors.accent.green,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
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
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: 'Map' }}
      />

      <Tab.Screen
        name="Latest"
        component={LatestClimbsScreen}
        options={{ tabBarLabel: 'Latest' }}
      />

      <Tab.Screen
        name="LogClimbSearch"
        component={MountainSearchScreen}
        options={{
          tabBarLabel: 'Log',
          tabBarButton: (props) => <CenterLogButton {...props} />
        }}
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

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
    height: 64
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.primary,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  }
})
