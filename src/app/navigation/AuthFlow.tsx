import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';
import AccountStatusScreen from '../../features/auth/screens/AccountStatusScreen';
import SplashScreen from '../../components/SplashScreen';
import { resolveAuthRoute } from '../../core/auth/normalizeUser';
import { logger } from '../../core/logging/logger';

/**
 * Routes on the normalised `user.role` and `user.status` only (AUTH-08, T-105); every thunk
 * that stores a user passes it through normalizeUser first.
 */
export default function AuthFlow() {
  const { isAuthenticated, user, isInitialized } = useSelector((state: RootState) => state.apiAuth);

  const route = resolveAuthRoute({ isInitialized, isAuthenticated, user });
  logger.debug('AuthFlow - route:', { route, role: user?.role ?? null, status: user?.status ?? null });

  switch (route) {
    case 'splash':
      // Until initializeAuth has checked the stored session, route nowhere (no Login flash).
      return <SplashScreen />;
    case 'account-status':
      // Pending, inactive, suspended or rejected (BE-32), an unconfirmed status, or no role
      // this app serves: role- and status-specific copy, Check Status and Sign Out (T-106).
      return <AccountStatusScreen />;
    case 'driver':
    case 'passenger':
      return <RootNavigation />;
    case 'auth':
    default:
      return <AuthStack />;
  }
}
