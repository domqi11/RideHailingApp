import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';

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

interface RouteInfo {
  coordinates: Array<{latitude: number; longitude: number}>;
  distance: string;
  duration: string;
}

const MapViewComponent: React.FC<MapViewComponentProps> = ({
  pickupLocation,
  destinationLocation,
  showUserLocation = true,
  height = 320,
}) => {
  const mapRef = useRef<MapView>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Use environment variable instead of hardcoded key
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Default region (Melbourne, Australia to match the app location)
  const defaultRegion = {
    latitude: -37.8136,
    longitude: 144.9631,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  const getDirections = async (origin: any, destination: any) => {
    if (!apiKey) {
      console.log('No API key available for directions');
      return;
    }

    try {
      setIsLoadingRoute(true);
      const originString = `${origin.latitude},${origin.longitude}`;
      const destinationString = `${destination.latitude},${destination.longitude}`;
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${originString}&destination=${destinationString}&key=${apiKey}&mode=driving`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Decode polyline
        const points = decodePolyline(route.overview_polyline.points);
        
        setRoute({
          coordinates: points,
          distance: leg.distance.text,
          duration: leg.duration.text,
        });
      } else {
        console.log('Directions API response:', data.status);
        setRoute(null);
      }
    } catch (error) {
      console.log('Error getting directions:', error);
      setRoute(null);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Decode polyline function (Google's encoded polyline algorithm)
  const decodePolyline = (encoded: string) => {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  useEffect(() => {
    if (pickupLocation && destinationLocation && mapRef.current) {
      // Get directions between pickup and destination
      getDirections(pickupLocation, destinationLocation);
      
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

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 80,
            right: 80,
            bottom: 160,
            left: 80,
          },
          animated: true,
        });
      }, 500);
    } else if (pickupLocation && mapRef.current) {
      // Center on pickup location
      setRoute(null);
      mapRef.current.animateToRegion({
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      setRoute(null);
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
        {/* Route Polyline */}
        {route && route.coordinates.length > 0 && (
          <Polyline
            coordinates={route.coordinates}
            strokeWidth={4}
            strokeColor="#3B82F6"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Pickup Location Marker */}
        {pickupLocation && (
          <Marker
            coordinate={{
              latitude: pickupLocation.latitude,
              longitude: pickupLocation.longitude,
            }}
            title="Pickup Location"
            description={pickupLocation.address}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pickupMarker}>
              <View style={styles.pickupMarkerInner}>
                <MaterialIcons name="my-location" size={16} color="#3B82F6" />
              </View>
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
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destinationMarker}>
              <View style={styles.destinationMarkerInner}>
                <MaterialIcons name="place" size={20} color="#EF4444" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Route Info Card */}
      {route && (
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoContent}>
            <View style={styles.routeInfoItem}>
              <MaterialIcons name="directions-car" size={16} color="#3B82F6" />
              <Text style={styles.routeInfoText}>{route.duration}</Text>
            </View>
            <View style={styles.routeInfoDivider} />
            <View style={styles.routeInfoItem}>
              <MaterialIcons name="straighten" size={16} color="#6B7280" />
              <Text style={styles.routeInfoText}>{route.distance}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Loading indicator for route */}
      {isLoadingRoute && (
        <View style={styles.loadingCard}>
          <View style={styles.loadingContent}>
            <Text style={styles.loadingText}>Calculating route...</Text>
          </View>
        </View>
      )}

      {/* Location indicator overlay */}
      <View style={styles.locationCard}>
        <View style={styles.locationCardContent}>
          <View style={styles.locationCardIcon}>
            <MaterialIcons name="my-location" size={14} color="#3B82F6" />
          </View>
          <Text style={styles.locationCardText} numberOfLines={1}>
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
  pickupMarkerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
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
  destinationMarkerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeInfoCard: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  routeInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  routeInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 8,
  },
  routeInfoDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
    marginHorizontal: 12,
  },
  loadingCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
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
  locationCardIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  locationCardText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});

export default MapViewComponent; 