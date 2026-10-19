import { useCallback, useEffect, type RefObject } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { cancelAllRequests } from '../../services/api';
import { logger } from '../../core/logging/logger';

const cancelRequests = (when: string) => {
  try {
    cancelAllRequests();
  } catch (e) {
    logger.debug(`Error cancelling requests ${when}:`, e);
  }
};

/**
 * The booking screen's network requests are cancelled when it loses focus and on unmount, and
 * the map ref is dropped on unmount (moved out of PassengerMapScreen, T-586 design review).
 */
export const useCancelRequestsOnLeave = <T>(mapRef: RefObject<T | null>) => {
  useEffect(() => {
    const ref = mapRef;
    return () => {
      ref.current = null;
      cancelRequests('on unmount');
    };
  }, [mapRef]);

  useFocusEffect(useCallback(() => () => cancelRequests('on unfocus'), []));
};
