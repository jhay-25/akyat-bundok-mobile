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
  Dimensions,
  Share,
  Platform,
  Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFocusEffect,
  useNavigation,
  useRoute,
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
import LogGpxCard from '../components/LogGpxCard'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Mountain, Country, User, MountainImage } from '../types'

type LogRoute = RouteProp<RootStackParamList, 'Log'>
type LogNav = StackNavigationProp<RootStackParamList, 'Log'>

interface LogRouteData {
  gpx_path: string | null
  is_uploaded: boolean | null
}

interface LogDetail {
  id: string
  created_at: string
  user_id: string
  mountain_id: string
  climb_date: string | null
  climb_report: string | null
  mountain: Mountain & { mountain_images?: { image_path: string }[] }
  user: User
  log_images: MountainImage[]
  log_routes?: LogRouteData[]
}

const REPORT_TRUNCATE = 300
const { width: SCREEN_WIDTH } = Dimensions.get('window')

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

const LogDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<LogRoute>()
  const navigation = useNavigation<LogNav>()
  const { session } = useAuth()
  const { logId } = route.params

  const [log, setLog] = useState<LogDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [seeMore, setSeeMore] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const fetchLog = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('logs')
      .select(
        `*,
        mountain: mountain_id(*, countries: mountain_country(country: countries(*)), mountain_images(image_path)),
        log_images(*),
        log_routes(gpx_path, is_uploaded),
        user: user_id(*)
        `
      )
      .eq('id', logId)
      .single()
    if (queryError) throw new Error(queryError.message)
    if (!data) throw new Error('Climb not found')
    return data as unknown as LogDetail
  }, [logId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const data = await fetchLog()
        if (active) setLog(data)
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Something went wrong')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchLog])

  const hasFocusedRef = useRef(false)
  // Refetch silently when returning from editing so the log reflects changes.
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true
        return
      }
      let active = true
      ;(async () => {
        try {
          const data = await fetchLog()
          if (active) setLog(data)
        } catch (_) {
          // Keep showing the existing data on a failed refresh
        }
      })()
      return () => {
        active = false
      }
    }, [fetchLog])
  )

  const handleShare = useCallback(async () => {
    if (!log) return
    const climberName = log.user.given_name
      ? log.user.family_name
        ? `${log.user.given_name} ${log.user.family_name}`
        : log.user.given_name
      : `@${log.user.username}`
    const shareUrl = `https://akyatbundok.com/users/${log.user.username}/logs/${log.id}`
    const message = `${climberName} climbed ${log.mountain.name} on Akyat Bundok`
    try {
      await Share.share({
        message:
          Platform.OS === 'android' ? `${message}\n\n${shareUrl}` : message,
        url: Platform.OS === 'ios' ? shareUrl : undefined
      })
    } catch (_) {
      // User dismissed the share sheet
    }
  }, [log])

  const goToProfile = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Home' })
  }, [navigation])

  const handleDelete = useCallback(() => {
    if (!log || !session) return
    Alert.alert('Delete this climb?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            const res = await fetch(
              `${API_CONFIG.BASE_URL}/api/logs/${log.id}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              }
            )
            if (!res.ok) throw new Error('Failed to delete climb')
            goToProfile()
          } catch (e) {
            setDeleting(false)
            Alert.alert(
              'Delete failed',
              e instanceof Error ? e.message : 'Something went wrong'
            )
          }
        }
      }
    ])
  }, [log, session, goToProfile])

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  if (error || !log) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.text.tertiary}
        />
        <Text style={styles.errorText}>{error || 'Climb not found'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const { mountain, user, log_images, climb_report, climb_date, created_at } =
    log
  const countries = mountain.countries?.map((c) => c.country) || []
  const displayName = user.given_name
    ? user.family_name
      ? `${user.given_name} ${user.family_name}`
      : user.given_name
    : `@${user.username}`
  const climbDateLabel = climb_date
    ? new Date(climb_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : null
  const uploadedImages = log_images.filter((img) => img.is_uploaded === 'true')
  const hasImages = uploadedImages.length > 0
  const shouldTruncate = (climb_report?.length ?? 0) > REPORT_TRUNCATE
  const displayReport =
    shouldTruncate && !seeMore
      ? climb_report?.substring(0, REPORT_TRUNCATE)
      : climb_report
  const gpxPath = log.log_routes?.find((r) => r.is_uploaded)?.gpx_path ?? null
  const mountainImage = mountain.mountain_images?.[0]?.image_path
  const isOwner = !!session && session.user.id === log.user_id

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Climb
        </Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('LogUpdate', { logId: log.id })
                }
                style={styles.headerButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={20} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.headerButton}
                disabled={deleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.error.text} />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.error.text}
                  />
                )}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={handleShare}
            style={styles.headerButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="share-outline"
              size={22}
              color={colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User header — own profile goes to the Home tab, others to their profile */}
        <TouchableOpacity
          style={styles.userRow}
          activeOpacity={0.7}
          onPress={() => {
            if (isOwner) {
              goToProfile()
            } else {
              navigation.navigate('UserProfile', { username: user.username })
            }
          }}
        >
          <View style={styles.avatar}>
            {user.image_path ? (
              <Image
                source={{ uri: getImageUrl(user.image_path) }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>
                {user.username.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.metaLine} numberOfLines={1}>
              {created_at ? timeAgo(created_at) : ''}
              {countries.length > 0
                ? ` · ${countries.map((c) => c.name).join(', ')}`
                : ''}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>

        {/* Mountain — tap to open the mountain page */}
        <TouchableOpacity
          style={styles.mountainRow}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('Mountain', {
              canonicalUrl: mountain.canonical_url
            })
          }
        >
          <View style={styles.mountainImageWrap}>
            {mountainImage ? (
              <Image
                source={{ uri: getImageUrl(mountainImage) }}
                style={styles.mountainImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.mountainImagePlaceholder}>
                <MountainIcon size={30} color="rgba(255, 255, 255, 0.08)" />
              </View>
            )}
          </View>
          <View style={styles.mountainInfo}>
            <Text style={styles.mountainName} numberOfLines={2}>
              {mountain.name}
            </Text>
            {mountain.elevation_m != null && (
              <Text style={styles.mountainElevation}>
                {mountain.elevation_m.toLocaleString()}m
              </Text>
            )}
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.text.tertiary}
          />
        </TouchableOpacity>

        {/* Climb date */}
        {climbDateLabel && (
          <Text style={styles.climbDate}>
            Climbed on{' '}
            <Text style={styles.climbDateStrong}>{climbDateLabel}</Text>
          </Text>
        )}

        {/* Report */}
        {climb_report ? (
          <Text style={styles.report}>
            {displayReport}
            {shouldTruncate && (
              <Text
                style={styles.seeMore}
                onPress={() => setSeeMore((v) => !v)}
              >
                {seeMore ? ' see less' : '...more'}
              </Text>
            )}
          </Text>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBoxText}>No climb report</Text>
          </View>
        )}

        {/* Images */}
        <Text style={styles.sectionLabel}>Images</Text>
        {hasImages ? (
          <View style={styles.photoGrid}>
            {uploadedImages.map((image, idx) => (
              <TouchableOpacity
                key={image.id}
                style={styles.photoTile}
                activeOpacity={0.9}
                onPress={() => setViewerIndex(idx)}
              >
                <Image
                  source={{ uri: getImageUrl(image.image_path) }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyBoxText}>No photos</Text>
          </View>
        )}

        {/* GPX Route */}
        {gpxPath && (
          <>
            <Text style={styles.sectionLabel}>GPX Route</Text>
            <LogGpxCard gpxPath={gpxPath} />
          </>
        )}
      </ScrollView>

      {/* Lightbox */}
      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.lightboxContainer}>
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxCounter}>
              {(viewerIndex ?? 0) + 1} / {uploadedImages.length}
            </Text>
            <TouchableOpacity
              onPress={() => setViewerIndex(null)}
              style={styles.lightboxClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentOffset={
              viewerIndex != null
                ? { x: viewerIndex * SCREEN_WIDTH, y: 0 }
                : undefined
            }
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH
              )
              setViewerIndex(
                Math.max(0, Math.min(index, uploadedImages.length - 1))
              )
            }}
          >
            {uploadedImages.map((image) => (
              <View
                key={image.id}
                style={[styles.lightboxSlide, { width: SCREEN_WIDTH }]}
              >
                <Image
                  source={{ uri: getImageUrl(image.image_path) }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.xl
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d'
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl * 2
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 40,
    height: 40
  },
  avatarText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700'
  },
  userInfo: {
    flex: 1
  },
  displayName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize'
  },
  metaLine: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2
  },
  mountainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.base
  },
  mountainImageWrap: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.elevated
  },
  mountainImage: {
    width: 72,
    height: 72
  },
  mountainImagePlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mountainInfo: {
    flex: 1
  },
  mountainName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize'
  },
  mountainElevation: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 4
  },
  climbDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.base
  },
  climbDateStrong: {
    color: colors.text.secondary
  },
  report: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: spacing.xl
  },
  seeMore: {
    color: colors.text.tertiary
  },
  sectionLabel: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.text.quaternary,
    marginBottom: spacing.sm
  },
  emptyBox: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.subtle,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  emptyBoxText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl
  },
  photoTile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.background.elevated
  },
  photoImage: {
    width: '100%',
    height: '100%'
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: colors.overlay.modal
  },
  lightboxHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base
  },
  lightboxCounter: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary
  },
  lightboxClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  lightboxSlide: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  lightboxImage: {
    width: '100%',
    height: '100%'
  }
})

export default LogDetailScreen
