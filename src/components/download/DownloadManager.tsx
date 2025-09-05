import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { DownloadTask } from '../../types';
import { DownloadProgress } from './DownloadProgress';
import { Button } from '../ui';

interface DownloadManagerProps {
  downloadTasks: DownloadTask[];
  onDownloadAction: (action: string, taskId: string) => void;
}

export function DownloadManager({ downloadTasks, onDownloadAction }: DownloadManagerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeDownloads = downloadTasks.filter(
    task => task.status === 'Downloading' || task.status === 'Pending' || task.status === 'Retrying'
  );

  const failedDownloads = downloadTasks.filter(task => task.status === 'Failed');
  const completedDownloads = downloadTasks.filter(task => task.status === 'Completed');

  const totalProgress = activeDownloads.length > 0 
    ? activeDownloads.reduce((sum, task) => sum + task.progress, 0) / activeDownloads.length 
    : 0;

  const handleRetry = (taskId: string) => {
    onDownloadAction('retry', taskId);
  };

  const handleRemove = (taskId: string) => {
    onDownloadAction('remove', taskId);
  };

  if (downloadTasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-200">
      {/* 头部 */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Download className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">下载管理器</h3>
              <p className="text-sm text-gray-500">
                {activeDownloads.length > 0 && (
                  <>
                    {activeDownloads.length} 个任务进行中
                    {totalProgress > 0 && (
                      <span className="ml-2">
                        - 总体进度 {Math.round(totalProgress * 100)}%
                      </span>
                    )}
                  </>
                )}
                {failedDownloads.length > 0 && (
                  <span className="text-red-600 ml-2">
                    {failedDownloads.length} 个失败
                  </span>
                )}
                {completedDownloads.length > 0 && (
                  <span className="text-green-600 ml-2">
                    {completedDownloads.length} 个已完成
                  </span>
                )}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>收起</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>展开</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 任务列表 */}
      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {/* 活动下载任务 */}
            {activeDownloads.map((task) => (
              <DownloadProgress
                key={task.id}
                task={task}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}

            {/* 失败的下载任务 */}
            {failedDownloads.map((task) => (
              <DownloadProgress
                key={task.id}
                task={task}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}

            {/* 最近完成的任务（只显示最近3个） */}
            {completedDownloads.slice(0, 3).map((task) => (
              <DownloadProgress
                key={task.id}
                task={task}
                onRetry={handleRetry}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* 底部操作 */}
          {(failedDownloads.length > 0 || completedDownloads.length > 3) && (
            <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
              {failedDownloads.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    failedDownloads.forEach(task => handleRetry(task.id));
                  }}
                  className="mr-2"
                >
                  重试全部失败任务
                </Button>
              )}
              
              {completedDownloads.length > 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    completedDownloads.forEach(task => handleRemove(task.id));
                  }}
                  className="text-gray-500"
                >
                  清除已完成任务
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}