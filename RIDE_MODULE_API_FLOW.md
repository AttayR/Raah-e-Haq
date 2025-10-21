# Ride Module API Flow Documentation

## Overview

This document outlines the complete API flow for the ride module, covering the two-way communication between passengers and drivers. The flow includes ride requests, driver assignment, real-time location tracking, status updates, and ride completion.

## Table of Contents

1. [Ride States & Status Flow](#ride-states--status-flow)
2. [Passenger Side API Flow](#passenger-side-api-flow)
3. [Driver Side API Flow](#driver-side-api-flow)
4. [Real-time Communication](#real-time-communication)
5. [API Endpoints Specification](#api-endpoints-specification)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Push Notifications](#push-notifications)

---

## Ride States & Status Flow

### Ride Status Progression

```
requested → accepted → ongoing → completed
     ↓           ↓         ↓
  cancelled   cancelled cancelled
```

### Status Definitions

- **`requested`**: Passenger has created a ride request, waiting for driver assignment
- **`accepted`**: Driver has accepted the ride, heading to pickup location
- **`ongoing`**: Driver has started the ride, passenger is in the vehicle
- **`completed`**: Ride has been completed successfully
- **`cancelled`**: Ride has been cancelled by either passenger or driver

---

## Passenger Side API Flow

### 1. Ride Request Creation

**Flow**: Passenger creates a ride request

**API Call**:

```http
POST /api/rides
Content-Type: application/json
Authorization: Bearer {passenger_token}

{
  "passenger_id": 11,
  "pickup_address": "Karachi Airport",
  "dropoff_address": "DHA Phase 2",
  "pickup_latitude": 24.8607,
  "pickup_longitude": 67.0011,
  "dropoff_latitude": 24.7982,
  "dropoff_longitude": 67.0537,
  "vehicle_type": "car",
  "stops": [
    {
      "address": "Gulshan-e-Iqbal Block 6",
      "latitude": 24.9038,
      "longitude": 67.0677,
      "stop_order": 1
    },
    {
      "address": "Bahadurabad Market",
      "latitude": 24.8858,
      "longitude": 67.0360,
      "stop_order": 2
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "message": "Ride request created successfully",
  "data": {
    "id": 123,
    "passenger_id": 11,
    "pickup_address": "Karachi Airport",
    "dropoff_address": "DHA Phase 2",
    "pickup_latitude": 24.8607,
    "pickup_longitude": 67.0011,
    "dropoff_latitude": 24.7982,
    "dropoff_longitude": 67.0537,
    "status": "requested",
    "vehicle_type": "car",
    "stops": [
      {
        "address": "Gulshan-e-Iqbal Block 6",
        "latitude": 24.9038,
        "longitude": 67.0677,
        "stop_order": 1,
        "estimated_arrival": "15 minutes"
      },
      {
        "address": "Bahadurabad Market",
        "latitude": 24.8858,
        "longitude": 67.036,
        "stop_order": 2,
        "estimated_arrival": "25 minutes"
      }
    ],
    "current_stop_index": 0,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Find Nearby Drivers

**Flow**: Passenger searches for available drivers

**API Call**:

```http
GET /api/rides/nearby-drivers?latitude=24.8607&longitude=67.0011&radius=5&vehicle_type=car
Authorization: Bearer {passenger_token}
```

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "Ahmed Khan",
      "phone": "+92-300-1234567",
      "rating": 4.8,
      "vehicle_type": "car",
      "distance_km": 2.3,
      "estimated_arrival_min": 8,
      "location": {
        "latitude": 24.862,
        "longitude": 67.002
      }
    }
  ]
}
```

### 3. Get Ride Status Updates

**Flow**: Passenger polls for ride status updates

**API Call**:

```http
GET /api/rides/123
Authorization: Bearer {passenger_token}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": 123,
    "passenger_id": 11,
    "driver_id": 5,
    "status": "accepted",
    "driver": {
      "id": 5,
      "name": "Ahmed Khan",
      "phone": "+92-300-1234567",
      "rating": 4.8,
      "vehicle_type": "car",
      "license_number": "ABC-123"
    },
    "estimated_arrival": "5 minutes",
    "driver_location": {
      "latitude": 24.862,
      "longitude": 67.002
    }
  }
}
```

### 4. Cancel Ride

**Flow**: Passenger cancels the ride

**API Call**:

```http
POST /api/rides/123/cancel
Authorization: Bearer {passenger_token}
```

**Response**:

```json
{
  "success": true,
  "message": "Ride cancelled successfully",
  "data": {
    "id": 123,
    "status": "cancelled",
    "cancelled_at": "2024-01-15T10:35:00Z"
  }
}
```

### 5. Manage Multiple Stops

**Flow**: Passenger can add, update, or remove stops during the ride

#### Add Stop

**API Call**:

```http
POST /api/rides/123/stops
Content-Type: application/json
Authorization: Bearer {passenger_token}

{
  "address": "Saddar Market",
  "latitude": 24.8632,
  "longitude": 67.0002,
  "stop_order": 3
}
```

**Response**:

```json
{
  "success": true,
  "message": "Stop added successfully",
  "data": {
    "id": 123,
    "stops": [
      {
        "address": "Gulshan-e-Iqbal Block 6",
        "latitude": 24.9038,
        "longitude": 67.0677,
        "stop_order": 1,
        "estimated_arrival": "15 minutes"
      },
      {
        "address": "Bahadurabad Market",
        "latitude": 24.8858,
        "longitude": 67.036,
        "stop_order": 2,
        "estimated_arrival": "25 minutes"
      },
      {
        "address": "Saddar Market",
        "latitude": 24.8632,
        "longitude": 67.0002,
        "stop_order": 3,
        "estimated_arrival": "35 minutes"
      }
    ],
    "updated_fare": 550,
    "updated_distance": "18.5 km",
    "updated_duration": "45 minutes"
  }
}
```

#### Remove Stop

**API Call**:

```http
DELETE /api/rides/123/stops/2
Authorization: Bearer {passenger_token}
```

**Response**:

```json
{
  "success": true,
  "message": "Stop removed successfully",
  "data": {
    "id": 123,
    "stops": [
      {
        "address": "Gulshan-e-Iqbal Block 6",
        "latitude": 24.9038,
        "longitude": 67.0677,
        "stop_order": 1,
        "estimated_arrival": "15 minutes"
      },
      {
        "address": "Saddar Market",
        "latitude": 24.8632,
        "longitude": 67.0002,
        "stop_order": 2,
        "estimated_arrival": "25 minutes"
      }
    ],
    "updated_fare": 450,
    "updated_distance": "15.2 km",
    "updated_duration": "35 minutes"
  }
}
```

#### Update Stop Order

**API Call**:

```http
PUT /api/rides/123/stops/reorder
Content-Type: application/json
Authorization: Bearer {passenger_token}

{
  "stop_orders": [
    {"stop_id": 1, "new_order": 2},
    {"stop_id": 2, "new_order": 1}
  ]
}
```

**Response**:

```json
{
  "success": true,
  "message": "Stop order updated successfully",
  "data": {
    "id": 123,
    "stops": [
      {
        "address": "Bahadurabad Market",
        "latitude": 24.8858,
        "longitude": 67.036,
        "stop_order": 1,
        "estimated_arrival": "15 minutes"
      },
      {
        "address": "Gulshan-e-Iqbal Block 6",
        "latitude": 24.9038,
        "longitude": 67.0677,
        "stop_order": 2,
        "estimated_arrival": "25 minutes"
      }
    ],
    "updated_fare": 450,
    "updated_distance": "15.2 km",
    "updated_duration": "35 minutes"
  }
}
```

---

### 1. Get Available Rides

**Flow**: Driver fetches available ride requests

**API Call**:

```http
GET /api/rides/pending?driver_id=5&latitude=24.8620&longitude=67.0020
Authorization: Bearer {driver_token}
```

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "passenger_id": 11,
      "pickup_address": "Karachi Airport",
      "dropoff_address": "DHA Phase 2",
      "pickup_latitude": 24.8607,
      "pickup_longitude": 67.0011,
      "dropoff_latitude": 24.7982,
      "dropoff_longitude": 67.0537,
      "status": "requested",
      "vehicle_type": "car",
      "passenger": {
        "id": 11,
        "name": "Sara Ahmed",
        "phone": "+92-300-9876543",
        "rating": 4.5
      },
      "estimated_distance": "15.2 km",
      "estimated_fare": 450
    }
  ]
}
```

### 2. Accept Ride

**Flow**: Driver accepts a ride request

**API Call**:

```http
POST /api/rides/123/assign-driver
Content-Type: application/json
Authorization: Bearer {driver_token}

{
  "driver_id": 5
}
```

**Response**:

```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "data": {
    "id": 123,
    "passenger_id": 11,
    "driver_id": 5,
    "status": "accepted",
    "accepted_at": "2024-01-15T10:32:00Z",
    "passenger": {
      "id": 11,
      "name": "Sara Ahmed",
      "phone": "+92-300-9876543",
      "rating": 4.5
    }
  }
}
```

### 3. Update Driver Location

**Flow**: Driver updates their current location

**API Call**:

```http
POST /api/tracking/update-location
Content-Type: application/json
Authorization: Bearer {driver_token}

{
  "latitude": 24.8620,
  "longitude": 67.0020,
  "status": "online",
  "speed": 25.5,
  "heading": 180,
  "accuracy": 5.0
}
```

**Response**:

```json
{
  "success": true,
  "message": "Location updated successfully"
}
```

### 4. Start Ride

**Flow**: Driver starts the ride (passenger picked up)

**API Call**:

```http
PUT /api/rides/123
Content-Type: application/json
Authorization: Bearer {driver_token}

{
  "status": "ongoing"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Ride started successfully",
  "data": {
    "id": 123,
    "status": "ongoing",
    "started_at": "2024-01-15T10:45:00Z"
  }
}
```

### 5. Complete Ride

**Flow**: Driver completes the ride

**API Call**:

```http
PUT /api/rides/123
Content-Type: application/json
Authorization: Bearer {driver_token}

{
  "status": "completed",
  "fare": 450,
  "distance_km": 15.2,
  "duration_min": 25
}
```

**Response**:

```json
{
  "success": true,
  "message": "Ride completed successfully",
  "data": {
    "id": 123,
    "status": "completed",
    "fare": 450,
    "distance_km": 15.2,
    "duration_min": 25,
    "completed_at": "2024-01-15T11:10:00Z"
  }
}
```

### 6. Manage Multiple Stops (Driver)

**Flow**: Driver can navigate through multiple stops and update stop status

#### Navigate to Next Stop

**API Call**:

```http
POST /api/rides/123/navigate-next-stop
Authorization: Bearer {driver_token}
```

**Response**:

```json
{
  "success": true,
  "message": "Navigating to next stop",
  "data": {
    "id": 123,
    "current_stop_index": 1,
    "next_stop": {
      "address": "Bahadurabad Market",
      "latitude": 24.8858,
      "longitude": 67.036,
      "stop_order": 2,
      "estimated_arrival": "8 minutes"
    },
    "remaining_stops": 2,
    "route_updated": true
  }
}
```

#### Mark Stop as Completed

**API Call**:

```http
POST /api/rides/123/stops/1/complete
Authorization: Bearer {driver_token}
```

**Response**:

```json
{
  "success": true,
  "message": "Stop completed successfully",
  "data": {
    "id": 123,
    "current_stop_index": 1,
    "completed_stops": 1,
    "remaining_stops": 2,
    "next_stop": {
      "address": "Bahadurabad Market",
      "latitude": 24.8858,
      "longitude": 67.036,
      "stop_order": 2,
      "estimated_arrival": "5 minutes"
    }
  }
}
```

#### Get Stop Navigation Instructions

**API Call**:

```http
GET /api/rides/123/navigation-instructions
Authorization: Bearer {driver_token}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "current_stop_index": 1,
    "total_stops": 3,
    "route": {
      "distance": "2.5 km",
      "duration": "8 minutes",
      "steps": [
        {
          "instruction": "Head north on Main Street",
          "distance": "500m",
          "duration": "2 minutes"
        },
        {
          "instruction": "Turn right onto Market Road",
          "distance": "1.2 km",
          "duration": "4 minutes"
        },
        {
          "instruction": "Arrive at Bahadurabad Market",
          "distance": "800m",
          "duration": "2 minutes"
        }
      ]
    },
    "next_stop": {
      "address": "Bahadurabad Market",
      "latitude": 24.8858,
      "longitude": 67.036,
      "stop_order": 2
    }
  }
}
```

---

### WebSocket Events

#### Passenger Events

```javascript
// Subscribe to ride updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'ride_updates',
  ride_id: 123,
  user_type: 'passenger'
}));

// Receive driver location updates
{
  "type": "driver_location_update",
  "ride_id": 123,
  "driver_location": {
    "latitude": 24.8620,
    "longitude": 67.0020,
    "speed": 25.5,
    "heading": 180
  },
  "estimated_arrival": "3 minutes"
}

// Receive ride status updates
{
  "type": "ride_status_update",
  "ride_id": 123,
  "status": "accepted",
  "driver": {
    "id": 5,
    "name": "Ahmed Khan",
    "phone": "+92-300-1234567"
  }
}
```

#### Driver Events

```javascript
// Subscribe to new ride requests
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'driver_requests',
  driver_id: 5,
  user_type: 'driver'
}));

// Receive new ride request
{
  "type": "new_ride_request",
  "ride": {
    "id": 123,
    "passenger": {
      "id": 11,
      "name": "Sara Ahmed",
      "phone": "+92-300-9876543"
    },
    "pickup_address": "Karachi Airport",
    "dropoff_address": "DHA Phase 2",
    "estimated_fare": 450
  }
}

// Receive ride cancellation
{
  "type": "ride_cancelled",
  "ride_id": 123,
  "reason": "passenger_cancelled"
}
```

---

## API Endpoints Specification

### Base URL

```
https://raahehaq.com/api
```

### Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer {user_token}
```

### Ride Management Endpoints

#### 1. Create Ride Request

```http
POST /rides
```

**Body**:

```json
{
  "passenger_id": number,
  "pickup_address": string,
  "dropoff_address": string,
  "pickup_latitude": number,
  "pickup_longitude": number,
  "dropoff_latitude": number,
  "dropoff_longitude": number,
  "vehicle_type": string (optional)
}
```

#### 2. Get Ride Details

```http
GET /rides/{id}
```

#### 3. Update Ride Status

```http
PUT /rides/{id}
```

**Body**:

```json
{
  "status": "requested" | "accepted" | "ongoing" | "completed" | "cancelled",
  "driver_id": number (optional),
  "fare": number (optional),
  "distance_km": number (optional),
  "duration_min": number (optional)
}
```

#### 4. Assign Driver

```http
POST /rides/{id}/assign-driver
```

**Body**:

```json
{
  "driver_id": number
}
```

#### 5. Cancel Ride

```http
POST /rides/{id}/cancel
```

#### 6. Get Pending Rides (Driver)

```http
GET /rides/pending?driver_id={id}&latitude={lat}&longitude={lng}
```

#### 7. Find Nearby Drivers

```http
GET /rides/nearby-drivers?latitude={lat}&longitude={lng}&radius={km}&vehicle_type={type}
```

#### 8. Add Stop to Ride

```http
POST /rides/{id}/stops
```

**Body**:

```json
{
  "address": string,
  "latitude": number,
  "longitude": number,
  "stop_order": number
}
```

#### 9. Remove Stop from Ride

```http
DELETE /rides/{id}/stops/{stop_id}
```

#### 10. Update Stop Order

```http
PUT /rides/{id}/stops/reorder
```

**Body**:

```json
{
  "stop_orders": [
    {"stop_id": number, "new_order": number}
  ]
}
```

#### 11. Navigate to Next Stop (Driver)

```http
POST /rides/{id}/navigate-next-stop
```

#### 12. Mark Stop as Completed (Driver)

```http
POST /rides/{id}/stops/{stop_id}/complete
```

#### 13. Get Navigation Instructions

```http
GET /rides/{id}/navigation-instructions
```

### Location Tracking Endpoints

#### 1. Update Driver Location

```http
POST /tracking/update-location
```

**Body**:

```json
{
  "latitude": number,
  "longitude": number,
  "status": "online" | "available" | "busy" | "offline",
  "speed": number (optional),
  "heading": number (optional),
  "accuracy": number (optional)
}
```

#### 2. Get Driver Location

```http
GET /tracking/driver/{driver_id}/location
```

---

## Data Models

### DriverLocation

```typescript
interface DriverLocation {
  latitude: number;
  longitude: number;
  status?: 'online' | 'available' | 'busy' | 'offline';
  address?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}
```

### DriverInRadius

```typescript
interface DriverInRadius {
  id: number;
  name: string;
  phone: string;
  rating: number;
  vehicle_type: string;
  distance_km: number;
  estimated_arrival_min: number;
  location: {
    latitude: number;
    longitude: number;
  };
}
```

### RideRequest

```typescript
interface RideRequest {
  passenger_id: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  vehicle_type?: string;
  stops?: StopLocation[]; // Optional multiple stops (max 5)
}

interface StopLocation {
  address: string;
  latitude: number;
  longitude: number;
  stop_order: number; // Order of the stop (1-5)
  estimated_arrival?: string; // Optional ETA for this stop
}
```

### RideResource (Updated with Stops)

```typescript
interface RideResource {
  id: number;
  passenger_id: number;
  driver_id?: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  status: 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  fare?: number;
  distance_km?: number;
  duration_min?: number;
  vehicle_type?: string;
  stops?: StopLocation[]; // Multiple stops (max 5)
  current_stop_index?: number; // Current stop being visited (0-based)
  created_at: string;
  updated_at: string;
  passenger?: {
    id: number;
    name: string;
    phone: string;
    rating?: number;
  };
  driver?: {
    id: number;
    name: string;
    phone: string;
    rating?: number;
    vehicle_type?: string;
    license_number?: string;
  };
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Ride not found",
    "details": "The requested ride with ID 123 does not exist"
  }
}
```

### Common Error Codes

- `RIDE_NOT_FOUND`: Ride with specified ID not found
- `RIDE_ALREADY_ACCEPTED`: Ride has already been accepted by another driver
- `RIDE_CANCELLED`: Ride has been cancelled
- `INVALID_STATUS_TRANSITION`: Invalid status change attempt
- `DRIVER_NOT_AVAILABLE`: Driver is not available for new rides
- `LOCATION_REQUIRED`: Driver location is required for this operation
- `AUTHENTICATION_REQUIRED`: Valid authentication token required
- `MAX_STOPS_EXCEEDED`: Maximum number of stops (5) exceeded
- `INVALID_STOP_ORDER`: Stop order must be between 1 and 5
- `STOP_NOT_FOUND`: Stop with specified ID not found
- `STOP_ALREADY_COMPLETED`: Stop has already been completed
- `CANNOT_MODIFY_COMPLETED_RIDE`: Cannot modify stops for completed rides
- `INVALID_STOP_COORDINATES`: Stop coordinates are invalid or out of range

---

## Push Notifications

### Notification Types

#### For Passengers

1. **Driver Assigned**: "Your ride has been accepted by Ahmed Khan"
2. **Driver Arrived**: "Your driver has arrived at the pickup location"
3. **Ride Started**: "Your ride has started"
4. **Ride Completed**: "Your ride has been completed. Fare: PKR 450"
5. **Stop Added**: "New stop added to your ride: Saddar Market"
6. **Stop Removed**: "Stop removed from your ride"
7. **Stop Order Updated**: "Stop order has been updated"
8. **Arrived at Stop**: "Driver has arrived at Gulshan-e-Iqbal Block 6"
9. **Stop Completed**: "Stop completed: Gulshan-e-Iqbal Block 6"

#### For Drivers

1. **New Ride Request**: "New ride request from Sara Ahmed"
2. **Ride Cancelled**: "Ride request has been cancelled"
3. **Ride Completed**: "Ride completed successfully. Earnings: PKR 450"
4. **Stop Added**: "New stop added to ride: Saddar Market"
5. **Stop Removed**: "Stop removed from ride"
6. **Stop Order Updated**: "Stop order has been updated"
7. **Navigate to Next Stop**: "Navigate to next stop: Bahadurabad Market"
8. **Stop Completed**: "Stop completed: Gulshan-e-Iqbal Block 6"

### Notification Payload Structure

```json
{
  "title": "Ride Update",
  "body": "Your driver has arrived",
  "data": {
    "type": "driver_arrived",
    "ride_id": 123,
    "driver_name": "Ahmed Khan",
    "action": "view_ride"
  }
}
```

---

## Complete Flow Example

### Scenario: Complete Ride from Request to Completion

1. **Passenger creates ride request**

   ```
   POST /api/rides → Status: "requested"
   ```

2. **Driver receives notification and fetches pending rides**

   ```
   GET /api/rides/pending → Returns ride request
   ```

3. **Driver accepts ride**

   ```
   POST /api/rides/123/assign-driver → Status: "accepted"
   ```

4. **Passenger receives driver assignment notification**

   ```
   WebSocket: ride_status_update → Status: "accepted"
   ```

5. **Driver updates location while heading to pickup**

   ```
   POST /api/tracking/update-location → Real-time location updates
   ```

6. **Passenger receives driver location updates**

   ```
   WebSocket: driver_location_update → Live tracking
   ```

7. **Driver starts ride (passenger picked up)**

   ```
   PUT /api/rides/123 → Status: "ongoing"
   ```

8. **Driver completes ride**

   ```
   PUT /api/rides/123 → Status: "completed" + fare details
   ```

9. **Both parties receive completion notifications**
   ```
   Push Notification: "Ride completed. Fare: PKR 450"
   ```

---

## Multiple Stops Business Rules

### Stop Management Rules

1. **Maximum Stops Limit**:

   - Maximum 5 stops per ride (excluding pickup and dropoff)
   - Total locations: Pickup + 5 Stops + Dropoff = 7 locations maximum

2. **Stop Order Validation**:

   - Stop order must be sequential (1, 2, 3, 4, 5)
   - Cannot skip stop orders
   - Cannot have duplicate stop orders

3. **Stop Modification Rules**:

   - Stops can only be added/modified when ride status is `requested` or `accepted`
   - Cannot modify stops when ride status is `ongoing` or `completed`
   - Driver can only modify stops with passenger consent

4. **Fare Calculation**:

   - Fare is recalculated when stops are added/removed/reordered
   - Base fare + distance-based pricing + stop fees
   - Each additional stop adds PKR 25-50 depending on distance

5. **Route Optimization**:
   - Backend should optimize route order for shortest distance
   - Driver can override optimized order if needed
   - Real-time route updates when stops are modified

### Stop Status Flow

```
Stop Created → Stop Active → Stop Completed
     ↓              ↓
Stop Cancelled  Stop Skipped
```

### Stop Status Definitions

- **`active`**: Stop is part of the current route
- **`completed`**: Driver has reached and completed this stop
- **`cancelled`**: Stop was removed from the ride
- **`skipped`**: Driver skipped this stop (with passenger consent)

### Multiple Stops API Constraints

1. **Rate Limiting for Stop Operations**:

   - Add stop: 3 requests per minute per ride
   - Remove stop: 5 requests per minute per ride
   - Reorder stops: 2 requests per minute per ride

2. **Validation Rules**:

   - Stop coordinates must be within city limits
   - Stop addresses must be valid and geocodable
   - Stop order must be unique within the ride

3. **Real-time Updates**:
   - All stop modifications trigger WebSocket notifications
   - Route recalculation happens automatically
   - Driver and passenger receive updated ETAs

---

## Implementation Notes

### Rate Limiting

- Ride creation: 5 requests per minute per passenger
- Location updates: 10 requests per minute per driver
- Status updates: 20 requests per minute per user
- Stop operations: 3 requests per minute per ride (add/remove/reorder)
- Navigation requests: 5 requests per minute per driver

### Caching Strategy

- Driver locations: Cache for 30 seconds
- Ride status: Cache for 10 seconds
- Nearby drivers: Cache for 1 minute
- Stop information: Cache for 5 minutes
- Route calculations: Cache for 2 minutes
- Navigation instructions: Cache for 1 minute

### Security Considerations

- All endpoints require authentication
- Location data should be encrypted in transit
- Driver assignment should validate driver availability
- Rate limiting to prevent abuse

### Performance Optimization

- Use pagination for ride history
- Implement WebSocket connections for real-time updates
- Cache frequently accessed data
- Use database indexes on location coordinates

---

This documentation provides a comprehensive guide for implementing the ride module API flow. The backend developer should implement these endpoints and flows to ensure seamless communication between passengers and drivers.
