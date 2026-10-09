import rideService, { LocationUpdate, DriverLocation } from './rideService';
import { logger } from '../core/logging/logger';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface TrackingConfig {
  enableTracking: boolean;
  updateInterval: number; // milliseconds
  minAccuracy: number; // meters
  minDistance: number; // meters
  backgroundTracking: boolean;
}

const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  enableTracking: true,
  updateInterval: 10000, // 10 seconds
  minAccuracy: 100, // 100 meters
  minDistance: 50, // 50 meters
  backgroundTracking: true
};

class LocationTrackingService {
  private isTracking: boolean = false;
  private watchId: number | null = null;
  private lastLocation: LocationData | null = null;
  private config: TrackingConfig = { ...DEFAULT_TRACKING_CONFIG };
  private listeners: Set<(location: LocationData) => void> = new Set();
  private updateTimer: NodeJS.Timeout | null = null;

  // Start location tracking
  async startTracking(config?: Partial<TrackingConfig>): Promise<void> {
    if (this.isTracking) {
      logger.debug('📍 Location tracking already started');
      return;
    }

    // Update config if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Request location permission
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      // Start watching position
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handleLocationUpdate(position),
        (error) => this.handleLocationError(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );

      this.isTracking = true;
      logger.debug('📍 Location tracking started');

      // Start periodic updates
      this.startPeriodicUpdates();

    } catch (error) {
      logger.error('❌ Failed to start location tracking:', error);
      throw error;
    }
  }

  // Stop location tracking
  stopTracking(): void {
    if (!this.isTracking) {
      logger.debug('📍 Location tracking not started');
      return;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.isTracking = false;
    logger.debug('📍 Location tracking stopped');
  }

  /**
   * Back to the signed-out state (called by logout, T-104): stops tracking and forgets the
   * last position, the listeners and any per-session config, so nothing of one user's
   * session is uploaded or delivered in the next one.
   */
  reset(): void {
    this.stopTracking();
    this.lastLocation = null;
    this.listeners.clear();
    this.config = { ...DEFAULT_TRACKING_CONFIG };
  }

  // Handle location update
  private handleLocationUpdate(position: GeolocationPosition): void {
    const location: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: Date.now()
    };

    // Check if location meets minimum requirements
    if (this.shouldUpdateLocation(location)) {
      this.lastLocation = location;
      this.notifyListeners(location);
      
      // Update server if tracking is enabled
      if (this.config.enableTracking) {
        this.updateServerLocation(location);
      }
    }
  }

  // Handle location error
  private handleLocationError(error: GeolocationPositionError): void {
    logger.error('❌ Location error:', error);
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        logger.error('❌ Location permission denied');
        break;
      case error.POSITION_UNAVAILABLE:
        logger.error('❌ Location unavailable');
        break;
      case error.TIMEOUT:
        logger.error('❌ Location request timeout');
        break;
    }
  }

  // Check if location should be updated
  private shouldUpdateLocation(location: LocationData): boolean {
    // Check accuracy
    if (location.accuracy && location.accuracy > this.config.minAccuracy) {
      return false;
    }

    // Check distance from last location
    if (this.lastLocation) {
      const distance = this.calculateDistance(
        this.lastLocation.latitude,
        this.lastLocation.longitude,
        location.latitude,
        location.longitude
      );

      if (distance < this.config.minDistance) {
        return false;
      }
    }

    return true;
  }

  // Start periodic updates to server
  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      if (this.lastLocation && this.config.enableTracking) {
        this.updateServerLocation(this.lastLocation);
      }
    }, this.config.updateInterval);
  }

  // Update location on server
  private async updateServerLocation(location: LocationData): Promise<void> {
    try {
      const locationUpdate: LocationUpdate = {
        latitude: location.latitude,
        longitude: location.longitude,
        status: 'online',
        speed: location.speed,
        heading: location.heading,
        accuracy: location.accuracy
      };

      await rideService.updateDriverLocation(locationUpdate);

      logger.debug('📍 Location updated on server');
    } catch (error) {
      logger.error('❌ Failed to update location on server:', error);
    }
  }

  // Get current location
  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: Date.now()
          };
          resolve(location);
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    });
  }

  // Get driver location. The backend route is GET /tracking/driver/{id}/latest
  // (there is no /tracking/driver/{id}/location); 403 unless there is an active ride (BE-20).
  async getDriverLocation(driverId: number): Promise<DriverLocation | null> {
    try {
      return await rideService.getDriverLocation(driverId);
    } catch (error) {
      logger.error('❌ Failed to get driver location:', error);
      throw error;
    }
  }

  // Add location listener
  addLocationListener(listener: (location: LocationData) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners
  private notifyListeners(location: LocationData): void {
    this.listeners.forEach(listener => {
      try {
        listener(location);
      } catch (error) {
        logger.error('❌ Error notifying location listener:', error);
      }
    });
  }

  // Request location permission
  private async requestLocationPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 5000 }
      );
    });
  }

  // Calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Get tracking status
  getTrackingStatus(): boolean {
    return this.isTracking;
  }

  // Get last location
  getLastLocation(): LocationData | null {
    return this.lastLocation;
  }

  // Update configuration
  updateConfig(config: Partial<TrackingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('📍 Tracking config updated:', this.config);
  }

  // Get current configuration
  getConfig(): TrackingConfig {
    return { ...this.config };
  }
}

// Create singleton instance
const locationTrackingService = new LocationTrackingService();

export default locationTrackingService;
