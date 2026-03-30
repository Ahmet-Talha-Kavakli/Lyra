import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

export interface User {
  id: string;
  email: string;
  firstName?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
}

/**
 * Auth Store - Zero Trust Architecture
 *
 * SECURITY:
 * - Never stores tokens in state (only in HttpOnly cookies)
 * - apiClient automatically includes cookies in all requests
 * - Logout clears cookies server-side
 * - checkAuth verifies with backend every session
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  logout: async () => {
    try {
      // Call logout endpoint - this clears cookies server-side
      await apiClient.post('/api/auth/logout', {});
    } catch (e) {
      console.error('Logout failed', e);
    }
    // Clear local state (cookies already cleared by server)
    set({ user: null, isAuthenticated: false });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post('/api/auth/login', { email, password });
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        isLoading: false
      });
      throw error;
    }
  },

  signup: async (email: string, password: string, firstName: string, lastName: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post('/api/auth/signup', {
        email,
        password,
        firstName,
        lastName
      });
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Signup failed',
        isLoading: false
      });
      throw error;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // Call verify endpoint - credentials included by apiClient
      const data = await apiClient.get('/api/auth/verify');

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.user,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        set({ 
          user: null,
          isAuthenticated: false,
          isLoading: false 
        });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  }
}));
