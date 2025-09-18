import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import AuthStack from './stacks/AuthStack';
import RootNavigation from './RootNavigation';
import DriverPendingApprovalScreen from '../../screens/Driver/DriverPendingApprovalScreen';

export default function AuthFlow() {
  const { status, uid, phoneNumber, role, profileCompleted, userProfile } = useSelector((state: RootState) => state.auth);
  
  console.log('AuthFlow - Current state:', { status, uid, phoneNumber, role, profileCompleted });
  console.log('AuthFlow - profileCompleted type:', typeof profileCompleted, 'value:', profileCompleted);
  console.log('AuthFlow - role type:', typeof role, 'value:', role);
  console.log('AuthFlow - userProfile:', userProfile);

  // Check if driver is approved
  const isDriverApproved = role === 'driver' ? 
    (userProfile?.driverStatus === 'approved') : 
    true; // Non-drivers are always "approved"

  // If authenticated, has a role, profile is completed, AND (not a driver or driver is approved), show main app
  if (status === 'authenticated' && uid && role && profileCompleted && isDriverApproved) {
    console.log('AuthFlow - User authenticated with role and completed profile, showing main app');
    return <RootNavigation />;
  }

  // If driver is not approved, show pending approval screen
  if (status === 'authenticated' && uid && role === 'driver' && profileCompleted && !isDriverApproved) {
    console.log('AuthFlow - Driver not approved, showing pending approval screen');
    return <DriverPendingApprovalScreen />;
  }

  // If authenticated but missing role OR profile not completed, show auth screens
  if (status === 'authenticated' && uid && (!role || !profileCompleted)) {
    console.log('AuthFlow - User authenticated but needs to complete setup, showing auth screens');
    console.log('AuthFlow - Missing role:', !role, 'Missing profileCompleted:', !profileCompleted);
    return <AuthStack />;
  }

  // If not authenticated or still loading, show auth screens
  console.log('AuthFlow - User not authenticated, showing auth screens');
  return <AuthStack />;
}
