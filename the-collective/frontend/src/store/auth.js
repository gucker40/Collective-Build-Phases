import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:  null,
      token: null,

      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      isAdmin: () => get().user?.role === 'admin',

      setUser: (updates) => set(s => ({ user: s.user ? { ...s.user, ...updates } : s.user })),
    }),
    {
      name: 'collective-auth',
      partialize: s => ({ user: s.user, token: s.token }),
    }
  )
);
