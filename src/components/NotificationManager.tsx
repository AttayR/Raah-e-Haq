import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import ModernToast, { ToastConfig } from './ModernToast';
import ModernModal, { ModernModalConfig } from './ModernModal';

interface NotificationManagerProps {
  children: React.ReactNode;
}

// Global state for notifications
let toastQueue: ToastConfig[] = [];
let modalConfig: ModernModalConfig | null = null;
let listeners: Array<() => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

// Toast functions
export const showToast = (config: Omit<ToastConfig, 'id'>) => {
  const toastId = `toast_${Date.now()}_${Math.random()}`;
  const newToast: ToastConfig = {
    id: toastId,
    duration: 4000,
    ...config,
  };
  
  toastQueue.push(newToast);
  notifyListeners();
};

export const hideToast = (id?: string) => {
  if (id) {
    toastQueue = toastQueue.filter(toast => toast.id !== id);
  } else {
    toastQueue = [];
  }
  notifyListeners();
};

// Modal functions
export const showModal = (config: ModernModalConfig) => {
  modalConfig = config;
  notifyListeners();
};

export const hideModal = () => {
  modalConfig = null;
  notifyListeners();
};

// Convenience functions for common notifications
export const showSuccessToast = (title: string, message?: string, action?: ToastConfig['action']) => {
  showToast({
    type: 'success',
    title,
    message,
    action,
  });
};

export const showErrorToast = (title: string, message?: string, action?: ToastConfig['action']) => {
  showToast({
    type: 'error',
    title,
    message,
    action,
  });
};

export const showInfoToast = (title: string, message?: string, action?: ToastConfig['action']) => {
  showToast({
    type: 'info',
    title,
    message,
    action,
  });
};

export const showLoadingToast = (title: string, message?: string) => {
  showToast({
    type: 'loading',
    title,
    message,
    duration: 0, // Don't auto-hide loading toasts
  });
};

export const showSuccessModal = (
  title: string, 
  message?: string, 
  primaryAction?: ModernModalConfig['primaryAction'],
  secondaryAction?: ModernModalConfig['secondaryAction']
) => {
  showModal({
    visible: true,
    type: 'success',
    title,
    message,
    primaryAction,
    secondaryAction,
    animationType: 'scale',
  });
};

export const showErrorModal = (
  title: string, 
  message?: string, 
  primaryAction?: ModernModalConfig['primaryAction'],
  secondaryAction?: ModernModalConfig['secondaryAction']
) => {
  showModal({
    visible: true,
    type: 'error',
    title,
    message,
    primaryAction,
    secondaryAction,
    animationType: 'scale',
  });
};

export const showLoadingModal = (
  title: string, 
  message?: string
) => {
  showModal({
    visible: true,
    type: 'loading',
    title,
    message,
    showCloseButton: false,
    animationType: 'scale',
  });
};

// Ride-specific notification functions
export const showRideRequestedToast = () => {
  showSuccessToast(
    'Ride Requested! 🚗',
    'Your ride request has been created and we\'re finding nearby drivers.',
    {
      label: 'View Status',
      onPress: () => {
        // Navigate to ride status screen
        console.log('Navigate to ride status');
      },
    }
  );
};

export const showRideRequestedModal = () => {
  showSuccessModal(
    'Ride Requested Successfully! 🎉',
    'Your ride request has been created and we\'re searching for nearby drivers. You\'ll be notified when a driver accepts your ride.',
    {
      label: 'View Ride Status',
      onPress: () => {
        hideModal();
        // Navigate to ride status screen
        console.log('Navigate to ride status');
      },
    },
    {
      label: 'Cancel Ride',
      onPress: () => {
        hideModal();
        // Show cancel confirmation
        console.log('Show cancel confirmation');
      },
    }
  );
};

export const showDriverFoundToast = (driverName: string) => {
  showSuccessToast(
    'Driver Found! 🎉',
    `${driverName} has accepted your ride and is on the way.`,
    {
      label: 'Track Driver',
      onPress: () => {
        console.log('Navigate to driver tracking');
      },
    }
  );
};

export const showRideStartedToast = () => {
  showInfoToast(
    'Ride Started! 🚀',
    'Your ride has begun. Enjoy your journey!',
  );
};

export const showRideCompletedToast = (fare: number) => {
  showSuccessToast(
    'Ride Completed! ✅',
    `Your ride has been completed. Total fare: $${fare}`,
    {
      label: 'Rate Driver',
      onPress: () => {
        console.log('Open rating modal');
      },
    }
  );
};

const NotificationManager: React.FC<NotificationManagerProps> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);
  const [currentModal, setCurrentModal] = useState<ModernModalConfig | null>(null);

  const updateNotifications = useCallback(() => {
    // Update toast
    if (toastQueue.length > 0 && !currentToast) {
      setCurrentToast(toastQueue[0]);
    }

    // Update modal
    setCurrentModal(modalConfig);
  }, [currentToast]);

  React.useEffect(() => {
    listeners.push(updateNotifications);
    updateNotifications();

    return () => {
      listeners = listeners.filter(listener => listener !== updateNotifications);
    };
  }, [updateNotifications]);

  const handleToastHide = (id: string) => {
    setCurrentToast(null);
    toastQueue = toastQueue.filter(toast => toast.id !== id);
    
    // Show next toast if available
    if (toastQueue.length > 0) {
      setTimeout(() => {
        setCurrentToast(toastQueue[0]);
      }, 100);
    }
  };

  const handleModalClose = () => {
    setCurrentModal(null);
    modalConfig = null;
  };

  return (
    <View style={styles.container}>
      {children}
      
      {/* Toast */}
      {currentToast && (
        <ModernToast
          config={currentToast}
          onHide={handleToastHide}
        />
      )}
      
      {/* Modal */}
      {currentModal && (
        <ModernModal
          config={currentModal}
          onClose={handleModalClose}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default NotificationManager;
