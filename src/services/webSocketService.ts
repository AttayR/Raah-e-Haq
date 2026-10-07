import { RideResource, DriverLocation, NotificationResource } from './rideService';
import { env } from '../config/env';
import { logger } from '../core/logging/logger';

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
      const response = await fetch(`${env.API_URL}/websocket/subscribe-ride`, {
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
        logger.debug(`🔌 Connected to ride updates for ride ${rideId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.debug(`📨 Received ride update:`, data);
          onEvent(data as RideUpdateEvent);
        } catch (error) {
          logger.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        logger.debug(`🔌 WebSocket closed for ride ${rideId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToRideUpdates(rideId, userType, onEvent)
        );
      };

      ws.onerror = (error) => {
        logger.error(`❌ WebSocket error for ride ${rideId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      logger.error('❌ Failed to subscribe to ride updates:', error);
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
      const response = await fetch(`${env.API_URL}/websocket/subscribe-driver`, {
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
        logger.debug(`🔌 Connected to driver requests for driver ${driverId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.debug(`📨 Received driver request:`, data);
          onEvent(data as DriverRequestEvent);
        } catch (error) {
          logger.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        logger.debug(`🔌 WebSocket closed for driver ${driverId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToDriverRequests(driverId, latitude, longitude, radius, onEvent)
        );
      };

      ws.onerror = (error) => {
        logger.error(`❌ WebSocket error for driver ${driverId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      logger.error('❌ Failed to subscribe to driver requests:', error);
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
      const wsUrl = `${env.WS_URL}/notifications/${userId}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        logger.debug(`🔌 Connected to notifications for user ${userId}`);
        this.reconnectAttempts.set(connectionId, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.debug(`📨 Received notification:`, data);
          onEvent(data as NotificationEvent);
        } catch (error) {
          logger.error('❌ Error parsing notification message:', error);
        }
      };

      ws.onclose = (event) => {
        logger.debug(`🔌 WebSocket closed for notifications ${userId}:`, event.code, event.reason);
        this.handleReconnect(connectionId, () => 
          this.subscribeToNotifications(userId, onEvent)
        );
      };

      ws.onerror = (error) => {
        logger.error(`❌ WebSocket error for notifications ${userId}:`, error);
      };

      this.connections.set(connectionId, ws);
      this.addEventListener(connectionId, onEvent);
      
      return connectionId;
    } catch (error) {
      logger.error('❌ Failed to subscribe to notifications:', error);
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
      logger.debug(`🔌 Unsubscribed from ${connectionId}`);
    }
  }

  // Close all connections
  closeAll(): void {
    this.connections.forEach((ws, connectionId) => {
      ws.close();
      logger.debug(`🔌 Closed connection ${connectionId}`);
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
      logger.debug(`🔄 Reconnecting ${connectionId} in ${delay}ms (attempt ${attempts + 1})`);
      
      setTimeout(async () => {
        try {
          await reconnectFn();
        } catch (error) {
          logger.error(`❌ Reconnection failed for ${connectionId}:`, error);
          this.reconnectAttempts.set(connectionId, attempts + 1);
        }
      }, delay);
    } else {
      logger.error(`❌ Max reconnection attempts reached for ${connectionId}`);
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
      logger.warn(`⚠️ WebSocket ${connectionId} is not open`);
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
