import { API_CONFIG } from '../constants'

/**
 * Constructs a URL for an image from the CDN
 * @param key - The image key/path
 * @returns Full CDN URL for the image
 */
export default function getImageUrl(key: string): string {
  if (!key) return ''
  return `${API_CONFIG.IMAGE_CDN}/${key}`
}

/**
 * Constructs a URL for an asset from the assets CDN
 * @param key - The asset key/path
 * @returns Full CDN URL for the asset
 */
export const getAssetsImageUrl = (key: string): string => {
  if (!key) return ''
  return `${API_CONFIG.ASSETS_CDN}/${key}`
}
