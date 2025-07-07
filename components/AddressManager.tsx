/**
 * AddressManager - Centralized address handling utility
 * Provides consistent address parsing, geocoding, and validation
 * across the entire ride-hailing app
 */

import * as Location from 'expo-location';

export interface AddressData {
  address: string;
  latitude: number;
  longitude: number;
  isValidCoordinates: boolean;
  source: 'geocoded' | 'fallback' | 'manual';
  lastUpdated: number;
}

interface GeocodingResult {
  success: boolean;
  data?: AddressData;
  error?: string;
}

export class AddressManager {
  private static apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // Australian city fallback coordinates
  private static cityCoordinates = {
    sydney: { latitude: -33.8688, longitude: 151.2093 },
    melbourne: { latitude: -37.8136, longitude: 144.9631 },
    brisbane: { latitude: -27.4698, longitude: 153.0251 },
    perth: { latitude: -31.9505, longitude: 115.8605 },
    adelaide: { latitude: -34.9285, longitude: 138.6007 },
    canberra: { latitude: -35.2809, longitude: 149.1300 },
    darwin: { latitude: -12.4634, longitude: 130.8456 },
    hobart: { latitude: -42.8821, longitude: 147.3272 },
  };

  /**
   * Validates if coordinates are valid and meaningful
   */
  static isValidCoordinates(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      isFinite(lat) &&
      isFinite(lng) &&
      lat !== 0 &&
      lng !== 0 &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }

  /**
   * Creates a standardized AddressData object
   */
  static createAddressData(
    address: string,
    latitude: number,
    longitude: number,
    source: 'geocoded' | 'fallback' | 'manual' = 'manual'
  ): AddressData {
    // If coordinates are invalid, use smart fallback based on address
    let finalLat = latitude;
    let finalLng = longitude;
    let finalSource = source;
    
    if (!this.isValidCoordinates(latitude, longitude)) {
      console.log('🔄 Invalid coordinates provided, using fallback for:', address);
      const fallbackCoords = this.getFallbackCoordinates(address);
      finalLat = fallbackCoords[0];
      finalLng = fallbackCoords[1];
      finalSource = 'fallback';
    }
    
    return {
      address: address.trim(),
      latitude: finalLat,
      longitude: finalLng,
      isValidCoordinates: this.isValidCoordinates(finalLat, finalLng),
      source: finalSource,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Geocodes an address using Google Places API
   */
  static async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || !address.trim()) {
      return { success: false, error: 'Address is required' };
    }

    if (!this.apiKey) {
      console.log('⚠️ No API key available, using fallback coordinates');
      return {
        success: true,
        data: this.createAddressData(
          address,
          ...this.getFallbackCoordinates(address),
          'fallback'
        ),
      };
    }

    try {
      console.log('🔍 Geocoding address:', address);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const geocodedAddress = this.createAddressData(
          result.formatted_address,
          result.geometry.location.lat,
          result.geometry.location.lng,
          'geocoded'
        );

        console.log('✅ Successfully geocoded:', geocodedAddress);
        return { success: true, data: geocodedAddress };
      } else {
        console.log('❌ Geocoding failed:', data.status, data.error_message);
        
        // Return fallback coordinates but preserve user's original address
        return {
          success: true,
          data: this.createAddressData(
            address,
            ...this.getFallbackCoordinates(address),
            'fallback'
          ),
        };
      }
    } catch (error) {
      console.log('❌ Geocoding error:', error);
      
      // Return fallback coordinates but preserve user's original address
      return {
        success: true,
        data: this.createAddressData(
          address,
          ...this.getFallbackCoordinates(address),
          'fallback'
        ),
      };
    }
  }

  /**
   * Gets place details using Google Places API
   */
  static async getPlaceDetails(placeId: string): Promise<GeocodingResult> {
    if (!this.apiKey) {
      return { success: false, error: 'No API key available' };
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${this.apiKey}&fields=geometry,formatted_address`
      );
      
      const data = await response.json();

      if (data.result && data.result.geometry) {
        const addressData = this.createAddressData(
          data.result.formatted_address,
          data.result.geometry.location.lat,
          data.result.geometry.location.lng,
          'geocoded'
        );
        
        return { success: true, data: addressData };
      } else {
        return { success: false, error: 'No place details found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Gets fallback coordinates based on city detection
   */
  static getFallbackCoordinates(address: string): [number, number] {
    const addressLower = address.toLowerCase();
    
    // Check for city names in the address
    for (const [city, coords] of Object.entries(this.cityCoordinates)) {
      if (addressLower.includes(city)) {
        console.log(`📍 Using ${city} coordinates for fallback`);
        return [coords.latitude, coords.longitude];
      }
    }
    
    // Default to Melbourne
    console.log('📍 Using Melbourne coordinates as default fallback');
    return [this.cityCoordinates.melbourne.latitude, this.cityCoordinates.melbourne.longitude];
  }

  /**
   * Validates if two addresses are duplicates
   */
  static isDuplicateAddress(address1: string, address2: string): boolean {
    if (!address1 || !address2) return false;
    
    const normalize = (addr: string) => 
      addr.trim().toLowerCase().replace(/\s+/g, ' ');
    
    return normalize(address1) === normalize(address2);
  }

  /**
   * Gets current location using device GPS
   */
  static async getCurrentLocation(): Promise<GeocodingResult> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: true,
          data: this.createAddressData(
            'Current Location (Permission Required)',
            this.cityCoordinates.melbourne.latitude,
            this.cityCoordinates.melbourne.longitude,
            'fallback'
          ),
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Try to get address from coordinates
      let address = 'Current Location';
      
      if (this.apiKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${this.apiKey}`
          );
          
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            address = data.results[0].formatted_address;
          }
        } catch (error) {
          console.log('❌ Reverse geocoding failed:', error);
        }
      }

      return {
        success: true,
        data: this.createAddressData(
          address,
          location.coords.latitude,
          location.coords.longitude,
          'geocoded'
        ),
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      
      return {
        success: true,
        data: this.createAddressData(
          'Melbourne, Australia (Location unavailable)',
          this.cityCoordinates.melbourne.latitude,
          this.cityCoordinates.melbourne.longitude,
          'fallback'
        ),
      };
    }
  }

  /**
   * Converts legacy address format to AddressData
   */
  static fromLegacyAddress(legacyAddress: any): AddressData {
    if (!legacyAddress) {
      return this.createAddressData(
        '',
        this.cityCoordinates.melbourne.latitude,
        this.cityCoordinates.melbourne.longitude,
        'fallback'
      );
    }

    const address = legacyAddress.address || '';
    const latitude = legacyAddress.latitude || 0;
    const longitude = legacyAddress.longitude || 0;

    return this.createAddressData(
      address,
      latitude,
      longitude,
      this.isValidCoordinates(latitude, longitude) ? 'geocoded' : 'fallback'
    );
  }

  /**
   * Converts AddressData to legacy format for backwards compatibility
   */
  static toLegacyAddress(addressData: AddressData): any {
    return {
      address: addressData.address,
      latitude: addressData.latitude,
      longitude: addressData.longitude,
    };
  }
}

export default AddressManager; 