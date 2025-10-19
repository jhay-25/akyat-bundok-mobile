import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'

import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import SignInScreen from './src/screens/SignInScreen'
import SignUpScreen from './src/screens/SignUpScreen'
import HomeScreen from './src/screens/HomeScreen'
import LatestClimbsScreen from './src/screens/LatestClimbsScreen'

type AuthStackParamList = {
  SignIn: undefined
  SignUp: undefined
}

type MainTabParamList = {
  Home: undefined
  Latest: undefined
}

const AuthStack = createStackNavigator<AuthStackParamList>()
const MainTab = createBottomTabNavigator<MainTabParamList>()

const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  )
}

const AppNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline'
          } else if (route.name === 'Latest') {
            iconName = focused ? 'compass' : 'compass-outline'
          } else {
            iconName = 'help-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#ae8048', // brown-500
        tabBarInactiveTintColor: '#886439', // brown-800
        tabBarStyle: {
          backgroundColor: '#24273b', // main-400 (dark tab bar)
          borderTopColor: '#886439', // brown-800
          borderTopWidth: 1,
        },
      })}
    >
      <MainTab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <MainTab.Screen 
        name="Latest" 
        component={LatestClimbsScreen}
        options={{ tabBarLabel: 'Latest' }}
      />
    </MainTab.Navigator>
  )
}

const AppContent = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ae8048" />
      </View>
    )
  }

  return user ? <AppNavigator /> : <AuthNavigator />
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer>
          <AppContent />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151728' // main-500 (dark background)
  }
})
