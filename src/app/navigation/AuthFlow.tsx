import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';
import DriverPendingApprovalScreen from '../../screens/Driver/DriverPendingApprovalScreen';

export default function AuthFlow() {
  const { isAuthenticated, user, profileCompleted } = useSelector((state: RootState) => state.apiAuth);
  
  console.log('AuthFlow - Current state:', { isAuthenticated, user, profileCompleted });

  // Check if user is active and has a role
  const isUserActive = user?.status === 'active';
  const userRole = user?.role;
  const isDriver = userRole === 'driver';
  const isPassenger = userRole === 'passenger';

  console.log('AuthFlow - User role check:', { 
    role: userRole, 
    isDriver, 
    isPassenger, 
    isUserActive 
  });

  // If authenticated, user is active, and has a role, show main app
  if (isAuthenticated && user && isUserActive && userRole) {
    console.log('AuthFlow - User authenticated and active with role, showing main app');
    console.log('AuthFlow - User details:', user);
    console.log('AuthFlow - User role:', userRole);
    return <RootNavigation />;
  }

  // If authenticated but user is not active (pending approval), show pending approval screen
  if (isAuthenticated && user && !isUserActive) {
    console.log('AuthFlow - User not active (pending approval), showing pending approval screen');
    return <DriverPendingApprovalScreen />;
  }

  // If authenticated but missing role, show auth screens for role selection
  if (isAuthenticated && user && isUserActive && !userRole) {
    console.log('AuthFlow - User authenticated but missing role, showing auth screens');
    return <AuthStack />;
  }

  // If not authenticated or still loading, show auth screens
  console.log('AuthFlow - User not authenticated, showing auth screens');
  return <AuthStack />;
}
