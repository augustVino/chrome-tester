import type { BrowserInfo, DownloadTask } from '../../types';
import { BrowserList } from '../browser/BrowserList';
import { DownloadManager } from '../download/DownloadManager';

interface MainContentProps {
  browsers: BrowserInfo[];
  downloadTasks: DownloadTask[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onBrowserAction: (action: string, browserId: string) => void;
  onDownloadAction: (action: string, taskId: string) => void;
}

export function MainContent({
  browsers,
  downloadTasks,
  searchQuery,
  sortBy,
  sortOrder,
  onBrowserAction,
  onDownloadAction
}: MainContentProps) {
  return (
    <main className="flex-1 overflow-hidden bg-gray-50">
      <div className="h-full flex flex-col">
        {/* 下载管理区域 - 有任何下载任务时都显示 */}
        {downloadTasks.length > 0 && (
          <div className="flex-shrink-0 bg-white border-b border-gray-200">
            <DownloadManager
              downloadTasks={downloadTasks}
              onDownloadAction={onDownloadAction}
            />
          </div>
        )}

        {/* 浏览器列表区域 */}
        <div className="flex-1 overflow-hidden">
          <BrowserList
            browsers={browsers}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onBrowserAction={onBrowserAction}
          />
        </div>
      </div>
    </main>
  );
}