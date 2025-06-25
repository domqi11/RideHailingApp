import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TextInput,
  ScrollView,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';

const { height: screenHeight } = Dimensions.get('window');

interface SimpleLocationInputProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (pickup: any, destination: any) => void;
  currentDestination?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const SimpleLocationInput: React.FC<SimpleLocationInputProps> = ({
  visible,
  onClose,
  onLocationSelected,
  currentDestination,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [destinationText, setDestinationText] = useState(currentDestination || '');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Use environment variable instead of hardcoded key
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Test API key function (for debugging)
  const testApiKey = async () => {
    if (!apiKey) {
      console.log('❌ No valid API key to test');
      return;
    }

    try {
      console.log('🧪 Testing API key with simple geocoding request...');
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${apiKey}`
      );
      
      const data = await response.json();
      console.log('🧪 API Test Result:', {
        status: data.status,
        hasResults: data.results?.length > 0,
        errorMessage: data.error_message
      });
      
      if (data.status === 'REQUEST_DENIED') {
        console.log('❌ API Key denied. Check restrictions and billing in Google Cloud Console');
      } else if (data.status === 'OK') {
        console.log('✅ API Key working correctly!');
      }
    } catch (error) {
      console.log('❌ API Test failed:', error.message);
    }
  };

  React.useEffect(() => {
    // Debug API key detection (without exposing the actual key)
    console.log('API Key Status:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 8) || 'none',
      isPlaceholder: false
    });
    
    // Test the API key when modal opens
    if (visible && apiKey) {
      testApiKey();
    }
    
    if (visible) {
      getCurrentLocation();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentLocation({
          latitude: -37.8136,
          longitude: 144.9631,
          address: 'Current Location (Permission Required)',
        });
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Use Google's Reverse Geocoding API for better address formatting
      if (apiKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${apiKey}`
          );
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              address: address,
            });
          } else {
            console.log('Google Geocoding response:', data.status, data.error_message);
            throw new Error(`Geocoding failed: ${data.status}`);
          }
        } catch (googleError) {
          console.log('Google Geocoding not available:', googleError.message);
          // Fall back to Expo's reverse geocoding
          await fallbackToExpoGeocoding(location);
        }
      } else {
        // Fall back to Expo's reverse geocoding if no valid API key
        console.log('No Google API key, using device geocoding');
        await fallbackToExpoGeocoding(location);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      setCurrentLocation({
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA (Default)',
      });
    } finally {
      setLoadingLocation(false);
    }
  };

  const fallbackToExpoGeocoding = async (location: any) => {
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let address = 'Current Location';
      if (reverseGeocode.length > 0) {
        const result = reverseGeocode[0];
        address = `${result.streetNumber || ''} ${result.street || ''}, ${result.city || ''}, ${result.region || ''}`.trim();
        if (address.startsWith(', ')) address = address.substring(2);
      }

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address,
      });
    } catch (error) {
      console.error('Expo geocoding error:', error);
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: 'Current Location',
      });
    }
  };

  const searchPlaces = async (query: string) => {
    if (!apiKey || query.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    try {
      setIsSearching(true);
      
      // Get current location for better biasing if available
      let locationBias = '';
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        // Use actual current location for biasing
        locationBias = `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=50000`;
      } else {
        // Default to Melbourne, Australia center for biasing
        locationBias = '&location=-37.8136,144.9631&radius=100000';
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=address&components=country:au${locationBias}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions.slice(0, 5)); // Limit to 5 results
        setShowPredictions(true);
      } else {
        console.log('Places API response:', data.status, data.error_message);
        setPredictions([]);
        setShowPredictions(false);
      }
    } catch (error) {
      console.log('Places API not available:', error.message);
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsSearching(false);
    }
  };

  const getPlaceDetails = async (placeId: string): Promise<any> => {
    if (!apiKey) {
      throw new Error('No API key available');
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=geometry,formatted_address`
      );
      const data = await response.json();

      if (data.result && data.result.geometry) {
        return {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          address: data.result.formatted_address,
        };
      } else {
        throw new Error('No place details found');
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      throw error;
    }
  };

  const handleTextChange = (text: string) => {
    setDestinationText(text);
    
    // Debounce the search
    clearTimeout((handleTextChange as any).searchTimeout);
    (handleTextChange as any).searchTimeout = setTimeout(() => {
      searchPlaces(text);
    }, 300);
  };

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    try {
      setDestinationText(prediction.description);
      setShowPredictions(false);
      setPredictions([]);

      const placeDetails = await getPlaceDetails(prediction.place_id);
      
      if (currentLocation) {
        onLocationSelected(currentLocation, placeDetails);
        onClose();
      }
    } catch (error) {
      console.error('Error selecting prediction:', error);
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!destinationText.trim()) {
      Alert.alert('Error', 'Please enter a destination address.');
      return;
    }

    if (!currentLocation) {
      Alert.alert('Error', 'Current location not available.');
      return;
    }

    // If we have an exact match from predictions, use that
    if (predictions.length > 0) {
      const exactMatch = predictions.find(p => 
        p.description.toLowerCase() === destinationText.toLowerCase()
      );
      if (exactMatch) {
        await handlePredictionSelect(exactMatch);
        return;
      }
    }

    // Otherwise, try to geocode the entered text
    if (apiKey) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destinationText)}&key=${apiKey}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          const destination = {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            address: result.formatted_address,
          };
          
          onLocationSelected(currentLocation, destination);
          onClose();
        } else {
          console.log('Geocoding response:', data.status, data.error_message);
          Alert.alert('Address Not Found', 'Could not find this address. Please try a different address or check your spelling.');
        }
      } catch (error) {
        console.log('Geocoding not available:', error.message);
        // Show user that we're using basic functionality
        Alert.alert(
          'Limited Functionality', 
          'Address validation is not available. The destination will be saved as entered.', 
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => {
                const destination = {
                  latitude: 37.7849, // Mock coordinates
                  longitude: -122.4094,
                  address: destinationText.trim(),
                };
                
                onLocationSelected(currentLocation, destination);
                onClose();
              }
            }
          ]
        );
      }
    } else {
      // Fallback without API key - inform user of limited functionality
      Alert.alert(
        'Basic Mode', 
        'Address validation requires Google Maps setup. The destination will be saved as entered.', 
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              const destination = {
                latitude: 37.7849, // Mock coordinates
                longitude: -122.4094,
                address: destinationText.trim(),
              };
              
              onLocationSelected(currentLocation, destination);
              onClose();
            }
          }
        ]
      );
    }
  };

  const handleClose = () => {
    setShowPredictions(false);
    setPredictions([]);
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      onClose();
    });
  };

  const renderPrediction = ({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity 
      style={styles.predictionItem}
      onPress={() => handlePredictionSelect(item)}
    >
      <View style={styles.predictionContent}>
        <AntDesign name="enviromento" size={16} color="#9CA3AF" style={styles.predictionIcon} />
        <View style={styles.predictionTextContainer}>
          <Text style={styles.predictionMainText} numberOfLines={1}>
            {item.structured_formatting.main_text}
          </Text>
          <Text style={styles.predictionSecondaryText} numberOfLines={1}>
            {item.structured_formatting.secondary_text}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={styles.overlayTouchable} 
            activeOpacity={1} 
            onPress={handleClose}
          />
          
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerHandle} />
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Plan your trip</Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <AntDesign name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Current Location Display */}
            <View style={styles.locationSection}>
              <View style={styles.locationItem}>
                <View style={[styles.locationPin, { backgroundColor: '#3B82F6' }]} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>From</Text>
                  {loadingLocation ? (
                    <Text style={styles.loadingText}>Detecting current location...</Text>
                  ) : (
                    <Text style={styles.locationText}>{currentLocation?.address}</Text>
                  )}
                </View>
                {!loadingLocation && (
                  <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
                    <Feather name="refresh-cw" size={16} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Destination Input */}
            <View style={styles.destinationSection}>
              <View style={styles.destinationHeader}>
                <View style={[styles.locationPin, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.destinationLabel}>Where to?</Text>
              </View>
              
              <TextInput
                style={styles.destinationInput}
                placeholder="Enter destination address"
                placeholderTextColor="#9CA3AF"
                value={destinationText}
                onChangeText={handleTextChange}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="words"
              />

              {/* Predictions Dropdown */}
              {showPredictions && predictions.length > 0 && (
                <View style={styles.predictionsContainer}>
                  <FlatList
                    data={predictions}
                    renderItem={renderPrediction}
                    keyExtractor={(item) => item.place_id}
                    style={styles.predictionsList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              )}

              {/* API Key Warning */}
              {!apiKey && (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>
                    ⚠️ Google Maps not configured. Basic functionality only.
                  </Text>
                  <Text style={styles.warningSubtext}>
                    Set up Google Maps API for address autocomplete and validation.
                  </Text>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.submitButton, !destinationText.trim() && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!destinationText.trim()}
              >
                <Text style={[styles.submitButtonText, !destinationText.trim() && styles.submitButtonTextDisabled]}>
                  Set Destination
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.6,
    minHeight: screenHeight * 0.3,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  header: {
    paddingTop: 6,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationSection: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationPin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  loadingText: {
    fontSize: 15,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  destinationLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  destinationInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  predictionsContainer: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 1000,
  },
  predictionsList: {
    maxHeight: 150,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  predictionItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  predictionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predictionIcon: {
    marginRight: 10,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  warningContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },
  warningSubtext: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  submitButton: {
    height: 44,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default SimpleLocationInput; 