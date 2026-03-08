import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  role: null, 


  login: (token, user) => {
    localStorage.setItem('token', token);
    set({
      token,
      user,
      isAuthenticated: true,
      role: user?.role || 'student' 
    });
  },

 
  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      role: null
    });
  }
}));