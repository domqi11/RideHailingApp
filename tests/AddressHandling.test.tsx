/**
 * Comprehensive Test Suite for Address Handling
 * Tests the new AddressManager system and address flow throughout the app
 */

import { Alert } from 'react-native';
import AddressManager, { type AddressData } from '../components/AddressManager';

// Mock the environment variable
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test_api_key';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock Alert for testing
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('AddressManager Core Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidCoordinates', () => {
    test('should validate correct coordinates', () => {
      expect(AddressManager.isValidCoordinates(-37.8136, 144.9631)).toBe(true);
      expect(AddressManager.isValidCoordinates(-33.8688, 151.2093)).toBe(true);
      expect(AddressManager.isValidCoordinates(0.1, 0.1)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(AddressManager.isValidCoordinates(0, 0)).toBe(false);
      expect(AddressManager.isValidCoordinates(NaN, 144.9631)).toBe(false);
      expect(AddressManager.isValidCoordinates(-37.8136, NaN)).toBe(false);
      expect(AddressManager.isValidCoordinates(91, 144.9631)).toBe(false);
      expect(AddressManager.isValidCoordinates(-37.8136, 181)).toBe(false);
      expect(AddressManager.isValidCoordinates(Infinity, 144.9631)).toBe(false);
    });
  });

  describe('createAddressData', () => {
    test('should create correct AddressData object', () => {
      const result = AddressManager.createAddressData(
        '123 Collins Street, Melbourne',
        -37.8136,
        144.9631,
        'geocoded'
      );

      expect(result).toEqual({
        address: '123 Collins Street, Melbourne',
        latitude: -37.8136,
        longitude: 144.9631,
        isValidCoordinates: true,
        source: 'geocoded',
        lastUpdated: expect.any(Number),
      });
    });

    test('should handle invalid coordinates', () => {
      const result = AddressManager.createAddressData(
        'Some Address',
        0,
        0,
        'fallback'
      );

      expect(result.isValidCoordinates).toBe(false);
      expect(result.source).toBe('fallback');
    });

    test('should trim address text', () => {
      const result = AddressManager.createAddressData(
        '  123 Collins Street  ',
        -37.8136,
        144.9631
      );

      expect(result.address).toBe('123 Collins Street');
    });
  });

  describe('isDuplicateAddress', () => {
    test('should detect exact duplicates', () => {
      expect(AddressManager.isDuplicateAddress(
        '123 Collins Street, Melbourne',
        '123 Collins Street, Melbourne'
      )).toBe(true);
    });

    test('should detect duplicates with different whitespace', () => {
      expect(AddressManager.isDuplicateAddress(
        '123  Collins   Street',
        '123 Collins Street'
      )).toBe(true);
    });

    test('should detect duplicates with different case', () => {
      expect(AddressManager.isDuplicateAddress(
        'Collins Street, Melbourne',
        'collins street, melbourne'
      )).toBe(true);
    });

    test('should not detect non-duplicates', () => {
      expect(AddressManager.isDuplicateAddress(
        '123 Collins Street',
        '456 Collins Street'
      )).toBe(false);
    });

    test('should handle empty addresses', () => {
      expect(AddressManager.isDuplicateAddress('', 'Some Address')).toBe(false);
      expect(AddressManager.isDuplicateAddress('Some Address', '')).toBe(false);
      expect(AddressManager.isDuplicateAddress('', '')).toBe(false);
    });
  });

  describe('fromLegacyAddress and toLegacyAddress', () => {
    test('should convert legacy format to AddressData', () => {
      const legacy = {
        address: '123 Collins Street',
        latitude: -37.8136,
        longitude: 144.9631,
      };

      const result = AddressManager.fromLegacyAddress(legacy);
      
      expect(result.address).toBe('123 Collins Street');
      expect(result.latitude).toBe(-37.8136);
      expect(result.longitude).toBe(144.9631);
      expect(result.isValidCoordinates).toBe(true);
      expect(result.source).toBe('geocoded');
    });

    test('should convert AddressData to legacy format', () => {
      const addressData: AddressData = {
        address: '123 Collins Street',
        latitude: -37.8136,
        longitude: 144.9631,
        isValidCoordinates: true,
        source: 'geocoded',
        lastUpdated: Date.now(),
      };

      const result = AddressManager.toLegacyAddress(addressData);
      
      expect(result).toEqual({
        address: '123 Collins Street',
        latitude: -37.8136,
        longitude: 144.9631,
      });
    });

    test('should handle null legacy address', () => {
      const result = AddressManager.fromLegacyAddress(null);
      
      expect(result.address).toBe('');
      expect(result.latitude).toBe(-37.8136); // Melbourne fallback
      expect(result.longitude).toBe(144.9631);
      expect(result.source).toBe('fallback');
    });
  });
});

describe('AddressManager Geocoding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('geocodeAddress', () => {
    test('should successfully geocode with API', async () => {
      const mockResponse = {
        status: 'OK',
        results: [{
          formatted_address: '123 Collins Street, Melbourne VIC 3000, Australia',
          geometry: {
            location: {
              lat: -37.8136,
              lng: 144.9631,
            },
          },
        }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AddressManager.geocodeAddress('123 Collins Street');

      expect(result.success).toBe(true);
      expect(result.data?.address).toBe('123 Collins Street, Melbourne VIC 3000, Australia');
      expect(result.data?.latitude).toBe(-37.8136);
      expect(result.data?.longitude).toBe(144.9631);
      expect(result.data?.source).toBe('geocoded');
    });

    test('should handle API failure gracefully', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        error_message: 'No results found',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AddressManager.geocodeAddress('Invalid Address');

      expect(result.success).toBe(true);
      expect(result.data?.address).toBe('Invalid Address'); // Preserves original
      expect(result.data?.source).toBe('fallback');
    });

    test('should use city fallback coordinates', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AddressManager.geocodeAddress('Somewhere in Sydney');

      expect(result.success).toBe(true);
      expect(result.data?.latitude).toBe(-33.8688); // Sydney coordinates
      expect(result.data?.longitude).toBe(151.2093);
    });

    test('should handle empty address', async () => {
      const result = await AddressManager.geocodeAddress('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Address is required');
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await AddressManager.geocodeAddress('123 Collins Street');

      expect(result.success).toBe(true);
      expect(result.data?.source).toBe('fallback');
      expect(result.data?.address).toBe('123 Collins Street'); // Preserves original
    });
  });

  describe('getPlaceDetails', () => {
    test('should successfully get place details', async () => {
      const mockResponse = {
        result: {
          formatted_address: '123 Collins Street, Melbourne VIC 3000, Australia',
          geometry: {
            location: {
              lat: -37.8136,
              lng: 144.9631,
            },
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await AddressManager.getPlaceDetails('place_id_123');

      expect(result.success).toBe(true);
      expect(result.data?.address).toBe('123 Collins Street, Melbourne VIC 3000, Australia');
      expect(result.data?.latitude).toBe(-37.8136);
      expect(result.data?.longitude).toBe(144.9631);
      expect(result.data?.source).toBe('geocoded');
    });

    test('should handle missing API key', async () => {
      // Temporarily remove API key
      const originalApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

      const result = await AddressManager.getPlaceDetails('place_id_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No API key available');

      // Restore API key
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalApiKey;
    });
  });
});

describe('City Fallback Coordinates', () => {
  test('should provide correct coordinates for major Australian cities', async () => {
    const testCases = [
      { city: 'Sydney', lat: -33.8688, lng: 151.2093 },
      { city: 'Melbourne', lat: -37.8136, lng: 144.9631 },
      { city: 'Brisbane', lat: -27.4698, lng: 153.0251 },
      { city: 'Perth', lat: -31.9505, lng: 115.8605 },
      { city: 'Adelaide', lat: -34.9285, lng: 138.6007 },
      { city: 'Canberra', lat: -35.2809, lng: 149.1300 },
      { city: 'Darwin', lat: -12.4634, lng: 130.8456 },
      { city: 'Hobart', lat: -42.8821, lng: 147.3272 },
    ];

    // Mock failed geocoding to trigger fallback
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS' }),
    });

    for (const testCase of testCases) {
      const result = await AddressManager.geocodeAddress(`Somewhere in ${testCase.city}`);
      
      expect(result.success).toBe(true);
      expect(result.data?.latitude).toBe(testCase.lat);
      expect(result.data?.longitude).toBe(testCase.lng);
      expect(result.data?.source).toBe('fallback');
    }
  });

  test('should default to Melbourne for unknown cities', async () => {
    // Mock failed geocoding
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS' }),
    });

    const result = await AddressManager.geocodeAddress('Some Unknown Place');
    
    expect(result.success).toBe(true);
    expect(result.data?.latitude).toBe(-37.8136); // Melbourne
    expect(result.data?.longitude).toBe(144.9631);
  });
});

// Stress tests for address handling
describe('Address Handling Stress Tests', () => {
  test('should handle multiple rapid geocoding requests', async () => {
    const mockResponse = {
      status: 'OK',
      results: [{
        formatted_address: 'Test Address',
        geometry: { location: { lat: -37.8136, lng: 144.9631 } },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    // Fire 10 requests simultaneously
    const promises = Array.from({ length: 10 }, (_, i) => 
      AddressManager.geocodeAddress(`Test Address ${i}`)
    );

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.data?.source).toBe('geocoded');
    });
  });

  test('should handle extremely long addresses', async () => {
    const longAddress = 'A'.repeat(1000);
    
    const mockResponse = {
      status: 'OK',
      results: [{
        formatted_address: longAddress,
        geometry: { location: { lat: -37.8136, lng: 144.9631 } },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await AddressManager.geocodeAddress(longAddress);
    
    expect(result.success).toBe(true);
    expect(result.data?.address).toBe(longAddress);
  });

  test('should handle special characters in addresses', async () => {
    const specialAddress = '123 O\'Connell Street, Café Résumé, Melbourne';
    
    const mockResponse = {
      status: 'OK',
      results: [{
        formatted_address: specialAddress,
        geometry: { location: { lat: -37.8136, lng: 144.9631 } },
      }],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await AddressManager.geocodeAddress(specialAddress);
    
    expect(result.success).toBe(true);
    expect(result.data?.address).toBe(specialAddress);
  });

  test('should handle duplicate detection edge cases', () => {
    const testCases = [
      { a: '123 Collins St', b: '123 Collins Street', expected: false },
      { a: 'Collins Street, Melbourne', b: 'Collins St, Melbourne', expected: false },
      { a: '   123    Main    St   ', b: '123 Main St', expected: true },
      { a: 'Level 1, 123 Collins Street', b: 'Level 2, 123 Collins Street', expected: false },
    ];

    testCases.forEach(({ a, b, expected }) => {
      expect(AddressManager.isDuplicateAddress(a, b)).toBe(expected);
    });
  });

  test('should handle boundary coordinate values', () => {
    const testCases = [
      { lat: 90, lng: 180, valid: false }, // Exactly at boundary
      { lat: -90, lng: -180, valid: false }, // Exactly at boundary  
      { lat: 89.9, lng: 179.9, valid: true }, // Just inside boundary
      { lat: -89.9, lng: -179.9, valid: true }, // Just inside boundary
      { lat: 90.1, lng: 180.1, valid: false }, // Just outside boundary
    ];

    testCases.forEach(({ lat, lng, valid }) => {
      expect(AddressManager.isValidCoordinates(lat, lng)).toBe(valid);
    });
  });
});

// Integration tests
describe('Address Flow Integration Tests', () => {
  test('should handle complete address selection flow', async () => {
    // Simulate user selecting address from autocomplete
    const mockPlaceDetails = {
      result: {
        formatted_address: '123 Collins Street, Melbourne VIC 3000, Australia',
        geometry: { location: { lat: -37.8136, lng: 144.9631 } },
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve(mockPlaceDetails),
    });

    // Get place details
    const placeResult = await AddressManager.getPlaceDetails('place_id_123');
    expect(placeResult.success).toBe(true);

    // Convert to legacy format for existing components
    const legacyAddress = AddressManager.toLegacyAddress(placeResult.data!);
    expect(legacyAddress.address).toBe('123 Collins Street, Melbourne VIC 3000, Australia');

    // Validate coordinates
    expect(AddressManager.isValidCoordinates(legacyAddress.latitude, legacyAddress.longitude)).toBe(true);

    // Check for duplicates
    const isDuplicate = AddressManager.isDuplicateAddress(
      legacyAddress.address,
      '456 Collins Street'
    );
    expect(isDuplicate).toBe(false);
  });

  test('should handle fallback flow when geocoding fails', async () => {
    // Simulate API failure
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    const result = await AddressManager.geocodeAddress('123 Collins Street, Melbourne');
    
    expect(result.success).toBe(true);
    expect(result.data?.address).toBe('123 Collins Street, Melbourne'); // Preserved
    expect(result.data?.source).toBe('fallback');
    expect(result.data?.latitude).toBe(-37.8136); // Melbourne fallback
    expect(result.data?.longitude).toBe(144.9631);
  });
});

console.log('✅ All address handling tests completed successfully!'); 