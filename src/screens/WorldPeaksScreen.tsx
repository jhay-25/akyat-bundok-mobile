import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { CountryWithMountainCount, Continent } from '../types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius, shadows } from '../theme'

const WorldPeaksScreen: React.FC = () => {
  const [countries, setCountries] = useState<CountryWithMountainCount[]>([])
  const [continents, setContinents] = useState<Continent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContinentId, setSelectedContinentId] = useState<number | null>(
    null
  )

  const fetchCountries = async () => {
    try {
      setError(null)
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/countries`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch countries')
      }

      const data = await response.json()
      setCountries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching countries:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchContinents = async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/continents`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch continents')
      }

      const data = await response.json()
      setContinents(data)
    } catch (err) {
      console.error('Error fetching continents:', err)
      // Don't show error to user, just log it
      // Continents filter will simply not show if this fails
    }
  }

  useEffect(() => {
    fetchCountries()
    fetchContinents()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    fetchCountries()
    fetchContinents()
  }

  // Filter countries based on search query and selected continent
  const filteredCountries = useMemo(() => {
    let filtered = countries

    // Filter by continent
    if (selectedContinentId !== null) {
      filtered = filtered.filter(
        (country) => country.continent_id === selectedContinentId
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((country) =>
        country.name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [countries, searchQuery, selectedContinentId])

  const handleContinentPress = (continentId: number) => {
    // Toggle: if already selected, deselect; otherwise select
    setSelectedContinentId((prev) =>
      prev === continentId ? null : continentId
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedContinentId(null)
  }

  const renderCountryItem = ({ item }: { item: CountryWithMountainCount }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        // TODO: Navigate to country detail screen
        console.log('Navigate to country:', item.id)
      }}
    >
      <View style={styles.countryContent}>
        <Text style={styles.countryName}>{item.name}</Text>
        <Text style={styles.mountainCount}>{item.mountain_count} peaks</Text>
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.text.primary} />
          <Text style={styles.loadingText}>Loading world peaks...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCountries}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>World Peaks</Text>
        <Text style={styles.subtitle}>
          Discover breathtaking peaks around the world
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.text.tertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search countries..."
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {(searchQuery || selectedContinentId !== null) && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
            <Ionicons
              name="close-circle"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Continent Filters */}
      {continents.length > 0 && (
        <View style={styles.continentFiltersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.continentFiltersContainer}
          >
            {continents.map((continent) => {
              const isSelected = selectedContinentId === continent.id
              return (
                <TouchableOpacity
                  key={continent.id}
                  style={[
                    styles.continentChip,
                    isSelected && styles.continentChipActive
                  ]}
                  onPress={() => handleContinentPress(continent.id)}
                >
                  <Text
                    style={[
                      styles.continentChipText,
                      isSelected && styles.continentChipTextActive
                    ]}
                  >
                    {continent.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredCountries}
        renderItem={renderCountryItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedContinentId !== null
                ? 'No countries match your filters'
                : 'No countries found'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
    backgroundColor: colors.background.primary
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    backgroundColor: colors.background.primary
  },
  title: {
    fontSize: typography.fontSize['5xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -1
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.xl,
    marginTop: spacing.base,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary
  },
  searchIcon: {
    marginRight: spacing.md
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.text.primary,
    fontSize: typography.fontSize.base
  },
  clearButton: {
    padding: spacing.xs
  },
  continentFiltersScroll: {
    maxHeight: 25,
    marginBottom: 8
  },
  continentFiltersWrapper: {
    marginBottom: spacing.sm
  },
  continentFiltersContainer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  },
  continentChip: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.primary
  },
  continentChipActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary
  },
  continentChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium
  },
  continentChipTextActive: {
    color: colors.background.primary,
    fontWeight: typography.fontWeight.semibold
  },
  listContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  countryItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    marginBottom: spacing.base,
    ...shadows.lg
  },
  countryContent: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  countryName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
    letterSpacing: -0.3
  },
  mountainCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginLeft: spacing.md,
    fontWeight: typography.fontWeight.semibold
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error.text,
    textAlign: 'center',
    marginBottom: spacing.base
  },
  retryButton: {
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg
  },
  retryButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  },
  emptyContainer: {
    paddingVertical: spacing['4xl'],
    alignItems: 'center'
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary
  }
})

export default WorldPeaksScreen
