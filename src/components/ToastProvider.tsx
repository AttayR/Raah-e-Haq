import React, { useState, useEffect } from 'react';
import Toast from './Toast';

// Global toast state
let toastState: {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  onHide?: () => void;
} = {
  visible: false,
  message: '',
  type: 'info',
};

let toastListeners: Array<() => void> = [];

const notifyListeners = () => {
  toastListeners.forEach(listener => listener());
};

// Static methods for showing toast
export const showToast = (type: 'success' | 'error' | 'info', message: string, onHide?: () => void) => {
  toastState = {
    visible: true,
    message,
    type,
    onHide,
  };
  notifyListeners();
};

export const hideToast = () => {
  toastState.visible = false;
  notifyListeners();
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState(toastState);

  useEffect(() => {
    const listener = () => {
      setToast({ ...toastState });
    };

    toastListeners.push(listener);

    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  const handleHide = () => {
    hideToast();
    if (toast.onHide) {
      toast.onHide();
    }
  };

  return (
    <>
      {children}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={handleHide}
      />
    </>
  );
}
