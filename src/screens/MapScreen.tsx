import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Image,
  Platform
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker, Region, UrlTile } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import Supercluster from 'supercluster'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import getImageUrl from '../utils/getImageUrl'
import { MountainIcon } from '../components/MountainIcon'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RootStackParamList } from '../navigation/types'

interface MountainMarker {
  id: string
  name: string
  elevation_m: number | null
  latitude: number
  longitude: number
  country_name: string | null
  region_name: string | null
  banner_path: string | null
  canonical_url: string
}

interface GeocodePlace {
  name: string
  latitude: number
  longitude: number
  country: string | null
  country_code: string | null
  state: string | null
  city: string | null
}

type SearchSection =
  | { type: 'location'; key: string }
  | { type: 'header'; key: string; label: string }
  | { type: 'mountain'; key: string; mountain: MountainMarker }
  | { type: 'place'; key: string; place: GeocodePlace }

const INITIAL_REGION: Region = {
  latitude: 12.8797,
  longitude: 121.774,
  latitudeDelta: 16,
  longitudeDelta: 16
}

// Height of the pick-mode header row (below the safe-area inset).
const PICK_HEADER_HEIGHT = 56

// Google Maps dark style (used on Android)
const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#121417' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7c8491' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121417' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d33' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b7280' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.place_of_worship',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1b2b1f' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1c2025' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2a2d33' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a929e' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2a2d33' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3a3d43' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1c2025' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f1b26' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4b6577' }]
  }
]

// Match the web app's elevation-based mountain marker colors
export function getMarkerColor(elevation: number | null): string {
  const m = elevation ?? 0
  if (m >= 6000) return '#e11d48' // rose-600
  if (m >= 4000) return '#f97316' // orange-500
  if (m >= 2000) return '#d97706' // amber-600
  return '#92400e' // amber-800
}

// Match the web app's elevation-based marker size (16px - 32px)
function getMarkerSize(elevation: number | null): number {
  const base = (elevation ?? 0) / 1000
  return Math.max(4, Math.min(8, base * 1.5 + 3)) * 4
}

const MAP_STYLE_OPTIONS = [
  { key: 'standard', label: 'Standard' },
  { key: 'opentopomap', label: 'OpenTopoMap' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'satelliteTopo', label: 'Satellite Topo' }
] as const

type MapStyleKey = (typeof MAP_STYLE_OPTIONS)[number]['key']

function resolveNativeMapType(
  style: MapStyleKey
): 'standard' | 'terrain' | 'satellite' | 'none' {
  if (style === 'terrain') return 'terrain'
  if (style === 'satellite' || style === 'satelliteTopo') return 'satellite'
  if (style === 'opentopomap') {
    // Hide the native base on Android so the dark map never flashes through
    // while OpenTopoMap tiles are loading. iOS hides the base via UrlTile.
    return Platform.OS === 'android' ? 'none' : 'standard'
  }
  return 'standard'
}

function resolveTileUrl(style: MapStyleKey): string | null {
  if (style === 'opentopomap' || style === 'satelliteTopo')
    return 'https://tile.opentopomap.org/{z}/{x}/{y}.png'
  return null
}

// Combine geocoded places and mountains into one ordered result list for the
// search dropdown — mirrors the web app's peak-or-place search.
function buildSearchSections(
  mountains: MountainMarker[],
  places: GeocodePlace[]
): SearchSection[] {
  const sections: SearchSection[] = []
  const hasResults = mountains.length > 0 || places.length > 0
  if (hasResults) {
    sections.push({ type: 'location', key: 'current-location' })
  }
  if (mountains.length > 0) {
    sections.push({ type: 'header', key: 'header-peaks', label: 'Peaks' })
    mountains
      .slice(0, 5)
      .forEach((m) =>
        sections.push({ type: 'mountain', key: `peak-${m.id}`, mountain: m })
      )
  }
  if (places.length > 0) {
    sections.push({ type: 'header', key: 'header-places', label: 'Places' })
    places
      .slice(0, 5)
      .forEach((p, i) =>
        sections.push({ type: 'place', key: `place-${i}`, place: p })
      )
  }
  return sections
}

const subtitlePlace = (p: GeocodePlace) =>
  [p.country, p.state, p.city].filter(Boolean).join(' · ')

const MapScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clusterIndexRef = useRef<Supercluster | null>(null)
  const didCenterOnUserRef = useRef(false)

  const [region, setRegion] = useState<Region>(INITIAL_REGION)
  const [markers, setMarkers] = useState<MountainMarker[]>([])
  const [loadingMarkers, setLoadingMarkers] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSections, setSearchSections] = useState<SearchSection[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<MountainMarker | null>(null)
  const [userCoords, setUserCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('opentopomap')
  const [layersOpen, setLayersOpen] = useState(false)

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const insets = useSafeAreaInsets()
  const route = useRoute()
  const pickMode = !!(
    route.params as { pickMode?: boolean } | undefined
  )?.pickMode

  const nativeMapType = resolveNativeMapType(mapStyle)
  const tileUrl = resolveTileUrl(mapStyle)

  const zoom = Math.max(
    0,
    Math.min(16, Math.floor(Math.log2(360 / region.longitudeDelta)))
  )

  const clusterIndex = useMemo(() => {
    const index = new Supercluster({ radius: 50, maxZoom: 14, minZoom: 0 })
    index.load(
      markers.map((m) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [m.longitude, m.latitude]
        },
        properties: m
      })) as any
    )
    clusterIndexRef.current = index
    return index
  }, [markers])

  const clusters = useMemo(() => {
    if (markers.length === 0) return []
    const west = region.longitude - region.longitudeDelta / 2
    const east = region.longitude + region.longitudeDelta / 2
    const south = region.latitude - region.latitudeDelta / 2
    const north = region.latitude + region.latitudeDelta / 2
    return clusterIndex.getClusters([west, south, east, north], zoom) as any[]
  }, [clusterIndex, region, zoom, markers])

  const fetchMarkersInBounds = useCallback(async (region: Region) => {
    const north = region.latitude + region.latitudeDelta / 2
    const south = region.latitude - region.latitudeDelta / 2
    const east = region.longitude + region.longitudeDelta / 2
    const west = region.longitude - region.longitudeDelta / 2

    setLoadingMarkers(true)
    try {
      const url = `${API_CONFIG.BASE_URL}/api/public/mountains/get-mountain-in-bounds?north=${north.toFixed(6)}&south=${south.toFixed(6)}&east=${east.toFixed(6)}&west=${west.toFixed(6)}&limit=30`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json()
      setMarkers((data.results || []) as MountainMarker[])
    } catch (_) {
      // Ignore network errors — markers simply won't update
    } finally {
      setLoadingMarkers(false)
      setHasFetched(true)
    }
  }, [])

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim()
      if (q.length < 3) {
        setSearchSections([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      try {
        // In pick mode the input only jumps to a place (geocoding) — no
        // mountain search; peaks are picked straight from the map markers.
        const placesRes = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/geocode/search?q=${encodeURIComponent(q)}&limit=5`
        )
        const places: GeocodePlace[] = placesRes.ok
          ? (await placesRes.json()).results || []
          : []
        if (pickMode) {
          setSearchSections(buildSearchSections([], places))
        } else {
          const mountainsRes = await fetch(
            `${API_CONFIG.BASE_URL}/api/public/mountains/search?query=${encodeURIComponent(q)}`
          )
          const mountains: MountainMarker[] = mountainsRes.ok
            ? (await mountainsRes.json()).results || []
            : []
          setSearchSections(buildSearchSections(mountains, places))
        }
      } catch (_) {
        setSearchSections([])
      } finally {
        setIsSearching(false)
      }
    },
    [pickMode]
  )

  // Debounced live search as the user types
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (searchQuery.trim().length < 3) {
      setSearchSections([])
      setIsSearching(false)
      return
    }
    searchTimeoutRef.current = setTimeout(() => runSearch(searchQuery), 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery, runSearch])

  useEffect(() => {
    fetchMarkersInBounds(INITIAL_REGION)
  }, [fetchMarkersInBounds])

  const onRegionChangeComplete = useCallback(
    (r: Region) => {
      setRegion(r)
      if (boundsTimeoutRef.current) clearTimeout(boundsTimeoutRef.current)
      boundsTimeoutRef.current = setTimeout(() => fetchMarkersInBounds(r), 400)
    },
    [fetchMarkersInBounds]
  )

  // Request location once — center the map on the user without showing the
  // map's built-in marker.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted' || !active) return
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        })
        if (!active) return
        const coordinate = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }
        setUserCoords(coordinate)
        if (didCenterOnUserRef.current) return
        didCenterOnUserRef.current = true
        const userRegion: Region = {
          ...coordinate,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5
        }
        setRegion(userRegion)
        mapRef.current?.animateToRegion(userRegion, 800)
      } catch (_) {
        // Location unavailable — fall back to the default region
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const goToUserLocation = useCallback(() => {
    if (!userCoords) return
    mapRef.current?.animateToRegion(
      {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      },
      800
    )
  }, [userCoords])

  const expandCluster = useCallback(
    (clusterId: number, latitude: number, longitude: number) => {
      const index = clusterIndexRef.current
      const expansionZoom = index
        ? index.getClusterExpansionZoom(clusterId)
        : zoom + 2
      const z = Math.min(expansionZoom + 2, 16)
      const delta = 360 / Math.pow(2, z)
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: delta,
          longitudeDelta: delta
        },
        600
      )
    },
    [zoom]
  )

  const selectMountain = useCallback((mountain: MountainMarker) => {
    setSelected(mountain)
    setSearchSections([])
    setSearchQuery('')
    Keyboard.dismiss()
  }, [])

  const searchSelect = useCallback((mountain: MountainMarker) => {
    setSelected(mountain)
    setSearchSections([])
    setSearchQuery('')
    Keyboard.dismiss()
    mapRef.current?.animateToRegion(
      {
        latitude: mountain.latitude,
        longitude: mountain.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      },
      700
    )
  }, [])

  // A geocoded place → move the map view to that location (no mountain
  // selected), matching the web app's place search.
  const selectPlace = useCallback((place: GeocodePlace) => {
    setSelected(null)
    setSearchSections([])
    setSearchQuery('')
    Keyboard.dismiss()
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1
      },
      700
    )
  }, [])

  // "Use my current location" row in the search results.
  const useMyLocation = useCallback(() => {
    Keyboard.dismiss()
    setSearchSections([])
    setSearchQuery('')
    const center = (coords: { latitude: number; longitude: number }) => {
      mapRef.current?.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        },
        700
      )
    }
    if (userCoords) {
      center(userCoords)
      return
    }
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        })
        const coordinate = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }
        setUserCoords(coordinate)
        center(coordinate)
      } catch (_) {
        // Location unavailable
      }
    })()
  }, [userCoords])

  const openMountain = useCallback(
    (mountain: MountainMarker) => {
      if (!mountain.canonical_url) return
      navigation.navigate('Mountain', {
        canonicalUrl: mountain.canonical_url
      })
    },
    [navigation]
  )

  const formatElevation = (m: number | null) =>
    m == null ? null : `${m.toLocaleString()}m`

  const subtitle = (m: MountainMarker) =>
    [m.country_name, m.region_name].filter(Boolean).join(', ')

  return (
    <View style={styles.container}>
      {/* Pick-mode header */}
      {pickMode && (
        <View
          style={[styles.pickHeader, { paddingTop: insets.top + spacing.sm }]}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.pickBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={styles.pickTitle} numberOfLines={1}>
            Pick a mountain
          </Text>
          <View style={styles.pickBack} />
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={() => setSelected(null)}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        mapType={nativeMapType}
        userInterfaceStyle="dark"
        customMapStyle={
          nativeMapType === 'standard' ? DARK_MAP_STYLE : undefined
        }
        showsCompass={false}
      >
        {tileUrl && (
          <UrlTile
            urlTemplate={tileUrl}
            maximumZ={19}
            zIndex={-1}
            opacity={mapStyle === 'satelliteTopo' ? 0.4 : 1}
            shouldReplaceMapContent={
              Platform.OS === 'ios' && mapStyle === 'opentopomap'
            }
          />
        )}

        {clusters.map((feature: any) => {
          const [lng, lat] = feature.geometry.coordinates
          const isCluster = feature.properties.cluster

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${feature.id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                onPress={() =>
                  expandCluster(feature.properties.cluster_id, lat, lng)
                }
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[
                    styles.clusterBubble,
                    {
                      width: Math.min(
                        48,
                        20 + feature.properties.point_count * 2
                      ),
                      height: Math.min(
                        48,
                        20 + feature.properties.point_count * 2
                      )
                    }
                  ]}
                >
                  <Text style={styles.clusterCount}>
                    {feature.properties.point_count > 99
                      ? '99+'
                      : feature.properties.point_count}
                  </Text>
                </View>
              </Marker>
            )
          }

          const mountain = feature.properties as MountainMarker
          const isSelected = selected?.id === mountain.id
          const iconSize = getMarkerSize(mountain.elevation_m)
          const selectedSize = iconSize + 8
          return (
            <Marker
              key={mountain.id}
              coordinate={{
                latitude: mountain.latitude,
                longitude: mountain.longitude
              }}
              onPress={() => selectMountain(mountain)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerShadow}>
                {isSelected && (
                  <View
                    style={[
                      {
                        width: selectedSize + 20,
                        height: selectedSize + 20,
                        borderRadius: (selectedSize + 16) / 2,
                        top: -8,
                        left: -8,
                        position: 'absolute'
                      }
                    ]}
                  />
                )}
                <MountainIcon
                  size={isSelected ? selectedSize : iconSize}
                  color={
                    isSelected
                      ? colors.accent.green
                      : getMarkerColor(mountain.elevation_m)
                  }
                />
              </View>
            </Marker>
          )
        })}

        {userCoords && (
          <Marker
            coordinate={{
              latitude: userCoords.latitude,
              longitude: userCoords.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Search bar + results overlay */}
      <SafeAreaView
        edges={pickMode ? [] : ['top']}
        style={[
          styles.searchSafeArea,
          pickMode && { top: insets.top + PICK_HEADER_HEIGHT }
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              pickMode
                ? 'Jump to a place...'
                : 'Search for a peak or place...'
            }
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                setSearchSections([])
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {isSearching ? (
          <View style={styles.resultsPanel}>
            <ActivityIndicator size="small" color={colors.accent.green} />
            <Text style={styles.resultsHint}>
              {pickMode ? 'Searching places...' : 'Searching peaks & places...'}
            </Text>
          </View>
        ) : searchQuery.trim().length > 0 && searchQuery.trim().length < 3 ? (
          <View style={styles.resultsPanel}>
            <Text style={styles.resultsHint}>Type at least 3 characters</Text>
          </View>
        ) : searchSections.length > 0 ? (
          <FlatList
            style={styles.resultsList}
            data={searchSections}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return <Text style={styles.resultHeader}>{item.label}</Text>
              }
              if (item.type === 'location') {
                return (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={useMyLocation}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons
                        name="locate"
                        size={16}
                        color={colors.accent.green}
                      />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>
                        Use my current location
                      </Text>
                      <Text style={styles.resultSubtitle}>
                        Center the map on where you are
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              }
              if (item.type === 'place') {
                const place = item.place
                return (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => selectPlace(place)}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons
                        name="location"
                        size={16}
                        color={colors.text.tertiary}
                      />
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      {subtitlePlace(place) ? (
                        <Text style={styles.resultSubtitle} numberOfLines={1}>
                          {subtitlePlace(place)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )
              }
              const mountain = item.mountain
              return (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => searchSelect(mountain)}
                >
                  <View style={styles.resultIcon}>
                    <Ionicons
                      name="trail-sign"
                      size={16}
                      color={colors.text.tertiary}
                    />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {mountain.name}
                    </Text>
                    {subtitle(mountain) ? (
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {subtitle(mountain)}
                      </Text>
                    ) : null}
                  </View>
                  {mountain.elevation_m != null && (
                    <Text style={styles.resultElevation}>
                      {formatElevation(mountain.elevation_m)}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        ) : searchQuery.trim().length >= 3 ? (
          <View style={styles.resultsPanel}>
            <Text style={styles.resultsHint}>
              {pickMode ? 'No places found' : 'No peaks or places found'}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Backdrop to close the layers panel when tapping outside of it */}
      {layersOpen && (
        <Pressable
          style={styles.layersBackdrop}
          onPress={() => setLayersOpen(false)}
        />
      )}

      {/* Map controls — hidden while a mountain is selected */}
      {!selected && (
        <View style={styles.mapControls}>
          {layersOpen && (
            <View style={styles.layersPanel}>
              {MAP_STYLE_OPTIONS.map((option) => {
                const isActive = mapStyle === option.key
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.layerOption,
                      isActive && styles.layerOptionActive
                    ]}
                    onPress={() => {
                      setMapStyle(option.key)
                      setLayersOpen(false)
                    }}
                  >
                    <Text
                      style={[
                        styles.layerOptionText,
                        isActive && styles.layerOptionTextActive
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.mapControlButton]}
            onPress={() => setLayersOpen((v) => !v)}
          >
            <Ionicons
              name={layersOpen ? 'layers' : 'layers-outline'}
              size={20}
              color={layersOpen ? colors.accent.green : colors.text.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={goToUserLocation}
          >
            <Ionicons name="locate" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Loading badge */}
      {loadingMarkers && !selected && (
        <View style={styles.loadingBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.text.tertiary} />
          <Text style={styles.loadingBadgeText}>
            {markers.length} peaks found
          </Text>
        </View>
      )}

      {/* No peaks in view — same message as the web app */}
      {hasFetched && !loadingMarkers && markers.length === 0 && (
        <View style={styles.emptyState} pointerEvents="none">
          <View style={styles.emptyStateCard}>
            <MountainIcon size={28} color="rgba(255, 255, 255, 0.12)" />
            <Text style={styles.emptyStateTitle}>No peaks in view</Text>
            <Text style={styles.emptyStateBody}>Move the map to explore.</Text>
          </View>
        </View>
      )}

      {/* Selected mountain card */}
      {selected && (
        <View style={styles.selectedCard}>
          <TouchableOpacity
            style={styles.selectedMain}
            activeOpacity={0.8}
            onPress={() =>
              pickMode
                ? navigation.navigate('LogClimb', {
                    mountainId: selected.id,
                    mountainName: selected.name
                  })
                : openMountain(selected)
            }
          >
            {selected.banner_path ? (
              <Image
                source={{ uri: getImageUrl(selected.banner_path) }}
                style={styles.selectedImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.selectedImagePlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={26}
                  color={colors.text.tertiary}
                />
              </View>
            )}
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={styles.selectedSubtitle} numberOfLines={1}>
                {[formatElevation(selected.elevation_m), subtitle(selected)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.selectedClose}
            onPress={() => setSelected(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
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
  map: {
    ...StyleSheet.absoluteFillObject
  },
  searchSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base
  },
  pickHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(21, 23, 32, 0.92)'
  },
  pickBack: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pickTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d'
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary
  },
  resultsPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: '#15181d'
  },
  resultsHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  resultsList: {
    marginTop: spacing.sm,
    maxHeight: 340,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: '#15181d',
    overflow: 'hidden'
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.background.pill
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
  resultHeader: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.quaternary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle
  },
  resultElevation: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.accent.green,
    marginLeft: spacing.md
  },
  markerShadow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  userLocationMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userLocationDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: colors.white
  },
  clusterBubble: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b45309', // amber-700
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.5)', // amber-500/50
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  clusterCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff'
  },
  loadingBadge: {
    position: 'absolute',
    bottom: 20,
    left: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d'
  },
  loadingBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: 'rgba(26, 29, 36, 0.95)',
    maxWidth: 260
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.sm
  },
  emptyStateBody: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2
  },
  layersBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  mapControls: {
    position: 'absolute',
    right: spacing.base,
    bottom: 20,
    alignItems: 'flex-end',
    gap: spacing.sm
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d',
    alignItems: 'center',
    justifyContent: 'center'
  },
  layersPanel: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d',
    overflow: 'hidden',
    marginBottom: spacing.xs
  },
  layerOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  layerOptionActive: {
    backgroundColor: colors.accent.greenSoft
  },
  layerOptionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary
  },
  layerOptionTextActive: {
    color: colors.accent.green
  },
  selectedCard: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d'
  },
  selectedMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  selectedClose: {
    marginLeft: spacing.sm
  },
  selectedImage: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginRight: spacing.md
  },
  selectedImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  selectedInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  selectedName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize'
  },
  selectedSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2
  }
})

export default MapScreen
