import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';
import DriverPendingApprovalScreen from '../../screens/Driver/DriverPendingApprovalScreen';

export default function AuthFlow() {
  const { isAuthenticated, user, profileCompleted } = useSelector((state: RootState) => state.apiAuth);
  
  console.log('AuthFlow - Current state:', { isAuthenticated, user, profileCompleted });

  // Check if driver is approved (assuming user_type field in API response)
  const isDriverApproved = user?.user_type === 'driver' ? 
    (user?.status === 'active') : 
    true; // Non-drivers are always "approved"

  // If authenticated, has a user, profile is completed, AND (not a driver or driver is approved), show main app
  if (isAuthenticated && user && profileCompleted && isDriverApproved) {
    console.log('AuthFlow - User authenticated with completed profile, showing main app');
    return <RootNavigation />;
  }

  // If driver is not approved, show pending approval screen
  if (isAuthenticated && user?.user_type === 'driver' && profileCompleted && !isDriverApproved) {
    console.log('AuthFlow - Driver not approved, showing pending approval screen');
    return <DriverPendingApprovalScreen />;
  }

  // If authenticated but profile not completed, show auth screens
  if (isAuthenticated && user && !profileCompleted) {
    console.log('AuthFlow - User authenticated but needs to complete setup, showing auth screens');
    return <AuthStack />;
  }

  // If not authenticated or still loading, show auth screens
  console.log('AuthFlow - User not authenticated, showing auth screens');
  return <AuthStack />;
}
