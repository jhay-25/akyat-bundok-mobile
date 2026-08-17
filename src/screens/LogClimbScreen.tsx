import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Switch
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { RootStackParamList } from '../navigation/types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import getImageUrl from '../utils/getImageUrl'
import { supabase } from '../utils/supabase'
import { useAuth } from '../contexts/AuthContext'

type LogClimbRoute = RouteProp<RootStackParamList, 'LogClimb' | 'LogUpdate'>
type LogClimbNav = StackNavigationProp<
  RootStackParamList,
  'LogClimb' | 'LogUpdate'
>

interface ExistingLogImage {
  id: string
  image_path: string
}

interface LogClimbParams {
  mountainId?: string
  mountainName?: string
  logId?: string
}

const MAX_IMAGES = 5

const formatDisplayDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

const LogClimbScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<LogClimbRoute>()
  const navigation = useNavigation<LogClimbNav>()
  const params = route.params as LogClimbParams
  const { mountainId, mountainName, logId } = params
  const isEdit = !!logId
  const { session, user } = useAuth()

  const [logMountainId, setLogMountainId] = useState(mountainId || '')
  const [mountainNameDisplay, setMountainNameDisplay] = useState(
    mountainName || ''
  )
  const [dateRemembered, setDateRemembered] = useState(false)
  const [climbDate, setClimbDate] = useState<Date>(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [report, setReport] = useState('')
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([])
  const [existingImages, setExistingImages] = useState<ExistingLogImage[]>([])
  const [gpx, setGpx] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null
  )
  const [hasExistingGpx, setHasExistingGpx] = useState(false)
  const [existingGpxPath, setExistingGpxPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const toggleDate = (value: boolean) => {
    setDateRemembered(value)
    if (value) setClimbDate(new Date())
  }

  // Edit mode — prefill the form from the existing log
  useEffect(() => {
    if (!isEdit || !logId) return
    let active = true
    ;(async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('logs')
          .select(
            `*,
            mountain: mountain_id(name),
            log_images(*),
            log_routes(gpx_path, is_uploaded)
            `
          )
          .eq('id', logId)
          .single()
        if (!active) return
        if (queryError || !data) {
          Alert.alert(
            'Failed to load climb',
            queryError?.message || 'Climb not found'
          )
          return
        }
        setLogMountainId(data.mountain_id)
        setMountainNameDisplay(data.mountain?.name || '')
        setReport(data.climb_report || '')
        if (data.climb_date) {
          setDateRemembered(true)
          setClimbDate(new Date(data.climb_date))
        }
        setExistingImages(
          ((data.log_images || []) as any[]).filter(
            (img) => img.is_uploaded != null
          )
        )
        const route = ((data.log_routes || []) as any[]).find(
          (r) => r.is_uploaded
        )
        setHasExistingGpx(!!route)
        setExistingGpxPath(route?.gpx_path ?? null)
      } catch (e) {
        if (active) {
          Alert.alert(
            'Failed to load climb',
            e instanceof Error ? e.message : 'Something went wrong'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, logId])

  const removeExistingImage = async (image: ExistingLogImage) => {
    if (!session) return
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('Delete this photo?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => resolve(true)
        }
      ])
    })
    if (!confirmed) return
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/api/logs/image/${image.image_path}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      )
      if (!res.ok) throw new Error('Failed to delete photo')
      setExistingImages((prev) => prev.filter((i) => i.id !== image.id))
    } catch (e) {
      Alert.alert(
        'Delete failed',
        e instanceof Error ? e.message : 'Something went wrong'
      )
    }
  }

  const removeExistingGpx = () => {
    if (!session || !existingGpxPath) return
    Alert.alert('Delete this GPX route?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(
              `${API_CONFIG.BASE_URL}/api/logs/gpx/${existingGpxPath}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              }
            )
            if (!res.ok) throw new Error('Failed to delete GPX route')
            setHasExistingGpx(false)
            setExistingGpxPath(null)
          } catch (e) {
            Alert.alert(
              'Delete failed',
              e instanceof Error ? e.message : 'Something went wrong'
            )
          }
        }
      }
    ])
  }

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1
    })

    if (!result.canceled) {
      setImages((prev) => {
        const combined = [...prev, ...result.assets]
        if (existingImages.length + combined.length > MAX_IMAGES) {
          Alert.alert('Limit', `You can add up to ${MAX_IMAGES} photos.`)
          return prev
        }
        return combined
      })
    }
  }

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((i) => i.uri !== uri))
  }

  const pickGpx = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true
    })
    if (!result.canceled) {
      setGpx(result.assets[0])
    }
  }

  const uploadFile = async (
    signedUrl: string,
    uri: string,
    contentType: string,
    userId: string
  ) => {
    const blob = await (await fetch(uri)).blob()
    await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-meta-user-id': userId
      },
      body: blob
    })
  }

  const submit = async () => {
    if (!session || !user) {
      Alert.alert('Sign in required', 'You need to be signed in to log climbs.')
      return
    }
    if (isEdit && !logId) return

    setSaving(true)
    try {
      const climbDateIso = dateRemembered
        ? new Date(
            climbDate.getFullYear(),
            climbDate.getMonth(),
            climbDate.getDate(),
            12,
            0,
            0
          ).toISOString()
        : null

      const body = {
        mountain_id: logMountainId,
        climb_report: report.trim() || null,
        climb_date: climbDateIso,
        images:
          images.length > 0
            ? images.map((img) => ({
                url: img.uri,
                contentType: img.mimeType || 'image/jpeg',
                contentLength: img.fileSize || 0
              }))
            : null,
        gpx: gpx
          ? {
              fileName: gpx.name || 'route.gpx',
              contentType: gpx.mimeType || 'application/gpx+xml',
              contentLength: gpx.size || 0
            }
          : null
      }

      const res = await fetch(
        isEdit
          ? `${API_CONFIG.BASE_URL}/api/logs/${logId}`
          : `${API_CONFIG.BASE_URL}/api/logs`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(body)
        }
      )

      if (!res.ok) {
        Alert.alert('Failed', await res.text())
        return
      }

      const data = await res.json()
      const savedLogId = data.log?.id || data.id || logId

      // Upload GPX file, then mark it as uploaded
      if (gpx && data.gpxSignedUrl) {
        await uploadFile(
          data.gpxSignedUrl,
          gpx.uri,
          gpx.mimeType || 'application/gpx+xml',
          user.id
        )
        await fetch(`${API_CONFIG.BASE_URL}/api/logs/gpx/uploaded`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ log_id: savedLogId, key: data.gpxKey })
        })
      }

      // Upload images, then attach them to the log
      if (images.length > 0 && data.signedUrls) {
        await Promise.all(
          images.map((img, idx) =>
            uploadFile(
              data.signedUrls[idx],
              img.uri,
              img.mimeType || 'image/jpeg',
              user.id
            )
          )
        )
        await fetch(`${API_CONFIG.BASE_URL}/api/logs/image/${savedLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            log_id: savedLogId,
            log_images_path: data.logImagesPath
          })
        })
      }

      Alert.alert('Success', isEdit ? 'Climb updated!' : 'Climb logged!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Climb' : 'Log Climb'}
        </Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>I climbed...</Text>
          <Text style={styles.mountainName}>{mountainNameDisplay}</Text>

          {/* Remember the date toggle */}
          <View style={styles.dateRow}>
            <Switch
              value={dateRemembered}
              onValueChange={toggleDate}
              trackColor={{
                false: colors.border.strong,
                true: colors.accent.green
              }}
              thumbColor={dateRemembered ? '#ffffff' : '#f4f3f4'}
            />
            <Text style={styles.dateRowText}>
              {dateRemembered ? 'Climbed on' : 'Remember the date?'}
            </Text>
          </View>

          {dateRemembered && (
            <>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={climbDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_event, selected) => {
                    if (selected) setClimbDate(selected)
                  }}
                  style={styles.datePicker}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowPicker(true)}
                    disabled={saving}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.text.secondary}
                    />
                    <Text style={styles.dateButtonText}>
                      {formatDisplayDate(climbDate)}
                    </Text>
                  </TouchableOpacity>
                  {showPicker && (
                    <DateTimePicker
                      value={climbDate}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={(event, selected) => {
                        setShowPicker(false)
                        if (event.type === 'set' && selected) {
                          setClimbDate(selected)
                        }
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}

          <Text style={styles.label}>Trip Report</Text>
          <TextInput
            style={[styles.input, styles.reportInput]}
            placeholder="How was it?"
            placeholderTextColor={colors.text.tertiary}
            value={report}
            onChangeText={setReport}
            multiline
            editable={!saving}
          />

          {/* Photos */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.counter}>
              {existingImages.length + images.length}/{MAX_IMAGES}
            </Text>
          </View>
          <View style={styles.photoGrid}>
            {existingImages.map((img) => (
              <View key={img.id} style={styles.photoTile}>
                <Image
                  source={{ uri: getImageUrl(img.image_path) }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removeExistingImage(img)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {images.map((img) => (
              <View key={img.uri} style={styles.photoTile}>
                <Image
                  source={{ uri: img.uri }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removeImage(img.uri)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            {existingImages.length + images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.addTile}
                onPress={pickImages}
                disabled={saving}
              >
                <Ionicons name="add" size={28} color={colors.text.tertiary} />
                <Text style={styles.addTileText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* GPX */}
          <Text style={styles.label}>GPX Route (optional)</Text>
          {gpx ? (
            <View style={styles.gpxRow}>
              <Ionicons
                name="trail-sign-outline"
                size={18}
                color={colors.accent.green}
              />
              <Text style={styles.gpxName} numberOfLines={1}>
                {gpx.name}
              </Text>
              <TouchableOpacity
                onPress={() => setGpx(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          ) : hasExistingGpx ? (
            <View style={styles.gpxRow}>
              <Ionicons
                name="trail-sign"
                size={18}
                color={colors.accent.green}
              />
              <Text style={styles.gpxName} numberOfLines={1}>
                Existing GPX route
              </Text>
              <TouchableOpacity
                onPress={removeExistingGpx}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={colors.error.text}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addGpx}
              onPress={pickGpx}
              disabled={saving}
            >
              <Ionicons name="add" size={18} color={colors.text.tertiary} />
              <Text style={styles.addGpxText}>Add GPX file</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submit, (saving || loading) && styles.disabled]}
            onPress={submit}
            disabled={saving || loading}
          >
            {saving ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.submitText}>
                {isEdit ? 'UPDATE' : 'SUBMIT'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: colors.background.primary
  },
  flex: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['5xl']
  },
  eyebrow: {
    fontSize: typography.fontSize.xxs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.text.tertiary,
    marginTop: spacing.sm
  },
  mountainName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    marginBottom: spacing.xl
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  dateRowText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg
  },
  dateButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary
  },
  datePicker: {
    marginBottom: spacing.lg
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.lg
  },
  reportInput: {
    minHeight: 120,
    textAlignVertical: 'top'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  counter: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  photoTile: {
    width: 92,
    height: 92,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.subtle
  },
  photoImage: {
    width: '100%',
    height: '100%'
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addTile: {
    width: 92,
    height: 92,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  addTileText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary
  },
  gpxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg
  },
  gpxName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary
  },
  addGpx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg
  },
  addGpxText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary
  },
  submit: {
    backgroundColor: colors.accent.green,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.sm
  },
  disabled: {
    opacity: 0.6
  },
  submitText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1
  }
})

export default LogClimbScreen
