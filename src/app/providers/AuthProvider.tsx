import React, { useEffect } from 'react';
import { useApiAuth } from '../../hooks/useApiAuth';
import { logger } from '../../core/logging/logger';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { initialize } = useApiAuth();

  useEffect(() => {
    logger.debug('AuthProvider - Initializing API authentication...');
    
    // Initialize auth state
    initialize();
    
    logger.debug('AuthProvider - API authentication initialized');
  }, [initialize]);

  logger.debug('AuthProvider - Rendering children');
  // Always render children - let AuthFlow handle the routing logic
  return <>{children}</>;
}
