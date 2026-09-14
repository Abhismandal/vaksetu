import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize: load authenticated user on refresh
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await api.get('/auth/me');
          if (response.data?.success && response.data?.user) {
            setUser(response.data.user);
            setToken(storedToken);
          } else {
            throw new Error('Invalid user payload');
          }
        } catch (error) {
          console.warn('[AuthContext] Session expired or invalid token:', error.message);
          localStorage.removeItem('token');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Register
  const register = async (userData) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data?.token && response.data?.user) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      throw new Error(response.data?.message || 'Registration failed');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  // Login
  const login = async (identifier, password) => {
    setAuthError(null);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      if (response.data?.token && response.data?.user) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      throw new Error(response.data?.message || 'Login failed');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.warn('[AuthContext] Logout API call warning:', error.message);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
      setAuthError(null);
    }
  };

  // Update profile
  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/me', profileData);
      if (response.data?.success && response.data?.user) {
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      throw new Error(response.data?.message || 'Profile update failed');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Profile update failed';
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        authError,
        setAuthError,
        register,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
