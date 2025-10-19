import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import SignInScreen from '../screens/SignInScreen'
import SignUpScreen from '../screens/SignUpScreen'
import UsernameSetupScreen from '../screens/UsernameSetupScreen'
import { AuthStackParamList } from './types'

const Stack = createStackNavigator<AuthStackParamList>()

/**
 * Authentication Stack Navigator
 * Handles Sign In, Sign Up, and Username Setup flows
 */
export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' }
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
    </Stack.Navigator>
  )
}
