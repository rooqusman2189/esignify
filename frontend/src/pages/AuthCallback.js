import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      // Check for OAuth errors first
      const errorCode = params.get('error');
      const errorDescription = params.get('error_description');
      
      if (errorCode) {
        console.error('OAuth Error:', errorCode, errorDescription);
        setError(errorDescription || errorCode);
        toast.error(`Login failed: ${errorDescription || errorCode}`);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }
      
      // Check for Microsoft SSO callback (has access_token and id_token)
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');
      
      // Check for Google SSO callback (has session_id)
      const sessionId = params.get('session_id');

      console.log('Auth callback params:', { 
        hasAccessToken: !!accessToken, 
        hasIdToken: !!idToken, 
        hasSessionId: !!sessionId 
      });

      // Handle Microsoft SSO
      if (idToken) {
        try {
          // Parse the ID token to get user claims (JWT payload is base64 encoded)
          const idTokenParts = idToken.split('.');
          // Handle base64url encoding
          const base64 = idTokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          
          console.log('Microsoft token claims:', payload);
          
          const response = await api.post('/api/auth/microsoft', {
            access_token: accessToken || '',
            id_token_claims: payload
          });
          
          if (response.data.success) {
            setUser(response.data.data.user);
            toast.success('Logged in with Microsoft!');
            navigate('/dashboard', { replace: true });
          } else {
            toast.error('Authentication failed');
            navigate('/login');
          }
        } catch (error) {
          console.error('Microsoft auth error:', error);
          toast.error('Microsoft authentication failed');
          navigate('/login');
        }
        return;
      }

      // Handle Google SSO (Emergent)
      if (sessionId) {
        try {
          const response = await api.post('/api/auth/session', { session_id: sessionId });
          if (response.data.success) {
            setUser(response.data.data.user);
            toast.success('Logged in successfully!');
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/login');
          }
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/login');
        }
        return;
      }

      // No valid auth params
      console.log('No valid auth params found, redirecting to login');
      navigate('/login');
    };

    processSession();
  }, [location, navigate, setUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    </div>
  );
};
