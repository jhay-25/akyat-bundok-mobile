import React, { useState } from 'react'
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
  ScrollView
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { RootStackParamList } from '../navigation/types'
import { API_CONFIG } from '../constants'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius } from '../theme'
import { useAuth } from '../contexts/AuthContext'

type LogClimbRoute = RouteProp<RootStackParamList, 'LogClimb'>
type LogClimbNav = StackNavigationProp<RootStackParamList, 'LogClimb'>

const LogClimbScreen: React.FC = () => {
  const insets = useSafeAreaInsets()
  const route = useRoute<LogClimbRoute>()
  const navigation = useNavigation<LogClimbNav>()
  const { mountainId, mountainName } = route.params
  const { session } = useAuth()

  const [climbDate, setClimbDate] = useState('')
  const [report, setReport] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!session) {
      Alert.alert('Sign in required', 'You need to be signed in to log climbs.')
      return
    }
    if (!climbDate.trim()) {
      Alert.alert('Missing date', 'Please enter the climb date (YYYY-MM-DD).')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mountain_id: mountainId,
          climb_report: report.trim() || null,
          climb_date: climbDate.trim(),
          images: null,
          gpx: null
        })
      })

      if (res.ok) {
        Alert.alert('Success', 'Climb logged!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ])
      } else {
        Alert.alert('Failed', await res.text())
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
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
        <Text style={styles.headerTitle}>Log Climb</Text>
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
          <Text style={styles.mountainName}>{mountainName}</Text>

          <Text style={styles.label}>Climb Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-01-01"
            placeholderTextColor={colors.text.tertiary}
            value={climbDate}
            onChangeText={setClimbDate}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          <Text style={styles.label}>Trip Report</Text>
          <TextInput
            style={[styles.input, styles.reportInput]}
            placeholder="Share your climb..."
            placeholderTextColor={colors.text.tertiary}
            value={report}
            onChangeText={setReport}
            multiline
            editable={!saving}
          />

          <TouchableOpacity
            style={[styles.submit, saving && styles.disabled]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <Text style={styles.submitText}>SAVE CLIMB</Text>
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
  mountainName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    marginTop: spacing.sm,
    marginBottom: spacing.xl
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
    minHeight: 140,
    textAlignVertical: 'top'
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
