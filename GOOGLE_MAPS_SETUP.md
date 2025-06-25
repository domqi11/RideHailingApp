# Google Maps API Setup Guide

## Overview
Your ride-hailing app uses Google Maps APIs for enhanced location functionality:
- **Current Location Detection**: Uses Google's Reverse Geocoding API for better address formatting
- **Address Autocomplete**: Real-time address suggestions as users type
- **Address Validation**: Converts typed addresses to precise coordinates
- **Route Display**: Shows driving directions between pickup and destination points

## Required Google Cloud APIs

You need to enable these APIs in your Google Cloud Console:

1. **Geocoding API** - For current location detection and address validation
2. **Places API** - For address autocomplete suggestions
3. **Directions API** - For route calculation and display
4. **Maps SDK for iOS** - For iOS map display
5. **Maps SDK for Android** - For Android map display

## Setup Steps

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable billing (required for Maps APIs)

### 2. Enable Required APIs
1. Navigate to **APIs & Services > Library**
2. Search and enable each of these APIs:
   - Geocoding API
   - Places API
   - Directions API
   - Maps SDK for iOS
   - Maps SDK for Android

### 3. Create API Key
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the generated API key

### 4. Secure Your API Key (Recommended)
1. Click on your API key to edit it
2. Under **Application restrictions**, choose:
   - **iOS apps** and add your bundle identifier
   - **Android apps** and add your package name and SHA-1 certificate fingerprint
3. Under **API restrictions**, select "Restrict key" and choose only the APIs you enabled

### 5. Add API Key to Your Project

**⚠️ IMPORTANT: Never commit your API key to version control!**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open your `.env` file and replace the placeholder with your actual API key:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. The `.env` file is already in `.gitignore` and won't be committed to git

4. Restart your Expo development server:
   ```bash
   npx expo start --clear
   ```

## Environment Variable Setup

The app uses environment variables to securely store your API key:

- **`.env`** - Contains your actual API key (ignored by git)
- **`.env.example`** - Template showing required variables (committed to git)
- **`.gitignore`** - Ensures `.env` files are never committed

This approach ensures your API key stays secure and isn't accidentally shared.

## Testing the Setup

### With API Key Configured
- ✅ Current location shows proper street address
- ✅ Typing in destination shows autocomplete dropdown with Australian addresses
- ✅ Selecting from dropdown sets precise coordinates
- ✅ Manual address entry validates and geocodes
- ✅ Map displays route between pickup and destination
- ✅ Route info shows journey time and distance

### Without API Key
- ⚠️ Current location shows basic format from device GPS
- ⚠️ No autocomplete dropdown
- ⚠️ Manual address entry uses mock coordinates
- ⚠️ Warning message displayed in modal
- ⚠️ No route display on map

## Cost Considerations

Google Maps APIs are pay-per-use after free tier:
- **Geocoding API**: $5 per 1000 requests (2,500 free per month)
- **Places API Autocomplete**: $2.83 per 1000 requests (First 1000 free per month)
- **Directions API**: $5 per 1000 requests (2,500 free per month)

For development and moderate usage, costs are minimal.

## Security Best Practices

1. **✅ API key stored in `.env` file** (not committed to git)
2. **✅ Use application restrictions** to limit key usage to your app
3. **✅ Use API restrictions** to limit which APIs the key can access
4. **✅ Monitor usage** in Google Cloud Console
5. **✅ Set up billing alerts** to avoid unexpected charges
6. **❌ Never hardcode API keys** in source code
7. **❌ Never commit `.env` files** to version control

## Troubleshooting

### "No valid Google API key" in logs
- Check your `.env` file has the correct API key
- Ensure the variable name is exactly `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Restart Expo development server after adding the key

### No autocomplete suggestions
- Ensure Places API is enabled in Google Cloud Console
- Check API key has permission to use Places API
- Verify internet connection

### "API key denied" errors
- Check if billing is enabled (required for most Google Maps APIs)
- Verify API key restrictions allow your app
- Ensure all required APIs are enabled

### Current location shows "Permission Required"
- Grant location permissions when prompted
- Check device location services are enabled
- For iOS simulator, use Features > Location > Custom Location

### Route not displaying
- Ensure Directions API is enabled
- Check that both pickup and destination coordinates are valid
- Verify API key has permission to use Directions API

## API Endpoints Used

The app makes direct HTTP requests to these Google APIs:
- `https://maps.googleapis.com/maps/api/geocode/json` - Reverse geocoding and address validation
- `https://maps.googleapis.com/maps/api/place/autocomplete/json` - Address autocomplete
- `https://maps.googleapis.com/maps/api/place/details/json` - Get precise coordinates for selected places
- `https://maps.googleapis.com/maps/api/directions/json` - Get driving routes between locations

## Geographic Configuration

The app is configured for **Australia**:
- Address search is biased to Australian locations
- Uses `country:au` filter for better local results
- Default map center is Melbourne, Australia
- Location biasing uses 50km radius around user's current location

## Fallback Behavior

If Google APIs are unavailable, the app gracefully falls back to:
- Device GPS with basic address formatting for current location  
- Manual text input for destinations with mock coordinates
- All functionality remains available, just with reduced accuracy and features

## Features Included

- 🗺️ **Interactive Google Maps** with real-time rendering
- 📍 **Address Autocomplete** with Australian location bias
- 📌 **Custom Location Markers** for pickup and destination
- 🛣️ **Route Display** with blue polylines following real roads
- ⏱️ **Route Information** showing journey time and distance
- 🔍 **Auto-zoom** to fit both locations and route on map
- 🎯 **Current Location** detection with formatted addresses
- 🔒 **Secure API Key** storage via environment variables
- ⚡ **Fast Performance** with 300ms search debouncing
- 🛡️ **Error Handling** with graceful fallbacks

Your ride-hailing app now has professional-grade location services with proper security practices! 