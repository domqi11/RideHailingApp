import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { AntDesign } from '@expo/vector-icons';

interface GooglePlacesInputProps {
  placeholder: string;
  onPlaceSelected: (place: any) => void;
  value?: string;
  editable?: boolean;
  pinColor?: string;
}

const GooglePlacesInput: React.FC<GooglePlacesInputProps> = ({
  placeholder,
  onPlaceSelected,
  value,
  editable = true,
  pinColor = '#3B82F6',
}) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('Google Maps API key not found. Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.inputPin, { backgroundColor: pinColor }]} />
      <GooglePlacesAutocomplete
        placeholder={placeholder}
        textInputProps={{
          value: value,
          editable: editable,
          style: styles.textInput,
          placeholderTextColor: '#9CA3AF',
        }}
        onPress={(data, details = null) => {
          onPlaceSelected({ data, details });
        }}
        query={{
          key: apiKey,
          language: 'en',
          types: 'address',
          components: 'country:us', // Restrict to US addresses
        }}
        fetchDetails={true}
        styles={{
          container: styles.autocompleteContainer,
          listView: styles.listView,
          row: styles.row,
          description: styles.description,
          separator: styles.separator,
        }}
        enablePoweredByContainer={false}
        keepResultsAfterBlur={true}
        predefinedPlaces={[]}
      />
      {!editable && (
        <View style={styles.searchButton}>
          <AntDesign name="search1" size={16} color="white" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 4,
  },
  inputPin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: 20,
    top: 24,
    zIndex: 2,
  },
  autocompleteContainer: {
    flex: 0,
  },
  textInput: {
    height: 56,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingLeft: 48,
    paddingRight: 56,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 0,
  },
  listView: {
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
  },
  row: {
    padding: 16,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  searchButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});

export default GooglePlacesInput; 