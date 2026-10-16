import React, { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppDispatch } from '../../store';
import { bootstrapAuth } from '../../store/thunks/apiThunks';
import { authStorage } from '../../services/authStorage';
import { signOutLegacyFirebaseAuth } from '../../services/legacyFirebaseSignOut';
import { logger } from '../../core/logging/logger';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  // T-534 (PERF-16): dispatch only; the app root does not subscribe to the auth slice.
  const dispatch = useAppDispatch();
  const initialize = useCallback(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    logger.debug('AuthProvider - Initializing API authentication...');

    // Initialize auth state
    initialize();

    logger.debug('AuthProvider - API authentication initialized');
  }, [initialize]);

  // One-time: sign out a native Firebase Auth session left by a pre-T-107 build. Runs in the
  // background, never throws and never blocks startup.
  useEffect(() => {
    signOutLegacyFirebaseAuth();
  }, []);

  // A launch that could not read the Keychain (e.g. started in the background before the
  // first unlock) starts signed out. When the app becomes active the Keychain is read again,
  // and a session found then gets the normal startup check (T-107).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        return;
      }
      authStorage
        .recheckAfterReadFailure()
        .then((found) => {
          if (found) {
            initialize();
          }
        })
        .catch((error: unknown) => {
          logger.warn('AuthProvider - Keychain re-read failed', {
            name: error instanceof Error ? error.name : typeof error,
          });
        });
    });
    return () => subscription.remove();
  }, [initialize]);

  logger.debug('AuthProvider - Rendering children');
  // Always render children - let AuthFlow handle the routing logic
  return <>{children}</>;
}
