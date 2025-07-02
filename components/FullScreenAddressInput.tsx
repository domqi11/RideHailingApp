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
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FullScreenAddressInputProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelected: (address: any) => void;
  fieldType: 'pickup' | 'destination' | 'stop';
  fieldLabel: string;
  initialValue?: string;
  placeholder?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const FullScreenAddressInput: React.FC<FullScreenAddressInputProps> = ({
  visible,
  onClose,
  onAddressSelected,
  fieldType,
  fieldLabel,
  initialValue = '',
  placeholder = 'Enter address or landmark...',
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [addressText, setAddressText] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches] = useState([
    'Melbourne CBD, VIC, Australia',
    'Flinders Street Station, Melbourne VIC, Australia',
    'Melbourne Airport, VIC, Australia',
    'Crown Casino, Melbourne VIC, Australia',
    'Royal Melbourne Hospital, Parkville VIC, Australia',
  ]);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);

  // Use environment variable for API key
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    isMountedRef.current = true;

    if (visible) {
      setAddressText(initialValue);
      
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        // Auto-focus the input after animation
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      });
    } else {
      // Slide out animation
      Animated.spring(slideAnim, {
        toValue: screenHeight,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();
    }

    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [visible, initialValue]);

  const searchPlaces = async (query: string) => {
    if (!apiKey || query.length < 2 || !isMountedRef.current) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      
      // Use Melbourne as bias location
      const locationBias = '&location=-37.8136,144.9631&radius=200000';
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:au${locationBias}&language=en`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions && isMountedRef.current) {
        setPredictions(data.predictions.slice(0, 10));
      } else {
        setPredictions([]);
      }
    } catch (error) {
      setPredictions([]);
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
      }
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

  const handleTextChange = useCallback((text: string) => {
    setAddressText(text);
    
    // Cancel previous search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If text is empty, clear predictions
    if (!text.trim()) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    // Debounced search
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && text.trim()) {
        searchPlaces(text);
      }
    }, 300);
  }, []);

  const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Update text immediately
      setAddressText(prediction.description);
      setPredictions([]);
      setIsSearching(false);

      // Get place details
      const placeDetails = await getPlaceDetails(prediction.place_id);
      
      // Return the address to parent
      onAddressSelected(placeDetails);
      
      // Close with delay for smooth transition
      setTimeout(() => {
        handleClose();
      }, 150);
    } catch (error) {
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    }
  }, [onAddressSelected]);

  const handleRecentSearchSelect = useCallback(async (address: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setAddressText(address);
      
      // Try to geocode the address
      if (apiKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
          );
          
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const geocodedLocation = {
              latitude: result.geometry.location.lat,
              longitude: result.geometry.location.lng,
              address: result.formatted_address,
            };
            
            onAddressSelected(geocodedLocation);
            setTimeout(() => {
              handleClose();
            }, 150);
            return;
          }
        } catch (error) {
          // Fall through to basic mode
        }
      }
      
      // Basic mode - return address as is
      onAddressSelected({
        latitude: -37.8136,
        longitude: 144.9631,
        address: address,
      });
      
      setTimeout(() => {
        handleClose();
      }, 150);
    } catch (error) {
      Alert.alert('Error', 'Unable to process address. Please try again.');
    }
  }, [apiKey, onAddressSelected]);

  const handleClose = useCallback(() => {
    // Clear search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
    // Clear state
    setPredictions([]);
    setIsSearching(false);
    
    // Blur input
    inputRef.current?.blur();
    
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!addressText.trim()) {
      Alert.alert('Error', 'Please enter an address.');
      return;
    }

    // If we have predictions, use the first one
    if (predictions.length > 0) {
      handlePredictionSelect(predictions[0]);
      return;
    }

    // Otherwise, try to geocode manually entered text
    if (apiKey) {
      handleRecentSearchSelect(addressText.trim());
    } else {
      // Basic mode
      onAddressSelected({
        latitude: -37.8136,
        longitude: 144.9631,
        address: addressText.trim(),
      });
      handleClose();
    }
  }, [addressText, predictions, apiKey, handlePredictionSelect, handleRecentSearchSelect, onAddressSelected]);

  const getFieldColor = () => {
    switch (fieldType) {
      case 'pickup': return '#3B82F6';
      case 'destination': return '#EF4444';
      case 'stop': return '#10B981';
      default: return '#6B7280';
    }
  };

  const renderPrediction = useCallback(({ item }: { item: PlacePrediction }) => (
    <Pressable 
      style={({ pressed }) => [
        styles.predictionItem,
        pressed && { backgroundColor: '#F3F4F6' }
      ]}
      onPress={() => handlePredictionSelect(item)}
    >
      <View style={styles.predictionContent}>
        <View style={[styles.predictionIcon, { backgroundColor: getFieldColor() }]}>
          <AntDesign name="enviromento" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.predictionTextContainer}>
          <Text style={styles.predictionMainText} numberOfLines={1}>
            {item.structured_formatting.main_text}
          </Text>
          <Text style={styles.predictionSecondaryText} numberOfLines={1}>
            {item.structured_formatting.secondary_text}
          </Text>
        </View>
        <AntDesign name="arrowright" size={16} color="#9CA3AF" />
      </View>
    </Pressable>
  ), [handlePredictionSelect, fieldType]);

  const renderRecentSearch = useCallback(({ item }: { item: string }) => (
    <Pressable 
      style={({ pressed }) => [
        styles.recentItem,
        pressed && { backgroundColor: '#F3F4F6' }
      ]}
      onPress={() => handleRecentSearchSelect(item)}
    >
      <View style={styles.recentContent}>
        <View style={styles.recentIcon}>
          <Feather name="clock" size={16} color="#9CA3AF" />
        </View>
        <Text style={styles.recentText} numberOfLines={1}>
          {item}
        </Text>
        <AntDesign name="arrowright" size={16} color="#9CA3AF" />
      </View>
    </Pressable>
  ), [handleRecentSearchSelect]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <AntDesign name="arrowleft" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.headerTitleText}>{fieldLabel}</Text>
              <View style={[styles.fieldIndicator, { backgroundColor: getFieldColor() }]} />
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputContainer, { borderColor: getFieldColor() }]}>
              <View style={[styles.searchIcon, { backgroundColor: getFieldColor() }]}>
                <AntDesign name="search1" size={20} color="#FFFFFF" />
              </View>
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                value={addressText}
                onChangeText={handleTextChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
                onSubmitEditing={handleConfirm}
              />
              {addressText.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setAddressText('')}
                  style={styles.clearButton}
                >
                  <AntDesign name="close" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Searching addresses...</Text>
              </View>
            ) : predictions.length > 0 ? (
              <FlatList
                data={predictions}
                renderItem={renderPrediction}
                keyExtractor={(item) => item.place_id}
                style={styles.predictionsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.predictionsContent}
              />
            ) : addressText.length > 0 ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No addresses found</Text>
                <Text style={styles.noResultsSubtext}>Try a different search term</Text>
              </View>
            ) : (
              <View style={styles.recentsContainer}>
                <Text style={styles.sectionTitle}>Recent searches</Text>
                <FlatList
                  data={recentSearches}
                  renderItem={renderRecentSearch}
                  keyExtractor={(item, index) => `recent-${index}`}
                  style={styles.recentsList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                />
              </View>
            )}
          </View>

          {/* Confirm Button */}
          {addressText.length > 0 && (
            <View style={styles.confirmContainer}>
              <TouchableOpacity 
                style={[styles.confirmButton, { backgroundColor: getFieldColor() }]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>
                  {predictions.length > 0 ? 'Select First Result' : 'Use This Address'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  fieldIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 16,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  predictionsList: {
    flex: 1,
  },
  predictionsContent: {
    paddingVertical: 8,
  },
  predictionItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  predictionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predictionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  predictionSecondaryText: {
    fontSize: 14,
    color: '#6B7280',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  recentsContainer: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  recentsList: {
    flex: 1,
  },
  recentItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recentText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  confirmContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FullScreenAddressInput; 