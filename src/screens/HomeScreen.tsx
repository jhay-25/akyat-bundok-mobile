import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  ImageBackground
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius, shadows } from '../theme'
import getImageUrl, { getAssetsImageUrl } from '../utils/getImageUrl'
import { supabase } from '../utils/supabase'
import type { ClimbLog } from '../types'
import { ClimbLogCard } from '../components/ClimbLogCard'

const HomeScreen: React.FC = () => {
  const { profile, signOut } = useAuth()
  const [logs, setLogs] = useState<ClimbLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalPeaks: 0,
    mountainsThisYear: 0,
    totalLogs: 0
  })

  const fetchUserLogs = useCallback(async () => {
    if (!profile?.id) return

    try {
      // Fetch stats from RPC function
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_profile_stats',
        {
          user_uuid: profile.id,
          peaks_on_year: new Date().getFullYear()
        }
      )

      if (statsError) throw statsError

      // Fetch total logs count
      const { count: totalLogsCount, error: countError } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      if (countError) throw countError

      // Fetch recent logs for display
      const { data: recentLogsData, error: recentLogsError } = await supabase
        .from('logs')
        .select(
          `
          *,
          mountain:mountain_id(name,elevation_m,prominence_m,countries:mountain_country(country:countries(*))),
          user:user_id(*),
          log_images(*)
        `
        )
        .eq('user_id', profile.id)
        .order('climb_date', { ascending: false, nullsFirst: false })
        .limit(10)

      if (recentLogsError) throw recentLogsError

      if (recentLogsData) {
        setLogs(recentLogsData as ClimbLog[])
      }

      if (statsData) {
        setStats({
          totalPeaks: statsData.peaks || 0,
          mountainsThisYear: statsData.this_year || 0,
          totalLogs: totalLogsCount || 0
        })
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchUserLogs()
  }, [fetchUserLogs])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchUserLogs()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const profileImage = profile?.image_path
    ? getImageUrl(profile.image_path)
    : null

  const hasBanner =
    (profile?.user_role?.role === 'pro' ||
      profile?.user_role?.role === 'crew') &&
    profile?.banner_path
  const bannerImage = hasBanner
    ? getImageUrl(profile.banner_path!)
    : getAssetsImageUrl('banner.jpg')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {hasBanner ? (
          <ImageBackground
            source={{ uri: bannerImage }}
            style={styles.profileHeader}
            resizeMode="cover"
          >
            <View style={styles.bannerOverlay} />
            <View style={styles.bannerGradientHorizontal} />
            <View style={styles.bannerGradientVertical} />
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons
                    name="person"
                    size={60}
                    color={colors.text.tertiary}
                  />
                </View>
              )}
            </View>

            {profile?.given_name && (
              <Text style={styles.fullName}>
                {profile.given_name} {profile.family_name}
              </Text>
            )}

            <Text style={styles.username}>
              @{profile?.username || 'username'}
            </Text>

            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>EDIT</Text>
            </TouchableOpacity>
          </ImageBackground>
        ) : (
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons
                    name="person"
                    size={60}
                    color={colors.text.tertiary}
                  />
                </View>
              )}
            </View>

            <Text style={styles.username}>
              @{profile?.username || 'username'}
            </Text>

            {profile?.given_name && (
              <Text style={styles.fullName}>
                {profile.given_name} {profile.family_name}
              </Text>
            )}

            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>EDIT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalPeaks}</Text>
            <Text style={styles.statLabel}>peaks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.mountainsThisYear}</Text>
            <Text style={styles.statLabel}>this year</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalLogs}</Text>
            <Text style={styles.statLabel}>logs</Text>
          </View>
        </View>

        {/* Climb Logs Section */}
        <View style={styles.logsSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.text.tertiary} />
            </View>
          ) : logs.length > 0 ? (
            <View style={styles.logsGrid}>
              {logs.map((log) => (
                <ClimbLogCard key={log.id} log={log} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="trending-up"
                size={64}
                color={colors.text.tertiary}
              />
              <Text style={styles.emptyStateText}>No climbs yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start logging your mountain adventures!
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  scrollView: {
    flex: 1
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 23, 40, 0.5)',
    zIndex: 1
  },
  bannerGradientHorizontal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 23, 40, 0.3)',
    zIndex: 2
  },
  bannerGradientVertical: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.4)',
    zIndex: 3
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl
  },
  profileImageContainer: {
    marginBottom: spacing.base,
    zIndex: 10
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.border.primary
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.border.primary
  },
  fullName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    zIndex: 10
  },
  username: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.base,
    zIndex: 10
  },
  editButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: 'transparent',
    marginTop: spacing.sm,
    zIndex: 10
  },
  editButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: 1
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.primary
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs
  },
  statLabel: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase'
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.primary,
    marginHorizontal: spacing.md
  },
  logsSection: {
    paddingTop: spacing.xl
  },
  loadingContainer: {
    paddingVertical: spacing['5xl'],
    alignItems: 'center'
  },
  logsGrid: {
    paddingHorizontal: spacing.base,
    gap: spacing.base
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl
  },
  emptyStateText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.base,
    marginBottom: spacing.xs
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    textAlign: 'center'
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    marginHorizontal: spacing.xl,
    marginTop: spacing['3xl'],
    marginBottom: spacing['3xl'],
    alignItems: 'center'
  },
  signOutButtonText: {
    color: colors.error.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1
  }
})

export default HomeScreen
