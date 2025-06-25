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

  React.useEffect(() => {
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
          latitude: 37.7749,
          longitude: -122.4194,
          address: 'Current Location (Permission Required)',
        });
        setLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

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

  const handleSubmit = () => {
    if (destinationText.trim() && currentLocation) {
      const destination = {
        latitude: 37.7849, // Mock coordinates for now
        longitude: -122.4094,
        address: destinationText.trim(),
      };
      
      onLocationSelected(currentLocation, destination);
      onClose();
    } else {
      Alert.alert('Error', 'Please enter a destination address.');
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
              onChangeText={setDestinationText}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />

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
    paddingBottom: 34,
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
    marginBottom: 16,
  },
  submitButton: {
    height: 48,
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
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default SimpleLocationInput; 