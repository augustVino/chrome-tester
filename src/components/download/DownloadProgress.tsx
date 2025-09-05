import { RefreshCw, X, AlertCircle } from 'lucide-react';
import type { DownloadTask } from '../../types';
import { Button, ProgressBar } from '../ui';

interface DownloadProgressProps {
  task: DownloadTask;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DownloadProgress({ task, onRetry, onRemove }: DownloadProgressProps) {
  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分钟`;
    }
  };

  const getStatusDisplay = () => {
    switch (task.status) {
      case 'Pending':
        return { text: '等待中', variant: 'primary' as const };
      case 'Downloading':
        return { text: '下载中', variant: 'primary' as const };
      case 'Completed':
        return { text: '已完成', variant: 'success' as const };
      case 'Failed':
        return { text: '失败', variant: 'error' as const };
      case 'Retrying':
        return { text: '重试中', variant: 'warning' as const };
      default:
        return { text: '未知', variant: 'primary' as const };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* 头部信息 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-gray-900">
              {task.browser_info.browser_type} {task.browser_info.version}
            </h4>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              status.variant === 'success' ? 'bg-green-100 text-green-800' :
              status.variant === 'error' ? 'bg-red-100 text-red-800' :
              status.variant === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {status.text}
            </span>
          </div>
          
          <p className="text-sm text-gray-500 mt-1">
            {task.browser_info.platform}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center space-x-1 ml-4">
          {task.status === 'Failed' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRetry(task.id)}
              className="text-blue-600 hover:text-blue-700"
              title="重试下载"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(task.id)}
            className="text-gray-400 hover:text-gray-600"
            title="移除任务"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 进度条 */}
      {task.status === 'Downloading' || task.status === 'Pending' || task.status === 'Retrying' ? (
        <div className="space-y-2">
          <ProgressBar
            progress={task.progress}
            variant={status.variant}
            size="md"
            showPercentage={true}
          />
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {formatBytes(task.downloaded_bytes)} / {formatBytes(task.total_bytes)}
            </span>
            {task.estimated_time_remaining && (
              <span>
                剩余时间: {formatTime(task.estimated_time_remaining)}
              </span>
            )}
          </div>
        </div>
      ) : task.status === 'Completed' ? (
        <div className="flex items-center space-x-2 text-sm text-green-600">
          <span>下载完成 - {formatBytes(task.total_bytes)}</span>
        </div>
      ) : task.status === 'Failed' ? (
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>下载失败</span>
            {task.retry_count > 0 && (
              <span className="text-gray-500">
                (已重试 {task.retry_count} 次)
              </span>
            )}
          </div>
          
          {task.error_message && (
            <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              {task.error_message}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}