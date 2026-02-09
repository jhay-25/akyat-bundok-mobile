import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../utils/supabase'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius, shadows } from '../theme'
import { VALIDATION } from '../constants'

interface Props {
  navigation: any
}

const UsernameSetupScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, signOut, refreshProfile } = useAuth()

  const validateUsername = (username: string): boolean => {
    // Check minimum length
    if (username.length < VALIDATION.MIN_USERNAME_LENGTH) {
      setError(
        `Username must be at least ${VALIDATION.MIN_USERNAME_LENGTH} characters`
      )
      return false
    }

    // Check maximum length
    if (username.length > VALIDATION.MAX_USERNAME_LENGTH) {
      setError(
        `Username must be no more than ${VALIDATION.MAX_USERNAME_LENGTH} characters`
      )
      return false
    }

    // Check alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]+$/
    if (!usernameRegex.test(username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return false
    }

    // Check doesn't start with number
    if (/^[0-9]/.test(username)) {
      setError('Username cannot start with a number')
      return false
    }

    setError('')
    return true
  }

  const handleSetUsername = async () => {
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    const trimmedUsername = username.trim().toLowerCase()

    if (!validateUsername(trimmedUsername)) {
      return
    }

    if (!user) {
      Alert.alert('Error', 'No user session found')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ username: trimmedUsername })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        if (
          error.message.includes('duplicate key') ||
          error.message.includes('users_username_key')
        ) {
          setError('This username is already taken. Please choose another.')
        } else {
          setError(error.message || 'Failed to set username')
        }
        setLoading(false)
        return
      }

      if (data) {
        // Refresh the profile to update the username in context
        await refreshProfile()

        // The RootNavigator will automatically redirect to MainTabs
        // when it detects the user now has a username
        Alert.alert(
          'Success!',
          'Your username has been set successfully. Welcome to AkyatBundok!'
        )
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to complete username setup when you sign in again.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut()
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Username</Text>
            <Text style={styles.subtitle}>
              Pick a unique username to complete your profile
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Username requirements:</Text>
              <Text style={styles.infoItem}>
                • {VALIDATION.MIN_USERNAME_LENGTH}-
                {VALIDATION.MAX_USERNAME_LENGTH} characters
              </Text>
              <Text style={styles.infoItem}>
                • Letters, numbers, and underscores only
              </Text>
              <Text style={styles.infoItem}>• Cannot start with a number</Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                placeholder="your_username"
                placeholderTextColor={colors.text.tertiary}
                value={username}
                onChangeText={(text) => {
                  setUsername(text)
                  setError('')
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={VALIDATION.MAX_USERNAME_LENGTH}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {username && !error ? (
                <Text style={styles.helperText}>
                  Your username will be: @{username.toLowerCase().trim()}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSetUsername}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>CONTINUE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              disabled={loading}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  keyboardAvoidingView: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl
  },
  header: {
    marginBottom: spacing['3xl']
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  infoBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.primary
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs
  },
  infoItem: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    marginTop: spacing.xs
  },
  form: {
    marginBottom: spacing['3xl']
  },
  inputContainer: {
    marginBottom: spacing.lg
  },
  label: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    ...shadows.sm
  },
  inputError: {
    borderColor: colors.error.border,
    borderWidth: 2
  },
  errorText: {
    color: colors.error.text,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.xs
  },
  helperText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.xs
  },
  submitButton: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.md
  },
  disabledButton: {
    opacity: 0.6
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.secondary
  },
  signOutButtonText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold
  }
})

export default UsernameSetupScreen
