import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../theme/colors'
import { spacing, typography, borderRadius, shadows } from '../theme'

const HomeScreen: React.FC = () => {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to AkyatBundok!</Text>
          <Text style={styles.subtitle}>Hello, {user?.email || 'Hiker'}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.bodyText}>
            🏔️ Ready to explore the mountains of the Philippines?
          </Text>
          <Text style={styles.bodyText}>
            Your hiking adventures start here!
          </Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>SIGN OUT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['5xl']
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center'
  },
  body: {
    alignItems: 'center',
    marginBottom: spacing['5xl']
  },
  bodyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 24
  },
  signOutButton: {
    backgroundColor: colors.error.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    alignItems: 'center',
    ...shadows.md
  },
  signOutButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1
  }
})

export default HomeScreen
