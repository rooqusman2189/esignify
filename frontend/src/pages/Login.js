import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msalConfig, setMsalConfig] = useState(null);

  useEffect(() => {
    // Check if Microsoft SSO is configured
    const checkMicrosoftConfig = async () => {
      try {
        const response = await api.get('/api/auth/microsoft/config');
        if (response.data.success && response.data.data.configured) {
          setMsalConfig(response.data.data);
        }
      } catch (error) {
        console.log('Microsoft SSO not available');
      }
    };
    checkMicrosoftConfig();
  }, []);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      if (response.data.success) {
        setUser(response.data.data.user);
        toast.success('Logged in successfully!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleMicrosoftLogin = async () => {
    if (!msalConfig) {
      toast.info('Microsoft SSO is not configured yet. Please contact your administrator or use Google/email login.');
      return;
    }

    // Redirect to Microsoft login
    const clientId = msalConfig.client_id;
    const tenantId = msalConfig.tenant_id;
    const redirectUri = encodeURIComponent(window.location.origin + '/dashboard');
    const scope = encodeURIComponent('openid profile email');
    const state = encodeURIComponent(JSON.stringify({ provider: 'microsoft' }));
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=id_token` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}` +
      `&response_mode=fragment` +
      `&state=${state}` +
      `&nonce=${Date.now()}`;
    
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#18181B] text-white p-12 flex-col justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="h-8 w-8" />
          <span className="text-2xl font-bold" style={{fontFamily: 'Outfit'}}>ESignify</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold mb-4" style={{fontFamily: 'Outfit'}}>
            Manage Email Signatures at Scale
          </h2>
          <p className="text-lg text-gray-300">
            Centralized signature management for modern organizations.
          </p>
        </div>
        <div className="text-sm text-gray-400">
          © 2024 ESignify. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{fontFamily: 'Outfit'}}>
              Welcome Back
            </h1>
            <p className="text-muted-foreground">
              Sign in to manage your email signatures
            </p>
          </div>

          <div className="space-y-6">
            {/* Email/Password Login */}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@esignify.com"
                  required
                  data-testid="email-input"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="password-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8]"
                disabled={loading}
                data-testid="login-btn"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="relative">
              <Separator />
              <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-muted-foreground">
                Or continue with
              </span>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleGoogleLogin}
                className="w-full h-12 border border-border bg-white text-foreground hover:bg-[#F4F4F5]"
                data-testid="google-login-btn"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <Button
                onClick={handleMicrosoftLogin}
                className="w-full h-12 border border-border bg-white text-foreground hover:bg-[#F4F4F5]"
                data-testid="microsoft-login-btn"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M0 0h11v11H0z"/>
                  <path fill="#81bc06" d="M12 0h11v11H12z"/>
                  <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                  <path fill="#ffba08" d="M12 12h11v11H12z"/>
                </svg>
                Continue with Microsoft
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              By continuing, you agree to our Terms of Service
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
