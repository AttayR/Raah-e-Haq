import { toast, type ToastApi } from './toast';

/** Hook form of the toast API for components. The object is a stable singleton. */
export const useToast = (): ToastApi => toast;

export default useToast;
