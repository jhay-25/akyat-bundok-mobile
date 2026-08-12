import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp
} from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { RootStackParamList } from '../navigation/types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import getImageUrl from '../utils/getImageUrl'
import { MountainIcon } from '../components/MountainIcon'
import { supabase } from '../utils/supabase'
import type {
  Mountain,
  Country,
  Region,
  ClimbLog,
  MountainImage
} from '../types'

type MountainRoute = RouteProp<RootStackParamList, 'Mountain'>
type MountainNav = StackNavigationProp<RootStackParamList, 'Mountain'>

interface MountainDetailResponse {
  mountain: Mountain
  countries: Country[]
  regions: Region[]
  provinces: { id: number; name: string; iso_code: string }[]
}

interface Climber {
  id: string
  username: string
  image_path: string | null
  given_name: string | null
  family_name: string | null
  climb_count: number
}

interface NearbyMountain {
  id: string
  name: string
  canonical_url: string
  elevation_m: number | null
  banner_path: string | null
  country_name: string | null
  region_name: string | null
}

interface GpxRoute {
  id: string
  created_at: string
  gpx_path: string
  title: string | null
  description: string | null
  user: {
    username: string
    given_name: string | null
    family_name: string | null
    image_path: string | null
  } | null
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'logs', label: 'Logs' },
  { key: 'photos', label: 'Photos' },
  { key: 'gpx', label: 'GPX Routes' }
] as const

type TabKey = (typeof TABS)[number]['key']

const formatM = (v: number | null) =>
  v == null ? '—' : `${v.toLocaleString()}m`

const capitalizeEachWord = (str: string) =>
  str.replace(/\b\w/g, (c) => c.toUpperCase())

const PHOTOS_PAGE_SIZE = 30

const MountainScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<MountainRoute>()
  const navigation = useNavigation<MountainNav>()
  const { canonicalUrl } = route.params

  const [mountain, setMountain] = useState<Mountain | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [provinces, setProvinces] = useState<
    { id: number; name: string; iso_code: string }[]
  >([])
  const [logs, setLogs] = useState<ClimbLog[]>([])
  const [logsCount, setLogsCount] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoadingMore, setLogsLoadingMore] = useState(false)
  const [climbers, setClimbers] = useState<Climber[]>([])
  const [nearby, setNearby] = useState<NearbyMountain[]>([])
  const [photos, setPhotos] = useState<MountainImage[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photosLoadingMore, setPhotosLoadingMore] = useState(false)
  const [photosCount, setPhotosCount] = useState(0)
  const [gpxRoutes, setGpxRoutes] = useState<GpxRoute[]>([])
  const [gpxLoading, setGpxLoading] = useState(false)
  const [gpxLoadingMore, setGpxLoadingMore] = useState(false)
  const [gpxCount, setGpxCount] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const photosFetchedRef = useRef(false)
  const gpxFetchedRef = useRef(false)

  // Load mountain details once
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const detailRes = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}`
        )
        if (!detailRes.ok) throw new Error('Mountain not found')
        const detail = (await detailRes.json()) as MountainDetailResponse
        if (!active) return
        setMountain(detail.mountain)
        setCountries(detail.countries || [])
        setRegions(detail.regions || [])
        setProvinces(detail.provinces || [])
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
  }, [canonicalUrl])

  // Fetch logs / climbers / nearby, and refresh every time the screen regains
  // focus (e.g., when returning from the Log Climb screen).
  const fetchListData = useCallback(async () => {
    if (!mountain) return
    try {
      const [logsRes, climbersRes, nearbyRes] = await Promise.all([
        fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}/logs?limit=20&page=1`
        ),
        fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}/climbers?limit=5`
        ),
        fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/nearby?latitude=${mountain.latitude}&longitude=${mountain.longitude}&limit=10`
        )
      ])
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(data.results || [])
        setLogsCount(data.count ?? (data.results?.length || 0))
        setLogsPage(data.page ?? 1)
      }
      if (climbersRes.ok) {
        const data = await climbersRes.json()
        setClimbers(data.results || [])
      }
      if (nearbyRes.ok) {
        const data = await nearbyRes.json()
        setNearby(
          (data.results || []).filter(
            (m: NearbyMountain) => m.canonical_url !== canonicalUrl
          )
        )
      }
    } catch (_) {
      // ignore transient network errors
    }
  }, [canonicalUrl, mountain?.latitude, mountain?.longitude])

  useFocusEffect(
    useCallback(() => {
      fetchListData()
    }, [fetchListData])
  )

  // Load photos lazily when the Photos tab is opened
  useEffect(() => {
    if (activeTab !== 'photos' || photosFetchedRef.current) return
    photosFetchedRef.current = true
    let active2 = true
    setPhotosLoading(true)
    ;(async () => {
      try {
        const { data, count } = await supabase
          .from('mountain_images')
          .select('*, mountains!inner(canonical_url)', { count: 'exact' })
          .eq('mountains.canonical_url', canonicalUrl)
          .not('is_uploaded', 'is', null)
          .order('created_at', { ascending: false })
          .range(0, PHOTOS_PAGE_SIZE - 1)
        if (active2 && data) {
          setPhotos(data as MountainImage[])
          setPhotosCount(count ?? 0)
        }
      } catch (_) {
      } finally {
        if (active2) setPhotosLoading(false)
      }
    })()
    return () => {
      active2 = false
    }
  }, [activeTab, canonicalUrl])

  // Load GPX routes lazily when the GPX tab is opened
  useEffect(() => {
    if (activeTab !== 'gpx' || gpxFetchedRef.current) return
    gpxFetchedRef.current = true
    let active2 = true
    setGpxLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}/gpx?limit=20&offset=0`
        )
        if (res.ok) {
          const data = await res.json()
          if (active2) {
            setGpxRoutes(data.results || [])
            setGpxCount(data.count ?? 0)
          }
        }
      } catch (_) {
      } finally {
        if (active2) setGpxLoading(false)
      }
    })()
    return () => {
      active2 = false
    }
  }, [activeTab, canonicalUrl])

  const loadMoreLogs = async () => {
    if (logsLoadingMore) return
    setLogsLoadingMore(true)
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}/logs?limit=20&page=${logsPage + 1}`
      )
      if (res.ok) {
        const data = await res.json()
        setLogs((prev) => [...prev, ...(data.results || [])])
        setLogsCount(data.count ?? 0)
        setLogsPage(data.page ?? logsPage + 1)
      }
    } catch (_) {
    } finally {
      setLogsLoadingMore(false)
    }
  }

  const loadMorePhotos = async () => {
    if (photosLoadingMore) return
    setPhotosLoadingMore(true)
    try {
      const { data, count } = await supabase
        .from('mountain_images')
        .select('*, mountains!inner(canonical_url)', { count: 'exact' })
        .eq('mountains.canonical_url', canonicalUrl)
        .not('is_uploaded', 'is', null)
        .order('created_at', { ascending: false })
        .range(photos.length, photos.length + PHOTOS_PAGE_SIZE - 1)
      if (data) {
        setPhotos((prev) => [...prev, ...data])
        setPhotosCount(count ?? 0)
      }
    } catch (_) {
    } finally {
      setPhotosLoadingMore(false)
    }
  }

  const loadMoreGpx = async () => {
    if (gpxLoadingMore) return
    setGpxLoadingMore(true)
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/mountains/${canonicalUrl}/gpx?limit=20&offset=${gpxRoutes.length}`
      )
      if (res.ok) {
        const data = await res.json()
        setGpxRoutes((prev) => [...prev, ...(data.results || [])])
        setGpxCount(data.count ?? 0)
      }
    } catch (_) {
    } finally {
      setGpxLoadingMore(false)
    }
  }

  const openLogClimb = () => {
    if (mountain) {
      navigation.navigate('LogClimb', {
        mountainId: mountain.id,
        mountainName: mountain.name
      })
    }
  }

  const onUpdatePress = () => {
    Alert.alert(
      'Update',
      'Updating mountain info is not available yet on mobile.'
    )
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  if (!mountain) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>⚠️ {error || 'Mountain not found'}</Text>
      </View>
    )
  }

  const countryName = countries.map((c) => c.name).join(' · ')
  const regionName = regions.map((r) => r.name).join(', ')
  const provinceName = provinces.map((p) => p.name).join(', ')

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.banner}>
          {mountain.banner_path ? (
            <Image
              source={{ uri: getImageUrl(mountain.banner_path) }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <MountainIcon size={64} color={colors.accent.green} />
            </View>
          )}
          <View style={styles.bannerOverlay} />
          <View style={[styles.bannerText, { paddingBottom: insets.bottom }]}>
            <Text style={styles.mountainName}>{mountain.name}</Text>
            {Boolean(countryName) && (
              <Text style={styles.countryName}>{countryName}</Text>
            )}
          </View>
        </View>

        {/* Back button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + spacing.sm }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.logButton}
              onPress={openLogClimb}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={colors.black} />
              <Text style={styles.logButtonText}>Log Climb</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onUpdatePress}
              activeOpacity={0.8}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={styles.tabItem}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {tab.label}
                  </Text>
                  {active && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              )
            })}
          </View>

          {activeTab === 'overview' && (
            <>
              {/* Info row */}
              <View style={styles.infoRow}>
                <InfoItem
                  label="Elevation"
                  value={formatM(mountain.elevation_m)}
                />
                <InfoItem
                  label="Prominence"
                  value={formatM(mountain.prominence_m)}
                />
                {Boolean(regionName) && (
                  <InfoItem label="Region" value={regionName} />
                )}
                {Boolean(provinceName) && (
                  <InfoItem label="Province" value={provinceName} />
                )}
                <InfoItem
                  label="Latitude"
                  value={mountain.latitude.toFixed(6)}
                />
                <InfoItem
                  label="Longitude"
                  value={mountain.longitude.toFixed(6)}
                />
              </View>

              {/* Description */}
              <Text style={styles.description}>
                {mountain.description ||
                  `${capitalizeEachWord(mountain.name)} is a mountain in ${
                    countries[0]?.name
                  } with an elevation of ${formatM(mountain.elevation_m)}.`}
              </Text>

              {/* Recent Climbs */}
              <Text style={styles.sectionLabel}>Recent Climbs</Text>
              {logs.length > 0 ? (
                <View style={styles.rows}>
                  {logs.slice(0, 5).map((log, idx) => (
                    <LogRow key={log.id} log={log} stripe={idx % 2 === 0} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No climb records yet. Be the first to log your climb.
                </Text>
              )}

              {/* Top Climbers */}
              <Text style={styles.sectionLabel}>Top Climbers</Text>
              {climbers.length > 0 ? (
                <View style={styles.rows}>
                  {climbers.map((climber, idx) => (
                    <ClimberRow
                      key={climber.id}
                      climber={climber}
                      rank={idx + 1}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No climbers yet.</Text>
              )}

              {/* Mountains Near */}
              <Text style={styles.sectionLabel}>
                Mountains Near{' '}
                <Text style={styles.sectionLabelAccent}>{mountain.name}</Text>
              </Text>
              {nearby.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nearbyRow}
                >
                  {nearby.map((m) => (
                    <NearbyCard
                      key={m.id}
                      mountain={m}
                      onPress={() =>
                        navigation.push('Mountain', {
                          canonicalUrl: m.canonical_url
                        })
                      }
                    />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No nearby mountains found.</Text>
              )}
            </>
          )}

          {activeTab === 'logs' && (
            <>
              <Text style={styles.sectionLabel}>All Climbs</Text>
              {logs.length > 0 ? (
                <>
                  <View style={styles.rows}>
                    {logs.map((log, idx) => (
                      <LogRow key={log.id} log={log} stripe={idx % 2 === 0} />
                    ))}
                  </View>
                  {logs.length < logsCount && (
                    <LoadMoreButton
                      loading={logsLoadingMore}
                      onPress={loadMoreLogs}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No climb records yet.</Text>
              )}
            </>
          )}

          {activeTab === 'photos' && (
            <>
              <Text style={styles.sectionLabel}>Photos</Text>
              {photosLoading ? (
                <ActivityIndicator
                  style={styles.tabLoader}
                  color={colors.accent.green}
                />
              ) : photos.length > 0 ? (
                <>
                  <View style={styles.photoGrid}>
                    {photos.map((photo) => (
                      <TouchableOpacity
                        key={photo.id}
                        style={styles.photoTile}
                        activeOpacity={0.9}
                        onPress={() =>
                          setViewerIndex(
                            photos.findIndex((p) => p.id === photo.id)
                          )
                        }
                      >
                        <Image
                          source={{ uri: getImageUrl(photo.image_path) }}
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {photos.length < photosCount && (
                    <LoadMoreButton
                      loading={photosLoadingMore}
                      onPress={loadMorePhotos}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No photos yet.</Text>
              )}
            </>
          )}

          {activeTab === 'gpx' && (
            <>
              <Text style={styles.sectionLabel}>GPX Routes</Text>
              {gpxLoading ? (
                <ActivityIndicator
                  style={styles.tabLoader}
                  color={colors.accent.green}
                />
              ) : gpxRoutes.length > 0 ? (
                <>
                  <View style={styles.rows}>
                    {gpxRoutes.map((route) => (
                      <GpxRow
                        key={route.id}
                        route={route}
                        onPress={() =>
                          navigation.navigate('GpxRoute', {
                            routeId: route.id
                          })
                        }
                      />
                    ))}
                  </View>
                  {gpxRoutes.length < gpxCount && (
                    <LoadMoreButton
                      loading={gpxLoadingMore}
                      onPress={loadMoreGpx}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No GPX routes yet.</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Photo viewer */}
      <Modal
        visible={viewerIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerContainer}>
          {viewerIndex != null && photos[viewerIndex] ? (
            <Image
              source={{ uri: getImageUrl(photos[viewerIndex].image_path) }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerIndex(null)}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}: </Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
)

const LogRow = ({ log, stripe }: { log: ClimbLog; stripe?: boolean }) => {
  const date = log.climb_date
    ? new Date(log.climb_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : ''
  const displayName = log.user.given_name
    ? log.user.family_name
      ? `${log.user.given_name} ${log.user.family_name}`
      : log.user.given_name
    : `@${log.user.username}`
  const excerpt =
    log.climb_report && log.climb_report.length > 160
      ? log.climb_report.slice(0, 160) + '…'
      : log.climb_report
  const img = log.log_images[0]

  return (
    <View style={[styles.logRow, stripe && styles.rowStriped]}>
      {img ? (
        <Image
          source={{ uri: getImageUrl(img.image_path) }}
          style={styles.logThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.logThumb, styles.logThumbPlaceholder]}>
          <MountainIcon size={22} color={colors.text.tertiary} />
        </View>
      )}
      <View style={styles.logBody}>
        <View style={styles.logHeader}>
          <Text style={styles.logName} numberOfLines={1}>
            {displayName}
          </Text>
          {Boolean(date) && <Text style={styles.logDate}>{date}</Text>}
        </View>
        {excerpt ? (
          <Text style={styles.logReport} numberOfLines={3}>
            {excerpt}
          </Text>
        ) : (
          <Text style={styles.logEmpty}>Climbed without a report</Text>
        )}
      </View>
    </View>
  )
}

const ClimberRow = ({ climber, rank }: { climber: Climber; rank: number }) => (
  <View style={styles.climberRow}>
    <Text style={styles.climberRank}>{rank}.</Text>
    <View style={styles.climberAvatar}>
      {climber.image_path ? (
        <Image
          source={{ uri: getImageUrl(climber.image_path) }}
          style={styles.climberAvatarImg}
        />
      ) : (
        <Text style={styles.climberAvatarText}>
          {climber.given_name?.[0] || climber.username?.[0]}
        </Text>
      )}
    </View>
    <Text style={styles.climberName} numberOfLines={1}>
      {climber.given_name || `@${climber.username}`}
    </Text>
    <Text style={styles.climberCount}>
      {climber.climb_count} {climber.climb_count > 1 ? 'climbs' : 'climb'}
    </Text>
  </View>
)

const NearbyCard = ({
  mountain,
  onPress
}: {
  mountain: NearbyMountain
  onPress: () => void
}) => (
  <TouchableOpacity
    style={styles.nearbyCard}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.nearbyImageWrap}>
      {mountain.banner_path ? (
        <Image
          source={{ uri: getImageUrl(mountain.banner_path) }}
          style={styles.nearbyImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.nearbyImage, styles.nearbyImagePlaceholder]}>
          <MountainIcon size={24} color={colors.text.tertiary} />
        </View>
      )}
    </View>
    <Text style={styles.nearbyName} numberOfLines={1}>
      {mountain.name}
    </Text>
    <Text style={styles.nearbyElevation}>{formatM(mountain.elevation_m)}</Text>
  </TouchableOpacity>
)

const GpxRow = ({
  route,
  onPress
}: {
  route: GpxRoute
  onPress: () => void
}) => {
  const date = route.created_at
    ? new Date(route.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : ''
  const name = route.user
    ? route.user.given_name || `@${route.user.username}`
    : 'Unknown'

  return (
    <TouchableOpacity
      style={styles.gpxRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.gpxIcon}>
        <Ionicons
          name="trail-sign-outline"
          size={20}
          color={colors.accent.green}
        />
      </View>
      <View style={styles.gpxBody}>
        <Text style={styles.gpxTitle} numberOfLines={1}>
          {route.title || 'Untitled route'}
        </Text>
        <Text style={styles.gpxMeta} numberOfLines={1}>
          {name}
          {date ? ` · ${date}` : ''}
        </Text>
        {route.description ? (
          <Text style={styles.gpxDesc} numberOfLines={2}>
            {route.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const LoadMoreButton = ({
  loading,
  onPress
}: {
  loading: boolean
  onPress: () => void
}) => (
  <TouchableOpacity
    style={styles.loadMoreButton}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator size="small" color={colors.accent.green} />
    ) : (
      <Text style={styles.loadMoreText}>Load more</Text>
    )}
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: spacing['5xl']
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.primary
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error.text,
    textAlign: 'center'
  },
  banner: {
    width: '100%',
    height: 320,
    position: 'relative'
  },
  bannerImage: {
    width: '100%',
    height: '100%'
  },
  bannerPlaceholder: {
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.image
  },
  bannerText: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.base
  },
  mountainName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.5
  },
  countryName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs
  },
  backButton: {
    position: 'absolute',
    left: spacing.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.strong
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginBottom: spacing.lg
  },
  infoItem: {
    flexDirection: 'row'
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: '#E5E7EB'
  },
  description: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    color: colors.text.secondary,
    marginBottom: spacing['2xl']
  },
  sectionLabel: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    marginTop: spacing.xl
  },
  sectionLabelAccent: {
    color: colors.accent.green,
    textTransform: 'capitalize'
  },
  rows: {
    marginHorizontal: -spacing.base
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  rowStriped: {
    backgroundColor: colors.background.card
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md
  },
  logThumb: {
    width: 58,
    height: 74,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.card
  },
  logThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  logBody: {
    flex: 1
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  logName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  },
  logDate: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginLeft: spacing.sm
  },
  logReport: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    color: colors.text.secondary
  },
  logEmpty: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    color: colors.text.tertiary
  },
  climberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm
  },
  climberRank: {
    width: 18,
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.quaternary,
    textAlign: 'right',
    marginRight: spacing.sm
  },
  climberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.sm
  },
  climberAvatarImg: {
    width: 24,
    height: 24
  },
  climberAvatarText: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase'
  },
  climberName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary
  },
  climberCount: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.quaternary
  },
  nearbyRow: {
    gap: spacing.md,
    paddingVertical: spacing.xs
  },
  nearbyCard: {
    width: 150,
    gap: spacing.xs
  },
  nearbyImageWrap: {
    width: 150,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.card,
    overflow: 'hidden'
  },
  nearbyImage: {
    width: '100%',
    height: '100%'
  },
  nearbyImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  nearbyName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize'
  },
  nearbyElevation: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent.green
  },
  logButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.black
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.lg
  },
  tabItem: {
    position: 'relative',
    paddingVertical: spacing.sm,
    marginRight: spacing.lg
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary
  },
  tabTextActive: {
    color: colors.text.primary
  },
  tabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent.green
  },
  tabLoader: {
    paddingVertical: spacing['3xl']
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  photoTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    backgroundColor: colors.background.card
  },
  photoImage: {
    width: '100%',
    height: '100%'
  },
  gpxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  gpxIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.greenSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gpxBody: {
    flex: 1
  },
  gpxTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  },
  gpxMeta: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 2
  },
  gpxDesc: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    color: colors.text.secondary,
    marginTop: 4
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: colors.overlay.modal,
    justifyContent: 'center',
    alignItems: 'center'
  },
  viewerImage: {
    width: '100%',
    height: '100%'
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong
  },
  loadMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary
  }
})

export default MountainScreen
