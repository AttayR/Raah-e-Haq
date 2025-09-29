import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideRequest {
  id?: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  passengerRating: number;
  pickup: Location;
  destination: Location;
  fare: number;
  distance: string;
  duration: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  vehicleInfo?: {
    type: string;
    brand: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  requestedAt: any;
  acceptedAt?: any;
  startedAt?: any;
  completedAt?: any;
  cancelledAt?: any;
  cancellationReason?: string;
  paymentMethod?: 'cash' | 'card' | 'wallet';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  rating?: {
    passengerRating?: number;
    driverRating?: number;
    passengerComment?: string;
    driverComment?: string;
  };
}

export interface DriverLocation {
  driverId: string;
  location: Location;
  isOnline: boolean;
  lastSeen: any;
}

// Create a new ride request
export const createRideRequest = async (rideData: Omit<RideRequest, 'id' | 'requestedAt'>): Promise<string> => {
  try {
    const rideRequest: Omit<RideRequest, 'id'> = {
      ...rideData,
      requestedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'rideRequests'), rideRequest);
    console.log('Ride request created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating ride request:', error);
    throw new Error('Failed to create ride request');
  }
};

// Update ride request status
export const updateRideStatus = async (rideId: string, updates: Partial<RideRequest>): Promise<void> => {
  try {
    const rideRef = doc(db, 'rideRequests', rideId);
    await updateDoc(rideRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    console.log('Ride status updated:', rideId, updates);
  } catch (error) {
    console.error('Error updating ride status:', error);
    throw new Error('Failed to update ride status');
  }
};

// Accept ride request
export const acceptRideRequest = async (rideId: string, driverId: string, driverInfo: any): Promise<void> => {
  try {
    await updateRideStatus(rideId, {
      status: 'accepted',
      driverId,
      driverName: driverInfo.name,
      driverPhone: driverInfo.phone,
      driverRating: driverInfo.rating,
      vehicleInfo: driverInfo.vehicleInfo,
      acceptedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error accepting ride request:', error);
    throw new Error('Failed to accept ride request');
  }
};

// Start ride
export const startRide = async (rideId: string): Promise<void> => {
  try {
    await updateRideStatus(rideId, {
      status: 'in_progress',
      startedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error starting ride:', error);
    throw new Error('Failed to start ride');
  }
};

// Complete ride
export const completeRide = async (rideId: string, paymentInfo?: any): Promise<void> => {
  try {
    await updateRideStatus(rideId, {
      status: 'completed',
      completedAt: serverTimestamp(),
      paymentStatus: paymentInfo?.status || 'completed',
      paymentMethod: paymentInfo?.method || 'cash',
    });
  } catch (error) {
    console.error('Error completing ride:', error);
    throw new Error('Failed to complete ride');
  }
};

// Cancel ride
export const cancelRide = async (rideId: string, reason: string, cancelledBy: 'passenger' | 'driver'): Promise<void> => {
  try {
    await updateRideStatus(rideId, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancellationReason: reason,
    });
  } catch (error) {
    console.error('Error cancelling ride:', error);
    throw new Error('Failed to cancel ride');
  }
};

// Get nearby drivers
export const getNearbyDrivers = async (userLocation: Location, radiusKm: number = 5): Promise<DriverLocation[]> => {
  try {
    // In a real implementation, you would use GeoFire or similar for geospatial queries
    // For now, we'll get all online drivers and filter in the client
    const driversRef = collection(db, 'driverLocations');
    const q = query(
      driversRef,
      where('isOnline', '==', true),
      orderBy('lastSeen', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    const drivers: DriverLocation[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      drivers.push({
        driverId: doc.id,
        location: data.location,
        isOnline: data.isOnline,
        lastSeen: data.lastSeen,
      });
    });
    
    // Filter by distance (simplified calculation)
    return drivers.filter(driver => {
      const distance = calculateDistance(userLocation, driver.location);
      return distance <= radiusKm;
    });
  } catch (error) {
    console.error('Error getting nearby drivers:', error);
    throw new Error('Failed to get nearby drivers');
  }
};

// Update driver location
export const updateDriverLocation = async (driverId: string, location: Location): Promise<void> => {
  try {
    const driverRef = doc(db, 'driverLocations', driverId);
    await updateDoc(driverRef, {
      location,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw new Error('Failed to update driver location');
  }
};

// Set driver online/offline status
export const setDriverStatus = async (driverId: string, isOnline: boolean): Promise<void> => {
  try {
    const driverRef = doc(db, 'driverLocations', driverId);
    await updateDoc(driverRef, {
      isOnline,
      lastSeen: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error setting driver status:', error);
    throw new Error('Failed to set driver status');
  }
};

// Listen to ride requests for drivers
export const listenToRideRequests = (driverId: string, callback: (rides: RideRequest[]) => void) => {
  const ridesRef = collection(db, 'rideRequests');
  const q = query(
    ridesRef,
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'desc'),
    limit(10)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const rides: RideRequest[] = [];
    querySnapshot.forEach((doc) => {
      rides.push({ id: doc.id, ...doc.data() } as RideRequest);
    });
    callback(rides);
  });
};

// Listen to active rides for passengers
export const listenToActiveRide = (passengerId: string, callback: (ride: RideRequest | null) => void) => {
  const ridesRef = collection(db, 'rideRequests');
  const q = query(
    ridesRef,
    where('passengerId', '==', passengerId),
    where('status', 'in', ['accepted', 'in_progress']),
    limit(1)
  );
  
  return onSnapshot(q, (querySnapshot) => {
    if (querySnapshot.empty) {
      callback(null);
    } else {
      const doc = querySnapshot.docs[0];
      callback({ id: doc.id, ...doc.data() } as RideRequest);
    }
  });
};

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Calculate fare based on distance and time
export const calculateFare = (pickup: Location, destination: Location, vehicleType: string = 'car'): {
  fare: number;
  distance: string;
  duration: string;
} => {
  const distance = calculateDistance(pickup, destination);
  
  // Base fare and per km rates (in PKR)
  const baseFares = {
    car: 50,
    bike: 30,
    van: 70,
    truck: 100,
  };
  
  const perKmRates = {
    car: 25,
    bike: 15,
    van: 35,
    truck: 50,
  };
  
  const baseFare = baseFares[vehicleType as keyof typeof baseFares] || baseFares.car;
  const perKmRate = perKmRates[vehicleType as keyof typeof perKmRates] || perKmRates.car;
  
  const fare = Math.round(baseFare + (distance * perKmRate));
  const duration = Math.round(distance * 2); // Rough estimate: 2 minutes per km
  
  return {
    fare,
    distance: `${distance.toFixed(1)} km`,
    duration: `${duration} min`,
  };
};

// Get ride history
export const getRideHistory = async (userId: string, userType: 'passenger' | 'driver'): Promise<RideRequest[]> => {
  try {
    const ridesRef = collection(db, 'rideRequests');
    const field = userType === 'passenger' ? 'passengerId' : 'driverId';
    const q = query(
      ridesRef,
      where(field, '==', userId),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    const rides: RideRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      rides.push({ id: doc.id, ...doc.data() } as RideRequest);
    });
    
    return rides;
  } catch (error) {
    console.error('Error getting ride history:', error);
    throw new Error('Failed to get ride history');
  }
};

// Rate ride
export const rateRide = async (rideId: string, rating: number, comment: string, ratedBy: 'passenger' | 'driver'): Promise<void> => {
  try {
    const rideRef = doc(db, 'rideRequests', rideId);
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (ratedBy === 'passenger') {
      updateData['rating.passengerRating'] = rating;
      updateData['rating.passengerComment'] = comment;
    } else {
      updateData['rating.driverRating'] = rating;
      updateData['rating.driverComment'] = comment;
    }
    
    await updateDoc(rideRef, updateData);
  } catch (error) {
    console.error('Error rating ride:', error);
    throw new Error('Failed to rate ride');
  }
};
