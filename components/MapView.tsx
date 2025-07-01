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

  // Custom map style for unique appearance
  const customMapStyle = [
    {
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#f5f5f5"
        }
      ]
    },
    {
      "elementType": "labels.icon",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#616161"
        }
      ]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [
        {
          "color": "#f5f5f5"
        }
      ]
    },
    {
      "featureType": "administrative.land_parcel",
      "elementType": "labels",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "administrative.land_parcel",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#bdbdbd"
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#eeeeee"
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "featureType": "poi.business",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#e5f5e5"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "poi.park",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#9e9e9e"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#ffffff"
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "labels",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#757575"
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#dadada"
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "labels",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#616161"
        }
      ]
    },
    {
      "featureType": "road.local",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "labels",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#9e9e9e"
        }
      ]
    },
    {
      "featureType": "transit",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "transit.line",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#e5e5e5"
        }
      ]
    },
    {
      "featureType": "transit.station",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#eeeeee"
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#c9e2f0"
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "color": "#9e9e9e"
        }
      ]
    }
  ];

  const getDirections = async (origin: any, destination: any) => {
    if (!apiKey) {
      console.log('No API key available for directions');
      return;
    }

    console.log('🗺️ Fetching directions from:', origin.address, 'to:', destination.address);

    try {
      setIsLoadingRoute(true);
      const originString = `${origin.latitude},${origin.longitude}`;
      const destinationString = `${destination.latitude},${destination.longitude}`;
      
      console.log('📍 Coordinates:', { originString, destinationString });
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${originString}&destination=${destinationString}&key=${apiKey}&mode=driving`
      );
      
      const data = await response.json();
      console.log('🚗 Directions API Response Status:', data.status);
      
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        console.log('✅ Route found:', {
          distance: leg.distance.text,
          duration: leg.duration.text,
          polylinePoints: route.overview_polyline.points.length
        });
        
        // Decode polyline
        const points = decodePolyline(route.overview_polyline.points);
        console.log('📍 Decoded route points:', points.length);
        console.log('📍 First few points:', points.slice(0, 3));
        console.log('📍 Last few points:', points.slice(-3));
        
        // Validate coordinate format
        const validPoints = points.filter(point => 
          point.latitude && point.longitude && 
          typeof point.latitude === 'number' && typeof point.longitude === 'number'
        );
        console.log('✅ Valid coordinate points:', validPoints.length, 'out of', points.length);
        
        setRoute({
          coordinates: validPoints, // Use validated points
          distance: leg.distance.text,
          duration: leg.duration.text,
        });
        
        console.log('🔥 ROUTE STATE SET! Coordinates:', validPoints.length, 'Distance:', leg.distance.text, 'Duration:', leg.duration.text);
        console.log('🔥 FIRST 3 ROUTE COORDINATES:', JSON.stringify(validPoints.slice(0, 3)));
        
        // Fit map to route after route is loaded for better visibility
        setTimeout(() => {
          if (mapRef.current && validPoints.length > 0) {
            mapRef.current.fitToCoordinates(validPoints, {
              edgePadding: {
                top: 40,
                right: 30,
                bottom: 60,
                left: 30,
              },
              animated: true,
            });
          }
        }, 800);
      } else {
        console.log('❌ Directions API response:', data.status, data.error_message);
        setRoute(null);
      }
    } catch (error) {
      console.log('❌ Error getting directions:', error);
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
      console.log('Map updating with both locations:', { pickupLocation, destinationLocation });
      
      // Get directions between pickup and destination
      getDirections(pickupLocation, destinationLocation);
      
      // Fit map to show both pickup and destination with better timing
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

      // Immediate fit without delay for better UX
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: {
            top: 40,
            right: 30,
            bottom: 60,
            left: 30,
          },
          animated: true,
        });
      }
      
      // Additional fit after a short delay to ensure markers are rendered
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: {
              top: 40,
              right: 30,
              bottom: 60,
              left: 30,
            },
            animated: true,
          });
        }
      }, 500);
    } else if (pickupLocation && mapRef.current) {
      console.log('Map updating with pickup only:', pickupLocation);
      // Center on pickup location
      setRoute(null);
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: pickupLocation.latitude,
            longitude: pickupLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }, 1000);
        }
      }, 100);
    } else {
      setRoute(null);
    }
  }, [pickupLocation, destinationLocation]);

  // Monitor route state changes
  useEffect(() => {
    if (route) {
      console.log('🛣️ Route state updated:', {
        coordinatesCount: route.coordinates.length,
        distance: route.distance,
        duration: route.duration,
        firstPoint: route.coordinates[0],
        lastPoint: route.coordinates[route.coordinates.length - 1]
      });
      console.log('🎨 POLYLINE SHOULD BE RENDERING NOW WITH', route.coordinates.length, 'COORDINATES');
      console.log('🎨 POLYLINE STROKE: 8px #0066FF with', route.coordinates.length, 'points');
      console.log('🎨 FIRST 5 COORDINATES:', JSON.stringify(route.coordinates.slice(0, 5)));
    } else {
      console.log('🛣️ Route cleared/null - no polyline should be visible');
    }
  }, [route]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        key={`map-${route?.coordinates?.length || 0}-${pickupLocation?.latitude || 0}-${destinationLocation?.latitude || 0}`}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={defaultRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        customMapStyle={customMapStyle}
      >
        {/* Route Polyline - Road-following route from Google Directions */}
        {route?.coordinates && route.coordinates.length > 0 && (
          <Polyline
            key={`route-${Date.now()}-${route.coordinates.length}`}
            coordinates={route.coordinates}
            strokeWidth={8}
            strokeColor="#0066FF"
            lineJoin="round"
            lineCap="round"
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
            <View style={styles.pickupMarkerContainer}>
              <View style={styles.pickupMarker}>
                <View style={styles.pickupMarkerInner}>
                  <View style={styles.pickupMarkerDot} />
                </View>
              </View>
              <View style={styles.markerPulse} />
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
            <View style={styles.destinationMarkerContainer}>
              <View style={styles.destinationMarker}>
                <View style={styles.destinationMarkerInner}>
                  <MaterialIcons name="place" size={18} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.destinationMarkerShadow} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Enhanced Route Info Card */}
      {route && (
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoContent}>
            <View style={styles.routeInfoItem}>
              <View style={styles.routeIconContainer}>
                <MaterialIcons name="directions-car" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.routeInfoText}>{route.duration}</Text>
            </View>
            <View style={styles.routeInfoItem}>
              <View style={styles.routeIconContainer}>
                <MaterialIcons name="straighten" size={12} color="#FFFFFF" />
              </View>
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

      {/* Modern location indicator overlay - only show when no route */}
      {!route && (
        <View style={styles.locationCard}>
          <View style={styles.locationCardContent}>
            <View style={styles.locationCardIcon}>
              <MaterialIcons name="my-location" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.locationCardText} numberOfLines={1}>
              {pickupLocation ? pickupLocation.address || 'Selected Location' : 'Current Location'}
            </Text>
          </View>
        </View>
      )}
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
  pickupMarkerContainer: {
    position: 'relative',
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
  pickupMarkerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6',
    marginTop: 13,
    marginLeft: 13,
  },
  markerPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  destinationMarkerContainer: {
    position: 'relative',
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
  destinationMarkerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  routeInfoCard: {
    position: 'absolute',
    top: 24,
    left: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  routeInfoContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
    width: '100%',
  },
  routeInfoText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 6,
  },
  routeIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
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