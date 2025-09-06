import { Search, Download, RefreshCw, Settings } from 'lucide-react';
import { Button, Input } from '../ui';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDownload: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  isLoading?: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  onDownload,
  onRefresh,
  onSettings,
  isLoading = false
}: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* 标题区域 */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-foreground">
            Chrome 版本管理器
          </h1>
        </div>

        {/* 搜索和操作区域 */}
        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          <div className="w-64">
            <Input
              type="text"
              placeholder="搜索版本..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="text-sm"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="md"
              onClick={onDownload}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>下载</span>
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={onSettings}
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>设置</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}