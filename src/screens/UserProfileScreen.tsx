import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { RootStackParamList } from '../navigation/types'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import getImageUrl, { getAssetsImageUrl } from '../utils/getImageUrl'
import { ClimbLogCard } from '../components/ClimbLogCard'
import { supabase } from '../utils/supabase'
import type { ClimbLog } from '../types'

type ProfileRoute = RouteProp<RootStackParamList, 'UserProfile'>
type ProfileNav = StackNavigationProp<RootStackParamList, 'UserProfile'>

interface ProfileUser {
  id: string
  username: string
  image_path: string | null
  given_name: string | null
  family_name: string | null
  location: string | null
  website: string | null
  banner_path: string | null
  user_role?: { role: 'crew' | 'pro' | null }
}

const PAGE_COUNT = 20

const UserProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<ProfileRoute>()
  const navigation = useNavigation<ProfileNav>()
  const { username } = route.params

  const [user, setUser] = useState<ProfileUser | null>(null)
  const [logs, setLogs] = useState<ClimbLog[]>([])
  const [stats, setStats] = useState({
    peaks: 0,
    countries: 0,
    thisYear: 0
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalLogs, setTotalLogs] = useState(0)
  const [error, setError] = useState('')

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*, user_role: user_roles(role)')
          .eq('username', username)
          .single()
        if (userError || !userData) {
          throw new Error(userError?.message || 'User not found')
        }
        setUser(userData as unknown as ProfileUser)

        // Stats: peaks + this year via RPC, countries via climbed mountains
        const { data: statsData } = await supabase.rpc('get_profile_stats', {
          user_uuid: userData.id,
          peaks_on_year: new Date().getFullYear()
        })
        let countryCount = 0
        try {
          const { data: logData } = await supabase
            .from('logs')
            .select('mountain_id')
            .eq('user_id', userData.id)
          const mountainIds = Array.from(
            new Set((logData ?? []).map((l: any) => l.mountain_id))
          )
          if (mountainIds.length > 0) {
            const { data: mcData } = await supabase
              .from('mountain_country')
              .select('country_id')
              .in('mountain_id', mountainIds)
            countryCount = new Set(
              (mcData ?? []).map((mc: any) => mc.country_id)
            ).size
          }
        } catch (_) {
          // country stats are best-effort
        }
        setStats({
          peaks: statsData?.peaks ?? 0,
          countries: countryCount,
          thisYear: statsData?.this_year ?? 0
        })

        // First page of logs
        const { data: logsData, count } = await supabase
          .from('logs')
          .select(
            `*,
            mountain: mountain_id(name,elevation_m,prominence_m,countries:mountain_country(country: countries(*))),
            log_images(*),
            user: user_id(*)
            `,
            { count: 'exact' }
          )
          .eq('user_id', userData.id)
          .order('climb_date', { ascending: false, nullsFirst: false })
          .range(0, PAGE_COUNT - 1)

        setLogs((logsData ?? []) as ClimbLog[])
        setTotalLogs(count ?? 0)
        setHasMore((logsData?.length ?? 0) < (count ?? 0))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [username]
  )

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const loadMoreLogs = useCallback(async () => {
    if (!user || loadingLogs || !hasMore) return
    setLoadingLogs(true)
    try {
      const from = logs.length
      const to = from + PAGE_COUNT - 1
      const { data, error } = await supabase
        .from('logs')
        .select(
          `*,
          mountain: mountain_id(name,elevation_m,prominence_m,countries:mountain_country(country: countries(*))),
          log_images(*),
          user: user_id(*)
          `
        )
        .eq('user_id', user.id)
        .order('climb_date', { ascending: false, nullsFirst: false })
        .range(from, to)
      if (error) throw new Error(error.message)
      const newLogs = (data ?? []) as ClimbLog[]
      setLogs((prev) => [...prev, ...newLogs])
      if (logs.length + newLogs.length >= totalLogs) setHasMore(false)
    } catch (_) {
      // ignore transient load-more errors
    } finally {
      setLoadingLogs(false)
    }
  }, [user, loadingLogs, hasMore, logs.length, totalLogs])

  const openLog = useCallback(
    (log: ClimbLog) => navigation.navigate('Log', { logId: log.id }),
    [navigation]
  )

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  if (error || !user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="person-circle-outline"
          size={48}
          color={colors.text.tertiary}
        />
        <Text style={styles.errorText}>{error || 'User not found'}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const displayName = user.given_name
    ? user.family_name
      ? `${user.given_name} ${user.family_name}`
      : user.given_name
    : `@${user.username}`
  const hasBanner = !!user.user_role?.role && !!user.banner_path
  const bannerImage = hasBanner
    ? getImageUrl(user.banner_path!)
    : getAssetsImageUrl('banner.jpg')
  const latest = logs[0]
  const latestImage = latest?.log_images.find(
    (img) => img.is_uploaded === 'true'
  )?.image_path

  const profileInfo =
    user.location || user.website ? (
      <View style={styles.infoRow}>
        {user.location && (
          <View style={styles.infoItem}>
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.text.tertiary}
            />
            <Text style={styles.infoText} numberOfLines={1}>
              {user.location}
            </Text>
          </View>
        )}
        {user.website && (
          <View style={styles.infoItem}>
            <Ionicons
              name="globe-outline"
              size={14}
              color={colors.text.tertiary}
            />
            <Text style={styles.infoText} numberOfLines={1}>
              {user.website}
            </Text>
          </View>
        )}
      </View>
    ) : null

  const profileHeader = (
    <>
      {hasBanner ? (
        <ImageBackground
          source={{ uri: bannerImage }}
          style={styles.profileHeader}
          resizeMode="cover"
        >
          <View style={styles.bannerOverlay} />
          <Avatar user={user} />
          <Text style={styles.fullName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.user_role?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user.user_role.role === 'crew' ? 'Crew' : 'Pro'}
              </Text>
            </View>
          )}
          {profileInfo}
        </ImageBackground>
      ) : (
        <View style={styles.profileHeader}>
          <Avatar user={user} />
          <Text style={styles.fullName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.user_role?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user.user_role.role === 'crew' ? 'Crew' : 'Pro'}
              </Text>
            </View>
          )}
          {profileInfo}
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.peaks}</Text>
          <Text style={styles.statLabel}>Peaks</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.countries}</Text>
          <Text style={styles.statLabel}>Countries</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.thisYear}</Text>
          <Text style={styles.statLabel}>This Year</Text>
        </View>
      </View>
    </>
  )

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
          {user.username}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            tintColor={colors.accent.green}
          />
        }
      >
        {profileHeader}

        {/* Latest Climb Highlight */}
        {latest && (
          <TouchableOpacity
            style={styles.latestCard}
            activeOpacity={0.8}
            onPress={() => openLog(latest)}
          >
            <View style={styles.latestIcon}>
              <Ionicons
                name="trail-sign"
                size={22}
                color={colors.accent.green}
              />
            </View>
            <View style={styles.latestInfo}>
              <Text style={styles.latestLabel}>Latest Climb</Text>
              <Text style={styles.latestName} numberOfLines={1}>
                {latest.mountain.name}
              </Text>
              {latest.climb_date && (
                <Text style={styles.latestDate}>
                  {new Date(latest.climb_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              )}
            </View>
            {latestImage && (
              <Image
                source={{ uri: getImageUrl(latestImage) }}
                style={styles.latestImage}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
        )}

        {/* All Climbs */}
        <Text style={styles.sectionLabel}>All Climbs</Text>
        {logs.length > 0 ? (
          <View style={styles.logsList}>
            {logs.map((log) => (
              <ClimbLogCard key={log.id} log={log} showUser={false} />
            ))}
            {loadingLogs && (
              <ActivityIndicator
                style={styles.loadMoreLoader}
                color={colors.accent.green}
              />
            )}
            {hasMore && !loadingLogs && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMoreLogs}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="trail-sign-outline"
              size={40}
              color={colors.text.tertiary}
            />
            <Text style={styles.emptyText}>No climbs yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const Avatar = ({ user }: { user: ProfileUser }) => {
  return (
    <View style={styles.avatarContainer}>
      {user.image_path ? (
        <Image
          source={{ uri: getImageUrl(user.image_path) }}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={52} color={colors.text.tertiary} />
        </View>
      )}
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
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  scrollView: {
    flex: 1
  },
  content: {
    paddingBottom: spacing['5xl']
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.image,
    zIndex: 1
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.card
  },
  avatarContainer: {
    marginBottom: spacing.base,
    zIndex: 10
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.border.subtle
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.border.subtle
  },
  fullName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    textAlign: 'center',
    zIndex: 10
  },
  username: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
    zIndex: 10
  },
  roleBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(74, 222, 128, 0.10)',
    zIndex: 10
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.accent.green
  },
  infoRow: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    zIndex: 10
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '90%'
  },
  infoText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.border.subtle
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  latestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: 'rgba(74, 222, 128, 0.05)'
  },
  latestIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(74, 222, 128, 0.10)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  latestInfo: {
    flex: 1,
    minWidth: 0
  },
  latestLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.text.tertiary
  },
  latestName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    marginTop: 2
  },
  latestDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2
  },
  latestImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  sectionLabel: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.text.quaternary,
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  logsList: {
    paddingHorizontal: spacing.base,
    gap: spacing.md
  },
  loadMoreLoader: {
    marginVertical: spacing.lg
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: spacing.sm
  },
  loadMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.sm
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  }
})

export default UserProfileScreen
