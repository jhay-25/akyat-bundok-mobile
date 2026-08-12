import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  LayoutAnimation,
  UIManager
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Enable smooth expand/collapse animation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import MapView, { Marker, Polyline, Region } from 'react-native-maps'
import Svg, {
  Polyline as SvgPolyline,
  Line as SvgLine,
  Text as SvgText,
  Path as SvgPath
} from 'react-native-svg'
import { RootStackParamList } from '../navigation/types'
import { API_CONFIG } from '../constants'
import getImageUrl from '../utils/getImageUrl'
import { MountainIcon } from '../components/MountainIcon'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import {
  parseGpxPoints,
  computeStats,
  computeElevationProfile,
  GpxPoint,
  GpxStats,
  ElevationPoint
} from '../utils/gpxParser'
import { getMarkerColor } from './MapScreen'

type GpxRouteRoute = RouteProp<RootStackParamList, 'GpxRoute'>
type GpxRouteNav = StackNavigationProp<RootStackParamList, 'GpxRoute'>

interface RouteUser {
  username: string | null
  given_name: string | null
  family_name: string | null
  image_path: string | null
}

const GpxRouteScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<GpxRouteRoute>()
  const navigation = useNavigation<GpxRouteNav>()
  const { routeId } = route.params

  const [title, setTitle] = useState('GPX Route')
  const [mountainName, setMountainName] = useState('')
  const [user, setUser] = useState<RouteUser | null>(null)
  const [createdAt, setCreatedAt] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(true)
  const [points, setPoints] = useState<GpxPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const infoRes = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/gpx/${routeId}`
        )
        if (!infoRes.ok) throw new Error('Route not found')
        const info = await infoRes.json()
        if (!active) return
        setTitle(info.title || 'GPX Route')
        setMountainName(info.mountain?.name || '')
        setUser(info.user ?? null)
        setCreatedAt(info.created_at ?? '')

        // Prefer the presigned URL returned with the route info to skip an
        // extra round trip; fall back to the download endpoint if absent.
        const url: string =
          info.download_url ??
          (await (async () => {
            const dlRes = await fetch(
              `${API_CONFIG.BASE_URL}/api/public/mountains/gpx/download/${info.gpx_path}`
            )
            if (!dlRes.ok) throw new Error('Failed to get download URL')
            return (await dlRes.json()).url
          })())
        if (!active) return
        setDownloadUrl(url)

        const gpxRes = await fetch(url)
        if (!gpxRes.ok) throw new Error('Failed to download GPX file')
        const xml = await gpxRes.text()
        const parsed = parseGpxPoints(xml)
        if (!active) return
        setPoints(parsed)
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'An error occurred')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [routeId])

  const displayName = user?.given_name
    ? user.family_name
      ? `${user.given_name} ${user.family_name}`
      : user.given_name
    : user?.username
      ? `@${user.username}`
      : 'Anonymous'
  const initials = (
    user?.given_name?.[0] ||
    user?.username?.[0] ||
    '?'
  ).toUpperCase()

  const toggleStats = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setStatsExpanded((prev) => !prev)
  }

  const handleDownload = async () => {
    if (!downloadUrl) return
    setDownloading(true)
    try {
      const safeName = (title || 'route')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
      const fileName = `${safeName || 'route'}.gpx`

      if (Platform.OS === 'android') {
        // Real save: user picks a folder (e.g. Downloads) and we write the GPX there
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
        if (!permissions.granted) return
        const gpxRes = await fetch(downloadUrl)
        if (!gpxRes.ok) throw new Error('Failed to download GPX file')
        const xml = await gpxRes.text()
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/gpx+xml'
        )
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, xml)
        Alert.alert('Downloaded', `GPX file saved as ${fileName}`)
      } else {
        // iOS / others: save to the app docs then present "Save to Files"
        const fileUri = FileSystem.documentDirectory + fileName
        const res = await FileSystem.downloadAsync(downloadUrl, fileUri)
        if (res.status !== 200) throw new Error('Download failed')
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/gpx+xml',
            dialogTitle: title || 'GPX Route'
          })
        }
      }
    } catch (e) {
      console.error('Download failed:', e)
      Alert.alert('Download failed', 'Unable to save the GPX file.')
    } finally {
      setDownloading(false)
    }
  }

  const initialRegion = useMemo<Region | null>(() => {
    if (points.length === 0) return null
    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity
    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude
      if (p.latitude > maxLat) maxLat = p.latitude
      if (p.longitude < minLng) minLng = p.longitude
      if (p.longitude > maxLng) maxLng = p.longitude
    }
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.005),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.005)
    }
  }, [points])

  const coordinates = useMemo(
    () => points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [points]
  )

  const startPoint = useMemo(
    () => (points.length > 0 ? points[0] : null),
    [points]
  )
  const endPoint = useMemo(
    () => (points.length > 0 ? points[points.length - 1] : null),
    [points]
  )
  const highestPoint = useMemo(() => {
    let highest: GpxPoint | null = null
    for (const p of points) {
      if (p.elevation == null) continue
      if (highest == null || p.elevation > (highest.elevation ?? -Infinity)) {
        highest = p
      }
    }
    return highest
  }, [points])

  const stats = useMemo<GpxStats>(() => computeStats(points), [points])
  const elevationProfile = useMemo<ElevationPoint[]>(
    () => computeElevationProfile(points),
    [points]
  )

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  if (error || points.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="trail-sign-outline"
          size={48}
          color={colors.text.tertiary}
        />
        <Text style={styles.errorText}>
          {error || 'No track points found in this GPX file.'}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion ?? undefined}
        userInterfaceStyle="dark"
      >
        <Polyline
          coordinates={coordinates}
          strokeColor={colors.accent.green}
          strokeWidth={4}
        />

        {startPoint && (
          <Marker
            coordinate={{
              latitude: startPoint.latitude,
              longitude: startPoint.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
          >
            <View style={[styles.pointMarker, styles.startMarker]}>
              <Text style={styles.pointMarkerText}>S</Text>
            </View>
          </Marker>
        )}

        {endPoint && (
          <Marker
            coordinate={{
              latitude: endPoint.latitude,
              longitude: endPoint.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
          >
            <View style={[styles.pointMarker, styles.endMarker]}>
              <Text style={styles.pointMarkerText}>E</Text>
            </View>
          </Marker>
        )}

        {highestPoint && (
          <Marker
            coordinate={{
              latitude: highestPoint.latitude,
              longitude: highestPoint.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={4}
          >
            <View style={styles.summitMarker}>
              <MountainIcon
                size={28}
                color={getMarkerColor(stats.maxElevationM)}
              />
            </View>
          </Marker>
        )}
      </MapView>

      <View
        style={[
          styles.statsPanel,
          {
            paddingBottom: statsExpanded
              ? insets.bottom + spacing.base
              : insets.bottom + spacing.sm
          }
        ]}
      >
        <View style={styles.statsHeader}>
          <TouchableOpacity
            style={styles.statsToggleArea}
            onPress={toggleStats}
            activeOpacity={0.7}
          >
            <Ionicons
              name="stats-chart"
              size={15}
              color={colors.accent.green}
            />
            <Text style={styles.statsTitle}>Route Statistics</Text>
            {!statsExpanded && (
              <Text style={styles.statsSummary} numberOfLines={1}>
                {formatDistance(stats.distanceKm)}
                {stats.elevationGainM > 0
                  ? ` · ${formatElevation(stats.elevationGainM)}`
                  : ''}
              </Text>
            )}
          </TouchableOpacity>
          <View style={styles.statsHeaderSpacer} />
          {statsExpanded && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownload}
              disabled={downloading || !downloadUrl}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={colors.black}
                />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.chevronButton}
            onPress={toggleStats}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={statsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        </View>
        {statsExpanded && (
          <>
            <View style={styles.statsGrid}>
              <StatItem
                label="Distance"
                value={formatDistance(stats.distanceKm)}
              />
              <StatItem
                label="Elevation Gain"
                value={formatElevation(stats.elevationGainM)}
              />
              <StatItem
                label="Elevation Loss"
                value={formatElevation(stats.elevationLossM)}
              />
              <StatItem
                label="Elevation Range"
                value={`${Math.round(stats.minElevationM)} — ${Math.round(stats.maxElevationM)} m`}
                wide
              />
            </View>
            {elevationProfile.length >= 2 && (
              <ElevationChart profile={elevationProfile} />
            )}
            {user && (
              <View style={styles.uploaderRow}>
                <View style={styles.uploaderAvatar}>
                  {user.image_path ? (
                    <Image
                      source={{ uri: getImageUrl(user.image_path) }}
                      style={styles.uploaderAvatarImg}
                    />
                  ) : (
                    <Text style={styles.uploaderAvatarText}>{initials}</Text>
                  )}
                </View>
                <View style={styles.uploaderInfo}>
                  <Text style={styles.uploaderName} numberOfLines={1}>
                    Uploaded by {displayName}
                  </Text>
                  {Boolean(createdAt) && (
                    <Text style={styles.uploaderDate}>
                      {formatDate(createdAt)}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {Boolean(mountainName) && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {mountainName}
            </Text>
          )}
        </View>
        <View style={styles.back} />
      </View>
    </View>
  )
}

function formatDistance(km: number): string {
  return km >= 1 ? km.toFixed(1) + ' km' : (km * 1000).toFixed(0) + ' m'
}

function formatElevation(m: number): string {
  return m > 0 ? Math.round(m) + ' m' : '—'
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

const StatItem = ({
  label,
  value,
  wide
}: {
  label: string
  value: string
  wide?: boolean
}) => (
  <View style={[styles.statItem, wide && styles.statItemWide]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
)

const ElevationChart = ({ profile }: { profile: ElevationPoint[] }) => {
  const WIDTH = 300
  const HEIGHT = 96
  const PAD = { top: 10, right: 30, bottom: 18, left: 6 }
  const chartW = WIDTH - PAD.left - PAD.right
  const chartH = HEIGHT - PAD.top - PAD.bottom

  const elevations = profile.map((p) => p.elevationM)
  const minEle = Math.min(...elevations)
  const maxEle = Math.max(...elevations)
  const eleRange = maxEle - minEle || 1
  const maxDist = profile[profile.length - 1].distanceKm || 1

  const x = (d: number) => PAD.left + (d / maxDist) * chartW
  const y = (e: number) => PAD.top + chartH - ((e - minEle) / eleRange) * chartH

  const linePath = profile
    .map(
      (p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.distanceKm)} ${y(p.elevationM)}`
    )
    .join(' ')
  const areaPath = `${linePath} L ${x(maxDist)} ${PAD.top + chartH} L ${PAD.left} ${PAD.top + chartH} Z`

  const yTicks = 3
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minEle + (eleRange * i) / yTicks
    return { val, y: PAD.top + chartH - (i / yTicks) * chartH }
  })

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Elevation Profile</Text>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {yLabels.map(({ val, y: yy }, i) => (
          <SvgLine
            key={`y-${i}`}
            x1={PAD.left}
            y1={yy}
            x2={PAD.left + chartW}
            y2={yy}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        <SvgPath d={areaPath} fill="rgba(74,222,128,0.15)" />
        <SvgPolyline
          points={profile
            .map((p) => `${x(p.distanceKm)},${y(p.elevationM)}`)
            .join(' ')}
          fill="none"
          stroke={colors.accent.green}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {yLabels.map(({ val }, i) => (
          <SvgText
            key={`yl-${i}`}
            x={PAD.left + chartW + 4}
            y={y(val) + 3}
            fill="rgba(255,255,255,0.3)"
            fontSize={9}
            textAnchor="start"
          >
            {Math.round(val)}m
          </SvgText>
        ))}
        <SvgText
          x={PAD.left + chartW}
          y={HEIGHT - 4}
          fill="rgba(255,255,255,0.3)"
          fontSize={9}
          textAnchor="end"
        >
          {maxDist >= 1
            ? maxDist.toFixed(1) + 'km'
            : (maxDist * 1000).toFixed(0) + 'm'}
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.primary,
    gap: spacing.md
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center'
  },
  backButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.elevated
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  subtitle: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'capitalize'
  },
  pointMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white
  },
  startMarker: {
    backgroundColor: colors.accent.green
  },
  endMarker: {
    backgroundColor: colors.error.text
  },
  highestMarker: {
    backgroundColor: colors.warning
  },
  summitMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  pointMarkerText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.black,
    lineHeight: 13
  },
  statsPanel: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.md,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  statsToggleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  statsSummary: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginLeft: spacing.xs
  },
  statsHeaderSpacer: {
    width: spacing.xs
  },
  chevronButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  downloadButton: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  uploaderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  uploaderAvatarImg: {
    width: '100%',
    height: '100%'
  },
  uploaderAvatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary
  },
  uploaderInfo: {
    flex: 1
  },
  uploaderName: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium
  },
  uploaderDate: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 1
  },
  statsTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base
  },
  statItem: {
    width: '45%'
  },
  statItemWide: {
    width: '100%'
  },
  statLabel: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: 2
  },
  chartContainer: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  chartTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  }
})

export default GpxRouteScreen
