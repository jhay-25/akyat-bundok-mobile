/**
 * App Color Palette
 * Based on the official brand colors from tailwind.config.ts
 */
export const colors = {
  // Brown shades - Primary brand colors
  brown: {
    10: '#F9F6F2', // Light background
    20: '#F4EDE4', // Very light
    30: '#EEE4D7', // Borders
    50: '#CDAD87', // Secondary text
    500: '#ae8048', // Primary brand
    800: '#886439', // Dark text
    900: '#7B5B34' // Darkest brown
  },

  // Blue accent
  blue: {
    500: '#4875AD'
  },

  // Main dark colors
  main: {
    400: '#24273b', // Dark cards/inputs
    500: '#151728' // Primary dark background
  },

  // Semantic colors
  error: '#dc3545',
  success: '#28a745',
  warning: '#ffc107',

  // Common colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent'
} as const

export type Colors = typeof colors
