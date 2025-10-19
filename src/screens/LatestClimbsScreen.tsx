import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Alert
} from 'react-native'
import { ClimbLog } from '../types'
import getImageUrl from '../utils/getImageUrl'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://akyatbundok.com'

const LatestClimbsScreen: React.FC = () => {
  const [logs, setLogs] = useState<ClimbLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(
    async (pageNum: number, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else if (pageNum === 1) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        const url = `${API_URL}/api/public/logs/latest?page=${pageNum}${
          pageNum === 1 ? '&count=true' : ''
        }`
        console.log('Fetching logs from:', url)

        const response = await fetch(url)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Fetch error:', response.status, errorText)
          throw new Error(
            `Failed to fetch logs: ${response.status} ${response.statusText}`
          )
        }

        const data = await response.json()
        console.log('Received data:', data)
        console.log(
          'Logs count:',
          data.logs?.length,
          'Total count:',
          data.count
        )

        const newLogs = (data.logs || []) as ClimbLog[]

        if (!Array.isArray(newLogs)) {
          throw new Error('Invalid response format: logs is not an array')
        }

        if (pageNum === 1) {
          setLogs(newLogs)
          if (data.count !== undefined) {
            setTotalLogs(data.count)
          }
        } else {
          setLogs((prev) => [...prev, ...newLogs])
        }

        setHasMore(
          newLogs.length > 0 &&
            (data.count ? logs.length + newLogs.length < data.count : true)
        )
        setError(null)

        console.log('Successfully loaded', newLogs.length, 'logs')
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred'
        console.error('Error fetching logs:', errorMessage, err)
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
    },
    [logs.length]
  )

  useEffect(() => {
    fetchLogs(1)
  }, [])

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

  const renderLogCard = ({ item }: { item: ClimbLog }) => <LogCard log={item} />

  const renderFooter = () => {
    if (!loadingMore) return null
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#8B4513" />
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
        <ActivityIndicator size="large" color="#8B4513" />
        <Text style={styles.loadingText}>Loading latest climbs...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Latest Climbs</Text>
        <Text style={styles.subtitle}>
          See the latest climbs from fellow hikers around the world
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
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
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

interface LogCardProps {
  log: ClimbLog
}

const LogCard: React.FC<LogCardProps> = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFullReport, setShowFullReport] = useState(false)

  const { mountain, user, log_images, climb_report, climb_date } = log
  const hasImages = log_images.length > 0
  const hasClimbReport = Boolean(climb_report)
  const displayImages = isExpanded ? log_images : log_images.slice(0, 1)

  const formattedDate = climb_date
    ? new Date(climb_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Unspecified'

  const shouldTruncate = (climb_report?.length ?? 0) > 150
  const displayReport =
    shouldTruncate && !showFullReport
      ? climb_report?.substring(0, 150)
      : climb_report

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.mountainName} numberOfLines={1}>
          {mountain.name}
        </Text>
        <Text style={styles.climbDate}>Climb Date: {formattedDate}</Text>
        <Text style={styles.username}>by @{user.username}</Text>
      </View>

      {hasImages && (
        <View style={styles.imageContainer}>
          {displayImages.map((image, index) => (
            <View key={image.id} style={styles.imageWrapper}>
              <Image
                source={{ uri: getImageUrl(image.image_path) }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          ))}
          {log_images.length > 1 && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setIsExpanded(!isExpanded)}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Show Less' : `+${log_images.length - 1} more`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {hasClimbReport && (
        <View
          style={[styles.reportContainer, hasImages && styles.reportWithImage]}
        >
          <Text style={styles.reportText}>
            {displayReport}
            {shouldTruncate && (
              <Text
                style={styles.seeMoreText}
                onPress={() => setShowFullReport(!showFullReport)}
              >
                {showFullReport ? ' ...see less' : ' ...see more'}
              </Text>
            )}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8
  },
  errorText: {
    color: '#c33',
    fontSize: 14
  },
  listContainer: {
    padding: 16,
    gap: 16
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
    fontSize: 64,
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24
  },
  card: {
    backgroundColor: '#2a2d3a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8
  },
  mountainName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textTransform: 'capitalize'
  },
  climbDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4
  },
  username: {
    fontSize: 12,
    color: '#9ca3af'
  },
  imageContainer: {
    position: 'relative'
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1d2e'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  expandButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    alignItems: 'center'
  },
  expandButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  reportContainer: {
    padding: 16,
    paddingTop: 8
  },
  reportWithImage: {
    paddingTop: 16
  },
  reportText: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20
  },
  seeMoreText: {
    color: '#9ca3af',
    fontWeight: '600'
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center'
  }
})

export default LatestClimbsScreen
