import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  logout: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
    localStorage.removeItem('lyra_token');
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('lyra_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Verify token with backend
      const response = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.user,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        localStorage.removeItem('lyra_token');
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  }
}));
