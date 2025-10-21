import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { useRide } from '../../hooks/useRide';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import ErrorBoundary from '../../components/ErrorBoundary';
import { NotificationResource } from '../../services/rideService';

interface NotificationScreenProps {
  userId: number;
}

const NotificationScreen: React.FC<NotificationScreenProps> = ({ userId }) => {
  const { handleError } = useErrorHandler();
  const rideHook = useRide(userId, 'passenger');
  const {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadCount,
  } = rideHook || {};

  const [notifications, setNotifications] = useState<NotificationResource[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePages, setHasMorePages] = useState<boolean>(true);

  // Load notifications
  const loadNotifications = useCallback(async (page: number = 1, refresh: boolean = false) => {
    if (!getNotifications) return;

    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const result = await getNotifications(page, 20);
      
      if (page === 1) {
        setNotifications(result.data);
      } else {
        setNotifications(prev => [...prev, ...result.data]);
      }
      
      setHasMorePages(result.pagination.current_page < result.pagination.last_page);
      setCurrentPage(page);
      
    } catch (error) {
      handleError(error, 'NOTIFICATION_LOAD_ERROR');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getNotifications, handleError]);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!getUnreadCount) return;

    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      handleError(error, 'UNREAD_COUNT_ERROR');
    }
  }, [getUnreadCount, handleError]);

  // Mark notification as read
  const handleMarkAsRead = useCallback(async (notificationId: number) => {
    if (!markNotificationAsRead) return;

    try {
      await markNotificationAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      handleError(error, 'MARK_READ_ERROR');
    }
  }, [markNotificationAsRead, handleError]);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!markAllNotificationsAsRead) return;

    try {
      await markAllNotificationsAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          read_at: new Date().toISOString()
        }))
      );
      
      setUnreadCount(0);
      Alert.alert('Success', 'All notifications marked as read');
      
    } catch (error) {
      handleError(error, 'MARK_ALL_READ_ERROR');
    }
  }, [markAllNotificationsAsRead, handleError]);

  // Load more notifications
  const loadMore = useCallback(() => {
    if (!isLoading && hasMorePages) {
      loadNotifications(currentPage + 1, false);
    }
  }, [isLoading, hasMorePages, currentPage, loadNotifications]);

  // Refresh notifications
  const refreshNotifications = useCallback(() => {
    loadNotifications(1, true);
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  // Initial load
  useEffect(() => {
    loadNotifications(1, false);
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  // Format notification time
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  // Get notification icon
  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'driver_assigned':
      case 'driver_arrived':
        return '🚗';
      case 'ride_started':
      case 'ride_completed':
        return '✅';
      case 'ride_cancelled':
        return '❌';
      case 'new_ride_request':
        return '📱';
      case 'stop_completed':
        return '📍';
      case 'payment_received':
        return '💰';
      default:
        return '🔔';
    }
  };

  // Get notification color
  const getNotificationColor = (type: string): string => {
    switch (type) {
      case 'driver_assigned':
      case 'driver_arrived':
      case 'ride_started':
      case 'ride_completed':
        return '#10B981';
      case 'ride_cancelled':
        return '#EF4444';
      case 'new_ride_request':
        return '#3B82F6';
      case 'stop_completed':
        return '#8B5CF6';
      case 'payment_received':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  // Render notification item
  const renderNotification = ({ item }: { item: NotificationResource }) => {
    const isRead = !!item.read_at;
    const iconColor = getNotificationColor(item.type);
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !isRead && styles.unreadNotification
        ]}
        onPress={() => handleMarkAsRead(item.id)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationIcon}>
              {getNotificationIcon(item.type)}
            </Text>
            <View style={styles.notificationText}>
              <Text style={[
                styles.notificationTitle,
                !isRead && styles.unreadText
              ]}>
                {item.title}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTime(item.created_at)}
              </Text>
            </View>
            {!isRead && <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />}
          </View>
          
          <Text style={[
            styles.notificationMessage,
            !isRead && styles.unreadText
          ]}>
            {item.message}
          </Text>
          
          {item.data && (
            <View style={styles.notificationData}>
              {item.data.ride_id && (
                <Text style={styles.dataText}>Ride ID: {item.data.ride_id}</Text>
              )}
              {item.data.driver_name && (
                <Text style={styles.dataText}>Driver: {item.data.driver_name}</Text>
              )}
              {item.data.fare && (
                <Text style={styles.dataText}>Fare: PKR {item.data.fare}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="notifications-none" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyMessage}>
        You don't have any notifications yet. When you request rides or receive updates, they'll appear here.
      </Text>
    </View>
  );

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Notifications</Text>
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('NotificationScreen Error:', error, errorInfo);
        handleError(error, 'NOTIFICATION_SCREEN_ERROR');
      }}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        {renderHeader()}
        
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderNotification}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshNotifications}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: BrandColors.primary,
    borderRadius: 6,
  },
  markAllText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadNotification: {
    backgroundColor: '#f8fafc',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationData: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  dataText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationScreen;
