import React, { useState, useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ClimbLog } from '../types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { ClimbLogCard } from '../components/ClimbLogCard'

const LatestClimbsScreen: React.FC = () => {
  const [logs, setLogs] = useState<ClimbLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Mirrors `logs` for synchronous reads inside fetchLogs, so the callback
  // stays stable (no stale-closure re-creation on every load).
  const logsRef = useRef<ClimbLog[]>([])
  const hasFocusedRef = useRef(false)
  const listRef = useRef<FlatList<ClimbLog>>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const fetchLogs = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else if (pageNum === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const url = `${
        API_CONFIG.BASE_URL
      }/api/public/logs/latest?page=${pageNum}${
        pageNum === 1 ? '&count=true' : ''
      }`

      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to fetch logs: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      const newLogs = (data.logs || []) as ClimbLog[]

      if (!Array.isArray(newLogs)) {
        throw new Error('Invalid response format: logs is not an array')
      }

      if (pageNum === 1) {
        logsRef.current = newLogs
        setLogs(newLogs)
        if (data.count !== undefined) {
          setTotalLogs(data.count)
        }
      } else {
        logsRef.current = [...logsRef.current, ...newLogs]
        setLogs(logsRef.current)
      }

      setHasMore(
        newLogs.length > 0 &&
          (data.count ? logsRef.current.length < data.count : true)
      )
      setError(null)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      Alert.alert(
        'Error Loading Climbs',
        `${errorMessage}\n\nPlease check your internet connection and try again.`,
        [
          {
            text: 'Retry',
            onPress: () => fetchLogs(pageNum, isRefresh)
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [])

  // Refetch the feed whenever the screen regains focus (e.g., after deleting
  // a climb from the log detail screen). The first focus does the full
  // loading state; later focuses refresh in place.
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true
        fetchLogs(1)
        return
      }
      fetchLogs(1, true)
    }, [fetchLogs])
  )

  const handleRefresh = () => {
    setPage(1)
    setHasMore(true)
    fetchLogs(1, true)
  }

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && logs.length < totalLogs) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchLogs(nextPage)
    }
  }

  const renderLogCard = ({ item }: { item: ClimbLog }) => (
    <ClimbLogCard log={item} />
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.text.tertiary} />
      </View>
    )
  }

  const renderEmptyComponent = () => {
    if (loading) return null
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏔️</Text>
        <Text style={styles.emptyTitle}>No Climbs Yet</Text>
        <Text style={styles.emptyText}>
          Be the first to share your climbing adventure!
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.tertiary} />
        <Text style={styles.loadingText}>Loading latest climbs...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Latest</Text>
        <View style={styles.titleAccent} />
        <Text style={styles.subtitle}>
          See the latest climbs around the world!
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={logs}
        renderItem={renderLogCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          logs.length === 0 ? styles.emptyListContainer : styles.listContainer
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        onScroll={(event) =>
          setShowBackToTop(event.nativeEvent.contentOffset.y > 400)
        }
        scrollEventThrottle={16}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
      />

      {/* Back to top */}
      {showBackToTop && (
        <TouchableOpacity
          style={styles.backToTop}
          activeOpacity={0.8}
          onPress={() =>
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
          }
        >
          <Ionicons name="arrow-up" size={20} color={colors.text.primary} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: colors.text.tertiary,
    fontWeight: '500'
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: colors.background.primary
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -1
  },
  titleAccent: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent.green,
    marginTop: 4,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.tertiary
  },
  errorContainer: {
    backgroundColor: colors.error.background,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.error.border
  },
  errorText: {
    color: colors.error.text,
    fontSize: 14,
    lineHeight: 20
  },
  listContainer: {
    padding: 16,
    gap: 20
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 20,
    opacity: 0.8
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24
  },
  backToTop: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center'
  }
})

export default LatestClimbsScreen
