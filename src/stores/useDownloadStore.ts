import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DownloadTask, BrowserType } from '../types';
import { invoke } from '@tauri-apps/api/core';

interface DownloadState {
  downloadTasks: DownloadTask[];
  isLoading: boolean;
  error: string | null;
}

interface DownloadActions {
  startDownload: (browserType: BrowserType, version: string, platform?: string) => Promise<string>;
  retryDownload: (taskId: string) => Promise<void>;
  removeDownloadTask: (taskId: string) => Promise<void>;
  updateTaskProgress: (taskId: string, progress: number, downloadedBytes: number, totalBytes: number) => void;
  updateTaskStatus: (taskId: string, status: DownloadTask['status'], error?: string) => void;
  fetchDownloadTasks: () => Promise<void>;
  clearError: () => void;
  clearCompletedTasks: () => void;
}

type DownloadStore = DownloadState & DownloadActions;

export const useDownloadStore = create<DownloadStore>()(
  immer((set) => ({
    // Initial state
    downloadTasks: [],
    isLoading: false,
    error: null,

    // Actions
    startDownload: async (browserType, version, platform) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      let taskId: string;

      try {
        taskId = await invoke<string>('download_browser', {
          browserType: browserType.toLowerCase(),
          version,
          platform: platform || 'win64' // 默认平台
        });

        // 立即创建前端下载任务记录
        set((state) => {
          state.isLoading = false;
          
          // 添加新的下载任务到前端状态
          const newTask: DownloadTask = {
            id: taskId,
            browser_info: {
              id: taskId,
              browser_type: browserType,
              version,
              platform: platform || 'win64',
              install_path: '',
              executable_path: '',
              download_date: new Date().toISOString(),
              file_size: 0,
              is_running: false
            },
            status: 'Pending',
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            estimated_time_remaining: undefined,
            error_message: undefined,
            retry_count: 0
          };
          
          state.downloadTasks.push(newTask);
        });

        return taskId;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to start download';
          state.isLoading = false;
        });
        throw error;
      }
    },

    retryDownload: async (taskId) => {
      set((state) => {
        state.error = null;
        // Update task status to retrying
        const task = state.downloadTasks.find(t => t.id === taskId);
        if (task) {
          task.status = 'Retrying';
        }
      });

      try {
        await invoke('retry_download', { taskId });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to retry download';
          // Revert status back to failed
          const task = state.downloadTasks.find(t => t.id === taskId);
          if (task) {
            task.status = 'Failed';
          }
        });
        throw error;
      }
    },

    removeDownloadTask: async (taskId) => {
      try {
        await invoke('remove_download_task', { taskId });
        set((state) => {
          state.downloadTasks = state.downloadTasks.filter(t => t.id !== taskId);
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to remove download task';
        });
        throw error;
      }
    },

    updateTaskProgress: (taskId, progress, downloadedBytes, totalBytes) => {
      set((state) => {
        const task = state.downloadTasks.find(t => t.id === taskId);
        if (task) {
          // 避免重复更新相同的进度值
          if (task.progress === progress && 
              task.downloaded_bytes === downloadedBytes && 
              task.total_bytes === totalBytes) {
            return;
          }
          
          console.log(`Updating task ${taskId} progress: ${(progress * 100).toFixed(1)}% (${downloadedBytes}/${totalBytes})`);
          task.progress = progress;
          task.downloaded_bytes = downloadedBytes;
          task.total_bytes = totalBytes;
          task.status = 'Downloading'; // 确保状态为下载中
          
          // Calculate estimated time remaining
          if (progress > 0 && downloadedBytes > 0) {
            const remainingBytes = totalBytes - downloadedBytes;
            const bytesPerSecond = downloadedBytes / (progress * 100); // Rough estimate
            task.estimated_time_remaining = remainingBytes / bytesPerSecond;
          }
        } else {
          console.warn(`Progress update: Task ${taskId} not found in download tasks`);
        }
      });
    },

    updateTaskStatus: (taskId, status, error) => {
      set((state) => {
        const task = state.downloadTasks.find(t => t.id === taskId);
        if (task) {
          // 避免重复更新相同状态
          if (task.status === status) {
            return;
          }
          
          console.log(`Updating task ${taskId} status from ${task.status} to ${status}`);
          task.status = status;
          if (error) {
            task.error_message = error;
          }
          if (status === 'Completed') {
            task.progress = 1.0;
            // 下载完成后停止进度更新
            console.log(`Task ${taskId} completed, stopping progress updates`);
          }
        } else {
          console.warn(`Task ${taskId} not found in download tasks`);
        }
      });
    },

    fetchDownloadTasks: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const tasks = await invoke<DownloadTask[]>('list_download_tasks');
        set((state) => {
          state.downloadTasks = tasks;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch download tasks';
          state.isLoading = false;
        });
      }
    },

    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    clearCompletedTasks: () => {
      set((state) => {
        const completedTasks = state.downloadTasks.filter(t => t.status === 'Completed');
        
        // Remove completed tasks from state
        state.downloadTasks = state.downloadTasks.filter(t => t.status !== 'Completed');
        
        // Also remove them from backend (async)
        completedTasks.forEach(async (task) => {
          try {
            await invoke('remove_download_task', { taskId: task.id });
          } catch (error) {
            console.error('Failed to remove completed task:', error);
          }
        });
      });
    }
  }))
);