import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
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
import AddressManager from './AddressManager';

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
  const [addressText, setAddressText] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const inputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Focus input when modal opens
  useEffect(() => {
    if (visible && inputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Update address text when initial value changes
  useEffect(() => {
    if (initialValue !== addressText) {
      setAddressText(initialValue);
    }
  }, [initialValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const searchPlaces = async (query: string) => {
    if (!apiKey) {
      console.log('⚠️ No API key available for places search');
      return;
    }

    try {
      setIsSearching(true);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=address&components=country:au&language=en`
      );
      
      const data = await response.json();
      
      if (data.predictions && Array.isArray(data.predictions)) {
        setPredictions(data.predictions);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTextChange = useCallback((text: string) => {
    console.log('🔍 Text changed:', { text, length: text.length });
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

      // Get place details using AddressManager
      const result = await AddressManager.getPlaceDetails(prediction.place_id);
      
      if (result.success && result.data) {
        // Return the standardized address data
        onAddressSelected(AddressManager.toLegacyAddress(result.data));
        
        // Close with delay for smooth transition
        setTimeout(() => {
          handleClose();
        }, 150);
      } else {
        throw new Error(result.error || 'Failed to get place details');
      }
    } catch (error) {
      console.error('Error selecting prediction:', error);
      Alert.alert('Error', 'Unable to get location details. Please try again.');
    }
  }, [onAddressSelected]);

  const handleRecentSearchSelect = useCallback(async (address: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setAddressText(address);
      
      // Use AddressManager to geocode the address
      const result = await AddressManager.geocodeAddress(address);
      
      if (result.success && result.data) {
        console.log('✅ Address geocoded successfully:', result.data);
        onAddressSelected(AddressManager.toLegacyAddress(result.data));
        
        setTimeout(() => {
          handleClose();
        }, 150);
      } else {
        throw new Error(result.error || 'Failed to geocode address');
      }
    } catch (error) {
      console.log('❌ Error in handleRecentSearchSelect:', error);
      Alert.alert('Error', 'Unable to process address. Please try again.');
    }
  }, [onAddressSelected]);

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

  const handleConfirm = useCallback(async () => {
    if (!addressText.trim()) {
      Alert.alert('Error', 'Please enter an address.');
      return;
    }

    try {
      // If we have predictions, use the first one
      if (predictions.length > 0) {
        await handlePredictionSelect(predictions[0]);
        return;
      }

      // Otherwise, geocode the manually entered text using AddressManager
      console.log('🔍 Geocoding manually entered address:', addressText);
      
      const result = await AddressManager.geocodeAddress(addressText.trim());
      
      if (result.success && result.data) {
        console.log('✅ Manual address geocoded successfully:', result.data);
        onAddressSelected(AddressManager.toLegacyAddress(result.data));
        handleClose();
      } else {
        throw new Error(result.error || 'Failed to geocode address');
      }
    } catch (error) {
      console.error('Error confirming address:', error);
      Alert.alert('Error', 'Unable to process address. Please try again.');
    }
  }, [addressText, predictions, handlePredictionSelect, onAddressSelected]);

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
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <AntDesign name="arrowleft" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{fieldLabel}</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Address Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <View style={[styles.inputDot, { backgroundColor: getFieldColor() }]} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={addressText}
              onChangeText={handleTextChange}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              autoFocus={true}
              returnKeyType="search"
              onSubmitEditing={handleConfirm}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        {/* Results */}
        <View style={styles.resultsContainer}>
          {isSearching && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {predictions.length > 0 && (
            <FlatList
              data={predictions}
              renderItem={renderPrediction}
              keyExtractor={(item) => item.place_id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {predictions.length === 0 && !isSearching && addressText.trim() === '' && (
            <View style={styles.emptyState}>
              <AntDesign name="enviromento" size={48} color="#E5E7EB" />
              <Text style={styles.emptyStateTitle}>Find your location</Text>
              <Text style={styles.emptyStateSubtitle}>
                Enter an address, landmark, or place name
              </Text>
            </View>
          )}

          {predictions.length === 0 && !isSearching && addressText.trim() !== '' && (
            <View style={styles.emptyState}>
              <AntDesign name="frown" size={48} color="#E5E7EB" />
              <Text style={styles.emptyStateTitle}>No results found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Try a different search term or confirm to use "{addressText}"
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
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
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default FullScreenAddressInput; 