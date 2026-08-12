/**
 * App Color Palette
 * Dark mode design system — follows Akyat Bundok design principles:
 *   - Subtle borders (white at low opacity)
 *   - Low-opacity backgrounds
 *   - Green as accent color
 *   - Flat design (no heavy shadows)
 */
export const colors = {
  // Background colors
  background: {
    primary: '#0A0A0A', // Main background
    card: 'rgba(255, 255, 255, 0.02)', // Cards, containers
    cardHover: 'rgba(255, 255, 255, 0.04)', // Hover / pressed cards
    elevated: 'rgba(255, 255, 255, 0.06)', // Active / selected elements
    pill: 'rgba(255, 255, 255, 0.03)' // Pills / badges
  },

  // Text colors
  text: {
    primary: '#FFFFFF', // Primary text
    secondary: '#9CA3AF', // Secondary text (gray-400)
    tertiary: '#6B7280', // Muted text / labels (gray-500)
    quaternary: '#4B5563' // Inactive / disabled text (gray-600)
  },

  // Border colors (subtle, low-opacity white)
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)', // Cards, containers, dividers
    strong: 'rgba(255, 255, 255, 0.08)', // Elevated borders
    pill: 'rgba(255, 255, 255, 0.05)' // Pills / badges
  },

  // Accent (green-400)
  accent: {
    green: '#4ADE80', // Active states, badges, highlights
    greenSoft: 'rgba(74, 222, 128, 0.10)', // bg-green-400/10
    greenBorder: 'rgba(74, 222, 128, 0.30)' // border-green-400/30
  },

  // Semantic colors
  error: {
    background: 'rgba(248, 113, 113, 0.10)',
    border: 'rgba(248, 113, 113, 0.30)',
    text: '#F87171'
  },
  success: '#4ADE80',
  warning: '#FBBF24',

  // Overlays
  overlay: {
    image: 'rgba(0, 0, 0, 0.60)', // Text / badges overlaid on images
    icon: 'rgba(0, 0, 0, 0.70)', // Icon badges over images
    modal: 'rgba(0, 0, 0, 0.95)' // Full-screen image viewer
  },

  // Common colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent'
} as const

export type Colors = typeof colors
