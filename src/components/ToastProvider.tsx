// Safe toast implementation that doesn't crash if react-native-toast-message is not available
export const showToast = (type: 'success' | 'error' | 'info', message: string) => {
  try {
    // Try to use react-native-toast-message if available
    const { Toast } = require('react-native-toast-message');
    Toast.show({
      type,
      text1: message,
      position: 'top',
      visibilityTime: 3000,
      topOffset: 50,
    });
  } catch (error) {
    // Fallback to console log if toast library is not available
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
