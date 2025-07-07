import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Animated } from 'react-native';
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
  stops?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    address?: string;
  }>;
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
  stops = [],
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

  const getDirections = async (origin: any, destination: any, waypoints: any[] = []) => {
    if (!apiKey || !origin || !destination) {
      console.log('❌ Cannot get directions - missing API key or locations:', {
        hasApiKey: !!apiKey,
        hasOrigin: !!origin,
        hasDestination: !!destination
      });
      return;
    }

    try {
      setIsLoadingRoute(true);
      
      console.log('🛣️ Getting directions from:', {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        waypointsCount: waypoints.length
      });
      
      // Validate and filter waypoints to only include valid stops
      const validWaypoints = waypoints.filter(waypoint => {
        const isValid = waypoint && 
          typeof waypoint.latitude === 'number' && 
          typeof waypoint.longitude === 'number' &&
          waypoint.latitude !== 0 && 
          waypoint.longitude !== 0 &&
          !isNaN(waypoint.latitude) && 
          !isNaN(waypoint.longitude) &&
          Math.abs(waypoint.latitude) <= 90 && 
          Math.abs(waypoint.longitude) <= 180;
          
        if (!isValid) {
          console.log('🗺️ Filtering out invalid waypoint:', waypoint);
        }
        
        return isValid;
      });
      
      console.log(`🛣️ Using ${validWaypoints.length} valid waypoints for directions`);

      // Build waypoints string for API
      let waypointsString = '';
      if (validWaypoints.length > 0) {
        waypointsString = `&waypoints=${validWaypoints.map(w => `${w.latitude},${w.longitude}`).join('|')}`;
      }

      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypointsString}&key=${apiKey}&mode=driving&alternatives=false&units=metric`;
      console.log('🛣️ Requesting directions from URL:', directionsUrl.replace(apiKey, 'API_KEY_HIDDEN'));

      const response = await fetch(directionsUrl);
      const data = await response.json();

      console.log('🛣️ Directions API response status:', data.status);

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        console.log('🛣️ Route found:', {
          legsCount: route.legs.length,
          overviewPolylineLength: route.overview_polyline.points.length
        });
        
        // Calculate total distance and duration for multi-leg routes
        let totalDistance = 0;
        let totalDuration = 0;
        
        route.legs.forEach((leg: any, index: number) => {
          totalDistance += leg.distance.value;
          totalDuration += leg.duration.value;
          console.log(`🛣️ Leg ${index + 1}: ${leg.distance.text}, ${leg.duration.text}`);
        });

        // Convert to readable format
        const distanceText = totalDistance >= 1000 
          ? `${(totalDistance / 1000).toFixed(1)} km`
          : `${totalDistance} m`;
        
        const durationText = totalDuration >= 3600
          ? `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`
          : `${Math.floor(totalDuration / 60)} min`;

        const routeCoordinates = decodePolyline(route.overview_polyline.points);
        
        console.log('🛣️ Route decoded successfully:', {
          coordinatesCount: routeCoordinates.length,
          totalDistance: distanceText,
          totalDuration: durationText,
          firstCoord: routeCoordinates[0],
          lastCoord: routeCoordinates[routeCoordinates.length - 1]
        });

        setRoute({
          coordinates: routeCoordinates,
          distance: distanceText,
          duration: durationText,
        });
      } else {
        console.log('❌ Directions API failed:', {
          status: data.status,
          errorMessage: data.error_message,
          availableAlternatives: data.available_travel_modes
        });
        setRoute(null);
      }
    } catch (error) {
      console.log('❌ Directions request failed:', error);
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
    console.log('🗺️ MapView received props:', {
      hasPickup: !!pickupLocation,
      hasDestination: !!destinationLocation,
      pickupCoords: pickupLocation ? `${pickupLocation.latitude},${pickupLocation.longitude}` : 'none',
      destinationCoords: destinationLocation ? `${destinationLocation.latitude},${destinationLocation.longitude}` : 'none',
      stopsCount: stops.length,
      stopsValid: stops.filter(stop => 
        stop && 
        typeof stop.latitude === 'number' && 
        typeof stop.longitude === 'number' &&
        stop.latitude !== 0 && 
        stop.longitude !== 0 &&
        !isNaN(stop.latitude) && 
        !isNaN(stop.longitude)
      ).length
    });
    
    if (pickupLocation && destinationLocation && mapRef.current) {
      // Validate pickup and destination coordinates
      const pickupValid = pickupLocation.latitude !== 0 && pickupLocation.longitude !== 0 && 
                          !isNaN(pickupLocation.latitude) && !isNaN(pickupLocation.longitude);
      const destinationValid = destinationLocation.latitude !== 0 && destinationLocation.longitude !== 0 && 
                              !isNaN(destinationLocation.latitude) && !isNaN(destinationLocation.longitude);
      
      if (!pickupValid || !destinationValid) {
        console.error('❌ Invalid coordinates provided to MapView:', {
          pickup: pickupLocation,
          destination: destinationLocation,
          pickupValid,
          destinationValid
        });
        return;
      }
      
      console.log('✅ MapView processing valid coordinates:', {
        pickup: `${pickupLocation.latitude},${pickupLocation.longitude}`,
        destination: `${destinationLocation.latitude},${destinationLocation.longitude}`
      });
      
      // Filter out invalid stops before using them with additional safety checks
      const validStops = stops.filter(stop => {
        try {
          return (
            stop && 
            stop.id && 
            typeof stop.latitude === 'number' && 
            typeof stop.longitude === 'number' &&
            stop.latitude !== 0 && 
            stop.longitude !== 0 &&
            !isNaN(stop.latitude) && 
            !isNaN(stop.longitude) &&
            Math.abs(stop.latitude) <= 90 && 
            Math.abs(stop.longitude) <= 180 &&
            isFinite(stop.latitude) &&
            isFinite(stop.longitude)
          );
        } catch (error) {
          // If any error occurs checking a stop, exclude it
          return false;
        }
      });
      
      console.log(`🗺️ Using ${validStops.length} valid stops for route calculation`);
      
      // Get directions with waypoints if valid stops exist
      getDirections(pickupLocation, destinationLocation, validStops);
      
      // Fit map to show all locations (pickup, valid stops, destination)
      const allCoordinates = [
        {
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
        },
        ...validStops.map(stop => ({
          latitude: stop.latitude,
          longitude: stop.longitude,
        })),
        {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
        },
      ];

      console.log('🗺️ Fitting map to coordinates:', allCoordinates);

      // Immediate fit without delay for better UX
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(allCoordinates, {
          edgePadding: {
            top: 80,
            right: 150,
            bottom: 80,
            left: 40,
          },
          animated: true,
        });
      }
      
      // Additional fit after a short delay to ensure markers are rendered
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(allCoordinates, {
            edgePadding: {
              top: 80,
              right: 150,
              bottom: 80,
              left: 40,
            },
            animated: true,
          });
        }
      }, 500);
    } else if (pickupLocation && mapRef.current) {
      // Center on pickup location
      setRoute(null);
      console.log('🗺️ Centering on pickup location:', `${pickupLocation.latitude},${pickupLocation.longitude}`);
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: pickupLocation.latitude,
            longitude: pickupLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 1000);
        }
      }, 500);
    } else {
      console.log('🗺️ No valid locations to display on map');
    }
  }, [pickupLocation, destinationLocation, stops]);

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
        {/* Route Polyline - Immediate display without animation */}
        {route?.coordinates && route.coordinates.length > 0 && (
          <Polyline
            key={`route-${route.coordinates.length}`}
            coordinates={route.coordinates}
            strokeWidth={8}
            strokeColor="#0066FF"
            lineJoin="round"
            lineCap="round"
            geodesic={true}
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

        {/* Destination Location Marker - Only show in simple mode (no stops) */}
        {destinationLocation && stops.filter(stop => 
          stop && 
          stop.id && 
          typeof stop.latitude === 'number' && 
          typeof stop.longitude === 'number' &&
          stop.latitude !== 0 && 
          stop.longitude !== 0 &&
          !isNaN(stop.latitude) && 
          !isNaN(stop.longitude) &&
          Math.abs(stop.latitude) <= 90 && 
          Math.abs(stop.longitude) <= 180
        ).length === 0 && (
          <Marker
            coordinate={{
              latitude: destinationLocation.latitude,
              longitude: destinationLocation.longitude,
            }}
            title="Destination"
            description={destinationLocation.address || 'Destination location'}
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

        {/* Stop Markers */}
        {stops.filter(stop => {
          const isValid = stop && 
            stop.id && 
            typeof stop.latitude === 'number' && 
            typeof stop.longitude === 'number' &&
            stop.latitude !== 0 && 
            stop.longitude !== 0 &&
            !isNaN(stop.latitude) && 
            !isNaN(stop.longitude) &&
            Math.abs(stop.latitude) <= 90 && 
            Math.abs(stop.longitude) <= 180;
          
          if (!isValid) {
            console.log('🗺️ Filtering out stop from map:', {
              id: stop?.id,
              address: stop?.address,
              lat: stop?.latitude,
              lng: stop?.longitude,
              reason: !stop ? 'null stop' :
                      !stop.id ? 'no id' :
                      typeof stop.latitude !== 'number' ? 'lat not number' :
                      typeof stop.longitude !== 'number' ? 'lng not number' :
                      stop.latitude === 0 ? 'lat is 0' :
                      stop.longitude === 0 ? 'lng is 0' :
                      isNaN(stop.latitude) ? 'lat is NaN' :
                      isNaN(stop.longitude) ? 'lng is NaN' :
                      Math.abs(stop.latitude) > 90 ? 'lat out of range' :
                      Math.abs(stop.longitude) > 180 ? 'lng out of range' : 'unknown'
            });
          }
          
          return isValid;
        }).map((stop, index, validStops) => {
          console.log('🗺️ Rendering stop marker:', { id: stop.id, address: stop.address, lat: stop.latitude, lng: stop.longitude });
          
          const isLastStop = index === validStops.length - 1;
          const stopNumber = (index + 1).toString();
          const markerColor = isLastStop ? '#EF4444' : '#F59E0B'; // Red for final stop, orange for others
          
          return (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: stop.latitude,
                longitude: stop.longitude,
              }}
              title={isLastStop ? `Stop ${index + 1} (Final Destination)` : `Stop ${index + 1}`}
              description={stop.address || (isLastStop ? 'Final destination' : 'Stop location')}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.stopMarkerContainer}>
                <View style={[styles.stopMarker, { borderColor: markerColor }]}>
                  <Text style={[styles.stopMarkerText, { color: markerColor }]}>{stopNumber}</Text>
                </View>
                <View style={[styles.stopMarkerShadow, { backgroundColor: `${markerColor}1A` }]} />
              </View>
            </Marker>
          );
        })}
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
    top: 16,      // Moved closer to top edge
    right: 16,    // Moved to right side instead of left
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 10,   // Slightly increased padding
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
    minWidth: 120,  // Ensure consistent width
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
  stopMarkerContainer: {
    position: 'relative',
  },
  stopMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  stopMarkerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  stopMarkerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
});

export default MapViewComponent; 