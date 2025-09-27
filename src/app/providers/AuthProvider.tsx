import React, { useEffect } from 'react';
import { useApiAuth } from '../../hooks/useApiAuth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { initialize } = useApiAuth();

  useEffect(() => {
    console.log('AuthProvider - Initializing API authentication...');
    
    // Initialize auth state
    initialize();
    
    console.log('AuthProvider - API authentication initialized');
  }, [initialize]);

  console.log('AuthProvider - Rendering children');
  // Always render children - let AuthFlow handle the routing logic
  return <>{children}</>;
}
