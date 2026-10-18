import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import ModernModal, { ModernModalConfig } from './ModernModal';
import { toast, type ToastAction } from '../core/toast';
import { DialogHost } from './ui/Dialog';
import { ToastHost } from './ui/Toast';
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

  const handleModalClose = () => {
    setCurrentModal(null);
    modalConfig = null;
  };

  // [T-565] The last modal stays rendered (hidden) after it is closed, like DialogHost: the Modal
  // closes with `visible={false}` and keeps its queue turn through the iOS dismiss, instead of
  // unmounting a presented Modal (which let the next sheet present while UIKit was still busy).
  const lastModal = useRef<ModernModalConfig | null>(null);
  if (currentModal) lastModal.current = currentModal;
  const shownModal = currentModal ?? lastModal.current;

  return (
    <View style={styles.container}>
      {children}

      {/* Toast: one at a time (a native Modal's ModalRoot takes over while it is up) */}
      <ToastHost />

      {/* Product dialogs: confirm() / alert() from src/core/dialog (UI-R3) */}
      <DialogHost />

      {/* Legacy modal (ModernModal; removed in UI-R19) */}
      {shownModal && (
        <ModernModal
          config={currentModal ?? { ...shownModal, visible: false }}
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
