/**
 * Quick Test Component for Address Coordinate Handling
 * This component helps verify that addresses are properly geocoded and routes display correctly
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AddressManager, { type AddressData } from '../components/AddressManager';

const AddressCoordinateTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
    console.log('🧪 Test:', result);
  };

  const runCoordinateTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('Starting coordinate validation tests...');
      
      // Test 1: Valid coordinates
      const validCoords = AddressManager.isValidCoordinates(-37.8136, 144.9631);
      addResult(`✅ Valid coordinates test: ${validCoords ? 'PASS' : 'FAIL'}`);
      
      // Test 2: Invalid coordinates (0,0)
      const invalidCoords = AddressManager.isValidCoordinates(0, 0);
      addResult(`✅ Invalid coordinates test: ${!invalidCoords ? 'PASS' : 'FAIL'}`);
      
      // Test 3: Create address with invalid coordinates (should use fallback)
      const addressWithFallback = AddressManager.createAddressData(
        'Test Address Melbourne',
        0,
        0,
        'manual'
      );
      const hasFallbackCoords = AddressManager.isValidCoordinates(addressWithFallback.latitude, addressWithFallback.longitude);
      addResult(`✅ Fallback coordinates test: ${hasFallbackCoords ? 'PASS' : 'FAIL'}`);
      addResult(`   Fallback coords: ${addressWithFallback.latitude}, ${addressWithFallback.longitude}`);
      
      // Test 4: City detection
      const fallbackCoords = AddressManager.getFallbackCoordinates('Collins Street, Melbourne');
      const isMelbourneCoords = fallbackCoords[0] === -37.8136 && fallbackCoords[1] === 144.9631;
      addResult(`✅ City detection test: ${isMelbourneCoords ? 'PASS' : 'FAIL'}`);
      
      // Test 5: Sydney city detection
      const sydneyCoords = AddressManager.getFallbackCoordinates('George Street, Sydney');
      const isSydneyCoords = sydneyCoords[0] === -33.8688 && sydneyCoords[1] === 151.2093;
      addResult(`✅ Sydney detection test: ${isSydneyCoords ? 'PASS' : 'FAIL'}`);
      
      // Test 6: Geocoding (if API key available)
      if (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
        addResult('Testing geocoding with API...');
        const geocodeResult = await AddressManager.geocodeAddress('Collins Street, Melbourne');
        addResult(`✅ Geocoding test: ${geocodeResult.success ? 'PASS' : 'FAIL'}`);
        if (geocodeResult.success && geocodeResult.data) {
          addResult(`   Address: ${geocodeResult.data.address}`);
          addResult(`   Coords: ${geocodeResult.data.latitude}, ${geocodeResult.data.longitude}`);
          addResult(`   Source: ${geocodeResult.data.source}`);
        }
      } else {
        addResult('⚠️  No API key - skipping geocoding test');
      }
      
      // Test 7: Destination-to-Stop conversion simulation
      addResult('Testing destination-to-stop conversion...');
      
      // Simulate a destination with no coordinates (like manual entry)
      const manualDestination = AddressManager.createAddressData(
        'Test Street, Melbourne',
        0,
        0,
        'manual'
      );
      
      // Verify it gets fallback coordinates
      const hasValidFallback = AddressManager.isValidCoordinates(manualDestination.latitude, manualDestination.longitude);
      addResult(`✅ Manual destination fallback test: ${hasValidFallback ? 'PASS' : 'FAIL'}`);
      addResult(`   Coordinates: ${manualDestination.latitude}, ${manualDestination.longitude}`);
      
      // Test 8: Legacy conversion
      const legacyAddress = AddressManager.toLegacyAddress(manualDestination);
      const hasLegacyCoords = legacyAddress.latitude !== 0 && legacyAddress.longitude !== 0;
      addResult(`✅ Legacy conversion test: ${hasLegacyCoords ? 'PASS' : 'FAIL'}`);
      
      addResult('All tests completed!');
      
    } catch (error) {
      addResult(`❌ Error during tests: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Address Coordinate Test</Text>
      <Text style={styles.subtitle}>
        This component tests address coordinate handling
      </Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={runCoordinateTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running Tests...' : 'Run Coordinate Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#3B82F6',
  },
  clearButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default AddressCoordinateTest; 