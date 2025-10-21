import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { MapViewProps, PROVIDER_GOOGLE } from 'react-native-maps';
import { BrandColors } from '../theme/colors';

interface SafeMapViewProps extends MapViewProps {
  fallbackComponent?: React.ReactNode;
}

export interface SafeMapViewRef {
  animateToRegion: (region: any, duration?: number) => void;
  animateToCoordinate: (coordinate: any, duration?: number) => void;
  fitToElements: (options?: { edgePadding?: any; animated?: boolean }) => void;
  fitToSuppliedMarkers: (markers: string[], animated?: boolean) => void;
}

const SafeMapView = forwardRef<SafeMapViewRef, SafeMapViewProps>(
  ({ fallbackComponent, ...props }, ref) => {
    const mapRef = useRef<MapView>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isMounted, setIsMounted] = useState(true);

    // Expose safe methods through ref
    useImperativeHandle(ref, () => ({
      animateToRegion: (region: any, duration = 1000) => {
        if (mapRef.current && isMapReady && isMounted) {
          try {
            mapRef.current.animateToRegion(region, duration);
          } catch (error) {
            console.log('SafeMapView: Error animating to region:', error);
          }
        }
      },
      animateToCoordinate: (coordinate: any, duration = 1000) => {
        if (mapRef.current && isMapReady && isMounted) {
          try {
            mapRef.current.animateToCoordinate(coordinate, duration);
          } catch (error) {
            console.log('SafeMapView: Error animating to coordinate:', error);
          }
        }
      },
      fitToElements: (options = { animated: true }) => {
        if (mapRef.current && isMapReady && isMounted) {
          try {
            // fitToElements takes animated parameter and optional edgePadding
            if (options.edgePadding) {
              mapRef.current.fitToElements(options.animated, options.edgePadding);
            } else {
              mapRef.current.fitToElements(options.animated);
            }
          } catch (error) {
            console.log('SafeMapView: Error fitting to elements:', error);
          }
        }
      },
      fitToSuppliedMarkers: (markers: string[], animated = true) => {
        if (mapRef.current && isMapReady && isMounted) {
          try {
            mapRef.current.fitToSuppliedMarkers(markers, animated);
          } catch (error) {
            console.log('SafeMapView: Error fitting to markers:', error);
          }
        }
      },
    }));

    useEffect(() => {
      setIsMounted(true);
      return () => {
        setIsMounted(false);
        // More aggressive cleanup to prevent MapView crashes
        if (mapRef.current) {
          try {
            // Clear any pending operations
            mapRef.current = null;
          } catch (error) {
            console.log('SafeMapView: Cleanup error:', error);
          }
        }
      };
    }, []);

    const handleMapReady = () => {
      if (isMounted && mapRef.current) {
        console.log('SafeMapView: Map ready - isMounted:', isMounted, 'hasError:', hasError);
        setIsMapReady(true);
        setHasError(false);
        
        // Call original onMapReady if provided
        if (props.onMapReady) {
          try {
            props.onMapReady();
          } catch (error) {
            console.log('SafeMapView: Error in onMapReady callback:', error);
            setHasError(true);
          }
        }
      }
    };

    const handleMapLoaded = () => {
      if (isMounted && mapRef.current) {
        console.log('SafeMapView: Map loaded');
        setIsMapReady(true);
        
        // Call original onMapLoaded if provided
        if (props.onMapLoaded) {
          try {
            props.onMapLoaded();
          } catch (error) {
            console.log('SafeMapView: Error in onMapLoaded callback:', error);
            setHasError(true);
          }
        }
      }
    };

    const handleError = (error: any) => {
      console.log('SafeMapView: Map error:', error);
      setHasError(true);
      setIsMapReady(false);
    };

    // Show fallback only if there's an error
    if (hasError) {
      if (fallbackComponent) {
        return <>{fallbackComponent}</>;
      }
      
      return (
        <View style={[props.style, styles.fallbackContainer]}>
          <Text style={styles.fallbackText}>Map Error - Please restart the app</Text>
        </View>
      );
    }

    console.log('SafeMapView: Rendering MapView - isMounted:', isMounted, 'hasError:', hasError, 'isMapReady:', isMapReady);
    
    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        {...props}
        onMapReady={handleMapReady}
        onMapLoaded={handleMapLoaded}
        onError={handleError}
        // Additional safety props to prevent crashes
        loadingEnabled={false}
        cacheEnabled={false}
        moveOnMarkerPress={false}
        loadingIndicatorColor={BrandColors.primary}
        loadingBackgroundColor="white"
        // Critical props to prevent MapView crashes
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        // Disable problematic features that can cause crashes
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        zoomControlEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      />
    );
  }
);

SafeMapView.displayName = 'SafeMapView';

const styles = StyleSheet.create({
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  fallbackText: {
    fontSize: 16,
    color: BrandColors.primary,
    fontWeight: '500',
  },
});

export default SafeMapView;
