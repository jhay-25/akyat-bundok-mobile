import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  ScrollView
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { ClimbLog } from '../types'
import getImageUrl from '../utils/getImageUrl'
import { VALIDATION } from '../constants'
import { colors } from '../theme/colors'
import { RootStackParamList } from '../navigation/types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface ClimbLogCardProps {
  log: ClimbLog
  showUser?: boolean
}

export const ClimbLogCard: React.FC<ClimbLogCardProps> = ({
  log,
  showUser = true
}) => {
  const [showFullReport, setShowFullReport] = useState(false)
  const [imagesExpanded, setImagesExpanded] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { mountain, user, log_images, climb_report, climb_date } = log
  const hasImages = log_images.length > 0
  const hasClimbReport = Boolean(climb_report)

  // Get countries from the mountain's countries array
  const countries = mountain.countries?.map((c) => c.country) || []

  const formattedDate = climb_date
    ? new Date(climb_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Unspecified'

  // Determine display name: prioritize given name + family name, then given name, then username
  const displayName = user.given_name
    ? user.family_name
      ? `${user.given_name} ${user.family_name}`
      : user.given_name
    : `@${user.username}`

  const shouldTruncate =
    (climb_report?.length ?? 0) > VALIDATION.TRUNCATE_LENGTH
  const displayReport =
    shouldTruncate && !showFullReport
      ? climb_report?.substring(0, VALIDATION.TRUNCATE_LENGTH)
      : climb_report

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => navigation.navigate('Log', { logId: log.id })}
      >
        {showUser && (
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                {user.image_path ? (
                  <Image
                    source={{ uri: getImageUrl(user.image_path) }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {user.username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.displayName}>{displayName}</Text>
                <Text
                  style={styles.metaLine}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formattedDate}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Image / elevation placeholder — matches the web LogCard */}
        {hasImages ? (
          <View style={styles.imageSection}>
            <TouchableOpacity
              style={styles.imageWrapper}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.95}
            >
              <Image
                source={{ uri: getImageUrl(log_images[0].image_path) }}
                style={styles.image}
                resizeMode="cover"
              />
              {/* Elevation badge (top-left) */}
              <View style={styles.elevationBadge}>
                <Text style={styles.elevationBadgeText}>
                  {mountain.elevation_m
                    ? `${mountain.elevation_m.toLocaleString()}m`
                    : '—'}
                </Text>
              </View>
              {/* Photo count toggle (bottom-right) */}
              {log_images.length > 1 && (
                <TouchableOpacity
                  style={styles.imageCountButton}
                  onPress={() => setImagesExpanded((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.imageCountButtonText}>
                    {imagesExpanded
                      ? 'Collapse'
                      : `+${log_images.length - 1} more`}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {/* Expanded images (inline, like the web) */}
            {imagesExpanded &&
              log_images.slice(1).map((image) => (
                <View key={image.id} style={styles.expandedImageWrapper}>
                  <Image
                    source={{ uri: getImageUrl(image.image_path) }}
                    style={styles.expandedImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderElevation}>
              {mountain.elevation_m
                ? mountain.elevation_m.toLocaleString()
                : '—'}
            </Text>
            <Text style={styles.placeholderLabel}>meters</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.contentSection}>
          <Text style={styles.mountainName} numberOfLines={1}>
            {mountain.name}
          </Text>

          <Text style={styles.dateText}>{formattedDate}</Text>

          {countries.length > 0 && (
            <View style={styles.countriesRow}>
              {countries.map((c) => (
                <View key={c.id} style={styles.countryChip}>
                  <Text style={styles.countryChipText}>{c.name}</Text>
                </View>
              ))}
            </View>
          )}

          {hasClimbReport && (
            <View style={styles.reportContainer}>
              <Text style={styles.reportText}>
                {displayReport}
                {shouldTruncate && (
                  <Text
                    style={styles.seeMoreText}
                    onPress={() => setShowFullReport(!showFullReport)}
                  >
                    {showFullReport ? ' less' : '...more'}
                  </Text>
                )}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalCounter}>
              {currentImageIndex + 1} / {log_images.length}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH
              )
              setCurrentImageIndex(index)
            }}
            scrollEventThrottle={16}
          >
            {log_images.map((image, index) => (
              <View key={image.id} style={styles.modalImageContainer}>
                <Image
                  source={{ uri: getImageUrl(image.image_path) }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    marginBottom: 4
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 40,
    height: 40
  },
  avatarText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700'
  },
  userDetails: {
    flex: 1
  },
  displayName: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'capitalize'
  },
  metaLine: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '400',
    letterSpacing: 0.3
  },
  contentSection: {
    padding: 12
  },
  mountainName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
    textTransform: 'capitalize'
  },
  dateText: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4
  },
  countriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  countryChip: {
    backgroundColor: colors.background.pill,
    borderWidth: 1,
    borderColor: colors.border.pill,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  countryChipText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500'
  },
  imageSection: {
    position: 'relative'
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.background.card,
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  elevationBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.overlay.image,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  elevationBadgeText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600'
  },
  imageCountButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.overlay.icon,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  imageCountButtonText: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '600'
  },
  expandedImageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle
  },
  expandedImage: {
    width: '100%',
    height: '100%'
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#1e2130',
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderElevation: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.text.primary,
    fontVariant: ['tabular-nums']
  },
  placeholderLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.text.tertiary,
    fontWeight: '600',
    marginTop: 4
  },
  reportContainer: {
    marginTop: 8
  },
  reportText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20
  },
  seeMoreText: {
    color: colors.accent.green,
    fontWeight: '600'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.overlay.modal,
    justifyContent: 'center'
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10
  },
  modalCounter: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600'
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '300'
  },
  modalImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT
  }
})
