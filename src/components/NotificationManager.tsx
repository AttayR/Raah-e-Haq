import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DialogHost } from './ui/Dialog';
import { ToastHost } from './ui/Toast';

interface NotificationManagerProps {
  children: React.ReactNode;
}

/**
 * Mounts the app-wide feedback hosts once, above the navigation tree: the toast host
 * (`src/core/toast`) and the product dialog host (`confirm()` / `alert()` from `src/core/dialog`).
 * UI-R19 removed the legacy modal (`showModal`, `showErrorModal`, …) and its unused ride
 * toasts; refusals now use the themed Dialog.
 */
const NotificationManager: React.FC<NotificationManagerProps> = ({ children }) => (
  <View style={styles.container}>
    {children}

    {/* Toast: one at a time (a native Modal's ModalRoot takes over while it is up) */}
    <ToastHost />

    {/* Product dialogs: confirm() / alert() from src/core/dialog (UI-R3) */}
    <DialogHost />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default NotificationManager;
