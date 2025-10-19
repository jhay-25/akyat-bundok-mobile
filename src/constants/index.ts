/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL:
    process.env.EXPO_PUBLIC_API_URL || 'https://workers.akyatbundok.com',
  IMAGE_CDN: 'https://images.akyatbundok.com',
  ASSETS_CDN: 'https://assets.akyatbundok.com',
  TIMEOUT: 10000 // 10 seconds
} as const

/**
 * Pagination Configuration
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  LOAD_MORE_THRESHOLD: 0.5,
  MAX_RETRIES: 3
} as const

/**
 * Validation Rules
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_TEXT_LENGTH: 500,
  MAX_REPORT_LENGTH: 2000,
  TRUNCATE_LENGTH: 150
} as const

/**
 * App Configuration
 */
export const APP_CONFIG = {
  NAME: 'AkyatBundok',
  VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@akyatbundok.com'
} as const
