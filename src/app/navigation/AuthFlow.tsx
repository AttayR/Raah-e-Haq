import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';
import DriverPendingApprovalScreen from '../../screens/Driver/DriverPendingApprovalScreen';
import SplashScreen from '../../components/SplashScreen';
import { logger } from '../../core/logging/logger';

export default function AuthFlow() {
  const { isAuthenticated, user, profileCompleted, isInitialized } = useSelector(
    (state: RootState) => state.apiAuth,
  );

  // Until initializeAuth has checked the stored session, route nowhere (no Login flash).
  if (!isInitialized) {
    return <SplashScreen />;
  }

  logger.debug('AuthFlow - Current state:', { isAuthenticated, hasUser: !!user, profileCompleted });

  // Check if user is active and has a role
  const isUserActive = user?.status === 'active';
  const userRole = user?.role;
  const isDriver = userRole === 'driver';
  const isPassenger = userRole === 'passenger';

  logger.debug('AuthFlow - User role check:', { 
    role: userRole, 
    isDriver, 
    isPassenger, 
    isUserActive 
  });

  // If authenticated, user is active, and has a role, show main app
  if (isAuthenticated && user && isUserActive && userRole) {
    logger.debug('AuthFlow - User authenticated and active with role, showing main app');
    logger.debug('AuthFlow - User role:', userRole);
    return <RootNavigation />;
  }

  // If authenticated but user is not active (pending approval), show pending approval screen
  if (isAuthenticated && user && !isUserActive) {
    logger.debug('AuthFlow - User not active (pending approval), showing pending approval screen');
    return <DriverPendingApprovalScreen />;
  }

  // If authenticated but missing role, show auth screens for role selection
  if (isAuthenticated && user && isUserActive && !userRole) {
    logger.debug('AuthFlow - User authenticated but missing role, showing auth screens');
    return <AuthStack />;
  }

  // If not authenticated or still loading, show auth screens
  logger.debug('AuthFlow - User not authenticated, showing auth screens');
  return <AuthStack />;
}
