import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import FullScreenAddressInput from './FullScreenAddressInput';
import AddressManager, { type AddressData } from './AddressManager';

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
  const [currentLocation, setCurrentLocation] = useState<AddressData | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [pickupData, setPickupData] = useState<AddressData | null>(null);
  const [destinationData, setDestinationData] = useState<AddressData | null>(null);
  const [localStops, setLocalStops] = useState(stops);
  const [showMultiStopMode, setShowMultiStopMode] = useState(false);
  
  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState(-1);
  const [initialTouchY, setInitialTouchY] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const dragY = useRef(new Animated.Value(0)).current;
  
  // Visual reordering state (separate from actual data)
  const [visualStopsOrder, setVisualStopsOrder] = useState<string[]>([]);

  // Full-screen address input states
  const [showFullScreenInput, setShowFullScreenInput] = useState(false);
  const [fullScreenFieldType, setFullScreenFieldType] = useState<'pickup' | 'destination' | 'stop'>('destination');
  const [fullScreenFieldLabel, setFullScreenFieldLabel] = useState('');
  const [fullScreenInitialValue, setFullScreenInitialValue] = useState('');
  const [editingStopId, setEditingStopId] = useState<string | null>(null);

  // Refs for better performance
  const isClosingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Helper function to check for duplicate addresses using AddressManager
  const checkForDuplicateAddress = useCallback((newAddress: string, excludeStopId?: string): boolean => {
    if (!newAddress || !newAddress.trim()) return false;
    
    // In simple mode, check against pickup and destination
    if (!showMultiStopMode) {
      // Check against pickup address
      const pickupAddress = allowPickupEdit ? pickupData?.address : currentLocation?.address;
      if (pickupAddress && AddressManager.isDuplicateAddress(newAddress, pickupAddress)) {
        return true;
      }
      
      // Check against destination address
      if (destinationData?.address && AddressManager.isDuplicateAddress(newAddress, destinationData.address)) {
        return true;
      }
    } else {
      // In multi-stop mode, only check against other stops
      const duplicateStop = localStops.find(stop => 
        stop && 
        stop.id !== excludeStopId && 
        stop.address && 
        AddressManager.isDuplicateAddress(newAddress, stop.address)
      );
      
      return !!duplicateStop;
    }
    
    return false;
  }, [allowPickupEdit, pickupData, currentLocation, showMultiStopMode, destinationData, localStops]);

  // Update visual order when localStops change (but not during drag)
  useEffect(() => {
    if (!draggedItem) {
      setVisualStopsOrder(localStops.map(stop => stop.id));
    }
  }, [localStops, draggedItem]);

  // Drag and drop handlers
  const handleDragStart = useCallback((stopId: string, index: number, gestureY: number) => {
    console.log('🎯 Drag started for stop:', stopId, 'at index:', index);
    setDraggedItem(stopId);
    setDraggedIndex(index);
    setInitialTouchY(gestureY);
    setDragStartOffset(0);
    dragY.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dragY]);

  const handleDragEnd = useCallback(() => {
    console.log('🎯 Drag ended');
    
    if (draggedIndex !== -1 && draggedItem) {
      const currentIndex = localStops.findIndex(stop => stop.id === draggedItem);
      if (currentIndex !== -1 && currentIndex !== draggedIndex) {
        const updatedStops = [...localStops];
        const [movedStop] = updatedStops.splice(currentIndex, 1);
        updatedStops.splice(draggedIndex, 0, movedStop);
        
        const reorderedStops = updatedStops.map((stop, index) => ({
          ...stop,
          order: index + 1,
        }));
        
        setLocalStops(reorderedStops);
        
        const stopsWithAddresses = reorderedStops.filter(stop => 
          stop && stop.id && stop.address && stop.address.trim() !== ''
        );
        onStopsUpdated?.(stopsWithAddresses);
      }
    }
    
    setDraggedItem(null);
    setDraggedIndex(-1);
    setInitialTouchY(0);
    setDragStartOffset(0);
    
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  }, [draggedItem, draggedIndex, localStops, onStopsUpdated, dragY]);

  const updateVisualOrder = useCallback((translationY: number) => {
    if (!draggedItem) return;
    
    const currentIndex = visualStopsOrder.findIndex(id => id === draggedItem);
    if (currentIndex === -1) return;
    
    const itemHeight = 70;
    const moveThreshold = itemHeight * 0.6;
    const moveDistance = Math.round(translationY / itemHeight);
    const newIndex = Math.max(0, Math.min(visualStopsOrder.length - 1, currentIndex + moveDistance));
    
    if (newIndex !== draggedIndex && Math.abs(translationY) > moveThreshold) {
      setDraggedIndex(newIndex);
      
      const newOrder = [...visualStopsOrder];
      const [movedId] = newOrder.splice(currentIndex, 1);
      newOrder.splice(newIndex, 0, movedId);
      setVisualStopsOrder(newOrder);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [draggedItem, visualStopsOrder, draggedIndex]);

  const createPanGestureHandler = useCallback((stopId: string, index: number) => {
    return (event: any) => {
      try {
        const { state, translationY, absoluteY } = event.nativeEvent;
        
        switch (state) {
          case GestureState.BEGAN:
            handleDragStart(stopId, index, absoluteY);
            break;
            
          case GestureState.ACTIVE:
            if (draggedItem !== stopId) return;
            
            const dampenedTranslation = translationY * 0.85;
            dragY.setValue(dampenedTranslation);
            setDragStartOffset(dampenedTranslation);
            updateVisualOrder(translationY);
            break;
            
          case GestureState.END:
          case GestureState.CANCELLED:
          case GestureState.FAILED:
            handleDragEnd();
            break;
        }
      } catch (error) {
        console.error('Gesture handler error:', error);
        handleDragEnd();
      }
    };
  }, [draggedItem, handleDragStart, handleDragEnd, dragY, updateVisualOrder]);

  const getStopsInVisualOrder = useCallback(() => {
    if (visualStopsOrder.length === 0) return localStops;
    
    return visualStopsOrder.map(id => 
      localStops.find(stop => stop.id === id)
    ).filter(Boolean);
  }, [localStops, visualStopsOrder]);

  // Initialize component state with consistent address handling
  useEffect(() => {
    console.log('🔍 Main useEffect triggered:', {
      visible,
      currentPickup: currentPickup?.substring(0, 30),
      currentDestination: currentDestination?.substring(0, 30),
      stopsLength: stops.length,
    });
    
    isMountedRef.current = true;
    isClosingRef.current = false;

    if (visible) {
      // Initialize pickup data - geocode if needed
      if (currentPickup) {
        console.log('🔍 Initializing pickup data from props:', currentPickup);
        // Check if we already have this pickup with valid coordinates
        if (!pickupData || pickupData.address !== currentPickup) {
          // Geocode the pickup address to get proper coordinates
          AddressManager.geocodeAddress(currentPickup).then(result => {
            if (result.success && result.data) {
              setPickupData(result.data);
              console.log('✅ Pickup geocoded:', result.data);
            } else {
              // Fallback to creating with manual source but let AddressManager handle coordinates
              const fallbackPickup = AddressManager.createAddressData(currentPickup, 0, 0, 'manual');
              setPickupData(fallbackPickup);
              console.log('✅ Pickup with fallback coordinates:', fallbackPickup);
            }
          });
        }
      }
      
      // Initialize destination data - geocode if needed
      if (currentDestination) {
        console.log('🔍 Initializing destination data from props:', currentDestination);
        // Check if we already have this destination with valid coordinates
        if (!destinationData || destinationData.address !== currentDestination) {
          // Geocode the destination address to get proper coordinates
          AddressManager.geocodeAddress(currentDestination).then(result => {
            if (result.success && result.data) {
              setDestinationData(result.data);
              console.log('✅ Destination geocoded:', result.data);
            } else {
              // Fallback to creating with manual source but let AddressManager handle coordinates
              const fallbackDestination = AddressManager.createAddressData(currentDestination, 0, 0, 'manual');
              setDestinationData(fallbackDestination);
              console.log('✅ Destination with fallback coordinates:', fallbackDestination);
            }
          });
        }
      }
      
      // Determine mode and update stops
      const hasStops = stops && stops.length > 0;
      const hasLocalStops = localStops && localStops.length > 0;
      setShowMultiStopMode(hasStops || hasLocalStops);
      
      if (stops && stops.length > 0) {
        console.log('🔄 Updating localStops from props:', stops.length);
        setLocalStops(stops);
      }
      
      getCurrentLocation();
      
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 150,
        friction: 12,
      }).start();
    } else {
      isClosingRef.current = true;
      
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [visible, currentPickup, currentDestination, stops.length]);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      
      const result = await AddressManager.getCurrentLocation();
      
      if (result.success && result.data) {
        setCurrentLocation(result.data);
        console.log('✅ Current location obtained:', result.data);
      } else {
        console.error('❌ Failed to get current location:', result.error);
        // Set fallback location
        setCurrentLocation(AddressManager.createAddressData(
          'Current Location (Unavailable)',
          -37.8136,
          144.9631,
          'fallback'
        ));
      }
      
      setLoadingLocation(false);
    } catch (error) {
      console.error('❌ Error getting current location:', error);
      setCurrentLocation(AddressManager.createAddressData(
        'Current Location (Error)',
        -37.8136,
        144.9631,
        'fallback'
      ));
      setLoadingLocation(false);
    }
  };

  // Function to close full-screen input
  const handleFullScreenClose = useCallback(() => {
    console.log('🔄 Closing full-screen input');
    setShowFullScreenInput(false);
    setEditingStopId(null);
  }, []);

  // Function to open full-screen input
  const openFullScreenInput = useCallback((
    fieldType: 'pickup' | 'destination' | 'stop',
    initialValue: string = '',
    label: string = '',
    stopId?: string
  ) => {
    console.log('🔄 Opening full-screen input:', { fieldType, initialValue, label, stopId });
    
    setFullScreenFieldType(fieldType);
    setFullScreenInitialValue(initialValue);
    setFullScreenFieldLabel(label);
    setEditingStopId(stopId || null);
    setShowFullScreenInput(true);
  }, []);

  // Function to handle address selection from full-screen input
  const handleFullScreenAddressSelected = useCallback(async (selectedAddressObject: any) => {
    console.log('🔄 Full-screen address selected:', { 
      selectedAddress: selectedAddressObject, 
      fieldType: fullScreenFieldType, 
      stopId: editingStopId,
    });

    try {
      const addressText = selectedAddressObject?.address || '';

      // Check for duplicate address before setting
      if (fullScreenFieldType === 'stop') {
        const isDuplicate = checkForDuplicateAddress(addressText, editingStopId);
        if (isDuplicate) {
          const duplicateStop = localStops.find(stop => 
            stop && 
            stop.id !== editingStopId && 
            stop.address && 
            AddressManager.isDuplicateAddress(addressText, stop.address)
          );
          
          const stopIndex = localStops.findIndex(stop => stop.id === duplicateStop?.id);
          const stopNumber = stopIndex >= 0 ? stopIndex + 1 : 'another';
          
          Alert.alert(
            'Duplicate Stop Address', 
            `This address is already used for Stop ${stopNumber}. Each stop should have a different address.`,
            [{ text: 'OK' }]
          );
          return;
        }
      }

      if (fullScreenFieldType === 'pickup') {
        const pickupAddressData = AddressManager.createAddressData(
          addressText,
          selectedAddressObject?.latitude || 0,
          selectedAddressObject?.longitude || 0,
          selectedAddressObject?.latitude ? 'geocoded' : 'manual'
        );
        setPickupData(pickupAddressData);
        console.log('✅ Updated pickup data:', pickupAddressData);
      } else if (fullScreenFieldType === 'destination') {
        const destinationAddressData = AddressManager.createAddressData(
          addressText,
          selectedAddressObject?.latitude || 0,
          selectedAddressObject?.longitude || 0,
          selectedAddressObject?.latitude ? 'geocoded' : 'manual'
        );
        setDestinationData(destinationAddressData);
        console.log('✅ Updated destination data:', destinationAddressData);
      } else if (fullScreenFieldType === 'stop' && editingStopId) {
        setLocalStops(currentLocalStops => {
          const updatedStops = currentLocalStops.map(stop => 
            stop.id === editingStopId 
              ? { 
                  ...stop, 
                  address: addressText,
                  latitude: selectedAddressObject?.latitude || 0,
                  longitude: selectedAddressObject?.longitude || 0
                }
              : stop
          );
          
          // For the updated stop, ensure it has valid coordinates
          const updatedStop = updatedStops.find(stop => stop.id === editingStopId);
          if (updatedStop && !AddressManager.isValidCoordinates(updatedStop.latitude, updatedStop.longitude)) {
            console.log('🔍 Stop has invalid coordinates, using fallback for:', updatedStop.address);
            const fallbackCoords = AddressManager.getFallbackCoordinates(updatedStop.address);
            updatedStop.latitude = fallbackCoords[0];
            updatedStop.longitude = fallbackCoords[1];
            console.log('✅ Applied fallback coordinates to stop:', fallbackCoords);
          }
          
          const stopsWithAddresses = updatedStops.filter(stop => {
            const hasValidId = stop && stop.id;
            const hasValidAddress = stop && stop.address && stop.address.trim() !== '';
            return hasValidId && hasValidAddress;
          });
          
          console.log('🔄 Sending updated stops to parent:', stopsWithAddresses);
          onStopsUpdated?.(stopsWithAddresses);
          
          return updatedStops;
        });
      }

      setShowFullScreenInput(false);
      setEditingStopId(null);
    } catch (error) {
      console.error('❌ Error handling full-screen address selection:', error);
      Alert.alert('Error', 'Failed to process address. Please try again.');
    }
  }, [fullScreenFieldType, editingStopId, onStopsUpdated, checkForDuplicateAddress, localStops]);

  const handleClose = useCallback(() => {
    try {
      if (isClosingRef.current) return;
      
      isClosingRef.current = true;
      
      setShowFullScreenInput(false);
      setEditingStopId(null);
      
      // Smart cleanup: Remove incomplete stops and adjust mode accordingly
      const validStops = localStops.filter(stop => 
        stop && stop.id && stop.address && stop.address.trim()
      );
      
      console.log('🧹 Cleanup on close:', {
        originalStops: localStops.length,
        validStops: validStops.length,
        showMultiStopMode,
        destinationText: destinationData?.address?.substring(0, 30)
      });
      
      // If we're in multi-stop mode but have no valid stops, revert to simple mode
      if (showMultiStopMode && validStops.length === 0) {
        console.log('🔄 No valid stops, reverting to simple mode');
        setShowMultiStopMode(false);
        setLocalStops([]);
        
        // If there was a converted destination (first stop), try to restore it as destination
        if (localStops.length > 0 && localStops[0].address) {
          console.log('🔄 Restoring first stop as destination:', localStops[0].address);
          setDestinationData(AddressManager.createAddressData(localStops[0].address, 0, 0, 'manual'));
        }
      } else if (showMultiStopMode && validStops.length > 0) {
        // Clean up incomplete stops but keep valid ones
        console.log('🧹 Cleaning up incomplete stops, keeping', validStops.length, 'valid stops');
        setLocalStops(validStops);
        
        // Notify parent about cleaned stops
        setTimeout(() => {
          onStopsUpdated?.(validStops);
        }, 100);
      }
      
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 130,
        friction: 9,
      }).start(() => {
        try {
          if (isMountedRef.current && onClose) {
            onClose();
          }
          isClosingRef.current = false;
        } catch (closeError) {
          isClosingRef.current = false;
        }
      });
    } catch (error) {
      try {
        isClosingRef.current = false;
        if (onClose) {
          onClose();
        }
      } catch (finalError) {
        // Last resort
      }
    }
  }, [onClose, localStops, showMultiStopMode, destinationData, onStopsUpdated]);

  const handleSubmit = useCallback(async () => {
    console.log('🔄 handleSubmit called with:', {
      allowPickupEdit,
      pickupText: pickupData?.address,
      destinationText: destinationData?.address,
      showMultiStopMode,
      localStopsLength: localStops.length
    });

    if (allowPickupEdit && !pickupData?.address) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    
    // In simple mode, we need a destination. In multi-stop mode, we need at least one stop
    if (!showMultiStopMode) {
      if (!destinationData?.address) {
        Alert.alert('Error', 'Please enter a destination address.');
        return;
      }
      
      // Check for duplicate between pickup and destination in simple mode
      const pickupAddr = allowPickupEdit ? pickupData?.address : currentLocation?.address;
      if (pickupAddr && destinationData?.address.toLowerCase() === pickupAddr.toLowerCase()) {
        Alert.alert(
          'Duplicate Address', 
          'Your pickup and destination cannot be the same address. Please choose a different destination.',
          [{ text: 'OK' }]
        );
        return;
      }
    } else {
      const validStops = localStops.filter(stop => stop.address && stop.address.trim());
      
      // If no valid stops in multi-stop mode, revert to simple mode
      if (validStops.length === 0) {
        console.log('🔄 No valid stops in multi-stop mode, reverting to simple mode');
        setShowMultiStopMode(false);
        setLocalStops([]);
        
        // Notify parent that stops are cleared
        if (onStopsUpdated) {
          onStopsUpdated([]);
        }
        
        // Check if we have a destination for simple mode
        if (!destinationData?.address) {
          Alert.alert('Error', 'Please enter a destination address.');
          return;
        }
        
        // Check for duplicate between pickup and destination in simple mode
        const pickupAddr = allowPickupEdit ? pickupData?.address : currentLocation?.address;
        if (pickupAddr && destinationData?.address.toLowerCase() === pickupAddr.toLowerCase()) {
          Alert.alert(
            'Duplicate Address', 
            'Your pickup and destination cannot be the same address. Please choose a different destination.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (validStops.length === 1) {
        // Only one valid stop - convert it to destination and switch to simple mode
        const singleStop = validStops[0];
        console.log('🔄 Only one valid stop, converting to simple mode destination:', singleStop.address);
        
        // Geocode the single stop address to ensure we have valid coordinates
        const geocodeResult = await AddressManager.geocodeAddress(singleStop.address);
        if (geocodeResult.success && geocodeResult.data) {
          setDestinationData(geocodeResult.data);
        } else {
          setDestinationData(AddressManager.createAddressData(singleStop.address, singleStop.latitude, singleStop.longitude, 'manual'));
        }
        
        setLocalStops([]);
        setShowMultiStopMode(false);
        
        // Notify parent that stops are cleared
        if (onStopsUpdated) {
          onStopsUpdated([]);
        }
      } else {
        // Multiple valid stops - proceed with multi-stop validation
        
        // Final check for duplicate addresses in multi-stop mode
        const allAddresses = [];
        
        // Add pickup address
        const pickupAddr = allowPickupEdit ? pickupData?.address : currentLocation?.address;
        if (pickupAddr) allAddresses.push(pickupAddr.toLowerCase());
        
        // Add stop addresses
        for (const stop of validStops) {
          const stopAddr = stop.address.trim().toLowerCase();
          if (allAddresses.includes(stopAddr)) {
            Alert.alert(
              'Duplicate Address', 
              'You have duplicate addresses in your trip. Please remove or change duplicate stops before continuing.',
              [{ text: 'OK' }]
            );
            return;
          }
          allAddresses.push(stopAddr);
        }
        
        // Update local stops to only include valid ones
        setLocalStops(validStops);
        if (onStopsUpdated) {
          onStopsUpdated(validStops);
        }
      }
    }

    try {
      // Check if we're converting a single stop back to destination
      const validStops = localStops.filter(stop => stop.address && stop.address.trim());
      const isSingleStopConversion = validStops.length === 1;
      
      if (allowPickupEdit) {
        // Ensure pickup has valid coordinates
        let pickup = {
          latitude: pickupData?.latitude || currentLocation?.latitude || -37.8136,
          longitude: pickupData?.longitude || currentLocation?.longitude || 144.9631,
          address: pickupData?.address || currentLocation?.address || '',
        };
        
        // If pickup coordinates are invalid, geocode the address
        if (!AddressManager.isValidCoordinates(pickup.latitude, pickup.longitude) && pickup.address) {
          console.log('🔍 Geocoding pickup address for submit:', pickup.address);
          const geocodeResult = await AddressManager.geocodeAddress(pickup.address);
          if (geocodeResult.success && geocodeResult.data) {
            pickup = AddressManager.toLegacyAddress(geocodeResult.data);
          }
        }
        
        // In simple mode, use destinationData.address. In multi-stop mode, use last stop as destination
        let destination = null;
        
        if (isSingleStopConversion) {
          // Use coordinates directly from the single stop (avoids state timing issues)
          const singleStop = validStops[0];
          destination = {
            latitude: singleStop.latitude,
            longitude: singleStop.longitude,
            address: singleStop.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding single stop destination:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        } else if (!showMultiStopMode && destinationData?.address) {
          destination = {
            latitude: destinationData.latitude,
            longitude: destinationData.longitude,
            address: destinationData.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding destination address:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        } else if (showMultiStopMode && validStops.length > 0) {
          const lastStop = validStops[validStops.length - 1];
          destination = {
            latitude: lastStop.latitude,
            longitude: lastStop.longitude,
            address: lastStop.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding last stop destination:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        }
        
        console.log('🔄 Calling onLocationSelected with:', { pickup, destination });
        onLocationSelected(pickup, destination);
      } else {
        // For non-editable pickup, same logic
        let pickup = AddressManager.toLegacyAddress(currentLocation || AddressManager.createAddressData('Melbourne, Australia', -37.8136, 144.9631, 'fallback'));
        
        let destination = null;
        
        if (isSingleStopConversion) {
          // Use coordinates directly from the single stop (avoids state timing issues)
          const singleStop = validStops[0];
          destination = {
            latitude: singleStop.latitude,
            longitude: singleStop.longitude,
            address: singleStop.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding single stop destination:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        } else if (!showMultiStopMode && destinationData?.address) {
          destination = {
            latitude: destinationData.latitude,
            longitude: destinationData.longitude,
            address: destinationData.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding destination address:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        } else if (showMultiStopMode && validStops.length > 0) {
          const lastStop = validStops[validStops.length - 1];
          destination = {
            latitude: lastStop.latitude,
            longitude: lastStop.longitude,
            address: lastStop.address,
          };
          
          // Ensure destination has valid coordinates
          if (!AddressManager.isValidCoordinates(destination.latitude, destination.longitude)) {
            console.log('🔍 Geocoding last stop destination:', destination.address);
            const geocodeResult = await AddressManager.geocodeAddress(destination.address);
            if (geocodeResult.success && geocodeResult.data) {
              destination = AddressManager.toLegacyAddress(geocodeResult.data);
            }
          }
        }
        
        console.log('🔄 Calling onLocationSelected with:', { pickup, destination });
        onLocationSelected(pickup, destination);
      }
      onClose();
    } catch (error) {
      console.log('❌ Error in handleSubmit:', error);
      Alert.alert('Error', 'Failed to process addresses. Please try again.');
    }
  }, [allowPickupEdit, pickupData, destinationData, showMultiStopMode, currentLocation, onLocationSelected, onClose, localStops, onStopsUpdated]);

  return (
    <>
    <Modal
      visible={visible && !showFullScreenInput}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      presentationStyle="overFullScreen"
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
              transform: [{ translateY: slideAnim }],
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
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="always"
            >
              {!showMultiStopMode ? (
                /* Simple Mode - Like Uber's initial state */
                <>
                  {/* Pickup Address Field */}
                  {allowPickupEdit ? (
                    <TouchableOpacity 
                      style={styles.addressInputField}
                      onPress={() => {
                        console.log('🔄 Pickup field pressed');
                        openFullScreenInput('pickup', pickupData?.address || '', 'Pickup');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addressFieldContent}>
                        <View style={[styles.addressDot, { backgroundColor: '#3B82F6' }]} />
                        <View style={styles.addressFieldInfo}>
                          <Text style={styles.fieldLabel}>From</Text>
                          <Text style={[
                            styles.addressDisplayText,
                            !pickupData?.address && styles.placeholderText
                          ]}>
                            {pickupData?.address || (currentLocation?.address || "Tap to enter pickup")}
                          </Text>
                        </View>
                        <AntDesign name="right" size={16} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
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

                  {/* Simple "Where to?" Field */}
                  <TouchableOpacity 
                    style={styles.addressInputField}
                    onPress={() => {
                      console.log('🔄 Destination field pressed');
                      openFullScreenInput('destination', destinationData?.address || '', 'Destination');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addressFieldContent}>
                      <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                      <View style={styles.addressFieldInfo}>
                        <Text style={styles.fieldLabel}>Where to?</Text>
                        <Text style={[
                          styles.addressDisplayText,
                          !destinationData?.address && styles.placeholderText
                        ]}>
                          {destinationData?.address || "Tap to enter destination"}
                        </Text>
                      </View>
                      <AntDesign name="right" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>

                  {/* Add Stops Button */}
                  <TouchableOpacity 
                    style={[styles.addStopButton, styles.highlightNewFeature]} 
                    onPress={async () => {
                      console.log('🔄 Switching to multi-stop mode');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      // Convert destination to first stop if it exists
                      if (destinationData?.address) {
                        // When switching to multi-stop mode, be more lenient with duplicate checking
                        // Only prevent if pickup and destination are EXACTLY the same and user likely made a mistake
                        const pickupAddr = allowPickupEdit ? pickupData?.address : currentLocation?.address;
                        const isExactMatch = pickupAddr && 
                          destinationData.address.trim().toLowerCase() === pickupAddr.toLowerCase();
                        
                        if (isExactMatch && pickupAddr) {
                          // Only show warning for exact matches, but allow user to proceed
                          Alert.alert(
                            'Same Pickup and Destination', 
                            'Your pickup and destination are the same address. This is unusual but you can continue if intentional.',
                            [
                              { text: 'Change Destination', style: 'cancel' },
                              { 
                                text: 'Continue Anyway', 
                                onPress: async () => {
                                  // Proceed with creating the stop
                                  // No duplicate issue, proceed normally
                                  // Ensure destination has valid coordinates before converting to stop
                                  let finalDestinationData = destinationData;
                                  
                                  // If destination doesn't have valid coordinates, try to geocode it first
                                  if (!AddressManager.isValidCoordinates(destinationData.latitude, destinationData.longitude)) {
                                    console.log('🔍 Destination has invalid coordinates, geocoding before conversion:', destinationData.address);
                                    try {
                                      const geocodeResult = await AddressManager.geocodeAddress(destinationData.address);
                                      if (geocodeResult.success && geocodeResult.data) {
                                        finalDestinationData = geocodeResult.data;
                                        setDestinationData(geocodeResult.data); // Update the state too
                                        console.log('✅ Destination geocoded before conversion:', geocodeResult.data);
                                      }
                                    } catch (error) {
                                      console.log('❌ Failed to geocode destination before conversion:', error);
                                    }
                                  }
                                  
                                  // Use coordinates from the geocoded/validated destination
                                  let initialCoords = { latitude: -37.8136, longitude: 144.9631 }; // Melbourne default
                                  
                                  // First priority: use actual geocoded coordinates if available
                                  if (AddressManager.isValidCoordinates(finalDestinationData.latitude, finalDestinationData.longitude)) {
                                    initialCoords = {
                                      latitude: finalDestinationData.latitude,
                                      longitude: finalDestinationData.longitude
                                    };
                                    console.log('✅ Using geocoded coordinates for stop conversion:', initialCoords);
                                  } else {
                                    // Fallback: city detection for better coordinates than default
                                    const fallbackCoords = AddressManager.getFallbackCoordinates(finalDestinationData.address);
                                    initialCoords = {
                                      latitude: fallbackCoords[0],
                                      longitude: fallbackCoords[1]
                                    };
                                    console.log('✅ Using fallback coordinates for stop conversion:', initialCoords);
                                  }
                                  
                                  const newStop = {
                                    id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    latitude: initialCoords.latitude,
                                    longitude: initialCoords.longitude,
                                    address: finalDestinationData.address,
                                    order: 1,
                                  };
                                  // Also create a second empty stop for additional input
                                  const secondStop = {
                                    id: `stop_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
                                    latitude: 0,
                                    longitude: 0,
                                    address: '',
                                    order: 2,
                                  };
                                  setLocalStops([newStop, secondStop]);
                                  setDestinationData(null); // Clear destination as it's now a stop
                                  setShowMultiStopMode(true);
                                }
                              }
                            ]
                          );
                          return;
                        }
                        
                        // No duplicate issue, proceed normally
                        // Ensure destination has valid coordinates before converting to stop
                        let finalDestinationData = destinationData;
                        
                        // If destination doesn't have valid coordinates, try to geocode it first
                        if (!AddressManager.isValidCoordinates(destinationData.latitude, destinationData.longitude)) {
                          console.log('🔍 Destination has invalid coordinates, geocoding before conversion:', destinationData.address);
                          try {
                            const geocodeResult = await AddressManager.geocodeAddress(destinationData.address);
                            if (geocodeResult.success && geocodeResult.data) {
                              finalDestinationData = geocodeResult.data;
                              setDestinationData(geocodeResult.data); // Update the state too
                              console.log('✅ Destination geocoded before conversion:', geocodeResult.data);
                            }
                          } catch (error) {
                            console.log('❌ Failed to geocode destination before conversion:', error);
                          }
                        }
                        
                        // Use coordinates from the geocoded/validated destination
                        let initialCoords = { latitude: -37.8136, longitude: 144.9631 }; // Melbourne default
                        
                        // First priority: use actual geocoded coordinates if available
                        if (AddressManager.isValidCoordinates(finalDestinationData.latitude, finalDestinationData.longitude)) {
                          initialCoords = {
                            latitude: finalDestinationData.latitude,
                            longitude: finalDestinationData.longitude
                          };
                          console.log('✅ Using geocoded coordinates for stop conversion:', initialCoords);
                        } else {
                          // Fallback: city detection for better coordinates than default
                          const fallbackCoords = AddressManager.getFallbackCoordinates(finalDestinationData.address);
                          initialCoords = {
                            latitude: fallbackCoords[0],
                            longitude: fallbackCoords[1]
                          };
                          console.log('✅ Using fallback coordinates for stop conversion:', initialCoords);
                        }
                        
                        const newStop = {
                          id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          latitude: initialCoords.latitude,
                          longitude: initialCoords.longitude,
                          address: finalDestinationData.address,
                          order: 1,
                        };
                        // Also create a second empty stop for additional input
                        const secondStop = {
                          id: `stop_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
                          latitude: 0,
                          longitude: 0,
                          address: '',
                          order: 2,
                        };
                        setLocalStops([newStop, secondStop]);
                        setDestinationData(null); // Clear destination as it's now a stop
                        setShowMultiStopMode(true);
                      }
                    }}
                  >
                    <View style={styles.addStopContent}>
                      <View style={styles.addStopIcon}>
                        <AntDesign name="plus" size={16} color="#FFFFFF" />
                      </View>
                      <Text style={styles.addStopText}>Add stops</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                /* Multi-Stop Mode - Like Uber's add stops interface */
                <>
                  {/* Pickup Address Field */}
                  {allowPickupEdit ? (
                    <TouchableOpacity 
                      style={styles.addressInputField}
                      onPress={() => {
                        console.log('🔄 Pickup field pressed');
                        openFullScreenInput('pickup', pickupData?.address || '', 'Pickup');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addressFieldContent}>
                        <View style={[styles.addressDot, { backgroundColor: '#3B82F6' }]} />
                        <View style={styles.addressFieldInfo}>
                          <Text style={styles.fieldLabel}>From</Text>
                          <Text style={[
                            styles.addressDisplayText,
                            !pickupData?.address && styles.placeholderText
                          ]}>
                            {pickupData?.address || (currentLocation?.address || "Tap to enter pickup")}
                          </Text>
                        </View>
                        <AntDesign name="right" size={16} color="#9CA3AF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
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

                  {/* Stops List */}
                  {Array.isArray(localStops) && localStops.length > 0 && (
                    <>
                      {getStopsInVisualOrder().map((stop, index) => {
                        if (!stop || !stop.id) return null;
                        
                        const hasAddress = stop.address && stop.address.trim() !== '';
                        const isDragging = draggedItem === stop.id;
                        const panGestureHandler = createPanGestureHandler(stop.id, index);
                        
                        return (
                          <View key={stop.id}>
                            {/* Journey Connector */}
                            <View style={styles.journeyConnector}>
                              <View style={styles.connectorLine} />
                            </View>
                            
                            {/* Stop Address Field with Drag Support */}
                            <Animated.View 
                              style={[
                                styles.stopContainer,
                                isDragging && {
                                  transform: [{ translateY: dragY }],
                                  zIndex: 1000,
                                  elevation: 10,
                                  shadowColor: '#000',
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.25,
                                  shadowRadius: 12,
                                }
                              ]}
                            >
                              <TouchableOpacity 
                                style={[
                                  styles.addressInputField,
                                  isDragging && styles.draggedField
                                ]}
                                onPress={() => {
                                  if (!isDragging) {
                                    openFullScreenInput('stop', stop.address, `Stop ${index + 1}`, stop.id);
                                  }
                                }}
                                activeOpacity={isDragging ? 1 : 0.7}
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
                                  
                                  {/* Stop Actions */}
                                  <View style={styles.stopFieldActions}>
                                    {/* Drag Handle - only show if more than one stop */}
                                    {localStops.length > 1 && (
                                      <PanGestureHandler
                                        onGestureEvent={panGestureHandler}
                                        onHandlerStateChange={panGestureHandler}
                                      >
                                        <Animated.View style={styles.dragHandle}>
                                          <MaterialIcons 
                                            name="drag-indicator" 
                                            size={20} 
                                            color={isDragging ? "#3B82F6" : "#9CA3AF"} 
                                          />
                                        </Animated.View>
                                      </PanGestureHandler>
                                    )}
                                    
                                    {/* Remove Button */}
                                    <TouchableOpacity 
                                      onPress={() => {
                                        if (isDragging) return;
                                        
                                        console.log('🔄 Removing stop:', stop.id);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        const updatedStops = localStops.filter(s => s && s.id !== stop.id)
                                          .map((stop, index) => ({ ...stop, order: index + 1 }));
                                        
                                        setLocalStops(updatedStops);
                                        
                                        // Handle transition from multi-stop to simple mode
                                        if (updatedStops.length === 0) {
                                          setShowMultiStopMode(false);
                                        } else if (updatedStops.length === 1) {
                                          const lastStop = updatedStops[0];
                                          if (lastStop && lastStop.address && lastStop.address.trim()) {
                                            console.log('🔄 Converting last stop to destination:', lastStop.address);
                                            setDestinationData(AddressManager.createAddressData(
                                              lastStop.address, 
                                              lastStop.latitude, 
                                              lastStop.longitude, 
                                              'manual'
                                            ));
                                            setLocalStops([]);
                                            setShowMultiStopMode(false);
                                            
                                            if (onStopsUpdated) {
                                              onStopsUpdated([]);
                                            }
                                            return;
                                          }
                                        }
                                        
                                        if (onStopsUpdated) {
                                          const stopsWithAddresses = updatedStops.filter(stop => 
                                            stop && stop.id && stop.address && stop.address.trim() !== ''
                                          );
                                          onStopsUpdated(stopsWithAddresses);
                                        }
                                      }}
                                      style={[
                                        styles.removeButton,
                                        isDragging && styles.buttonDisabled
                                      ]}
                                      disabled={isDragging}
                                    >
                                      <AntDesign name="close" size={12} color="#EF4444" />
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {/* Add Another Stop Button */}
                  <TouchableOpacity 
                    style={[styles.addStopButton, { marginTop: 16 }]} 
                    onPress={() => {
                      console.log('🔄 Adding new stop, current stops:', localStops.length);
                      
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      if (localStops.length >= 6) {
                        Alert.alert('Limit Reached', 'You can add up to 6 stops maximum.');
                        return;
                      }
                      
                      const newStop = {
                        id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        latitude: 0,
                        longitude: 0,
                        address: '',
                        order: localStops.length + 1,
                      };
                      
                      console.log('🔄 Creating new stop:', newStop);
                      
                      const updatedStops = [...localStops, newStop];
                      setLocalStops(updatedStops);
                      
                      console.log('🔄 Updated stops array length:', updatedStops.length);
                      
                      setTimeout(() => {
                        if (isMountedRef.current) {
                          console.log('🔄 Opening full-screen input for new stop:', newStop.id);
                          openFullScreenInput('stop', newStop.address, `Stop ${newStop.order}`, newStop.id);
                        }
                      }, 50);
                    }}
                  >
                    <View style={styles.addStopContent}>
                      <View style={styles.addStopIcon}>
                        <AntDesign name="plus" size={16} color="#FFFFFF" />
                      </View>
                      <Text style={styles.addStopText}>Add another stop</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.submitSection}>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmit}
                activeOpacity={0.9}
              >
                <Text style={styles.submitButtonText}>
                  {showMultiStopMode && localStops.length > 0 ? 'Confirm Journey' : 'Confirm Addresses'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>

    {/* Full-Screen Address Input */}
    <FullScreenAddressInput
      visible={showFullScreenInput}
      onClose={handleFullScreenClose}
      onAddressSelected={handleFullScreenAddressSelected}
      fieldType={fullScreenFieldType}
      fieldLabel={fullScreenFieldLabel}
      initialValue={fullScreenInitialValue}
    />
    </>
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
  addressDisplayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 4,
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
  stopFieldActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
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
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  stopContainer: {
    // Remove default margins when dragging to prevent positioning issues
  },
  draggedField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    transform: [{ scale: 1.01 }], // More subtle scaling when dragging
    // Ensure no overflow by setting overflow hidden
    overflow: 'hidden',
    // Add shadow to the field itself for better depth
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
});

export default SimpleLocationInput; 