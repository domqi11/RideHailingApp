import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Keyboard,
  StatusBar,
} from 'react-native';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

const { height: screenHeight } = Dimensions.get('window');

interface SimpleLocationInputProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (pickup: any, destination: any) => void;
  currentDestination?: string;
  currentPickup?: string;
  allowPickupEdit?: boolean;
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
  currentPickup,
  allowPickupEdit = false,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [pickupText, setPickupText] = useState(currentPickup || '');
  const [destinationText, setDestinationText] = useState(currentDestination || '');
  const [editingField, setEditingField] = useState<'pickup' | 'destination'>('destination');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation states for confirmation
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const buttonOpacityAnim = useRef(new Animated.Value(1)).current;
  const successScaleAnim = useRef(new Animated.Value(0)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Refs for better performance
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Use environment variable instead of hardcoded key
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setShowPredictions(false);
    setPredictions([]);
    setIsSearching(false);
    setIsSubmitting(false);
  }, []);

  // Optimized field switching
  const switchToField = useCallback((field: 'pickup' | 'destination') => {
    if (editingField !== field) {
      // Add haptic feedback for field switching
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Immediate cleanup and switch
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      setShowPredictions(false);
      setPredictions([]);
      setIsSearching(false);
      
      // Immediate field switch
      setEditingField(field);
    }
  }, [editingField]);

  // Enhanced useEffect with proper cleanup
  React.useEffect(() => {
    isMountedRef.current = true;
    isClosingRef.current = false;

    if (visible) {
      // Immediate state updates for better responsiveness
      setPickupText(currentPickup || '');
      setDestinationText(currentDestination || '');
      // Always start with pickup field when pickup editing is allowed
      setEditingField(allowPickupEdit ? 'pickup' : 'destination');
      getCurrentLocation();
      
      // Faster, smoother opening animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 150,
        friction: 12,
        velocity: 0,
        overshootClamping: false,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 0.5,
      }).start();
    } else {
      isClosingRef.current = true;
      cleanup();
      
      // Faster closing animation
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
        overshootClamping: true,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 0.5,
      }).start();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [visible, currentPickup, currentDestination, allowPickupEdit]);

  // Safe state update helper
  const safeSetState = useCallback((updateFn: () => void) => {
    // Use requestAnimationFrame to schedule updates properly
    requestAnimationFrame(() => {
      if (isMountedRef.current && !isClosingRef.current) {
        updateFn();
      }
    });
  }, []);

  // Test API key function (for debugging)
  const testApiKey = async () => {
    if (!apiKey) {
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=Melbourne,VIC,Australia&key=${apiKey}`
      );
      
      const data = await response.json();
      
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
    // Only test API key once when component mounts and has API key
    if (apiKey && isMountedRef.current) {
      // Schedule API test after component is fully mounted
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          testApiKey();
        }
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [apiKey]);

  const getCurrentLocation = async () => {
    try {
      safeSetState(() => setLoadingLocation(true));
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        safeSetState(() => {
          setCurrentLocation({
            latitude: -37.8136,
            longitude: 144.9631,
            address: 'Current Location (Permission Required)',
          });
          setLoadingLocation(false);
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Use Google's Reverse Geocoding API for better address formatting
      if (apiKey && isMountedRef.current) {
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
            safeSetState(() => {
              setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                address: address,
              });
              setLoadingLocation(false);
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
      safeSetState(() => {
        setCurrentLocation({
          latitude: -37.8136,
          longitude: 144.9631,
          address: 'Melbourne, Australia (Default)',
        });
        setLoadingLocation(false);
      });
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

      safeSetState(() => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address,
        });
        setLoadingLocation(false);
      });
    } catch (error) {
      console.error('Expo geocoding error:', error);
      safeSetState(() => {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: 'Current Location',
        });
        setLoadingLocation(false);
      });
    }
  };

  const searchPlaces = async (query: string) => {
    if (!apiKey || query.length < 2 || !isMountedRef.current) {
      safeSetState(() => {
        setPredictions([]);
        setShowPredictions(false);
        setIsSearching(false);
      });
      return;
    }

    try {
      safeSetState(() => setIsSearching(true));
      
      // Get current location for better biasing if available
      let locationBias = '';
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        // Use actual current location for biasing
        locationBias = `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=100000`;
      } else {
        // Default to Melbourne, Australia center for biasing
        locationBias = '&location=-37.8136,144.9631&radius=200000';
      }
      
      // Try comprehensive search first (like Google Maps)
      let allPredictions = [];
      
      try {
        // Search 1: General places and addresses (most comprehensive)
        const generalResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:au${locationBias}&language=en`
        );
        
        if (generalResponse.ok) {
          const generalData = await generalResponse.json();
          if (generalData.status === 'OK' && generalData.predictions) {
            allPredictions = [...generalData.predictions];
          }
        }
        
        // Search 2: If we don't have many results, try establishment search
        if (allPredictions.length < 4) {
          const establishmentResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=establishment&components=country:au${locationBias}&language=en`
          );
          
          if (establishmentResponse.ok) {
            const establishmentData = await establishmentResponse.json();
            if (establishmentData.status === 'OK' && establishmentData.predictions) {
              // Merge unique results
              const existingPlaceIds = new Set(allPredictions.map(p => p.place_id));
              const newPredictions = establishmentData.predictions.filter(p => !existingPlaceIds.has(p.place_id));
              allPredictions = [...allPredictions, ...newPredictions];
            }
          }
        }
        
        // Search 3: If still not enough, try geocoding search for addresses
        if (allPredictions.length < 4) {
          const addressResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=address&components=country:au${locationBias}&language=en`
          );
          
          if (addressResponse.ok) {
            const addressData = await addressResponse.json();
            if (addressData.status === 'OK' && addressData.predictions) {
              // Merge unique results
              const existingPlaceIds = new Set(allPredictions.map(p => p.place_id));
              const newPredictions = addressData.predictions.filter(p => !existingPlaceIds.has(p.place_id));
              allPredictions = [...allPredictions, ...newPredictions];
            }
          }
        }
      } catch (searchError) {
        console.log('Enhanced search failed, falling back to basic search:', searchError.message);
        
        // Fallback to original search
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:au${locationBias}&language=en`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'OK' && data.predictions) {
          allPredictions = data.predictions;
        }
      }

      if (allPredictions.length > 0 && isMountedRef.current) {
        safeSetState(() => {
          setPredictions(allPredictions.slice(0, 8)); // Take best 8 results
          setShowPredictions(true);
          setIsSearching(false);
        });
      } else {
        console.log('No predictions found for query:', query);
        safeSetState(() => {
          setPredictions([]);
          setShowPredictions(false);
          setIsSearching(false);
        });
      }
    } catch (error) {
      console.log('Places API not available:', error.message);
      safeSetState(() => {
        setPredictions([]);
        setShowPredictions(false);
        setIsSearching(false);
      });
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

  // Optimized text change handler with proper debouncing
  const handleTextChange = useCallback((text: string) => {
    if (editingField === 'pickup') {
      setPickupText(text);
    } else {
      setDestinationText(text);
    }
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Reduced timeout for faster response
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !isClosingRef.current) {
        searchPlaces(text);
      }
    }, 200);
  }, [editingField]);

  const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
    try {
      // Add haptic feedback for selection
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Immediate visual feedback - update text first
      if (editingField === 'pickup') {
        setPickupText(prediction.description);
        // Clear predictions immediately for better UX
        setShowPredictions(false);
        setPredictions([]);
        
        // Get place details in background
        const placeDetails = await getPlaceDetails(prediction.place_id);
        console.log('Pickup place details retrieved:', placeDetails);
        
        // Update parent immediately with new pickup
        let destination = null;
        if (destinationText && destinationText.trim()) {
          destination = { address: destinationText };
        }
        onLocationSelected(placeDetails, destination);
        
        // Switch to destination field smoothly
        setEditingField('destination');
        
        return;
      } else {
        setDestinationText(prediction.description);
        // Clear predictions immediately
        setShowPredictions(false);
        setPredictions([]);

        // Get place details
        const placeDetails = await getPlaceDetails(prediction.place_id);
        console.log('Destination place details retrieved:', placeDetails);
        
        // For destination, use current pickup location
        let pickup = currentLocation;
        if (allowPickupEdit && pickupText && pickupText.trim()) {
          pickup = currentLocation ? {
            ...currentLocation,
            address: pickupText
          } : { address: pickupText };
        }
        
        // Update parent immediately
        onLocationSelected(pickup, placeDetails);
        
        // Close modal with slight delay for smooth transition
        setTimeout(() => {
          handleClose();
        }, 100);
      }
    } catch (error) {
      console.error('Error selecting prediction:', error);
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    }
  }, [editingField, destinationText, allowPickupEdit, pickupText, currentLocation, onLocationSelected]);

  const handleSubmit = useCallback(async () => {
    // If editing pickup and it's empty, require pickup
    if (editingField === 'pickup' && !pickupText.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    
    // If editing destination and it's empty, require destination  
    if (editingField === 'destination' && !destinationText.trim()) {
      Alert.alert('Error', 'Please enter a destination address.');
      return;
    }

    // For pickup editing mode, check if we should switch to destination
    if (allowPickupEdit && editingField === 'pickup' && pickupText.trim() && !destinationText.trim()) {
      // Pickup is filled but destination is empty - switch to destination field
      setEditingField('destination');
      return;
    }

    // For pickup editing, we need both addresses to submit
    if (allowPickupEdit && (!pickupText.trim() || !destinationText.trim())) {
      Alert.alert('Error', 'Please enter both pickup and destination addresses.');
      return;
    }

    // Start confirmation animation
    setIsConfirming(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Button press animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(buttonScaleAnim, {
          toValue: 0.95,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(buttonOpacityAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(buttonScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.timing(buttonOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const currentText = editingField === 'pickup' ? pickupText : destinationText;
    setIsSubmitting(true);

    try {
      // If we have an exact match from predictions, use that
      if (predictions.length > 0) {
        const exactMatch = predictions.find(p => 
          p.description.toLowerCase() === currentText.toLowerCase()
        );
        if (exactMatch) {
          await handlePredictionSelect(exactMatch);
          await showSuccessAnimationAndClose();
          return;
        }
      }

      // Otherwise, try to geocode the entered text
      if (apiKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(currentText)}&key=${apiKey}`
          );
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();

          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const geocodedLocation = {
              latitude: result.geometry.location.lat,
              longitude: result.geometry.location.lng,
              address: result.formatted_address,
            };
            
            if (allowPickupEdit) {
              // Handle both pickup and destination
              let pickup, destination;
              
              if (editingField === 'pickup') {
                pickup = geocodedLocation;
                // If destination is filled, geocode it too
                if (destinationText.trim()) {
                  try {
                    const destResponse = await fetch(
                      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destinationText)}&key=${apiKey}`
                    );
                    const destData = await destResponse.json();
                    if (destData.status === 'OK' && destData.results?.length > 0) {
                      destination = {
                        latitude: destData.results[0].geometry.location.lat,
                        longitude: destData.results[0].geometry.location.lng,
                        address: destData.results[0].formatted_address,
                      };
                    }
                  } catch (error) {
                    console.log('Destination geocoding failed:', error);
                  }
                }
                
                // Switch to destination field instead of closing
                onLocationSelected(pickup, destination);
                setEditingField('destination');
                setIsConfirming(false);
                return;
              } else {
                destination = geocodedLocation;
                // Use pickup text for pickup
                pickup = pickupText.trim() ? { address: pickupText } : currentLocation;
                onLocationSelected(pickup, destination);
                await showSuccessAnimationAndClose();
              }
            } else {
              // Original behavior for destination only
              onLocationSelected(currentLocation, geocodedLocation);
              await showSuccessAnimationAndClose();
            }
          } else {
            console.log('Geocoding response:', data.status, data.error_message);
            setIsConfirming(false);
            Alert.alert('Address Not Found', 'Could not find this address. Please try a different address or check your spelling.');
          }
        } catch (error) {
          console.log('Geocoding not available:', error.message);
          setIsConfirming(false);
          handleBasicSubmit();
        }
      } else {
        setIsConfirming(false);
        handleBasicSubmit();
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [editingField, pickupText, destinationText, allowPickupEdit, predictions, apiKey, currentLocation, handlePredictionSelect, onLocationSelected]);

  const showSuccessAnimationAndClose = useCallback(async () => {
    return new Promise<void>((resolve) => {
      setShowSuccessAnimation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Success animation sequence
      Animated.sequence([
        // Show success checkmark
        Animated.parallel([
          Animated.spring(successScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 6,
          }),
          Animated.timing(successOpacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        // Animate checkmark drawing
        Animated.timing(checkmarkAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Hold for a moment
        Animated.delay(400),
        // Fade out and close
        Animated.parallel([
          Animated.timing(successOpacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: screenHeight,
            useNativeDriver: true,
            tension: 150,
            friction: 12,
            overshootClamping: true,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 0.5,
          }),
        ]),
      ]).start(() => {
        // Reset all animation states
        setIsConfirming(false);
        setShowSuccessAnimation(false);
        successScaleAnim.setValue(0);
        successOpacityAnim.setValue(0);
        checkmarkAnim.setValue(0);
        buttonScaleAnim.setValue(1);
        buttonOpacityAnim.setValue(1);
        
        onClose();
        resolve();
      });
    });
  }, [onClose]);

  const handleBasicSubmit = () => {
    Alert.alert(
      'Basic Mode', 
      'Address validation requires Google Maps setup. The addresses will be saved as entered.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          onPress: () => {
            if (allowPickupEdit) {
              const pickup = {
                latitude: -37.8136, // Mock coordinates
                longitude: 144.9631,
                address: pickupText.trim() || 'Current Location',
              };
              const destination = {
                latitude: -37.8136, // Mock coordinates
                longitude: 144.9631,
                address: destinationText.trim(),
              };
              onLocationSelected(pickup, destination);
            } else {
              const destination = {
                latitude: -37.8136, // Mock coordinates
                longitude: 144.9631,
                address: destinationText.trim(),
              };
              onLocationSelected(currentLocation, destination);
            }
            onClose();
          }
        }
      ]
    );
  };

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    
    isClosingRef.current = true;
    Keyboard.dismiss();
    
    // Clear state immediately
    setShowPredictions(false);
    setPredictions([]);
    setIsSearching(false);
    
    // Faster close animation
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 130,
      friction: 9,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start(() => {
      if (isMountedRef.current) {
        onClose();
      }
    });
  }, [onClose]);

  const renderPrediction = useCallback(({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity 
      style={styles.predictionItem}
      onPress={() => handlePredictionSelect(item)}
      activeOpacity={0.7}
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
  ), [handlePredictionSelect]);

  // Start spinner animation when confirming
  useEffect(() => {
    if (isConfirming) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        { iterations: -1 }
      );
      spinAnimation.start();
      
      return () => {
        spinAnimation.stop();
        spinAnim.setValue(0);
      };
    }
  }, [isConfirming]);

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
              styles.backdrop,
              {
                opacity: slideAnim.interpolate({
                  inputRange: [0, screenHeight],
                  outputRange: [0.6, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [
                  {
                    translateY: slideAnim,
                  },
                ],
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

            {/* Address Fields */}
            <View style={styles.addressFieldsContainer}>
              {/* Pickup Address Field */}
              {allowPickupEdit && (
                <View style={[styles.addressInputField, editingField === 'pickup' && styles.activeField]}>
                  <View style={styles.addressFieldContent}>
                    <View style={[styles.addressDot, { backgroundColor: '#3B82F6' }]} />
                    <View style={styles.addressFieldInfo}>
                      <Text style={styles.fieldLabel}>From</Text>
                      <TextInput
                        style={[
                          styles.addressInput,
                          editingField !== 'pickup' && styles.inactiveAddressInput
                        ]}
                        placeholder={pickupText ? pickupText : (currentLocation?.address || "Tap to enter pickup")}
                        placeholderTextColor={editingField === 'pickup' ? "#9CA3AF" : "#111827"}
                        value={editingField === 'pickup' ? pickupText : ''}
                        onChangeText={handleTextChange}
                        onFocus={() => switchToField('pickup')}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="words"
                        blurOnSubmit={false}
                        editable={true}
                        onSubmitEditing={() => {
                          if (predictions.length > 0) {
                            handlePredictionSelect(predictions[0]);
                          }
                        }}
                      />
                    </View>
                    {editingField === 'pickup' && (
                      <TouchableOpacity 
                        onPress={() => switchToField('destination')} 
                        style={styles.switchFieldButton}
                      >
                        <AntDesign name="down" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Static Pickup Display (when not editable) */}
              {!allowPickupEdit && (
                <View style={styles.addressInputField}>
                  <View style={styles.addressFieldContent}>
                    <View style={[styles.addressDot, { backgroundColor: '#3B82F6' }]} />
                    <View style={styles.addressFieldInfo}>
                      <Text style={styles.fieldLabel}>From</Text>
                      <Text style={styles.addressDisplayText} numberOfLines={1}>
                        {currentLocation?.address || 'Loading your location...'}
                      </Text>
                    </View>
                    {!loadingLocation && (
                      <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
                        <Feather name="refresh-cw" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Journey Connector */}
              <View style={styles.journeyConnector}>
                <View style={styles.connectorLine} />
              </View>

              {/* Destination Address Field */}
              <View style={[styles.addressInputField, editingField === 'destination' && styles.activeField]}>
                <View style={styles.addressFieldContent}>
                  <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                  <View style={styles.addressFieldInfo}>
                    <Text style={styles.fieldLabel}>Where to?</Text>
                    <TextInput
                      style={[
                        styles.addressInput,
                        editingField !== 'destination' && styles.inactiveAddressInput
                      ]}
                      placeholder={destinationText || "Tap to enter destination"}
                      placeholderTextColor={editingField === 'destination' ? "#9CA3AF" : "#111827"}
                      value={editingField === 'destination' ? destinationText : ''}
                      onChangeText={handleTextChange}
                      onFocus={() => switchToField('destination')}
                      autoFocus={!allowPickupEdit && editingField === 'destination'}
                      returnKeyType="search"
                      autoCorrect={false}
                      autoCapitalize="words"
                      blurOnSubmit={false}
                      editable={true}
                      onSubmitEditing={() => {
                        if (predictions.length > 0) {
                          handlePredictionSelect(predictions[0]);
                        }
                      }}
                    />
                  </View>
                  {editingField === 'destination' && allowPickupEdit && (
                    <TouchableOpacity 
                      onPress={() => switchToField('pickup')} 
                      style={styles.switchFieldButton}
                    >
                      <AntDesign name="up" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Predictions Dropdown */}
            {(showPredictions && predictions.length > 0) || isSearching ? (
              <View style={styles.predictionsContainer}>
                {isSearching ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={predictions}
                    renderItem={renderPrediction}
                    keyExtractor={(item) => item.place_id}
                    style={styles.predictionsList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={true}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    updateCellsBatchingPeriod={50}
                    windowSize={10}
                    getItemLayout={(data, index) => ({
                      length: 60,
                      offset: 60 * index,
                      index,
                    })}
                    contentContainerStyle={styles.predictionsContent}
                  />
                )}
              </View>
            ) : null}

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

            {/* Submit Button */}
            <View style={styles.submitSection}>
              <TouchableOpacity 
                style={[
                  styles.submitButton, 
                  ((!destinationText.trim() && editingField === 'destination') || (!pickupText.trim() && editingField === 'pickup') || (!allowPickupEdit && !currentLocation) || isSubmitting || isConfirming) && styles.submitButtonDisabled,
                  { 
                    transform: [{ scale: buttonScaleAnim }],
                    opacity: buttonOpacityAnim,
                  }
                ]}
                onPress={handleSubmit}
                disabled={(!destinationText.trim() && editingField === 'destination') || (!pickupText.trim() && editingField === 'pickup') || (!allowPickupEdit && !currentLocation) || isSubmitting || isConfirming}
                activeOpacity={0.9}
              >
                {isConfirming && !showSuccessAnimation ? (
                  <View style={styles.confirmingContent}>
                    <Animated.View 
                      style={[
                        styles.loadingSpinner,
                        {
                          transform: [
                            {
                              rotate: spinAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                              }),
                            },
                          ],
                        }
                      ]}
                    />
                    <Text style={styles.confirmingText}>Confirming...</Text>
                  </View>
                ) : (
                  <Text style={[
                    styles.submitButtonText, 
                    ((!destinationText.trim() && editingField === 'destination') || (!pickupText.trim() && editingField === 'pickup') || (!allowPickupEdit && !currentLocation) || isSubmitting || isConfirming) && styles.submitButtonTextDisabled
                  ]}>
                    {isSubmitting && !isConfirming ? 'Processing...' : 
                     allowPickupEdit && editingField === 'pickup' && pickupText.trim() && !destinationText.trim() ? 'Next: Enter Destination' :
                     allowPickupEdit && (!pickupText.trim() || !destinationText.trim()) ? 'Enter Address' :
                     'Confirm Addresses'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Success Animation Overlay */}
            {showSuccessAnimation && (
              <Animated.View 
                style={[
                  styles.successOverlay,
                  {
                    opacity: successOpacityAnim,
                    transform: [{ scale: successScaleAnim }],
                  }
                ]}
              >
                <View style={styles.successContainer}>
                  <Animated.View 
                    style={[
                      styles.successCheckmark,
                      {
                        transform: [
                          {
                            scale: checkmarkAnim.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 1.2, 1],
                            }),
                          },
                        ],
                      }
                    ]}
                  >
                    <AntDesign name="check" size={32} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.successText}>Addresses Confirmed!</Text>
                </View>
              </Animated.View>
            )}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'black',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: screenHeight * 0.6,
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
  addressFieldsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addressInputField: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  addressFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  addressFieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  addressInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 2,
    borderColor: '#3B82F6',
    marginBottom: 12,
  },
  inactiveAddressInput: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 0,
    height: 'auto',
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  addressDisplayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyConnector: {
    marginVertical: 12,
  },
  connectorLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  predictionsContainer: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 1000,
    height: 200,
  },
  predictionsList: {
    flex: 1,
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
  submitSection: {
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  activeField: {
    borderBottomColor: '#3B82F6',
  },
  switchFieldButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  predictionsContent: {
    padding: 12,
  },
  confirmingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderTopColor: 'transparent',
    marginRight: 10,
  },
  confirmingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  successContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  successCheckmark: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
});

export default SimpleLocationInput; 