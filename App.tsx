/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import {
  AntDesign,
  Feather,
  MaterialIcons,
  Ionicons,
  FontAwesome,
} from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapViewComponent from './components/MapView';
import ErrorBoundary from './components/ErrorBoundary';
import SimpleLocationInput from './components/SimpleLocationInput';

const { width } = Dimensions.get('window');

export default function RideHailingApp() {
  const [currentStep, setCurrentStep] = useState('booking');
  const [selectedRide, setSelectedRide] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Location state
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [stops, setStops] = useState([]); // Array of stop locations

  // Automatically get user's current location when app loads
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const showLocationPermissionHelp = () => {
    Alert.alert(
      'Location Access Required',
      'To provide the best ride experience, please enable location access:\n\n' +
      '1. Go to Settings > Privacy & Security > Location Services\n' +
      '2. Find "Expo Go" or "RideHailingApp"\n' +
      '3. Select "While Using App"\n\n' +
      'This helps us show your current location and find nearby drivers.',
      [
        {
          text: 'Use Default Location',
          style: 'cancel',
          onPress: () => {
            setPickupLocation({
              latitude: -37.8136,
              longitude: 144.9631,
              address: 'Melbourne, Australia (Default)',
            });
          }
        },
        {
          text: 'Try Again',
          onPress: () => getCurrentLocation()
        }
      ]
    );
  };

  const getCurrentLocation = async () => {
    try {
      // First check if location services are enabled
      let { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission not granted, requesting...');
        const permissionResult = await Location.requestForegroundPermissionsAsync();
        status = permissionResult.status;
        
        if (status !== 'granted') {
          console.log('Location permission denied by user');
          showLocationPermissionHelp();
          return;
        }
      }

      console.log('Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('Location obtained:', location.coords);

      // Use Google's Reverse Geocoding API for better address formatting
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (apiKey) {
        try {
          console.log('Getting address from Google Geocoding...');
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.coords.latitude},${location.coords.longitude}&key=${apiKey}`
          );
          
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            console.log('Address found:', address);
            setPickupLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              address: address,
            });
            return;
          } else {
            console.log('Geocoding API returned:', data.status);
            throw new Error('Geocoding failed');
          }
        } catch (geocodingError) {
          console.log('Google Geocoding failed:', geocodingError);
          // Fall back to basic location without formatted address
        }
      } else {
        console.log('No Google API key, using device geocoding');
      }

      // Fallback: Use basic location with Expo's reverse geocoding
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
        
        setPickupLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: formattedAddress || 'Current Location',
        });
      } catch (reverseGeoError) {
        console.log('Reverse geocoding failed:', reverseGeoError);
        // Final fallback: Just use coordinates
        setPickupLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: 'Current Location',
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Melbourne, Australia (Location unavailable)';
      
      if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
        errorMessage = 'Melbourne, Australia (Location services disabled)';
      } else if (error.code === 'E_LOCATION_TIMEOUT') {
        errorMessage = 'Melbourne, Australia (Location timeout)';
      } else if (error.message && error.message.includes('denied')) {
        errorMessage = 'Melbourne, Australia (Location permission denied)';
      }
      
      // Fallback to Melbourne
      setPickupLocation({
        latitude: -37.8136,
        longitude: 144.9631,
        address: errorMessage,
      });
    }
  };

  // Location handlers
  const handleLocationSelected = (pickup: any, destination: any) => {
    try {
      console.log('Location Selected:', { pickup, destination });
      
      // Validate and set pickup location
      if (pickup && typeof pickup === 'object') {
        // Ensure pickup has valid coordinates and address
        if (typeof pickup.latitude === 'number' && 
            typeof pickup.longitude === 'number' && 
            !isNaN(pickup.latitude) && 
            !isNaN(pickup.longitude) && 
            Math.abs(pickup.latitude) <= 90 && 
            Math.abs(pickup.longitude) <= 180) {
          
          setPickupLocation({
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            address: pickup.address || 'Selected Location',
          });
        } else if (pickup.address && typeof pickup.address === 'string' && pickup.address.trim()) {
          // If no valid coordinates but has address, keep current location but update address
          console.log('Pickup has address but invalid coordinates, keeping current location');
        }
      }
      
      // Validate and set destination location - only if destination is provided and valid
      if (destination && typeof destination === 'object') {
        if (typeof destination.latitude === 'number' && 
            typeof destination.longitude === 'number' && 
            !isNaN(destination.latitude) && 
            !isNaN(destination.longitude) && 
            Math.abs(destination.latitude) <= 90 && 
            Math.abs(destination.longitude) <= 180 &&
            destination.address && 
            typeof destination.address === 'string' && 
            destination.address.trim()) {
          
          setDestinationLocation({
            latitude: destination.latitude,
            longitude: destination.longitude,
            address: destination.address.trim(),
          });
        } else if (destination.address && typeof destination.address === 'string' && destination.address.trim()) {
          // If destination only has address, keep the text but don't update coordinates
          console.log('Destination has address but no valid coordinates:', destination.address);
        }
      }
      
      // Close modal immediately for better responsiveness
      setShowLocationModal(false);
    } catch (error) {
      console.error('Error in handleLocationSelected:', error);
      // Safely close modal even if there's an error
      setShowLocationModal(false);
      Alert.alert('Error', 'Failed to process location data. Please try again.');
    }
  };

  const handleLocationModalClose = () => {
    try {
      // Use setTimeout to schedule the state update properly and prevent race conditions
      setTimeout(() => {
        setShowLocationModal(false);
      }, 0);
    } catch (error) {
      // Fallback: Force close modal
      setShowLocationModal(false);
    }
  };

  const handleSeePrices = () => {
    if (destinationLocation) {
      setTimeout(() => {
        setCurrentStep('selecting');
      }, 0);
    }
  };

  const handleBackToBooking = () => {
    setTimeout(() => {
      setCurrentStep('booking');
    }, 0);
  };

  const handleConfirmRide = () => {
    if (selectedRide) {
      setTimeout(() => {
        setCurrentStep('confirmed');
      }, 0);
    }
  };

  const handleTrackRide = () => {
    setTimeout(() => {
      setCurrentStep('tracking');
    }, 0);
  };

  const handleToggleProfile = () => {
    setTimeout(() => {
      setCurrentScreen(currentScreen === 'profile' ? 'home' : 'profile');
    }, 0);
  };

  const handleBackToHome = () => {
    setTimeout(() => {
      setCurrentScreen('home');
    }, 0);
  };

  const handleSelectRide = (rideId: string) => {
    setTimeout(() => {
      setSelectedRide(rideId);
    }, 0);
  };

  const handleOpenLocationModal = () => {
    setTimeout(() => {
      setShowLocationModal(true);
    }, 0);
  };

  const handleCancelTrip = () => {
    setCurrentStep('booking');
    setDestinationLocation(null);
    setSelectedRide(null);
  };

  // Stop management handlers
  const handleAddStop = () => {
    console.log('🛑 Add stop button pressed - opening location modal');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLocationModal(true);
  };

  const handleRemoveStop = (stopId) => {
    console.log('🗑️ Removing stop from main app:', stopId);
    try {
      const updatedStops = stops.filter(stop => stop.id !== stopId)
        .map((stop, index) => ({ ...stop, order: index + 1 }));
      setStops(updatedStops);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('❌ Error removing stop:', error);
      Alert.alert('Error', 'Failed to remove stop. Please try again.');
    }
  };

  const handleReorderStops = (fromIndex, toIndex) => {
    console.log('🔄 Reordering stops:', { fromIndex, toIndex });
    try {
      const reorderedStops = [...stops];
      const [movedStop] = reorderedStops.splice(fromIndex, 1);
      reorderedStops.splice(toIndex, 0, movedStop);
      
      // Update order numbers
      const updatedStops = reorderedStops.map((stop, index) => ({
        ...stop,
        order: index + 1,
      }));
      
      setStops(updatedStops);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Error reordering stops:', error);
      Alert.alert('Error', 'Failed to reorder stops. Please try again.');
    }
  };

  const rideOptions = [
    {
      id: 'economy',
      name: 'Ride',
      icon: 'car',
      time: '3 min',
      price: '$12',
      description: 'Affordable, everyday rides',
      capacity: '1-4',
    },
    {
      id: 'comfort',
      name: 'Comfort',
      icon: 'shield',
      time: '5 min',
      price: '$19',
      description: 'Newer cars with extra legroom',
      capacity: '1-4',
    },
    {
      id: 'xl',
      name: 'XL',
      icon: 'users',
      time: '7 min',
      price: '$24',
      description: 'Larger vehicles for groups',
      capacity: '1-6',
    },
    {
      id: 'premium',
      name: 'Black',
      icon: 'star',
      time: '4 min',
      price: '$33',
      description: 'Premium vehicles and service',
      capacity: '1-4',
    },
  ];

  const BookingScreen = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Map Area */}
      <View style={styles.mapContainer}>
        {pickupLocation ? (
          <MapViewComponent
            key={`${pickupLocation.latitude}-${pickupLocation.longitude}-${destinationLocation?.latitude || 'none'}-${destinationLocation?.longitude || 'none'}-${stops.length}`}
            pickupLocation={pickupLocation}
            destinationLocation={destinationLocation}
            stops={stops}
          />
        ) : (
          <View style={styles.loadingMapContainer}>
            <Text style={styles.loadingMapText}>Loading your location...</Text>
          </View>
        )}
      </View>

      {/* Address Input Section */}
      <View style={styles.inputContainer}>
        <View style={styles.addressContainer}>
          {/* From Address */}
          <TouchableOpacity 
            style={styles.addressField}
            onPress={handleOpenLocationModal}
            activeOpacity={0.7}
          >
            <View style={styles.addressFieldContent}>
              <View style={styles.fromDot} />
              <View style={styles.addressTextContainer}>
                <Text style={styles.addressLabel}>From</Text>
                <Text style={styles.addressText} numberOfLines={1}>
                  {pickupLocation ? pickupLocation.address : 'Loading your location...'}
                </Text>
              </View>
              <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshLocationButton}>
                <Feather name="refresh-cw" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Journey Line Connector (only if no stops) */}
          {stops.length === 0 && (
            <View style={styles.journeyConnector}>
              <View style={styles.connectorLine} />
              <View style={styles.connectorIcon}>
                <MaterialIcons name="swap-vert" size={14} color="#FFFFFF" />
              </View>
            </View>
          )}

          {/* Stops */}
          {stops.filter(stop => 
            stop && 
            stop.id && 
            stop.address && 
            typeof stop.address === 'string' && 
            stop.address.trim()
          ).map((stop, index) => (
            <View key={stop.id}>
              <View style={styles.stopField}>
                <View style={styles.addressFieldContent}>
                  <View style={styles.stopDot}>
                    <Text style={styles.stopNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressLabel}>Stop {index + 1}</Text>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {stop.address}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleRemoveStop(stop.id)} 
                    style={styles.removeStopButton}
                  >
                    <AntDesign name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Connector after each stop */}
              <View style={styles.journeyConnector}>
                <View style={styles.connectorLine} />
              </View>
            </View>
          ))}

          {/* Where To Field */}
          <TouchableOpacity 
            style={styles.addressField}
            onPress={handleOpenLocationModal}
            activeOpacity={0.7}
          >
            <View style={styles.addressFieldContent}>
              <View style={styles.toDot} />
              <View style={styles.addressTextContainer}>
                {destinationLocation ? (
                  <>
                    <Text style={styles.addressLabel}>Where to?</Text>
                    <Text style={styles.addressText} numberOfLines={1}>
                      {destinationLocation.address}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.wherePlaceholder}>Where to?</Text>
                )}
              </View>
              <View style={styles.addressArrow}>
                <AntDesign name="right" size={16} color="#9CA3AF" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton}>
          <View style={styles.quickActionIcon}>
            <AntDesign name="clockcircleo" size={16} color="white" />
          </View>
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionButton}>
          <View style={styles.quickActionIcon}>
            <AntDesign name="staro" size={16} color="white" />
          </View>
          <Text style={styles.quickActionText}>Favorites</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionButton} onPress={handleAddStop}>
          <View style={styles.quickActionIcon}>
            <AntDesign name="plus" size={16} color="white" />
          </View>
          <Text style={styles.quickActionText}>Add Stop</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !destinationLocation && styles.primaryButtonDisabled]}
        onPress={handleSeePrices}
        disabled={!destinationLocation}
      >
        <Text style={[styles.primaryButtonText, !destinationLocation && styles.primaryButtonTextDisabled]}>
          See Prices
        </Text>
      </TouchableOpacity>

      {/* Location Selection Modal */}
      <SimpleLocationInput
        visible={showLocationModal}
        onClose={handleLocationModalClose}
        onLocationSelected={handleLocationSelected}
        currentDestination={destinationLocation?.address}
        currentPickup={pickupLocation?.address}
        allowPickupEdit={true}
        stops={stops}
        onStopsUpdated={setStops}
      />
    </ScrollView>
  );

  const SelectingScreen = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToBooking}
        >
          <AntDesign name="arrowleft" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a ride</Text>
        <TouchableOpacity style={styles.backButton}>
          <Feather name="more-horizontal" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tripCard}>
        <View style={styles.tripLocation}>
          <View style={[styles.locationPin, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.tripLocationText}>{pickupLocation.address}</Text>
        </View>
        
        {/* Display stops */}
        {stops.filter(stop => 
          stop && 
          stop.id && 
          stop.address && 
          typeof stop.address === 'string' && 
          stop.address.trim()
        ).map((stop, index) => (
          <View key={stop.id} style={styles.tripLocation}>
            <View style={[styles.locationPin, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.stopPinText}>{index + 1}</Text>
            </View>
            <Text style={styles.tripLocationText} numberOfLines={1}>
              Stop {index + 1}: {stop.address}
            </Text>
          </View>
        ))}
        
        <View style={styles.tripLocation}>
          <View style={[styles.locationPin, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.tripLocationText}>
            {destinationLocation?.address || '456 Oak Avenue'}
          </Text>
        </View>
      </View>

      <View style={styles.rideOptions}>
        {rideOptions.map((ride, index) => {
          const isSelected = selectedRide === ride.id;
          return (
            <TouchableOpacity
              key={ride.id}
              style={[
                styles.rideOption,
                isSelected && styles.rideOptionSelected,
              ]}
              onPress={() => handleSelectRide(ride.id)}
            >
              <View style={styles.rideOptionContent}>
                <View style={styles.rideOptionLeft}>
                  <View style={styles.rideOptionIcon}>
                    {ride.icon === 'car' && <AntDesign name="car" size={24} color="#374151" />}
                    {ride.icon === 'shield' && <Feather name="shield" size={24} color="#374151" />}
                    {ride.icon === 'users' && <Feather name="users" size={24} color="#374151" />}
                    {ride.icon === 'star' && <AntDesign name="star" size={24} color="#374151" />}
                  </View>
                  <View style={styles.rideOptionInfo}>
                    <Text style={styles.rideOptionName}>{ride.name}</Text>
                    <Text style={styles.rideOptionDescription}>{ride.description}</Text>
                    <View style={styles.rideOptionDetails}>
                      <Text style={styles.rideOptionDetail}>{ride.time} away</Text>
                      <Text style={styles.rideOptionDetail}>{ride.capacity} seats</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.rideOptionPrice}>{ride.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedRide && styles.primaryButtonDisabled]}
        onPress={handleConfirmRide}
        disabled={!selectedRide}
      >
        <Text style={[styles.primaryButtonText, !selectedRide && styles.primaryButtonTextDisabled]}>
          Confirm {selectedRide && rideOptions.find((r) => r.id === selectedRide)?.name}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const ConfirmedScreen = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.confirmedHeader}>
        <View style={styles.confirmedIcon}>
          <View style={styles.confirmedIconInner}>
            <AntDesign name="check" size={20} color="white" />
          </View>
        </View>
        <Text style={styles.confirmedTitle}>Your ride is confirmed</Text>
        <Text style={styles.confirmedSubtitle}>Michael is coming to pick you up</Text>
      </View>

      {/* Driver Card */}
      <View style={styles.driverCard}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>MJ</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>Michael Johnson</Text>
            <View style={styles.driverRating}>
              <View style={styles.driverRatingStars}>
                <AntDesign name="star" size={16} color="#FCD34D" />
                <Text style={styles.driverRatingText}>4.9</Text>
              </View>
              <Text style={styles.driverTrips}>• 1,247 trips</Text>
            </View>
            <Text style={styles.driverCar}>Toyota Camry • ABC 123</Text>
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.driverAction}>
              <Feather name="phone" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.driverAction}>
              <Feather name="message-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Trip Details */}
      <View style={styles.tripDetails}>
        <View style={styles.tripDetailRow}>
          <Text style={styles.tripDetailLabel}>Pickup time</Text>
          <Text style={styles.tripDetailValue}>3 minutes</Text>
        </View>
        <View style={styles.tripDetailDivider} />
        <View style={styles.tripDetailRow}>
          <Text style={styles.tripDetailLabel}>Trip time</Text>
          <Text style={styles.tripDetailValue}>12 minutes</Text>
        </View>
        <View style={styles.tripDetailDivider} />
        <View style={styles.tripDetailRow}>
          <Text style={styles.tripDetailLabel}>Total</Text>
          <Text style={styles.tripDetailTotal}>$12.00</Text>
        </View>
        <View style={styles.paymentMethod}>
          <AntDesign name="creditcard" size={20} color="#9CA3AF" />
          <Text style={styles.paymentMethodText}>•••• 4242</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
        onPress={handleTrackRide}
      >
        <Text style={styles.primaryButtonText}>Track your ride</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const TrackingScreen = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Live Map */}
      <View style={[styles.mapContainer, { height: 400 }]}>
        <View style={[styles.mapGradient, { backgroundColor: '#EFF6FF' }]}>
          <View style={styles.trackingDriver}>
            <View style={styles.trackingDriverIcon}>
              <AntDesign name="car" size={28} color="white" />
            </View>
            <View style={styles.trackingDriverStatus} />
          </View>

          <View style={styles.trackingCard}>
            <View style={styles.trackingCardContent}>
              <View style={styles.trackingInfo}>
                <Text style={styles.trackingLabel}>Arriving in</Text>
                <Text style={styles.trackingTime}>2 min</Text>
              </View>
              <View style={styles.trackingInfo}>
                <Text style={styles.trackingLabel}>Distance</Text>
                <Text style={styles.trackingDistance}>0.3 mi</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Driver Status */}
      <View style={styles.trackingStatus}>
        <View style={styles.trackingStatusContent}>
          <View style={styles.trackingDriverAvatar}>
            <Text style={styles.trackingDriverAvatarText}>MJ</Text>
          </View>
          <View style={styles.trackingDriverInfo}>
            <Text style={styles.trackingDriverName}>Michael is on the way</Text>
            <Text style={styles.trackingDriverCar}>Toyota Camry • ABC 123</Text>
          </View>
          <View style={styles.trackingBadge}>
            <Text style={styles.trackingBadgeText}>En route</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.trackingActions}>
        <TouchableOpacity style={styles.trackingAction}>
          <Feather name="phone" size={20} color="#6B7280" />
          <Text style={styles.trackingActionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.trackingAction}>
          <Feather name="message-circle" size={20} color="#6B7280" />
          <Text style={styles.trackingActionText}>Message</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={handleCancelTrip}
      >
        <Text style={styles.cancelButtonText}>Cancel ride</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const ProfileScreen = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>JD</Text>
        </View>
        <Text style={styles.profileName}>John Doe</Text>
        <Text style={styles.profileEmail}>john.doe@email.com</Text>
        <View style={styles.profileRating}>
          <AntDesign name="star" size={16} color="#FCD34D" />
          <Text style={styles.profileRatingText}>4.8</Text>
          <Text style={styles.profileTrips}>• 127 trips</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>127</Text>
          <Text style={styles.profileStatLabel}>Total Trips</Text>
        </View>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>$1,240</Text>
          <Text style={styles.profileStatLabel}>Total Spent</Text>
        </View>
        <View style={styles.profileStat}>
          <Text style={styles.profileStatValue}>4.8</Text>
          <Text style={styles.profileStatLabel}>Rating</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.profileMenu}>
        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#DBEAFE' }]}>
              <Feather name="users" size={16} color="#2563EB" />
            </View>
            <Text style={styles.profileMenuText}>Personal Information</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#D1FAE5' }]}>
              <AntDesign name="creditcard" size={16} color="#059669" />
            </View>
            <Text style={styles.profileMenuText}>Payment Methods</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#E9D5FF' }]}>
              <AntDesign name="clockcircleo" size={16} color="#7C3AED" />
            </View>
            <Text style={styles.profileMenuText}>Trip History</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Preferences Section */}
      <View style={styles.profileSection}>
        <Text style={styles.profileSectionTitle}>Preferences</Text>
        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#FED7AA' }]}>
              <AntDesign name="staro" size={16} color="#EA580C" />
            </View>
            <Text style={styles.profileMenuText}>Saved Places</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#C7D2FE' }]}>
              <Feather name="shield" size={16} color="#4F46E5" />
            </View>
            <Text style={styles.profileMenuText}>Privacy & Safety</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#F3F4F6' }]}>
              <Feather name="more-horizontal" size={16} color="#6B7280" />
            </View>
            <Text style={styles.profileMenuText}>Settings</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <View style={styles.profileSection}>
        <Text style={styles.profileSectionTitle}>Support</Text>
        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#DBEAFE' }]}>
              <Feather name="message-circle" size={16} color="#2563EB" />
            </View>
            <Text style={styles.profileMenuText}>Help & Support</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.profileMenuItem}>
          <View style={styles.profileMenuLeft}>
            <View style={[styles.profileMenuIcon, { backgroundColor: '#FEF3C7' }]}>
              <AntDesign name="staro" size={16} color="#D97706" />
            </View>
            <Text style={styles.profileMenuText}>Rate the App</Text>
          </View>
          <AntDesign name="right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCurrentScreen = () => {
    if (currentScreen === 'profile') {
      return <ProfileScreen />;
    }

    switch (currentStep) {
      case 'booking':
        return <BookingScreen />;
      case 'selecting':
        return <SelectingScreen />;
      case 'confirmed':
        return <ConfirmedScreen />;
      case 'tracking':
        return <TrackingScreen />;
      default:
        return <BookingScreen />;
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        {/* Header */}
        <View style={styles.appHeader}>
          <View>
            <Text style={styles.appHeaderTitle}>
              {currentScreen === 'profile' ? 'Profile' : 'Rides'}
            </Text>
            {currentStep === 'booking' && currentScreen === 'home' && (
              <Text style={styles.appHeaderSubtitle}>Good afternoon, John</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleToggleProfile}
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>JD</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Back Button for Profile */}
        {currentScreen === 'profile' && (
          <View style={styles.profileBackHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToHome}
            >
              <AntDesign name="arrowleft" size={24} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        )}

        {renderCurrentScreen()}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  appHeaderTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  appHeaderSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  profileBackHeader: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  mapContainer: {
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
  },
  mapGradient: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  mapPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
  },
  mapPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    alignSelf: 'center',
    marginTop: 8,
  },
  locationCard: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  locationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 32,
  },
  addressContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  addressField: {
    minHeight: 56,
    justifyContent: 'center',
  },
  addressFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fromDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginRight: 16,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
  },
  refreshLocationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingLeft: 6,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 14,
  },
  connectorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 16,
  },
  wherePlaceholder: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  addressArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    height: 96,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  primaryButton: {
    height: 56,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  primaryButtonTextDisabled: {
    color: '#9CA3AF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  tripCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tripLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripLocationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  rideOptions: {
    marginBottom: 24,
  },
  rideOption: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  rideOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    elevation: 0,
    shadowOpacity: 0,
  },
  rideOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rideOptionIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rideOptionInfo: {
    flex: 1,
  },
  rideOptionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  rideOptionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  rideOptionDetails: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 16,
  },
  rideOptionDetail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  rideOptionPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  confirmedHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  confirmedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmedIconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  confirmedSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 20,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverRatingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRatingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  driverTrips: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  driverCar: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 12,
  },
  driverAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripDetails: {
    marginBottom: 32,
  },
  tripDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  tripDetailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  tripDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tripDetailTotal: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  tripDetailDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    gap: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  trackingDriver: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -28 }, { translateY: -28 }],
  },
  trackingDriverIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingDriverStatus: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: 'white',
  },
  trackingCard: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
  },
  trackingCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackingInfo: {
    alignItems: 'center',
  },
  trackingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  trackingTime: {
    fontSize: 32,
    fontWeight: '600',
    color: '#111827',
  },
  trackingDistance: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  trackingStatus: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  trackingStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingDriverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  trackingDriverAvatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  trackingDriverInfo: {
    flex: 1,
  },
  trackingDriverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  trackingDriverCar: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  trackingBadge: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  trackingBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  trackingActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  trackingAction: {
    flex: 1,
    height: 56,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  trackingActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  cancelButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 32,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  profileRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  profileRatingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  profileTrips: {
    fontSize: 14,
    color: '#6B7280',
  },
  profileStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  profileStat: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  profileMenu: {
    marginBottom: 32,
  },
  profileMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 4,
  },
  profileMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileMenuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  profileSection: {
    marginBottom: 32,
  },
  profileSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  signOutButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 24,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  loadingMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMapText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  locationPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
  },
  stopField: {
    marginBottom: 12,
  },
  stopDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  removeStopButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopPinText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
