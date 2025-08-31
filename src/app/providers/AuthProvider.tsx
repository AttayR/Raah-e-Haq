import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { startAuthListener, checkAuthStatusThunk } from '../../store/thunks/authThunks';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useDispatch<any>();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log('AuthProvider - Initializing...');
    
    // Check initial auth status
    console.log('AuthProvider - Checking auth status...');
    dispatch(checkAuthStatusThunk());
    
    // Start auth listener
    console.log('AuthProvider - Starting auth listener...');
    const unsubscribe = dispatch(startAuthListener());
    if (typeof unsubscribe === 'function') {
      unsubscribeRef.current = unsubscribe;
      console.log('AuthProvider - Auth listener started successfully');
    } else {
      console.log('AuthProvider - Auth listener returned non-function:', unsubscribe);
    }

    // Cleanup on unmount
    return () => {
      console.log('AuthProvider - Cleaning up...');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [dispatch]);

  console.log('AuthProvider - Rendering children');
  // Always render children - let AuthFlow handle the routing logic
  return <>{children}</>;
}
