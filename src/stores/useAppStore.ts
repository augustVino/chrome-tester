import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { AppConfig, SystemInfo } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface AppState {
  config: AppConfig;
  systemInfo: SystemInfo | null;
  isInitialized: boolean;
  version: string;
}

interface AppActions {
  initializeApp: () => Promise<void>;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  getConfig: (key: string) => Promise<string | null>;
  setConfig: (key: string, value: string) => Promise<void>;
  fetchSystemInfo: () => Promise<void>;
  reset: () => void;
}

type AppStore = AppState & AppActions;

const defaultConfig: AppConfig = {
  downloadPath: '',
  autoCleanup: true,
  maxConcurrentDownloads: 3,
  notifications: true,
  proxySettings: {
    enabled: false,
  }
};

export const useAppStore = create<AppStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      config: defaultConfig,
      systemInfo: null,
      isInitialized: false,
      version: '1.0.0',

      // Actions
      initializeApp: async () => {
        try {
          // Fetch system info
          await get().fetchSystemInfo();
          
          // Load any additional configuration from backend
          // This could include checking for updates, validating paths, etc.
          
          set((state) => {
            state.isInitialized = true;
          });
        } catch (error) {
          console.error('Failed to initialize app:', error);
          // Continue with initialization even if some steps fail
          set((state) => {
            state.isInitialized = true;
          });
        }
      },

      updateConfig: async (updates) => {
        set((state) => {
          state.config = { ...state.config, ...updates };
        });

        // Persist important config changes to backend
        try {
          for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
              await invoke('set_app_config', { 
                key: `config.${key}`, 
                value: JSON.stringify(value) 
              });
            }
          }
        } catch (error) {
          console.error('Failed to persist config changes:', error);
        }
      },

      getConfig: async (key) => {
        try {
          const value = await invoke<string | null>('get_app_config', { key });
          return value;
        } catch (error) {
          console.error('Failed to get config:', error);
          return null;
        }
      },

      setConfig: async (key, value) => {
        try {
          await invoke('set_app_config', { key, value });
        } catch (error) {
          console.error('Failed to set config:', error);
          throw error;
        }
      },

      fetchSystemInfo: async () => {
        try {
          const systemInfo = await invoke<SystemInfo>('get_system_info');
          set((state) => {
            state.systemInfo = systemInfo;
          });
        } catch (error) {
          console.error('Failed to fetch system info:', error);
          // Set default system info if fetch fails
          set((state) => {
            state.systemInfo = {
              platform: 'unknown',
              arch: 'unknown',
              available_versions: []
            };
          });
        }
      },

      reset: () => {
        set((state) => {
          state.config = defaultConfig;
          state.systemInfo = null;
          state.isInitialized = false;
        });
      }
    })),
    {
      name: 'chrome-tester-app',
      // Only persist configuration, not runtime state
      partialize: (state) => ({
        config: state.config,
        version: state.version,
      }),
    }
  )
);

// Hook for getting current platform
export const usePlatform = () => {
  const systemInfo = useAppStore(state => state.systemInfo);
  return systemInfo?.platform || 'unknown';
};

// Hook for checking if app is ready
export const useAppReady = () => {
  return useAppStore(state => state.isInitialized);
};