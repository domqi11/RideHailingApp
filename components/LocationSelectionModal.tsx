import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const { height: screenHeight } = Dimensions.get('window');

interface LocationSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (pickup: any, destination: any) => void;
  currentDestination?: string;
}

const LocationSelectionModal: React.FC<LocationSelectionModalProps> = ({
  visible,
  onClose,
  onLocationSelected,
  currentDestination,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [destinationText, setDestinationText] = useState(currentDestination || '');

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
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
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to detect your current location.',
          [{ text: 'OK' }]
        );
        setCurrentLocation({
          latitude: 37.7749,
          longitude: -122.4194,
          address: 'Current Location (Permission Required)',
        });
        setLoadingLocation(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
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

  const handleDestinationSelected = (data: any, details: any) => {
    try {
      if (details && details.geometry && currentLocation) {
        const destination = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
          address: data.description,
        };
        
        onLocationSelected(currentLocation, destination);
        onClose();
      } else {
        console.warn('Invalid destination data received:', { data, details });
      }
    } catch (error) {
      console.error('Error handling destination selection:', error);
      Alert.alert(
        'Error',
        'There was an issue selecting this destination. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleError = (error: any) => {
    console.error('GooglePlacesAutocomplete error:', error);
    // Don't show alert for common network errors
    if (error && !error.toString().includes('network') && !error.toString().includes('timeout')) {
      Alert.alert(
        'Search Error',
        'There was an issue with the location search. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
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
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Detecting current location...</Text>
                  </View>
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
            
            <View style={styles.autocompleteContainer}>
              {apiKey ? (
                <GooglePlacesAutocomplete
                  placeholder="Search for a destination"
                  onPress={handleDestinationSelected}
                  query={{
                    key: apiKey,
                    language: 'en',
                    types: 'address',
                    components: 'country:us',
                  }}
                  fetchDetails={true}
                  styles={{
                    container: styles.googleContainer,
                    textInputContainer: styles.googleTextInputContainer,
                    textInput: styles.destinationInput,
                    listView: styles.googleListView,
                    row: styles.googleRow,
                    description: styles.googleDescription,
                    separator: styles.googleSeparator,
                  }}
                  enablePoweredByContainer={false}
                  timeout={20000}
                  debounce={300}
                  minLength={2}
                  onFail={handleError}
                />
              ) : (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>
                    Google Maps API key is required for location search.
                  </Text>
                  <Text style={styles.errorSubtext}>
                    Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your environment.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.quickActionsTitle}>Quick options</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.quickAction}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <AntDesign name="home" size={20} color="#2563EB" />
                </View>
                <Text style={styles.quickActionText}>Home</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <AntDesign name="laptop" size={20} color="#D97706" />
                </View>
                <Text style={styles.quickActionText}>Work</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <AntDesign name="star" size={20} color="#059669" />
                </View>
                <Text style={styles.quickActionText}>Saved</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                  <AntDesign name="clockcircleo" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.quickActionText}>Recent</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
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
    maxHeight: screenHeight * 0.85,
    paddingBottom: 34, // Safe area bottom
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  locationPin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  destinationLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 16,
  },
  autocompleteContainer: {
    flex: 1,
  },
  destinationInput: {
    height: 56,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  googleContainer: {
    flex: 0,
  },
  googleListView: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    maxHeight: 300,
  },
  googleRow: {
    padding: 16,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleDescription: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  googleSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  quickActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  quickAction: {
    alignItems: 'center',
    marginRight: 24,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  googleTextInputContainer: {
    // Add any necessary styles for the text input container
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});

export default LocationSelectionModal; 