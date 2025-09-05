import type { BrowserInfo, DownloadTask } from '../../types';
import { Header } from './Header';
import { MainContent } from './MainContent';

interface LayoutProps {
  browsers: BrowserInfo[];
  downloadTasks: DownloadTask[];
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  isLoading: boolean;
  onSearchChange: (query: string) => void;
  onDownload: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onBrowserAction: (action: string, browserId: string) => void;
  onDownloadAction: (action: string, taskId: string) => void;
}

export function Layout({
  browsers,
  downloadTasks,
  searchQuery,
  sortBy,
  sortOrder,
  isLoading,
  onSearchChange,
  onDownload,
  onRefresh,
  onSettings,
  onBrowserAction,
  onDownloadAction
}: LayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 头部 */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onDownload={onDownload}
        onRefresh={onRefresh}
        onSettings={onSettings}
        isLoading={isLoading}
      />

      {/* 主内容区 */}
      <MainContent
        browsers={browsers}
        downloadTasks={downloadTasks}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onBrowserAction={onBrowserAction}
        onDownloadAction={onDownloadAction}
      />
    </div>
  );
}