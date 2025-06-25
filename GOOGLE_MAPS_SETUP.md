# Google Maps API Setup Guide

## 🗝️ **Step 1: Get Your Google Maps API Key**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps SDK for iOS**
   - **Maps SDK for Android**
   - **Places API**
   - **Geocoding API**

4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key

## 🔒 **Step 2: Configure API Key**

1. Open the `.env` file in your project root
2. Replace `your_google_maps_api_key_here` with your actual API key:
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyC4E1Dz4W3qN1QyXyYzGaQm5aBc123456
```

3. Open `app.json` and replace both instances of `your_google_maps_api_key_here` with your API key

## 🛡️ **Step 3: Secure Your API Key (Recommended)**

1. In Google Cloud Console, go to your API key
2. Click **Restrict Key**
3. Under **Application restrictions**, select:
   - **iOS apps** → Add your bundle identifier
   - **Android apps** → Add your package name and SHA-1 certificate

## 📱 **Step 4: Test the Integration**

1. Restart your Expo development server:
```bash
npx expo start
```

2. Test the following features:
   - ✅ Map displays correctly
   - ✅ Address autocomplete works in "From" field
   - ✅ Address autocomplete works in "Where to?" field
   - ✅ Map markers appear when locations are selected
   - ✅ Map zooms to show both pickup and destination

## 🚨 **Troubleshooting**

### "Map not displaying"
- Check that your API key is correct in both `.env` and `app.json`
- Ensure Maps SDK for iOS/Android are enabled

### "Autocomplete not working"
- Verify Places API is enabled
- Check console for API key errors

### "Network request failed"
- Make sure your API key has proper permissions
- Check if billing is enabled (Google requires billing for Places API)

## 💡 **Features Included**

- 🗺️ **Interactive Google Maps** with real-time rendering
- 📍 **Address Autocomplete** with Google Places API
- 📌 **Location Markers** for pickup and destination
- 🔍 **Auto-zoom** to fit both locations on map
- 🎯 **Current Location** detection
- 🔒 **Secure API Key** storage

Your ride-hailing app now has professional-grade location services! 