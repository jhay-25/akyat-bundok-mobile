// App config — starts from app.json and injects secrets from the environment.
// The Google Maps key is read from GOOGLE_MAPS_API_KEY (set locally in .env,
// and in CI as a GitHub secret). It is never committed.
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: 'com.akyatbundok.app',
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    }
  }
})
