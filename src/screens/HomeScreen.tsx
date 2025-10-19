import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native'
import { useAuth } from '../contexts/AuthContext'

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
    backgroundColor: '#151728' // main-500 (dark background)
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  header: {
    alignItems: 'center',
    marginBottom: 60
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F9F6F2', // brown-10 (light text)
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 18,
    color: '#CDAD87', // brown-50 (light text)
    textAlign: 'center'
  },
  body: {
    alignItems: 'center',
    marginBottom: 60
  },
  bodyText: {
    fontSize: 16,
    color: '#F4EDE4', // brown-20 (light text)
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24
  },
  signOutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1
  }
})

export default HomeScreen
