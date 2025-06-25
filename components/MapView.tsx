import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { AntDesign } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface MapViewComponentProps {
  pickupLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  showUserLocation?: boolean;
  height?: number;
}

const MapViewComponent: React.FC<MapViewComponentProps> = ({
  pickupLocation,
  destinationLocation,
  showUserLocation = true,
  height = 320,
}) => {
  const mapRef = useRef<MapView>(null);

  // Default region (San Francisco)
  const defaultRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  useEffect(() => {
    if (pickupLocation && destinationLocation && mapRef.current) {
      // Fit map to show both pickup and destination
      const coordinates = [
        {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
        },
        {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
        },
      ];

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        },
        animated: true,
      });
    } else if (pickupLocation && mapRef.current) {
      // Center on pickup location
      mapRef.current.animateToRegion({
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [pickupLocation, destinationLocation]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={defaultRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Pickup Location Marker */}
        {pickupLocation && (
          <Marker
            coordinate={{
              latitude: pickupLocation.latitude,
              longitude: pickupLocation.longitude,
            }}
            title="Pickup Location"
            description={pickupLocation.address}
          >
            <View style={styles.pickupMarker}>
              <AntDesign name="enviromento" size={24} color="#3B82F6" />
            </View>
          </Marker>
        )}

        {/* Destination Location Marker */}
        {destinationLocation && (
          <Marker
            coordinate={{
              latitude: destinationLocation.latitude,
              longitude: destinationLocation.longitude,
            }}
            title="Destination"
            description={destinationLocation.address}
          >
            <View style={styles.destinationMarker}>
              <AntDesign name="enviromento" size={24} color="#EF4444" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Location indicator overlay */}
      <View style={styles.locationCard}>
        <View style={styles.locationCardContent}>
          <AntDesign name="enviromento" size={16} color="#3B82F6" />
          <Text style={styles.locationCardText}>
            {pickupLocation ? pickupLocation.address || 'Selected Location' : 'Current Location'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  destinationMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
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
});

export default MapViewComponent; 