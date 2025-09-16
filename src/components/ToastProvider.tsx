import { Toast as RNToast } from 'react-native-toast-message/lib/src/Toast';

export const showToast = (type: 'success' | 'error' | 'info', message: string) => {
  RNToast.show({
    type,
    text1: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 50,
  });
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
