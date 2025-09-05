import { useEffect } from 'react';
import { useAppStore, useBrowserStore, useDownloadStore, useUIStore } from '../stores';

export function useAppInit() {
  const initializeApp = useAppStore(state => state.initializeApp);
  const fetchBrowsers = useBrowserStore(state => state.fetchBrowsers);
  const fetchDownloadTasks = useDownloadStore(state => state.fetchDownloadTasks);
  const theme = useUIStore(state => state.theme);
  const isInitialized = useAppStore(state => state.isInitialized);

  useEffect(() => {
    // Apply theme on mount
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Initialize app configuration
        await initializeApp();

        if (!mounted) return;

        // Load initial data in parallel
        await Promise.allSettled([
          fetchBrowsers(),
          fetchDownloadTasks(),
        ]);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initializeApp, fetchBrowsers, fetchDownloadTasks]);

  return {
    isInitialized,
  };
}