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
          <ActivityIndicator size="large" color={colors.brown[500]} />
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌍 World Peaks</Text>
        <Text style={styles.subtitle}>
          Discover breathtaking peaks around the world
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.brown[800]}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search countries..."
          placeholderTextColor={colors.brown[800]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {(searchQuery || selectedContinentId !== null) && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={colors.brown[800]} />
          </TouchableOpacity>
        )}
      </View>

      {/* Continent Filters */}
      {continents.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.continentFiltersContainer}
          style={styles.continentFiltersScroll}
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
            tintColor={colors.brown[500]}
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
    backgroundColor: colors.main[500]
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.brown[800]
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.brown[500],
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: colors.brown[800],
    marginBottom: 8
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.main[400],
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brown[800]
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.brown[500],
    fontSize: 16
  },
  clearButton: {
    padding: 4
  },
  continentFiltersScroll: {
    maxHeight: 50,
    marginBottom: 8
  },
  continentFiltersContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 8
  },
  continentChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.main[400],
    borderWidth: 1,
    borderColor: colors.brown[800],
    marginRight: 8
  },
  continentChipActive: {
    backgroundColor: colors.brown[500],
    borderColor: colors.brown[500]
  },
  continentChipText: {
    fontSize: 14,
    color: colors.brown[500],
    fontWeight: '500'
  },
  continentChipTextActive: {
    color: colors.main[500],
    fontWeight: '600'
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24
  },
  countryItem: {
    backgroundColor: colors.main[400],
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.brown[800],
    overflow: 'hidden'
  },
  countryContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brown[500],
    flex: 1
  },
  mountainCount: {
    fontSize: 12,
    color: colors.brown[800],
    marginLeft: 12
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.brown[800]
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: colors.brown[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  retryButtonText: {
    color: colors.main[500],
    fontSize: 16,
    fontWeight: '600'
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16,
    color: colors.brown[800]
  }
})

export default WorldPeaksScreen
