import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BrowserInfo } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface BrowserState {
  browsers: BrowserInfo[];
  isLoading: boolean;
  error: string | null;
}

interface BrowserActions {
  fetchBrowsers: () => Promise<void>;
  addBrowser: (browser: BrowserInfo) => void;
  updateBrowser: (id: string, updates: Partial<BrowserInfo>) => void;
  deleteBrowser: (id: string) => Promise<void>;
  openBrowser: (id: string, args?: string[]) => Promise<void>;
  clearAllBrowsers: () => Promise<void>;
  clearError: () => void;
  setBrowsers: (browsers: BrowserInfo[]) => void;
}

type BrowserStore = BrowserState & BrowserActions;

export const useBrowserStore = create<BrowserStore>()(
  immer((set) => ({
    // Initial state
    browsers: [],
    isLoading: false,
    error: null,

    // Actions
    fetchBrowsers: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const browsers = await invoke<BrowserInfo[]>('list_browsers');
        set((state) => {
          state.browsers = browsers;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch browsers';
          state.isLoading = false;
        });
      }
    },

    addBrowser: (browser) => {
      set((state) => {
        state.browsers.push(browser);
      });
    },

    updateBrowser: (id, updates) => {
      set((state) => {
        const index = state.browsers.findIndex(b => b.id === id);
        if (index !== -1) {
          state.browsers[index] = { ...state.browsers[index], ...updates };
        }
      });
    },

    deleteBrowser: async (id) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        await invoke('delete_browser', { browserId: id });
        set((state) => {
          state.browsers = state.browsers.filter(b => b.id !== id);
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to delete browser';
          state.isLoading = false;
        });
        throw error;
      }
    },

    openBrowser: async (id, args) => {
      set((state) => {
        state.error = null;
      });

      try {
        await invoke('open_browser', { browserId: id, args });
        
        // Update browser running status
        set((state) => {
          const browser = state.browsers.find(b => b.id === id);
          if (browser) {
            browser.is_running = true;
          }
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to open browser';
        });
        throw error;
      }
    },

    clearAllBrowsers: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        await invoke('clear_all_browsers');
        set((state) => {
          state.browsers = [];
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to clear all browsers';
          state.isLoading = false;
        });
        throw error;
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    setBrowsers: (browsers) => {
      set((state) => {
        state.browsers = browsers;
      });
    }
  }))
);