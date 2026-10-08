import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { View, StyleSheet } from 'react-native';
import ModernToast from './ModernToast';
import ModernModal, { ModernModalConfig } from './ModernModal';
import { toast, toastStore, type ToastAction } from '../core/toast';
import { logger } from '../core/logging/logger';

interface NotificationManagerProps {
  children: React.ReactNode;
}

// Global state for modals. Toasts live in src/core/toast (the one toast API).
let modalConfig: ModernModalConfig | null = null;
let listeners: Array<() => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener());
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

// Ride-specific notification functions (thin wrappers over the one toast API)
const logAction = (label: string, note: string): ToastAction => ({
  label,
  onPress: () => logger.debug(note),
});

export const showRideRequestedToast = () => {
  toast.success(
    'Ride Requested! 🚗',
    'Your ride request has been created and we\'re finding nearby drivers.',
    { action: logAction('View Status', 'Navigate to ride status') },
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
        logger.debug('Navigate to ride status');
      },
    },
    {
      label: 'Cancel Ride',
      onPress: () => {
        hideModal();
        // Show cancel confirmation
        logger.debug('Show cancel confirmation');
      },
    }
  );
};

export const showDriverFoundToast = (driverName: string) => {
  toast.success(
    'Driver Found! 🎉',
    `${driverName} has accepted your ride and is on the way.`,
    { action: logAction('Track Driver', 'Navigate to driver tracking') },
  );
};

export const showRideStartedToast = () => {
  toast.info(
    'Ride Started! 🚀',
    'Your ride has begun. Enjoy your journey!',
  );
};

export const showRideCompletedToast = (fare: number) => {
  toast.success(
    'Ride Completed! ✅',
    `Your ride has been completed. Total fare: $${fare}`,
    { action: logAction('Rate Driver', 'Open rating modal') },
  );
};

const NotificationManager: React.FC<NotificationManagerProps> = ({ children }) => {
  const currentToast = useSyncExternalStore(toastStore.subscribe, toastStore.getCurrent);
  const [currentModal, setCurrentModal] = useState<ModernModalConfig | null>(modalConfig);

  const updateModal = useCallback(() => {
    setCurrentModal(modalConfig);
  }, []);

  React.useEffect(() => {
    listeners.push(updateModal);
    updateModal();

    return () => {
      listeners = listeners.filter(listener => listener !== updateModal);
    };
  }, [updateModal]);

  const handleToastHide = useCallback((id: string) => toast.hide(id), []);

  const handleModalClose = () => {
    setCurrentModal(null);
    modalConfig = null;
  };

  return (
    <View style={styles.container}>
      {children}

      {/* Toast: one at a time; key remounts it so each toast animates and times out on its own */}
      {currentToast && (
        <ModernToast
          key={currentToast.id}
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
