import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore, useBrowserStore } from '../stores';
import type { DownloadTask } from '../types';

interface DownloadProgressEvent {
  taskId: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  status: string;
  estimatedTimeRemaining?: number;
}

interface DownloadStatusEvent {
  taskId: string;
  status: string;
  progress?: number;
  installPath?: string;
  errorMessage?: string;
}

export function useDownloadEvents() {
  const updateTaskProgress = useDownloadStore(state => state.updateTaskProgress);
  const updateTaskStatus = useDownloadStore(state => state.updateTaskStatus);
  const fetchBrowsers = useBrowserStore(state => state.fetchBrowsers);

  useEffect(() => {
    let progressUnlisten: (() => void) | undefined;
    let statusUnlisten: (() => void) | undefined;

    const setupProgressListener = async () => {
      try {
        progressUnlisten = await listen<DownloadProgressEvent>('download-progress-update', (event) => {
          const { taskId, progress, downloadedBytes, totalBytes } = event.payload;
          
          updateTaskProgress(taskId, progress, downloadedBytes, totalBytes);
          
          // Log progress for debugging
          console.log(`Download Progress Update: ${taskId} - ${(progress * 100).toFixed(1)}%`);
        });
      } catch (error) {
        console.error('Failed to set up download progress listener:', error);
      }
    };

    const setupStatusListener = async () => {
      try {
        statusUnlisten = await listen<DownloadStatusEvent>('download-status-update', async (event) => {
          const { taskId, status, errorMessage } = event.payload;
          
          updateTaskStatus(taskId, status as DownloadTask['status'], errorMessage);
          
          // Log status changes for debugging
          console.log(`Download Status Update: ${taskId} - ${status}`, errorMessage);
          
          // 如果状态更新为下载中，也更新状态
          if (status === 'Downloading') {
            console.log(`Task ${taskId} is now downloading`);
          }
          
          // 如果下载完成，刷新浏览器列表以显示新的浏览器
          if (status === 'Completed') {
            console.log(`Download completed for task ${taskId}, refreshing browser list`);
            try {
              await fetchBrowsers();
              console.log('Browser list refreshed successfully');
            } catch (error) {
              console.error('Failed to refresh browser list:', error);
            }
          }
        });
      } catch (error) {
        console.error('Failed to set up download status listener:', error);
      }
    };

    // Set up listeners
    setupProgressListener();
    setupStatusListener();

    // Cleanup function
    return () => {
      if (progressUnlisten) {
        progressUnlisten();
      }
      if (statusUnlisten) {
        statusUnlisten();
      }
    };
  }, [updateTaskProgress, updateTaskStatus, fetchBrowsers]);

  return {
    // This hook doesn't return any values, it just sets up the listeners
    // You could add status indicators here if needed
  };
}