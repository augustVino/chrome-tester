import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { Notification } from '../types';

interface UIState {
  // 搜索和过滤
  searchQuery: string;
  sortBy: 'version' | 'date' | 'name';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
  
  // 主题和界面
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  
  // 选中状态
  selectedBrowser: string | null;
  selectedTasks: string[];
  selectedBrowserForDetails: string | null;
  
  // 加载和错误状态
  isLoading: boolean;
  error: string | null;
  
  // 通知
  notifications: Notification[];
  
  // 模态框状态
  modals: {
    downloadModal: boolean;
    settingsModal: boolean;
    browserDetailsModal: boolean;
    confirmDeleteModal: boolean;
  };
}

interface UIActions {
  // 搜索和过滤
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: UIState['sortBy']) => void;
  setSortOrder: (order: UIState['sortOrder']) => void;
  setViewMode: (mode: UIState['viewMode']) => void;
  
  // 主题和界面
  setTheme: (theme: UIState['theme']) => void;
  toggleSidebar: () => void;
  
  // 选中状态
  setSelectedBrowser: (id: string | null) => void;
  toggleTaskSelection: (taskId: string) => void;
  clearTaskSelection: () => void;
  setSelectedBrowserForDetails: (id: string | null) => void;
  
  // 加载和错误状态
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 通知
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // 模态框
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  closeAllModals: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
      viewMode: 'grid',
      theme: 'light',
      sidebarCollapsed: false,
      selectedBrowser: null,
      selectedTasks: [],
      selectedBrowserForDetails: null,
      isLoading: false,
      error: null,
      notifications: [],
      modals: {
        downloadModal: false,
        settingsModal: false,
        browserDetailsModal: false,
        confirmDeleteModal: false,
      },

      // Actions
      setSearchQuery: (query) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      setSortBy: (sortBy) => {
        set((state) => {
          state.sortBy = sortBy;
        });
      },

      setSortOrder: (order) => {
        set((state) => {
          state.sortOrder = order;
        });
      },

      setViewMode: (mode) => {
        set((state) => {
          state.viewMode = mode;
        });
      },

      setTheme: (theme) => {
        set((state) => {
          state.theme = theme;
        });
        
        // Update document class for theme
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
      },

      toggleSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      setSelectedBrowser: (id) => {
        set((state) => {
          state.selectedBrowser = id;
        });
      },

      toggleTaskSelection: (taskId) => {
        set((state) => {
          const index = state.selectedTasks.indexOf(taskId);
          if (index > -1) {
            state.selectedTasks.splice(index, 1);
          } else {
            state.selectedTasks.push(taskId);
          }
        });
      },

      clearTaskSelection: () => {
        set((state) => {
          state.selectedTasks = [];
        });
      },

      setSelectedBrowserForDetails: (id) => {
        set((state) => {
          state.selectedBrowserForDetails = id;
        });
      },

      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
          ...notification,
          id,
        };

        set((state) => {
          state.notifications.push(newNotification);
        });

        // Auto-remove notification after duration
        if (notification.duration !== 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, notification.duration || 5000);
        }

        return id;
      },

      removeNotification: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
        });
      },

      clearNotifications: () => {
        set((state) => {
          state.notifications = [];
        });
      },

      openModal: (modal) => {
        set((state) => {
          state.modals[modal] = true;
        });
      },

      closeModal: (modal) => {
        set((state) => {
          state.modals[modal] = false;
        });
      },

      closeAllModals: () => {
        set((state) => {
          Object.keys(state.modals).forEach((key) => {
            state.modals[key as keyof UIState['modals']] = false;
          });
        });
      },
    })),
    {
      name: 'chrome-tester-ui',
      // 只持久化部分状态
      partialize: (state) => ({
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        viewMode: state.viewMode,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);