import { XMLParser } from 'fast-xml-parser'

export interface GpxPoint {
  latitude: number
  longitude: number
  elevation: number | null
}

/**
 * Parse a GPX XML string and extract all track points.
 * Returns a flat list of { latitude, longitude, elevation }.
 */
export function parseGpxPoints(xml: string): GpxPoint[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'trk' || name === 'trkseg' || name === 'trkpt'
  })

  const doc = parser.parse(xml)
  const gpx = doc?.gpx
  if (!gpx) return []

  const tracks: any[] = Array.isArray(gpx.trk)
    ? gpx.trk
    : gpx.trk
      ? [gpx.trk]
      : []

  const points: GpxPoint[] = []

  for (const trk of tracks) {
    const segments: any[] = Array.isArray(trk.trkseg)
      ? trk.trkseg
      : trk.trkseg
        ? [trk.trkseg]
        : []

    for (const seg of segments) {
      const pts: any[] = Array.isArray(seg.trkpt)
        ? seg.trkpt
        : seg.trkpt
          ? [seg.trkpt]
          : []

      for (const pt of pts) {
        const lat = parseFloat(pt['@_lat'])
        const lon = parseFloat(pt['@_lon'])
        if (isNaN(lat) || isNaN(lon)) continue

        const rawEle = pt.ele != null ? parseFloat(pt.ele) : NaN
        points.push({
          latitude: lat,
          longitude: lon,
          elevation: isNaN(rawEle) ? null : rawEle
        })
      }
    }
  }

  return points
}

// ---- GPX Statistics & Elevation Profile ----
// Mirrors the web app (akyat-bundok/src/utils/gpxParser.ts)

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface GpxStats {
  distanceKm: number
  elevationGainM: number
  elevationLossM: number
  minElevationM: number
  maxElevationM: number
  pointCount: number
}

export interface ElevationPoint {
  distanceKm: number
  elevationM: number
}

export function computeStats(points: GpxPoint[]): GpxStats {
  let distanceKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  let minElevationM = Infinity
  let maxElevationM = -Infinity
  let prevLat: number | null = null
  let prevLon: number | null = null
  let prevEle: number | null = null

  for (const p of points) {
    if (prevLat !== null && prevLon !== null) {
      distanceKm += haversineDistance(prevLat, prevLon, p.latitude, p.longitude)
    }
    prevLat = p.latitude
    prevLon = p.longitude

    if (p.elevation != null) {
      minElevationM = Math.min(minElevationM, p.elevation)
      maxElevationM = Math.max(maxElevationM, p.elevation)
      if (prevEle !== null) {
        const diff = p.elevation - prevEle
        if (diff > 0) elevationGainM += diff
        else elevationLossM += Math.abs(diff)
      }
      prevEle = p.elevation
    }
  }

  return {
    distanceKm,
    elevationGainM,
    elevationLossM,
    minElevationM: minElevationM === Infinity ? 0 : minElevationM,
    maxElevationM: maxElevationM === -Infinity ? 0 : maxElevationM,
    pointCount: points.length
  }
}

export function computeElevationProfile(points: GpxPoint[]): ElevationPoint[] {
  const profile: ElevationPoint[] = []
  let distanceKm = 0
  let prevLat: number | null = null
  let prevLon: number | null = null

  for (const p of points) {
    if (prevLat !== null && prevLon !== null) {
      distanceKm += haversineDistance(prevLat, prevLon, p.latitude, p.longitude)
    }
    prevLat = p.latitude
    prevLon = p.longitude
    if (p.elevation != null) {
      profile.push({ distanceKm, elevationM: p.elevation })
    }
  }

  return profile
}
