import { RideResource, DriverLocation, NotificationResource } from './rideService';

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface RideUpdateEvent extends WebSocketEvent {
  type: 'ride_status_update' | 'driver_location_update' | 'stop_update' | 'fare_update';
  data: {
    ride_id: number;
    status?: string;
    driver_location?: DriverLocation;
    stop?: any;
    fare?: number;
  };
}

export interface DriverRequestEvent extends WebSocketEvent {
  type: 'new_ride_request' | 'ride_cancelled';
  data: {
    ride: RideResource;
    passenger?: any;
  };
}

export interface NotificationEvent extends WebSocketEvent {
  type: 'notification';
  data: NotificationResource;
}

class WebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private eventListeners: Map<string, Set<(event: WebSocketEvent) => void>> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 second

  // Subscribe to ride updates
  async subscribeToRideUpdates(
    rideId: number, 
    userType: 'passenger' | 'driver',
    onEvent: (event: RideUpdateEvent) => void
  ): Promise<string> {
    const connectionId = `ride_${rideId}_${userType}`;
    
    try {
      // Get WebSocket URL from API
      const response = await fetch('https://raahehaq.com/api/websocket/subscribe-ride', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          ride_id: rideId,
          user_type: userType
        })
      });

      const result = await response.json();
      const wsUrl = result.data.websocket_url;

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`🔌 Connected to ride updates for ride ${rideId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 Received ride update:`, data);
          onEvent(data as RideUpdateEvent);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for ride ${rideId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToRideUpdates(rideId, userType, onEvent)
        );
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for ride ${rideId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      console.error('❌ Failed to subscribe to ride updates:', error);
      throw error;
    }
  }

  // Subscribe to driver requests
  async subscribeToDriverRequests(
    driverId: number,
    latitude: number,
    longitude: number,
    radius: number = 10,
    onEvent: (event: DriverRequestEvent) => void
  ): Promise<string> {
    const connectionId = `driver_${driverId}`;
    
    try {
      // Get WebSocket URL from API
      const response = await fetch('https://raahehaq.com/api/websocket/subscribe-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          driver_id: driverId,
          latitude,
          longitude,
          radius
        })
      });

      const result = await response.json();
      const wsUrl = result.data.websocket_url;

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`🔌 Connected to driver requests for driver ${driverId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 Received driver request:`, data);
          onEvent(data as DriverRequestEvent);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for driver ${driverId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToDriverRequests(driverId, latitude, longitude, radius, onEvent)
        );
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for driver ${driverId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      console.error('❌ Failed to subscribe to driver requests:', error);
      throw error;
    }
  }

  // Subscribe to notifications
  async subscribeToNotifications(
    userId: number,
    onEvent: (event: NotificationEvent) => void
  ): Promise<string> {
    const connectionId = `notifications_${userId}`;
    
    try {
      // Create WebSocket connection for notifications
      const wsUrl = `wss://raahehaq.com/ws/notifications/${userId}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`🔌 Connected to notifications for user ${userId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 Received notification:`, data);
          onEvent(data as NotificationEvent);
        } catch (error) {
          console.error('❌ Error parsing notification message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for notifications ${userId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToNotifications(userId, onEvent)
        );
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for notifications ${userId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  // Unsubscribe from a connection
  unsubscribe(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close();
      this.connections.delete(connectionId);
      this.eventListeners.delete(connectionId);
      this.reconnectAttempts.delete(connectionId);
      console.log(`🔌 Unsubscribed from ${connectionId}`);
    }
  }

  // Close all connections
  closeAll(): void {
    this.connections.forEach((ws, connectionId) => {
      ws.close();
      console.log(`🔌 Closed connection ${connectionId}`);
    });
    this.connections.clear();
    this.eventListeners.clear();
    this.reconnectAttempts.clear();
  }

  // Handle reconnection logic
  private handleReconnect(connectionId: string, reconnectFn: () => Promise<string>): void {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
      console.log(`🔄 Reconnecting ${connectionId} in ${delay}ms (attempt ${attempts + 1})`);
      
      setTimeout(async () => {
        try {
          await reconnectFn();
        } catch (error) {
          console.error(`❌ Reconnection failed for ${connectionId}:`, error);
          this.reconnectAttempts.set(connectionId, attempts + 1);
        }
      }, delay);
    } else {
      console.error(`❌ Max reconnection attempts reached for ${connectionId}`);
    }
  }

  // Add event listener
  private addEventListener(connectionId: string, listener: (event: WebSocketEvent) => void): void {
    if (!this.eventListeners.has(connectionId)) {
      this.eventListeners.set(connectionId, new Set());
    }
    this.eventListeners.get(connectionId)!.add(listener);
  }

  // Remove event listener
  removeEventListener(connectionId: string, listener: (event: WebSocketEvent) => void): void {
    const listeners = this.eventListeners.get(connectionId);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Get authentication token
  private async getAuthToken(): Promise<string> {
    // This should be implemented based on your auth system
    // For now, returning a placeholder
    return 'your_auth_token_here';
  }

  // Send message through WebSocket
  sendMessage(connectionId: string, message: any): void {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn(`⚠️ WebSocket ${connectionId} is not open`);
    }
  }

  // Get connection status
  getConnectionStatus(connectionId: string): 'connecting' | 'open' | 'closing' | 'closed' {
    const ws = this.connections.get(connectionId);
    if (!ws) return 'closed';
    
    switch (ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }

  // Get all active connections
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter(
      connectionId => this.getConnectionStatus(connectionId) === 'open'
    );
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
