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
import { ClimbLog } from '../types'
import getImageUrl from '../utils/getImageUrl'
import { VALIDATION } from '../constants'
import { colors } from '../theme/colors'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface ClimbLogCardProps {
  log: ClimbLog
}

export const ClimbLogCard: React.FC<ClimbLogCardProps> = ({ log }) => {
  const [showFullReport, setShowFullReport] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const { mountain, user, log_images, climb_report, climb_date } = log
  const hasImages = log_images.length > 0
  const hasClimbReport = Boolean(climb_report)
  const firstImage = log_images[0]

  // Get countries from the mountain's countries array
  const countries = mountain.countries?.map((c) => c.country) || []

  // Convert ISO code to flag emoji
  const getFlagEmoji = (isoCode: string) => {
    return isoCode
      .toUpperCase()
      .split('')
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join('')
  }

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
              {countries.length > 0 && (
                <>
                  {countries.map((country, index) => (
                    <React.Fragment key={country.id}>
                      {index > 0 && ' · '}
                      {country.name}
                    </React.Fragment>
                  ))}
                  <Text style={styles.metaSeparator}> • </Text>
                </>
              )}
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.mountainHeader}>
          <View style={styles.mountainInfo}>
            <Text style={styles.mountainName} numberOfLines={2}>
              {mountain.name}
            </Text>
          </View>
        </View>

        {hasImages && (
          <View style={styles.imageContainer}>
            <TouchableOpacity
              style={styles.imageWrapper}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.95}
            >
              <Image
                source={{ uri: getImageUrl(firstImage.image_path) }}
                style={styles.image}
                resizeMode="cover"
              />
              {log_images.length > 1 && (
                <View style={styles.imageCountOverlay}>
                  <Text style={styles.imageCountText}>
                    +{log_images.length - 1}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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
                  {showFullReport ? ' show less' : ' ...more'}
                </Text>
              )}
            </Text>
          </View>
        )}
      </View>

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
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary
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
  metaSeparator: {
    color: colors.text.quaternary
  },
  contentSection: {
    padding: 16
  },
  mountainHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16
  },
  mountainIcon: {
    fontSize: 20,
    marginTop: 2
  },
  mountainInfo: {
    flex: 1
  },
  mountainName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    textTransform: 'capitalize'
  },
  imageContainer: {
    marginBottom: 16
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  imageCountOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  imageCountText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600'
  },
  reportContainer: {
    paddingTop: 0
  },
  reportText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 24,
    letterSpacing: -0.1
  },
  seeMoreText: {
    color: colors.text.tertiary,
    fontWeight: '600',
    fontSize: 14
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
