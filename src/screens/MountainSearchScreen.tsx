import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RootStackParamList } from '../navigation/types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'

interface MountainResult {
  id: string
  name: string
  elevation_m: number | null
  country_name: string | null
  region_name: string | null
  banner_path: string | null
  canonical_url: string
}

/**
 * "Log a climb" entry point — the center tab. The user searches for a
 * mountain first; selecting one opens the existing LogClimb form.
 */
const MountainSearchScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MountainResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) {
      setResults([])
      setIsSearching(false)
      setSearched(false)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/public/mountains/search?query=${encodeURIComponent(trimmed)}`
      )
      if (res.ok) {
        const data = await res.json()
        setResults((data.results || []) as MountainResult[])
      } else {
        setResults([])
      }
    } catch (_) {
      setResults([])
    } finally {
      setIsSearching(false)
      setSearched(true)
    }
  }

  // Debounced live search as the user types
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (query.trim().length < 3) {
      setResults([])
      setIsSearching(false)
      setSearched(false)
      return
    }
    timeoutRef.current = setTimeout(() => runSearch(query), 300)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query])

  const selectMountain = (m: MountainResult) => {
    Keyboard.dismiss()
    navigation.navigate('LogClimb', {
      mountainId: m.id,
      mountainName: m.name
    })
  }

  const subtitle = (m: MountainResult) =>
    [m.country_name, m.region_name].filter(Boolean).join(', ')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Log a climb</Text>
        <Text style={styles.title}>Which mountain?</Text>
        <Text style={styles.subtitle}>Search for the peak you climbed.</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a mountain..."
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('')
              setResults([])
              setSearched(false)
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.mapButton}
          onPress={() =>
            navigation.navigate('MountainPicker', { pickMode: true })
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="map-outline" size={20} color={colors.accent.green} />
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.accent.green} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results.slice(0, 20)}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              activeOpacity={0.8}
              onPress={() => selectMountain(item)}
            >
              <View style={styles.resultIcon}>
                <Ionicons
                  name="trail-sign"
                  size={16}
                  color={colors.accent.green}
                />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {item.name}
                </Text>
                {subtitle(item) ? (
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {subtitle(item)}
                  </Text>
                ) : null}
              </View>
              {item.elevation_m != null && (
                <Text style={styles.resultElevation}>
                  {item.elevation_m.toLocaleString()}m
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      ) : searched && query.trim().length >= 3 ? (
        <View style={styles.centerBox}>
          <Ionicons name="search" size={32} color={colors.text.tertiary} />
          <Text style={styles.hintText}>No mountains found</Text>
        </View>
      ) : (
        <View style={styles.centerBox}>
          <Ionicons
            name="trail-sign-outline"
            size={40}
            color={colors.text.tertiary}
          />
          <Text style={styles.hintText}>
            Type at least 3 characters to search
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg
  },
  mapButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs
  },
  eyebrow: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.accent.green,
    marginBottom: spacing.xs
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent.greenBorder,
    backgroundColor: '#15181d'
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary
  },
  resultsList: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: 'rgba(74, 222, 128, 0.10)'
  },
  resultInfo: {
    flex: 1
  },
  resultName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize'
  },
  resultSubtitle: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 2
  },
  resultElevation: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.accent.green,
    marginLeft: spacing.md
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  hintText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center'
  }
})

export default MountainSearchScreen
