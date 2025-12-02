import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

// Token refresh interval (refresh every 20 minutes to stay ahead of 24h expiry)
const TOKEN_REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
  const refreshIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // Track user activity for session timeout
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Track various user activities
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoaded(true);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const { user: userData } = await response.json();
          setUser(userData);
          setAccessToken(token);
        } else {
          // Token expired or invalid, try refresh
          await refreshToken();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Don't automatically clear tokens on error
      } finally {
        setIsLoaded(true);
      }
    };

    checkAuth();
  }, []);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      });

      if (response.ok) {
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await response.json();
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setAccessToken(newAccessToken);

        // Fetch user data with new token
        const userResponse = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${newAccessToken}` }
        });
        if (userResponse.ok) {
          const { user: userData } = await userResponse.json();
          setUser(userData);
        }
        console.log('[Auth] Token refreshed successfully');
        return true;
      } else {
        // Refresh failed, but don't automatically logout
        // Just return false to indicate failure
        console.warn('[Auth] Token refresh failed - response not ok');
        return false;
      }
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error);
      return false;
    }
  }, []);

  // Auto-refresh tokens for long-running NOC displays
  // Simplified to just check for inactivity timeout if configured
  // Token refreshing is handled reactively by authFetch in api.js
  useEffect(() => {
    if (!user) return;

    const checkInactivity = async () => {
      const sessionTimeout = parseInt(localStorage.getItem('noc-session-timeout') || '0');
      
      // If timeout is set (not 0/infinite), check for inactivity
      if (sessionTimeout > 0) {
        const inactiveMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60);
        if (inactiveMinutes >= sessionTimeout) {
          console.log('[Auth] Session timeout due to inactivity');
          await logout();
        }
      }
    };

    // Check every minute for inactivity
    refreshIntervalRef.current = setInterval(checkInactivity, 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [user, logout]);

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const { user: userData, accessToken, refreshToken } = await response.json();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setAccessToken(accessToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, firstName, lastName) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const { user: userData, accessToken, refreshToken } = await response.json();
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setAccessToken(accessToken);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = useCallback(async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    try {
      const refresh = localStorage.getItem('refreshToken');
      const token = localStorage.getItem('accessToken');
      if (refresh && token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ refreshToken: refresh })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const value = {
    user,
    isLoaded,
    accessToken,
    login,
    register,
    logout,
    refreshToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
