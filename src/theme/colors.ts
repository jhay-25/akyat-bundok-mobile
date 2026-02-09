/**
 * App Color Palette
 * Modern dark mode design system
 */
export const colors = {
  // Background colors
  background: {
    primary: '#0A0A0A', // Main background
    secondary: '#1A1A1A', // Cards, header
    tertiary: '#2A2A2A', // Elevated elements
    elevated: '#3A3A3A' // Buttons, interactive elements
  },

  // Text colors
  text: {
    primary: '#FFFFFF', // Primary text
    secondary: '#CCCCCC', // Body text
    tertiary: '#999999', // Secondary/muted text
    quaternary: '#666666' // Inactive/disabled text
  },

  // Border colors
  border: {
    primary: '#2A2A2A', // Default borders
    secondary: '#3A3A3A' // Elevated borders
  },

  // Brown shades - Legacy brand colors (kept for compatibility)
  brown: {
    10: '#F9F6F2',
    20: '#F4EDE4',
    30: '#EEE4D7',
    50: '#CDAD87',
    500: '#ae8048',
    800: '#886439',
    900: '#7B5B34'
  },

  // Blue accent
  blue: {
    500: '#4875AD'
  },

  // Main dark colors (legacy)
  main: {
    400: '#24273b',
    500: '#151728'
  },

  // Semantic colors
  error: {
    background: '#2A1A0A',
    border: '#FF9800',
    text: '#FFB74D'
  },
  success: '#28a745',
  warning: '#ffc107',

  // Common colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent'
} as const

export type Colors = typeof colors
