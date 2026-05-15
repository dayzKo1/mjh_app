/**
 * 全局状态管理
 */
import { create } from 'zustand';

interface AdminState {
  token: string;
  collapsed: boolean;
  setToken: (token: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  logout: () => void;
}

/**
 * 管理后台全局状态
 */
export const useStore = create<AdminState>((set) => ({
  token: localStorage.getItem('admin_token') || '',
  collapsed: false,
  setToken: (token) => {
    localStorage.setItem('admin_token', token);
    set({ token });
  },
  setCollapsed: (collapsed) => set({ collapsed }),
  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: '' });
  },
}));
