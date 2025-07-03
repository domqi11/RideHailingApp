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
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [pickupText, setPickupText] = useState(currentPickup || '');
  const [destinationText, setDestinationText] = useState(currentDestination || '');
  const [localStops, setLocalStops] = useState(stops);
  const [showMultiStopMode, setShowMultiStopMode] = useState(false);
  
  // Drag and drop states - improved for better finger tracking
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

  // Update visual order when localStops change (but not during drag)
  useEffect(() => {
    if (!draggedItem) {
      setVisualStopsOrder(localStops.map(stop => stop.id));
    }
  }, [localStops, draggedItem]);

  // Drag and drop handlers - improved for precise finger tracking
  const handleDragStart = useCallback((stopId: string, index: number, gestureY: number) => {
    console.log('🎯 Drag started for stop:', stopId, 'at index:', index, 'gestureY:', gestureY);
    setDraggedItem(stopId);
    setDraggedIndex(index);
    setInitialTouchY(gestureY);
    setDragStartOffset(0);
    dragY.setValue(0); // Reset to 0 at start
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dragY]);

  const handleDragEnd = useCallback(() => {
    console.log('🎯 Drag ended');
    
    // Only update parent if there was actual reordering
    if (draggedIndex !== -1 && draggedItem) {
      const currentIndex = localStops.findIndex(stop => stop.id === draggedItem);
      if (currentIndex !== -1 && currentIndex !== draggedIndex) {
        // Now update the actual data
        const updatedStops = [...localStops];
        const [movedStop] = updatedStops.splice(currentIndex, 1);
        updatedStops.splice(draggedIndex, 0, movedStop);
        
        // Update order
        const reorderedStops = updatedStops.map((stop, index) => ({
          ...stop,
          order: index + 1,
        }));
        
        setLocalStops(reorderedStops);
        
        // Send to parent
        const stopsWithAddresses = reorderedStops.filter(stop => 
          stop && stop.id && stop.address && stop.address.trim() !== ''
        );
        onStopsUpdated?.(stopsWithAddresses);
      }
    }
    
    // Reset drag state
    setDraggedItem(null);
    setDraggedIndex(-1);
    setInitialTouchY(0);
    setDragStartOffset(0);
    
    // Smooth return animation
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  }, [draggedItem, draggedIndex, localStops, onStopsUpdated, dragY]);

  // Update visual order during drag (without affecting data)
  const updateVisualOrder = useCallback((translationY: number) => {
    if (!draggedItem) return;
    
    const currentIndex = visualStopsOrder.findIndex(id => id === draggedItem);
    if (currentIndex === -1) return;
    
    // Each item is approximately 70px tall (more accurate measurement)
    const itemHeight = 70;
    const moveThreshold = itemHeight * 0.6; // Require 60% movement to trigger reorder
    const moveDistance = Math.round(translationY / itemHeight);
    const newIndex = Math.max(0, Math.min(visualStopsOrder.length - 1, currentIndex + moveDistance));
    
    // Only update if we've moved far enough to warrant a reorder
    if (newIndex !== draggedIndex && Math.abs(translationY) > moveThreshold) {
      setDraggedIndex(newIndex);
      
      // Update visual order immediately for smooth UI
      const newOrder = [...visualStopsOrder];
      const [movedId] = newOrder.splice(currentIndex, 1);
      newOrder.splice(newIndex, 0, movedId);
      setVisualStopsOrder(newOrder);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [draggedItem, visualStopsOrder, draggedIndex]);

  // Improved gesture handler with precise finger tracking
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
            
            // Apply dampened translation for more natural movement
            const dampenedTranslation = translationY * 0.85; // Reduce sensitivity by 15%
            dragY.setValue(dampenedTranslation);
            setDragStartOffset(dampenedTranslation);
            
            // Update visual order for smooth reordering
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

  // Get stops in visual order for rendering
  const getStopsInVisualOrder = useCallback(() => {
    if (visualStopsOrder.length === 0) return localStops;
    
    return visualStopsOrder.map(id => 
      localStops.find(stop => stop.id === id)
    ).filter(Boolean);
  }, [localStops, visualStopsOrder]);

  useEffect(() => {
    console.log('🔍 Main useEffect triggered:', {
      visible,
      currentPickup: currentPickup?.substring(0, 30),
      currentDestination: currentDestination?.substring(0, 30),
      stopsLength: stops.length,
      currentDestinationText: destinationText?.substring(0, 30)
    });
    
    isMountedRef.current = true;
    isClosingRef.current = false;

    if (visible) {
      // For pickup: always update from props (since it's usually current location)
      console.log('🔍 Setting pickup text to:', currentPickup);
      setPickupText(currentPickup || '');
      
      // For destination: only update if we have meaningful props
      if (currentDestination && currentDestination.trim()) {
        console.log('🔍 Updating destination from props:', currentDestination);
        setDestinationText(currentDestination);
      }
      
      // Determine mode based on whether we have stops or user preference
      const hasStops = stops && stops.length > 0;
      const hasLocalStops = localStops && localStops.length > 0;
      setShowMultiStopMode(hasStops || hasLocalStops);
      
      // Update localStops from props if provided
      if (stops && stops.length > 0) {
        console.log('🔄 Updating localStops from props:', { 
          fromProps: stops.length 
        });
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

  // Debug FullScreenAddressInput state changes
  useEffect(() => {
    const mainModalVisible = visible && !showFullScreenInput;
    if (visible || showFullScreenInput) {
      console.log('🔍 Modal states:', {
        visible,
        showFullScreenInput,
        mainModalVisible,
        localStopsCount: localStops.length
      });
    }
  }, [visible, showFullScreenInput, localStops.length]);

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
      setLoadingLocation(false);
    } catch (error) {
      setCurrentLocation({
        latitude: -37.8136,
        longitude: 144.9631,
        address: 'Melbourne, Australia (Default)',
      });
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
    
    console.log('✅ Full-screen input should now be visible');
  }, []);

  // Function to handle address selection from full-screen input
  const handleFullScreenAddressSelected = useCallback((selectedAddressObject: any) => {
    console.log('🔄 Full-screen address selected:', { 
      selectedAddress: selectedAddressObject, 
      fieldType: fullScreenFieldType, 
      stopId: editingStopId,
    });

    // Extract the address string from the object
    const addressText = selectedAddressObject?.address || '';

    if (fullScreenFieldType === 'pickup') {
      setPickupText(addressText);
      console.log('✅ Updated pickup text:', addressText);
    } else if (fullScreenFieldType === 'destination') {
      // In simple mode, just set destinationText
      setDestinationText(addressText);
      console.log('✅ Updated destination text:', addressText);
    } else if (fullScreenFieldType === 'stop' && editingStopId) {
      // Use functional state update to avoid stale closure
      setLocalStops(currentLocalStops => {
        // Update the specific stop with full location data
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
        
        console.log('🔍 Debug stop update:', {
          editingStopId,
          addressText,
          localStopsCount: currentLocalStops.length,
          updatedStopsCount: updatedStops.length,
        });
        
        // Send all stops with addresses to parent
        const stopsWithAddresses = updatedStops.filter(stop => {
          const hasValidId = stop && stop.id;
          const hasValidAddress = stop && stop.address && stop.address.trim() !== '';
          return hasValidId && hasValidAddress;
        });
        console.log('🔄 Sending stops with addresses to parent:', stopsWithAddresses);
        onStopsUpdated?.(stopsWithAddresses);
        
        return updatedStops;
      });
    }

    setShowFullScreenInput(false);
    setEditingStopId(null);
  }, [fullScreenFieldType, editingStopId, onStopsUpdated, currentDestination]);

  const handleClose = useCallback(() => {
    try {
      if (isClosingRef.current) return;
      
      isClosingRef.current = true;
      
      setShowFullScreenInput(false);
      setEditingStopId(null);
      
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
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    console.log('🔄 handleSubmit called with:', {
      allowPickupEdit,
      pickupText: pickupText,
      destinationText: destinationText,
      showMultiStopMode,
      localStopsLength: localStops.length
    });

    if (allowPickupEdit && !pickupText.trim()) {
      Alert.alert('Error', 'Please enter a pickup address.');
      return;
    }
    
    // In simple mode, we need a destination. In multi-stop mode, we need at least one stop
    if (!showMultiStopMode) {
      if (!destinationText.trim()) {
        Alert.alert('Error', 'Please enter a destination address.');
        return;
      }
    } else {
      const validStops = localStops.filter(stop => stop.address && stop.address.trim());
      if (validStops.length === 0) {
        Alert.alert('Error', 'Please add at least one stop.');
        return;
      }
    }

    try {
      if (allowPickupEdit) {
        const pickup = {
          latitude: currentLocation?.latitude || -37.8136,
          longitude: currentLocation?.longitude || 144.9631,
          address: pickupText.trim(),
        };
        
        // In simple mode, use destinationText. In multi-stop mode, use last stop as destination
        let destination = null;
        if (!showMultiStopMode && destinationText.trim()) {
          destination = {
            latitude: -37.8136,
            longitude: 144.9631,
            address: destinationText.trim(),
          };
        } else if (showMultiStopMode) {
          const validStops = localStops.filter(stop => stop.address && stop.address.trim());
          if (validStops.length > 0) {
            const lastStop = validStops[validStops.length - 1];
            destination = {
              latitude: lastStop.latitude,
              longitude: lastStop.longitude,
              address: lastStop.address,
            };
          }
        }
        
        console.log('🔄 Calling onLocationSelected with:', { pickup, destination });
        onLocationSelected(pickup, destination);
      } else {
        // For non-editable pickup, same logic
        let destination = null;
        if (!showMultiStopMode && destinationText.trim()) {
          destination = {
            latitude: -37.8136,
            longitude: 144.9631,
            address: destinationText.trim(),
          };
        } else if (showMultiStopMode) {
          const validStops = localStops.filter(stop => stop.address && stop.address.trim());
          if (validStops.length > 0) {
            const lastStop = validStops[validStops.length - 1];
            destination = {
              latitude: lastStop.latitude,
              longitude: lastStop.longitude,
              address: lastStop.address,
            };
          }
        }
        
        console.log('🔄 Calling onLocationSelected with:', { pickup: currentLocation, destination });
        onLocationSelected(currentLocation, destination);
      }
      onClose();
    } catch (error) {
      console.log('❌ Error in handleSubmit:', error);
      Alert.alert('Error', 'Failed to process addresses. Please try again.');
    }
  }, [allowPickupEdit, pickupText, destinationText, showMultiStopMode, currentLocation, onLocationSelected, onClose, localStops]);

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
                        openFullScreenInput('pickup', pickupText, 'Pickup');
                      }}
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
                      openFullScreenInput('destination', destinationText, 'Destination');
                    }}
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

                  {/* Add Stops Button */}
                  <TouchableOpacity 
                    style={[styles.addStopButton, styles.highlightNewFeature]} 
                    onPress={() => {
                      console.log('🔄 Switching to multi-stop mode');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      // Convert destination to first stop if it exists
                      if (destinationText.trim()) {
                        const newStop = {
                          id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          latitude: 0,
                          longitude: 0,
                          address: destinationText,
                          order: 1,
                        };
                        setLocalStops([newStop]);
                        setDestinationText(''); // Clear destination as it's now a stop
                      }
                      
                      setShowMultiStopMode(true);
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
                        openFullScreenInput('pickup', pickupText, 'Pickup');
                      }}
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
                                        if (isDragging) return; // Prevent removal while dragging
                                        
                                        console.log('🔄 Removing stop:', stop.id);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        const updatedStops = localStops.filter(s => s && s.id !== stop.id)
                                          .map((stop, index) => ({ ...stop, order: index + 1 }));
                                        
                                        setLocalStops(updatedStops);
                                        
                                        // If no stops left, switch back to simple mode
                                        if (updatedStops.length === 0) {
                                          setShowMultiStopMode(false);
                                        }
                                        
                                        // Notify parent
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
                      
                      // Check for maximum stops limit (5 stops maximum)
                      if (localStops.length >= 5) {
                        Alert.alert('Limit Reached', 'You can add up to 5 stops maximum.');
                        return;
                      }
                      
                      // Create a new stop
                      const newStop = {
                        id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        latitude: 0,
                        longitude: 0,
                        address: '',
                        order: localStops.length + 1,
                      };
                      
                      console.log('🔄 Creating new stop:', newStop);
                      
                      // Add to the stops array
                      const updatedStops = [...localStops, newStop];
                      setLocalStops(updatedStops);
                      
                      console.log('🔄 Updated stops array length:', updatedStops.length);
                      
                      // Open full-screen input for the new stop
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