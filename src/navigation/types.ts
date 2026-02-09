import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { CompositeNavigationProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

/**
 * Auth Stack Navigation Types
 */
export type AuthStackParamList = {
  SignIn: undefined
  SignUp: undefined
  UsernameSetup: undefined
}

export type AuthStackNavigationProp<T extends keyof AuthStackParamList> =
  StackNavigationProp<AuthStackParamList, T>

/**
 * Main Tab Navigation Types
 */
export type MainTabParamList = {
  Latest: undefined
  WorldPeaks: undefined
  Home?: undefined
  Account?: undefined
}

export type MainTabNavigationProp<T extends keyof MainTabParamList> =
  BottomTabNavigationProp<MainTabParamList, T>

/**
 * Combined Navigation Types for screens that can access both stacks
 */
export type RootNavigationProp = CompositeNavigationProp<
  MainTabNavigationProp<keyof MainTabParamList>,
  AuthStackNavigationProp<keyof AuthStackParamList>
>
