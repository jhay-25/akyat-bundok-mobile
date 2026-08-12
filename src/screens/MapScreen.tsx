import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Image
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import Supercluster from 'supercluster'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import getImageUrl from '../utils/getImageUrl'
import { MountainIcon } from '../components/MountainIcon'

interface MountainMarker {
  id: string
  name: string
  elevation_m: number | null
  latitude: number
  longitude: number
  country_name: string | null
  region_name: string | null
  banner_path: string | null
}

const INITIAL_REGION: Region = {
  latitude: 12.8797,
  longitude: 121.774,
  latitudeDelta: 16,
  longitudeDelta: 16
}

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
function getMarkerColor(elevation: number | null): string {
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

const MapScreen: React.FC = () => {
  const mapRef = useRef<MapView>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boundsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clusterIndexRef = useRef<Supercluster | null>(null)
  const didCenterOnUserRef = useRef(false)

  const [region, setRegion] = useState<Region>(INITIAL_REGION)
  const [markers, setMarkers] = useState<MountainMarker[]>([])
  const [loadingMarkers, setLoadingMarkers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MountainMarker[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<MountainMarker | null>(null)
  const [userCoords, setUserCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [mapType, setMapType] = useState<
    'standard' | 'satellite' | 'hybrid' | 'terrain'
  >('standard')
  const [layersOpen, setLayersOpen] = useState(false)

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
    }
  }, [])

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (q.length < 3) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    try {
      const url = `${API_CONFIG.BASE_URL}/api/public/mountains/search?query=${encodeURIComponent(q)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setSearchResults((data.results || []) as MountainMarker[])
      }
    } catch (_) {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced live search as the user types
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (searchQuery.trim().length < 3) {
      setSearchResults([])
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
    setSearchResults([])
    setSearchQuery('')
    Keyboard.dismiss()
  }, [])

  const searchSelect = useCallback((mountain: MountainMarker) => {
    setSelected(mountain)
    setSearchResults([])
    setSearchQuery('')
    Keyboard.dismiss()
    mapRef.current?.animateToRegion(
      {
        latitude: mountain.latitude,
        longitude: mountain.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06
      },
      700
    )
  }, [])

  const formatElevation = (m: number | null) =>
    m == null ? null : `${m.toLocaleString()}m`

  const subtitle = (m: MountainMarker) =>
    [m.country_name, m.region_name].filter(Boolean).join(', ')

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        mapType={mapType}
        userInterfaceStyle="dark"
        customMapStyle={mapType === 'standard' ? DARK_MAP_STYLE : undefined}
        showsCompass={false}
      >
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
        edges={['top']}
        style={styles.searchSafeArea}
        pointerEvents="box-none"
      >
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for a mountain..."
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                setSearchResults([])
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
            <Text style={styles.resultsHint}>Searching peaks...</Text>
          </View>
        ) : searchQuery.trim().length > 0 && searchQuery.trim().length < 3 ? (
          <View style={styles.resultsPanel}>
            <Text style={styles.resultsHint}>Type at least 3 characters</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            style={styles.resultsList}
            data={searchResults.slice(0, 8)}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => searchSelect(item)}
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
                    {formatElevation(item.elevation_m)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        ) : searchQuery.trim().length >= 3 ? (
          <View style={styles.resultsPanel}>
            <Text style={styles.resultsHint}>No mountains found</Text>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Map controls */}
      <View style={styles.mapControls}>
        {layersOpen && (
          <View style={styles.layersPanel}>
            {(
              [
                { key: 'standard', label: 'Standard' },
                { key: 'satellite', label: 'Satellite' },
                { key: 'hybrid', label: 'Hybrid' },
                { key: 'terrain', label: 'Terrain' }
              ] as const
            ).map((option) => {
              const isActive = mapType === option.key
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.layerOption,
                    isActive && styles.layerOptionActive
                  ]}
                  onPress={() => {
                    setMapType(option.key)
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
          style={[
            styles.mapControlButton,
            layersOpen && styles.mapControlButtonActive
          ]}
          onPress={() => setLayersOpen((v) => !v)}
        >
          <Ionicons
            name={layersOpen ? 'layers' : 'layers-outline'}
            size={20}
            color={colors.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={goToUserLocation}
        >
          <Ionicons name="locate" size={20} color={colors.accent.green} />
        </TouchableOpacity>
      </View>

      {/* Loading badge */}
      {loadingMarkers && (
        <View style={styles.loadingBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.text.tertiary} />
          <Text style={styles.loadingBadgeText}>
            {markers.length} peaks found
          </Text>
        </View>
      )}

      {/* Selected mountain card */}
      {selected && (
        <View style={styles.selectedCard}>
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
          <TouchableOpacity
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
    bottom: 132,
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
  mapControls: {
    position: 'absolute',
    right: spacing.base,
    bottom: 132,
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
  mapControlButtonActive: {
    borderColor: colors.accent.greenBorder,
    backgroundColor: colors.accent.greenSoft
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
