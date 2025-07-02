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
  PanResponder,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import FullScreenAddressInput from './FullScreenAddressInput';

const { height: screenHeight } = Dimensions.get('window');

interface SimpleLocationInputProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (pickup: any, destination: any) => void;
  currentDestination?: string;
  currentPickup?: string;
  allowPickupEdit?: boolean;
  stops?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    address: string;
    order: number;
  }>;
  onStopsUpdated?: (stops: Array<{
    id: string;
    latitude: number;
    longitude: number;
    address: string;
    order: number;
  }>) => void;
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
  stops = [],
  onStopsUpdated,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [pickupText, setPickupText] = useState(currentPickup || '');
  const [destinationText, setDestinationText] = useState(currentDestination || '');
  const [editingField, setEditingField] = useState<'pickup' | 'destination' | 'stop'>('destination');
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [stopText, setStopText] = useState('');
  const [localStops, setLocalStops] = useState(stops);
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

  // Drag and drop states
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;

  // Refs for better performance
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use environment variable instead of hardcoded key
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Full-screen address input states
  const [showFullScreenInput, setShowFullScreenInput] = useState(false);
  const [fullScreenFieldType, setFullScreenFieldType] = useState<'pickup' | 'destination' | 'stop'>('destination');
  const [fullScreenFieldLabel, setFullScreenFieldLabel] = useState('');
  const [fullScreenInitialValue, setFullScreenInitialValue] = useState('');

  // Cleanup function
  const cleanup = useCallback(() => {
    try {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    } catch (error) {
      // Handle timeout cleanup error
      searchTimeoutRef.current = null;
      cleanupTimeoutRef.current = null;
    }
    
    try {
      setShowPredictions(false);
      setPredictions([]);
      setIsSearching(false);
      setIsSubmitting(false);
      setIsDragging(false);
      setDraggedStopId(null);
    } catch (stateError) {
      // Silently handle state cleanup errors
    }
  }, []);

  // Optimized field switching with cleanup
  const switchToField = useCallback((field: 'pickup' | 'destination' | 'stop', stopId?: string) => {
    try {
      // Clean up incomplete stops before switching fields (except when switching to edit an incomplete stop)
      if (field !== 'stop' || !stopId) {
        const incompleteStops = localStops.filter(stop => 
          stop && stop.latitude === 0 && stop.longitude === 0 && stop.address === ''
        );
        
        if (incompleteStops.length > 0) {
          const cleanedStops = localStops.filter(stop => 
            stop && !(stop.latitude === 0 && stop.longitude === 0 && stop.address === '')
          );
          setLocalStops(cleanedStops);
          
          // If we were editing an incomplete stop, clear the editing state
          if (editingField === 'stop' && incompleteStops.some(stop => stop.id === editingStopId)) {
            setEditingStopId(null);
            setStopText('');
          }
        }
      }
      
      if (editingField !== field || (field === 'stop' && editingStopId !== stopId)) {
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
        
        // Set editing field and stop ID
        setEditingField(field);
        if (field === 'stop' && stopId) {
          setEditingStopId(stopId);
          const stop = localStops.find(s => s && s.id === stopId);
          setStopText(stop?.address || '');
        } else {
          setEditingStopId(null);
          setStopText('');
        }
      }
    } catch (error) {
      // Handle field switching errors
      try {
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
        setShowPredictions(false);
        setPredictions([]);
      } catch (recoveryError) {
        // Last resort recovery
      }
    }
  }, [editingField, editingStopId, localStops]);

  // Helper function to count real stops (excluding temporary ones)
  const getRealStopsCount = useCallback(() => {
    return localStops.filter(stop => 
      stop && stop.latitude !== 0 && 
      stop.longitude !== 0 && 
      stop.address !== ''
    ).length;
  }, [localStops]);

  // Simple add stop function - just adds a new field
  const handleAddStop = useCallback(() => {
    try {
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Check for maximum stops limit (5 stops maximum)
      if (localStops.length >= 5) {
        Alert.alert('Limit Reached', 'You can add up to 5 stops maximum.');
        return;
      }
      
      // Check if there's already an incomplete stop being edited
      const incompleteStop = localStops.find(stop => 
        stop && stop.latitude === 0 && stop.longitude === 0 && stop.address === ''
      );
      
      if (incompleteStop) {
        // Focus on the existing incomplete stop instead of creating a new one
        setEditingField('stop');
        setEditingStopId(incompleteStop.id);
        setStopText('');
        return;
      }
      
      // Create a simple new stop
      const newStop = {
        id: `stop_${Date.now()}`,
        latitude: 0,
        longitude: 0,
        address: '',
        order: localStops.length + 1,
      };
      
      // Add to the stops array
      const updatedStops = [...localStops, newStop];
      setLocalStops(updatedStops);
      
      // Switch to editing the new stop
      setEditingField('stop');
      setEditingStopId(newStop.id);
      setStopText('');
    } catch (error) {
      // Handle add stop errors gracefully
      Alert.alert('Error', 'Unable to add stop. Please try again.');
    }
  }, [localStops]);

  const handleRemoveStop = useCallback((stopId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const updatedStops = localStops.filter(stop => stop && stop.id !== stopId)
        .map((stop, index) => ({ ...stop, order: index + 1 }));
      
      setLocalStops(updatedStops);
      
      // Only notify parent if this is a real stop (has actual coordinates)
      const removedStop = localStops.find(stop => stop && stop.id === stopId);
      if (removedStop && removedStop.latitude !== 0 && removedStop.longitude !== 0 && onStopsUpdated) {
        onStopsUpdated(updatedStops);
      }
      
      // If we were editing this stop, switch to destination
      if (editingStopId === stopId) {
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
      }
    } catch (error) {
      // Handle remove stop errors gracefully
      try {
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
      } catch (recoveryError) {
        // Last resort recovery
      }
    }
  }, [localStops, editingStopId, onStopsUpdated]);

  // Function to clean up incomplete stops - more aggressive cleanup
  const cleanupIncompleteStops = useCallback(() => {
    try {
      // Remove ALL incomplete stops (those without coordinates and address)
      const completeStops = localStops.filter(stop => 
        stop && 
        stop.latitude !== 0 && 
        stop.longitude !== 0 && 
        stop.address && 
        stop.address.trim() !== ''
      );
      
      // Always update local state if there are any incomplete stops
      if (completeStops.length !== localStops.length) {
        setLocalStops(completeStops);
        
        // CRITICAL FIX: Only notify parent if we're NOT closing the modal
        // Calling onStopsUpdated during modal closing causes the app to become unresponsive
        if (!isClosingRef.current && onStopsUpdated && typeof onStopsUpdated === 'function') {
          // Use a small delay to ensure the state update happens safely
          setTimeout(() => {
            if (!isClosingRef.current && isMountedRef.current) {
              onStopsUpdated(completeStops);
            }
          }, 50);
        }
        
        // If we were editing an incomplete stop, reset editing state
        if (editingField === 'stop' && editingStopId) {
          const wasIncomplete = !localStops.find(stop => 
            stop && stop.id === editingStopId && 
            stop.latitude !== 0 && stop.longitude !== 0 && 
            stop.address && stop.address.trim() !== ''
          );
          
          if (wasIncomplete) {
            setEditingField('destination');
            setEditingStopId(null);
            setStopText('');
          }
        }
      }
    } catch (error) {
      // If cleanup fails, clear everything as a safety measure
      try {
        setLocalStops([]);
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
        
        // CRITICAL FIX: Only notify parent if we're NOT closing
        if (!isClosingRef.current && onStopsUpdated && typeof onStopsUpdated === 'function') {
          setTimeout(() => {
            if (!isClosingRef.current && isMountedRef.current) {
              onStopsUpdated([]);
            }
          }, 50);
        }
      } catch (recoveryError) {
        // Last resort - do nothing
      }
    }
  }, [localStops, onStopsUpdated, editingField, editingStopId]);

  const handleStopAdded = useCallback((stopLocation: any) => {
    try {
      // Validate stop location
      if (!stopLocation || !stopLocation.latitude || !stopLocation.longitude || !stopLocation.address) {
        Alert.alert('Error', 'Invalid location data. Please try selecting a different address.');
        return;
      }
      
      const stopId = editingStopId || `stop_${Date.now()}`;
      const existingStopIndex = localStops.findIndex(s => s && s.id === stopId);
      
      if (existingStopIndex >= 0) {
        // Update existing stop (including temporary ones)
        const updatedStops = [...localStops];
        updatedStops[existingStopIndex] = {
          ...updatedStops[existingStopIndex],
          latitude: stopLocation.latitude,
          longitude: stopLocation.longitude,
          address: stopLocation.address,
        };
        setLocalStops(updatedStops);
        if (onStopsUpdated && typeof onStopsUpdated === 'function') {
          onStopsUpdated(updatedStops);
        }
      } else {
        // Check for maximum stops limit (5 stops maximum)
        const realStopsCount = getRealStopsCount();
        
        if (realStopsCount >= 5) {
          Alert.alert('Limit Reached', 'You can add up to 5 stops maximum.');
          return;
        }
        
        // Add new stop (fallback case)
        const newStop = {
          id: stopId,
          latitude: stopLocation.latitude,
          longitude: stopLocation.longitude,
          address: stopLocation.address,
          order: localStops.length + 1,
        };
        const updatedStops = [...localStops, newStop];
        setLocalStops(updatedStops);
        if (onStopsUpdated && typeof onStopsUpdated === 'function') {
          onStopsUpdated(updatedStops);
        }
      }
      
      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Clear stop text and switch to destination
      setStopText('');
      setEditingStopId(null);
      setEditingField('destination');
    } catch (error) {
      Alert.alert('Error', 'Failed to add stop. Please try again.');
      // Reset editing state on error
      setEditingStopId(null);
      setStopText('');
      setEditingField('destination');
    }
  }, [editingStopId, localStops, onStopsUpdated, getRealStopsCount]);

  // Address reordering functions
  const handleMoveStopUp = useCallback((stopId: string) => {
    const stopIndex = localStops.findIndex(s => s && s.id === stopId);
    if (stopIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updatedStops = [...localStops];
      [updatedStops[stopIndex], updatedStops[stopIndex - 1]] = [updatedStops[stopIndex - 1], updatedStops[stopIndex]];
      
      // Update order numbers
      const reorderedStops = updatedStops.map((stop, index) => ({
        ...stop,
        order: index + 1,
      }));
      
      setLocalStops(reorderedStops);
      onStopsUpdated?.(reorderedStops);
    }
  }, [localStops, onStopsUpdated]);

  const handleMoveStopDown = useCallback((stopId: string) => {
    const stopIndex = localStops.findIndex(s => s && s.id === stopId);
    if (stopIndex < localStops.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updatedStops = [...localStops];
      [updatedStops[stopIndex], updatedStops[stopIndex + 1]] = [updatedStops[stopIndex + 1], updatedStops[stopIndex]];
      
      // Update order numbers
      const reorderedStops = updatedStops.map((stop, index) => ({
        ...stop,
        order: index + 1,
      }));
      
      setLocalStops(reorderedStops);
      onStopsUpdated?.(reorderedStops);
    }
  }, [localStops, onStopsUpdated]);

  // Drag and drop functionality
  const createPanResponder = useCallback((stopId: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start dragging if significant movement
        return Math.abs(gestureState.dy) > 10;
      },
      
      onPanResponderGrant: () => {
        setIsDragging(true);
        setDraggedStopId(stopId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Scale up animation
        Animated.spring(dragScale, {
          toValue: 1.05,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }).start();
      },
      
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);
      },
      
      onPanResponderRelease: (_, gestureState) => {
        const stopIndex = localStops.findIndex(s => s && s.id === stopId);
        const threshold = 60; // Minimum distance to trigger reorder
        
        let targetIndex = stopIndex;
        
        if (gestureState.dy > threshold && stopIndex < localStops.length - 1) {
          // Move down
          targetIndex = stopIndex + 1;
        } else if (gestureState.dy < -threshold && stopIndex > 0) {
          // Move up
          targetIndex = stopIndex - 1;
        }
        
        // Perform reorder if target changed
        if (targetIndex !== stopIndex) {
          const updatedStops = [...localStops];
          const [movedStop] = updatedStops.splice(stopIndex, 1);
          updatedStops.splice(targetIndex, 0, movedStop);
          
          // Update order numbers
          const reorderedStops = updatedStops.map((stop, index) => ({
            ...stop,
            order: index + 1,
          }));
          
          setLocalStops(reorderedStops);
          onStopsUpdated?.(reorderedStops);
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Reset animations
        Animated.parallel([
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
          }),
          Animated.spring(dragScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
          }),
        ]).start();
        
        setIsDragging(false);
        setDraggedStopId(null);
      },
    });
  }, [localStops, onStopsUpdated, dragY, dragScale]);

  // Enhanced useEffect with proper cleanup
  React.useEffect(() => {
    try {
      isMountedRef.current = true;
      isClosingRef.current = false;

      if (visible) {
        // Immediate state updates for better responsiveness
        setPickupText(currentPickup || '');
        setDestinationText(currentDestination || '');
        
        // ONLY sync local stops with props when modal first opens (not when localStops changes)
        // This prevents the infinite loop where adding stops gets reset
        if (Array.isArray(stops)) {
          setLocalStops(stops);
        } else {
          setLocalStops([]);
        }
        
        // Reset editing state when modal opens
        if (!editingStopId) {
          setEditingField(allowPickupEdit ? 'pickup' : 'destination');
        }
        
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
        
        // Reset all editing states when closing
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
        
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
    } catch (error) {
      // Handle any errors during setup
      try {
        setLocalStops([]);
        setEditingField('destination');
        setEditingStopId(null);
        setStopText('');
      } catch (recoveryError) {
        // Last resort recovery
      }
    }

    return () => {
      try {
        isMountedRef.current = false;
        cleanup();
      } catch (cleanupError) {
        // Silently handle cleanup errors
      }
    };
  }, [visible, currentPickup, currentDestination, allowPickupEdit]);

  // Safe state update helper
  const safeSetState = useCallback((updateFn: () => void) => {
    try {
      // Use requestAnimationFrame to schedule updates properly
      requestAnimationFrame(() => {
        try {
          if (isMountedRef.current && !isClosingRef.current && typeof updateFn === 'function') {
            updateFn();
          }
        } catch (updateError) {
          // Silently handle update errors
        }
      });
    } catch (error) {
      // Handle requestAnimationFrame errors
      try {
        if (isMountedRef.current && !isClosingRef.current && typeof updateFn === 'function') {
          updateFn();
        }
      } catch (fallbackError) {
        // Last resort - do nothing
      }
    }
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
        // API Key denied - silently fail for better UX
      } else if (data.status === 'OK') {
        // API Key working - silently succeed
      }
    } catch (error) {
      // API Test failed - silently fail for better UX
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
            throw new Error(`Geocoding failed: ${data.status}`);
          }
        } catch (googleError) {
          // Fall back to Expo's reverse geocoding
          await fallbackToExpoGeocoding(location);
        }
      } else {
        // Fall back to Expo's reverse geocoding if no valid API key
        await fallbackToExpoGeocoding(location);
      }
    } catch (error) {
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
        safeSetState(() => {
          setPredictions([]);
          setShowPredictions(false);
          setIsSearching(false);
        });
      }
    } catch (error) {
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
      throw error;
    }
  };

  // Enhanced handleTextChange with improved performance
  const handleTextChange = useCallback((text: string) => {
    // Update the appropriate text field
    if (editingField === 'pickup') {
      setPickupText(text);
    } else if (editingField === 'destination') {
      setDestinationText(text);
    } else if (editingField === 'stop') {
      setStopText(text);
    }
    
    // Cancel previous search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If text is empty, hide predictions immediately
    if (!text.trim()) {
      setShowPredictions(false);
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    // Shorter debounce for better responsiveness
    searchTimeoutRef.current = setTimeout(() => {
      safeSetState(() => {
        if (isMountedRef.current && !isClosingRef.current && text.trim()) {
          searchPlaces(text);
        }
      });
    }, 200);
  }, [editingField, safeSetState]);

  const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
    try {
      // IMMEDIATE UI updates first - no delays
      setShowPredictions(false);
      setPredictions([]);
      setIsSearching(false);
      
      // Add haptic feedback for selection
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Immediate visual feedback - update text first
      if (editingField === 'pickup') {
        setPickupText(prediction.description);
        
        // Get place details in background
        const placeDetails = await getPlaceDetails(prediction.place_id);
        
        // Update parent immediately with new pickup
        let destination = null;
        if (destinationText && destinationText.trim()) {
          destination = { address: destinationText };
        }
        onLocationSelected(placeDetails, destination);
        
        // Switch to destination field smoothly
        setEditingField('destination');
        
        return;
      } else if (editingField === 'stop') {
        setStopText(prediction.description);

        // Get place details for stop
        const placeDetails = await getPlaceDetails(prediction.place_id);
        
        // Add or update the stop
        handleStopAdded(placeDetails);
        
        return;
      } else {
        setDestinationText(prediction.description);

        // Get place details
        const placeDetails = await getPlaceDetails(prediction.place_id);
        
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
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    }
  }, [editingField, destinationText, allowPickupEdit, pickupText, currentLocation, onLocationSelected, handleStopAdded]);

  const handleSubmit = useCallback(async () => {
    // If editing pickup and it's empty, require pickup
    if (editingField === 'pickup' && !pickupText.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    
    // If editing destination and it's empty, and we have no stops, require destination  
    if (editingField === 'destination' && !destinationText.trim() && getRealStopsCount() === 0) {
      Alert.alert('Error', 'Please enter a destination address or add at least one stop.');
      return;
    }

    // For pickup editing mode, check if we should switch to destination
    if (allowPickupEdit && editingField === 'pickup' && pickupText.trim() && !destinationText.trim() && getRealStopsCount() === 0) {
      // Pickup is filled but destination is empty and no stops - switch to destination field
      setEditingField('destination');
      return;
    }

    // For pickup editing, we need either a destination OR stops to submit
    if (allowPickupEdit && !pickupText.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    
    if (allowPickupEdit && !destinationText.trim() && getRealStopsCount() === 0) {
      Alert.alert('Error', 'Please enter a destination address or add at least one stop.');
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
                    // Destination geocoding failed - continue without it
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
            setIsConfirming(false);
            Alert.alert('Address Not Found', 'Could not find this address. Please try a different address or check your spelling.');
          }
        } catch (error) {
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
  }, [editingField, pickupText, destinationText, allowPickupEdit, predictions, apiKey, currentLocation, handlePredictionSelect, onLocationSelected, getRealStopsCount]);

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
    const currentText = editingField === 'pickup' ? pickupText : destinationText;
    
    // Don't allow submission with empty addresses
    if (!currentText || !currentText.trim()) {
      Alert.alert('Error', 'Please enter an address before continuing.');
      return;
    }

    Alert.alert(
      'Basic Mode', 
      'Address validation requires Google Maps setup. The addresses will be saved as entered.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          onPress: () => {
            try {
              if (allowPickupEdit) {
                // Validate both pickup and destination
                if (!pickupText.trim()) {
                  Alert.alert('Error', 'Please enter a pickup address.');
                  return;
                }
                
                if (!destinationText.trim() && getRealStopsCount() === 0) {
                  Alert.alert('Error', 'Please enter a destination address or add at least one stop.');
                  return;
                }

                const pickup = {
                  latitude: -37.8136, // Mock coordinates
                  longitude: 144.9631,
                  address: pickupText.trim(),
                };
                
                // Only create destination if we have destination text
                let destination = null;
                if (destinationText.trim()) {
                  destination = {
                    latitude: -37.8136, // Mock coordinates
                    longitude: 144.9631,
                    address: destinationText.trim(),
                  };
                }
                
                onLocationSelected(pickup, destination);
              } else {
                // For destination-only mode, ensure we have destination text
                if (!destinationText.trim()) {
                  Alert.alert('Error', 'Please enter a destination address.');
                  return;
                }

                const destination = {
                  latitude: -37.8136, // Mock coordinates
                  longitude: 144.9631,
                  address: destinationText.trim(),
                };
                onLocationSelected(currentLocation, destination);
              }
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to process addresses. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleClose = useCallback(() => {
    try {
      if (isClosingRef.current) return;
      
      isClosingRef.current = true;
      Keyboard.dismiss();
      
      // Store the current state for final cleanup
      const currentIncompleteStops = localStops.filter(stop => 
        stop && (
          stop.latitude === 0 || 
          stop.longitude === 0 || 
          !stop.address || 
          stop.address.trim() === ''
        )
      );
      const shouldNotifyParent = currentIncompleteStops.length > 0;
      
      // Clean up any incomplete stops locally (but don't notify parent yet)
      const completeStops = localStops.filter(stop => 
        stop && 
        stop.latitude !== 0 && 
        stop.longitude !== 0 && 
        stop.address && 
        stop.address.trim() !== ''
      );
      setLocalStops(completeStops);
      
      // Clear state immediately with safety checks
      setShowPredictions(false);
      setPredictions([]);
      setIsSearching(false);
      setIsSubmitting(false);
      setIsConfirming(false);
      
      // Reset editing states
      setEditingField('destination');
      setEditingStopId(null);
      setStopText('');
      
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
        try {
          // CRITICAL FIX: Only call onClose first, then handle cleanup
          if (isMountedRef.current && onClose && typeof onClose === 'function') {
            onClose();
          }
          
          // CRITICAL FIX: Perform final parent state update AFTER modal is closed
          // This prevents the app from becoming unresponsive
          if (shouldNotifyParent && onStopsUpdated && typeof onStopsUpdated === 'function') {
            setTimeout(() => {
              if (isMountedRef.current) {
                onStopsUpdated(completeStops);
              }
            }, 100); // Give the modal time to fully close
          }
          
          // Final state reset
          isClosingRef.current = false;
        } catch (closeError) {
          // Silently handle close errors
          isClosingRef.current = false;
        }
      });
    } catch (error) {
      // If anything fails, force close
      try {
        isClosingRef.current = false;
        if (onClose && typeof onClose === 'function') {
          onClose();
        }
      } catch (finalError) {
        // Last resort - do nothing
      }
    }
  }, [onClose, localStops, onStopsUpdated]);

  const renderPrediction = useCallback(({ item }: { item: PlacePrediction }) => (
    <Pressable 
      style={({ pressed }) => [
        styles.predictionItem,
        pressed && { backgroundColor: '#F3F4F6' }
      ]}
      onPress={() => {
        // Prevent keyboard dismissal by handling the event immediately
        handlePredictionSelect(item);
      }}
      unstable_pressDelay={0}
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
    </Pressable>
  ), [handlePredictionSelect]);

  // Auto-cleanup incomplete stops when not editing them
  useEffect(() => {
    // CRITICAL FIX: Don't cleanup during modal closing to prevent unresponsive state
    if (isClosingRef.current) {
      return;
    }
    
    // Only cleanup if we're not currently editing a stop field
    if (editingField !== 'stop') {
      const incompleteStops = localStops.filter(stop => 
        stop && stop.latitude === 0 && stop.longitude === 0 && (!stop.address || stop.address.trim() === '')
      );
      
      if (incompleteStops.length > 0) {
        // Small delay to allow for quick field switches
        const timeoutId = setTimeout(() => {
          // Double-check we're still not closing before cleanup
          if (!isClosingRef.current) {
            cleanupIncompleteStops();
          }
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [editingField, localStops, cleanupIncompleteStops]);

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

  // Function to open full-screen address input
  const openFullScreenInput = useCallback((fieldType: 'pickup' | 'destination' | 'stop', label: string, initialValue: string = '', stopId?: string) => {
    setFullScreenFieldType(fieldType);
    setFullScreenFieldLabel(label);
    setFullScreenInitialValue(initialValue);
    
    // Store the stop ID if editing a stop
    if (fieldType === 'stop' && stopId) {
      setEditingStopId(stopId);
    }
    
    setShowFullScreenInput(true);
  }, []);

  // Function to handle address selection from full-screen input
  const handleFullScreenAddressSelected = useCallback((address: any) => {
    try {
      if (fullScreenFieldType === 'pickup') {
        setPickupText(address.address);
        
        // Update parent immediately with new pickup
        let destination = null;
        if (destinationText && destinationText.trim()) {
          destination = { address: destinationText };
        }
        onLocationSelected(address, destination);
        
      } else if (fullScreenFieldType === 'stop') {
        // Handle stop address selection
        if (editingStopId) {
          const existingStopIndex = localStops.findIndex(s => s && s.id === editingStopId);
          
          if (existingStopIndex >= 0) {
            // Update existing stop
            const updatedStops = [...localStops];
            updatedStops[existingStopIndex] = {
              ...updatedStops[existingStopIndex],
              latitude: address.latitude,
              longitude: address.longitude,
              address: address.address,
            };
            setLocalStops(updatedStops);
            if (onStopsUpdated && typeof onStopsUpdated === 'function') {
              onStopsUpdated(updatedStops);
            }
          } else {
            // Add new stop (fallback case)
            const newStop = {
              id: editingStopId || `stop_${Date.now()}`,
              latitude: address.latitude,
              longitude: address.longitude,
              address: address.address,
              order: localStops.length + 1,
            };
            const updatedStops = [...localStops, newStop];
            setLocalStops(updatedStops);
            if (onStopsUpdated && typeof onStopsUpdated === 'function') {
              onStopsUpdated(updatedStops);
            }
          }
          
          // Success feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Clear editing state
          setEditingStopId(null);
        }
        
      } else {
        // Handle destination
        setDestinationText(address.address);
        
        // For destination, use current pickup location
        let pickup = currentLocation;
        if (allowPickupEdit && pickupText && pickupText.trim()) {
          pickup = currentLocation ? {
            ...currentLocation,
            address: pickupText
          } : { address: pickupText };
        }
        
        // Update parent immediately
        onLocationSelected(pickup, address);
        
        // Close main modal after a short delay
        setTimeout(() => {
          handleClose();
        }, 300);
      }
      
      // Close full-screen input
      setShowFullScreenInput(false);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to process address. Please try again.');
      setShowFullScreenInput(false);
    }
  }, [fullScreenFieldType, editingStopId, localStops, destinationText, allowPickupEdit, pickupText, currentLocation, onLocationSelected, onStopsUpdated]);

  // Function to close full-screen input
  const handleFullScreenClose = useCallback(() => {
    setShowFullScreenInput(false);
    setEditingStopId(null);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
        enabled={true}
      >
        <View style={styles.overlay}>
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
            pointerEvents="none"
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
            <View style={{ flex: 1 }}>
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
              <ScrollView 
                style={styles.addressFieldsContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                scrollEventThrottle={16}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                {/* Pickup Address Field */}
                {allowPickupEdit && (
                  <TouchableOpacity 
                    style={styles.addressInputField}
                    onPress={() => openFullScreenInput('pickup', 'Enter pickup address', pickupText)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressFieldContent}>
                      <View style={[styles.addressDot, { backgroundColor: '#3B82F6' }]} />
                      <View style={styles.addressFieldInfo}>
                        <Text style={styles.fieldLabel}>From</Text>
                        <Text style={[
                          styles.addressDisplayText,
                          !pickupText && styles.placeholderText
                        ]}>
                          {pickupText || (currentLocation?.address || "Tap to enter pickup")}
                        </Text>
                      </View>
                      <AntDesign name="right" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Inline Predictions for Pickup Field */}
                {allowPickupEdit && editingField === 'pickup' && ((showPredictions && predictions.length > 0) || isSearching) && (
                  <View style={styles.inlinePredictionsContainer}>
                    {isSearching ? (
                      <View style={styles.inlineLoadingContainer}>
                        <Text style={styles.loadingText}>Searching...</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={predictions}
                        renderItem={renderPrediction}
                        keyExtractor={(item) => item.place_id}
                        style={styles.inlinePredictionsList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                        removeClippedSubviews={false}
                        initialNumToRender={6}
                        maxToRenderPerBatch={6}
                        scrollEnabled={false}
                        nestedScrollEnabled={false}
                        disableIntervalMomentum={true}
                        disableScrollViewPanResponder={true}
                      />
                    )}
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

                {/* Destination Address Field - Always at the bottom */}
                <TouchableOpacity 
                  style={styles.addressInputField}
                  onPress={() => openFullScreenInput('destination', 'Enter destination', destinationText)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressFieldContent}>
                    <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                    <View style={styles.addressFieldInfo}>
                      <Text style={styles.fieldLabel}>Where to?</Text>
                      <Text style={[
                        styles.addressDisplayText,
                        !destinationText && styles.placeholderText
                      ]}>
                        {destinationText || "Tap to enter destination"}
                      </Text>
                    </View>
                    <AntDesign name="right" size={16} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>

                {/* Inline Predictions for Destination Field */}
                {editingField === 'destination' && ((showPredictions && predictions.length > 0) || isSearching) && (
                  <View style={styles.inlinePredictionsContainer}>
                    {isSearching ? (
                      <View style={styles.inlineLoadingContainer}>
                        <Text style={styles.loadingText}>Searching...</Text>
                      </View>
                    ) : (
                      <FlatList
                        data={predictions}
                        renderItem={renderPrediction}
                        keyExtractor={(item) => item.place_id}
                        style={styles.inlinePredictionsList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                        removeClippedSubviews={false}
                        initialNumToRender={6}
                        maxToRenderPerBatch={6}
                        scrollEnabled={false}
                        nestedScrollEnabled={false}
                        disableIntervalMomentum={true}
                        disableScrollViewPanResponder={true}
                      />
                    )}
                  </View>
                )}

                {/* Add Stop Button - Now appears after destination */}
                <TouchableOpacity 
                  style={[styles.addStopButton, styles.highlightNewFeature]} 
                  onPress={handleAddStop}
                >
                  <View style={styles.addStopContent}>
                    <View style={styles.addStopIcon}>
                      <AntDesign name="plus" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.addStopText}>
                      Add stop
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Stops Section - Redesigned to match From/Where to fields */}
                {Array.isArray(localStops) && localStops.map((stop, index) => {
                  if (!stop || !stop.id) return null;
                  
                  const isEditingThisStop = editingField === 'stop' && editingStopId === stop.id;
                  const isNewStop = stop.latitude === 0 && stop.longitude === 0 && stop.address === '';
                  const hasAddress = stop.address && stop.address.trim() !== '';
                  
                  return (
                    <View key={stop.id}>
                      {/* Journey Connector */}
                      <View style={styles.journeyConnector}>
                        <View style={styles.connectorLine} />
                      </View>
                      
                      {/* Stop Address Field - Same design as From/Where to */}
                      <TouchableOpacity 
                        style={styles.addressInputField}
                        onPress={() => openFullScreenInput('stop', `Stop ${index + 1}`, stop.address, stop.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.addressFieldContent}>
                          <View style={[styles.addressDot, { backgroundColor: '#10B981' }]} />
                          <View style={styles.addressFieldInfo}>
                            <Text style={styles.fieldLabel}>Stop {index + 1}</Text>
                            <Text style={[
                              styles.addressDisplayText,
                              !hasAddress && styles.placeholderText
                            ]}>
                              {hasAddress ? stop.address : "Tap to add stop address"}
                            </Text>
                          </View>
                          
                          {/* Stop Actions - Compact design matching other fields */}
                          <View style={styles.stopFieldActions}>
                            {/* Reorder Controls */}
                            {localStops.length > 1 && (
                              <View style={styles.compactReorderContainer}>
                                <TouchableOpacity 
                                  onPress={() => handleMoveStopUp(stop.id)}
                                  style={[
                                    styles.compactReorderBtn, 
                                    index === 0 && styles.reorderBtnDisabled
                                  ]}
                                  disabled={index === 0}
                                >
                                  <AntDesign 
                                    name="up" 
                                    size={10} 
                                    color={index === 0 ? "#D1D5DB" : "#6B7280"} 
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  onPress={() => handleMoveStopDown(stop.id)}
                                  style={[
                                    styles.compactReorderBtn, 
                                    index === localStops.length - 1 && styles.reorderBtnDisabled
                                  ]}
                                  disabled={index === localStops.length - 1}
                                >
                                  <AntDesign 
                                    name="down" 
                                    size={10} 
                                    color={index === localStops.length - 1 ? "#D1D5DB" : "#6B7280"} 
                                  />
                                </TouchableOpacity>
                              </View>
                            )}
                            
                            {/* Remove Button */}
                            <TouchableOpacity 
                              onPress={() => handleRemoveStop(stop.id)}
                              style={styles.compactRemoveBtn}
                            >
                              <AntDesign name="close" size={12} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                      
                      {/* Inline Predictions for Stop Fields */}
                      {isEditingThisStop && ((showPredictions && predictions.length > 0) || isSearching) && (
                        <View style={styles.inlinePredictionsContainer}>
                          {isSearching ? (
                            <View style={styles.inlineLoadingContainer}>
                              <Text style={styles.loadingText}>Searching...</Text>
                            </View>
                          ) : (
                            <FlatList
                              data={predictions}
                              renderItem={renderPrediction}
                              keyExtractor={(item) => item.place_id}
                              style={styles.inlinePredictionsList}
                              showsVerticalScrollIndicator={false}
                              keyboardShouldPersistTaps="always"
                              keyboardDismissMode="none"
                              removeClippedSubviews={false}
                              initialNumToRender={5}
                              maxToRenderPerBatch={5}
                              scrollEnabled={false}
                              nestedScrollEnabled={false}
                              disableIntervalMomentum={true}
                              disableScrollViewPanResponder={true}
                            />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

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
                    ((!destinationText.trim() && editingField === 'destination' && getRealStopsCount() === 0) || 
                     (!pickupText.trim() && editingField === 'pickup') || 
                     (!allowPickupEdit && !currentLocation) || 
                     isSubmitting || isConfirming) && styles.submitButtonDisabled,
                    { 
                      transform: [{ scale: buttonScaleAnim }],
                      opacity: buttonOpacityAnim,
                    }
                  ]}
                  onPress={handleSubmit}
                  disabled={(!destinationText.trim() && editingField === 'destination' && getRealStopsCount() === 0) || 
                           (!pickupText.trim() && editingField === 'pickup') || 
                           (!allowPickupEdit && !currentLocation) || 
                           isSubmitting || isConfirming}
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
                      ((!destinationText.trim() && editingField === 'destination' && getRealStopsCount() === 0) || 
                       (!pickupText.trim() && editingField === 'pickup') || 
                       (!allowPickupEdit && !currentLocation) || 
                       isSubmitting || isConfirming) && styles.submitButtonTextDisabled
                    ]}>
                      {isSubmitting && !isConfirming ? 'Processing...' : 
                       allowPickupEdit && editingField === 'pickup' && pickupText.trim() && !destinationText.trim() ? 'Next: Enter Destination' :
                       allowPickupEdit && (!pickupText.trim() || (!destinationText.trim() && getRealStopsCount() === 0)) ? 'Enter Address' :
                       getRealStopsCount() > 0 ? 'Confirm Journey' : 'Confirm Addresses'}
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
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      <FullScreenAddressInput
        visible={showFullScreenInput}
        onClose={handleFullScreenClose}
        onAddressSelected={handleFullScreenAddressSelected}
        fieldType={fullScreenFieldType}
        fieldLabel={fullScreenFieldLabel}
        initialValue={fullScreenInitialValue}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 4,
    paddingHorizontal: 8,
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
  placeholderText: {
    color: '#9CA3AF',
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
  journeyConnector: {
    marginVertical: 12,
  },
  connectorLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
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
  stopNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  removeStopButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStopButton: {
    height: 44,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addStopContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addStopIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addStopText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
  stopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reorderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  reorderButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  reorderButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  instructionsContainer: {
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  newStopField: {
    borderBottomColor: '#EF4444',
  },
  newStopInput: {
    borderColor: '#EF4444',
  },
  newStopHighlight: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
    borderRadius: 12,
    marginVertical: 2,
  },
  newStopLabel: {
    fontWeight: '600',
    color: '#10B981',
  },
  highlightNewFeature: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeStopInput: {
    borderColor: '#3B82F6',
  },
  stopConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  stopConnectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  stopConnectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 8,
  },
  stopCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  stopCardActive: {
    borderColor: '#3B82F6',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  stopCardNew: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  stopCardContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stopBadgeActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  stopBadgeNew: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stopBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  stopBadgeTextActive: {
    color: '#FFFFFF',
  },
  stopContent: {
    flex: 1,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopLabelActive: {
    color: '#3B82F6',
  },
  stopLabelNew: {
    color: '#10B981',
  },
  stopInputContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  stopInputContainerActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  stopInputContainerEmpty: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  stopInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  stopInputActive: {
    color: '#111827',
  },
  inputIndicator: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -4,
  },
  inputIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    opacity: 0.8,
  },
  stopHelperText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  reorderContainer: {
    flexDirection: 'row',
    marginRight: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 2,
  },
  reorderBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  inlinePredictionsContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlinePredictionsList: {
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
  stopFieldActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactReorderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  compactReorderBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  compactRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
});

export default SimpleLocationInput; 