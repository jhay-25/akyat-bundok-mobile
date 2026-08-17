import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import {
  parseGpxPoints,
  computeStats,
  GpxPoint,
  GpxStats
} from '../utils/gpxParser'

interface LogGpxCardProps {
  gpxPath: string
}

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label: string
  value: string
}

function StatItem({ icon, iconColor, label, value }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <View style={styles.statText}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  )
}

const LogGpxCard: React.FC<LogGpxCardProps> = ({ gpxPath }) => {
  const [points, setPoints] = useState<GpxPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const dlRes = await fetch(
          `${API_CONFIG.BASE_URL}/api/public/logs/gpx/download/${encodeURIComponent(gpxPath)}`
        )
        if (!dlRes.ok) throw new Error('Failed to load GPX route')
        const data = await dlRes.json()
        const url: string | undefined = data?.url
        if (!url) throw new Error('GPX file unavailable')

        const gpxRes = await fetch(url)
        if (!gpxRes.ok) throw new Error('Failed to download GPX')
        const xml = await gpxRes.text()
        const parsed = parseGpxPoints(xml)
        if (!active) return
        setPoints(parsed)
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Failed to load GPX route')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [gpxPath])

  const stats = useMemo<GpxStats>(() => computeStats(points), [points])

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={colors.accent.green} />
          <Text style={styles.stateText}>Loading route...</Text>
        </View>
      </View>
    )
  }

  if (error || points.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.stateBox}>
          <Ionicons
            name="trail-sign-outline"
            size={26}
            color={colors.text.tertiary}
          />
          <Text style={styles.stateText}>
            {error || 'No track points found in this GPX file.'}
          </Text>
        </View>
      </View>
    )
  }

  const distanceLabel =
    stats.distanceKm >= 1
      ? `${stats.distanceKm.toFixed(1)} km`
      : `${(stats.distanceKm * 1000).toFixed(0)} m`
  const gainLabel =
    stats.elevationGainM > 0 ? `${Math.round(stats.elevationGainM)} m` : '—'
  const lossLabel =
    stats.elevationLossM > 0 ? `${Math.round(stats.elevationLossM)} m` : '—'
  const rangeLabel =
    stats.maxElevationM > 0
      ? `${Math.round(stats.minElevationM)} m — ${Math.round(stats.maxElevationM)} m`
      : null

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        <StatItem
          icon="swap-horizontal"
          iconColor={colors.text.tertiary}
          label="Distance"
          value={distanceLabel}
        />
        <StatItem
          icon="trending-up"
          iconColor="#22c55e"
          label="Elevation Gain"
          value={gainLabel}
        />
        <StatItem
          icon="trending-down"
          iconColor="#f87171"
          label="Elevation Loss"
          value={lossLabel}
        />

        {rangeLabel && (
          <View style={styles.statWide}>
            <StatItem
              icon="swap-vertical"
              iconColor="#facc15"
              label="Elevation Range"
              value={rangeLabel}
            />
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: '#15181d',
    overflow: 'hidden'
  },
  stateBox: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 80
  },
  stateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.sm
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '50%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm
  },
  statWide: {
    width: '100%'
  },
  statText: {
    flex: 1,
    minWidth: 0
  },
  statValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary
  },
  statLabel: {
    fontSize: typography.fontSize.xxs,
    color: colors.text.tertiary,
    marginTop: 1
  }
})

export default LogGpxCard
